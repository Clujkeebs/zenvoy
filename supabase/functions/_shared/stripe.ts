// ─── Stripe helpers shared by edge functions ────────────────────────────
// Signature verification implemented with Web Crypto so we don't need to
// pull in the Stripe SDK (keeps the function cold-start small).

const encoder = new TextEncoder()

/** Constant-time comparison — avoids leaking byte position via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
}

export class StripeSignatureError extends Error {}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 *
 * Mirrors Stripe's documented scheme: the `Stripe-Signature` header carries
 * `t=<unix-ts>` plus one or more `v1=<hex hmac>` values, where the HMAC is
 * computed over `<t>.<raw body>` with the endpoint's signing secret.
 *
 * @param rawBody   The request body as an untouched string. Must NOT be
 *                  re-serialised from JSON — key order would change and the
 *                  signature would never match.
 * @param header    Value of the `Stripe-Signature` request header.
 * @param secret    `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`).
 * @param toleranceSeconds Reject events older than this to blunt replays.
 */
export async function verifyStripeEvent(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<Record<string, unknown>> {
  if (!header) throw new StripeSignatureError("Missing Stripe-Signature header")
  if (!secret) throw new StripeSignatureError("STRIPE_WEBHOOK_SECRET not configured")

  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=")
    if (k === "t") timestamp = v
    else if (k === "v1" && v) signatures.push(v)
  }

  if (!timestamp) throw new StripeSignatureError("No timestamp in signature header")
  if (signatures.length === 0) throw new StripeSignatureError("No v1 signature in header")

  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(age)) throw new StripeSignatureError("Malformed timestamp")
  if (Math.abs(age) > toleranceSeconds) {
    throw new StripeSignatureError(`Event timestamp outside tolerance (${age}s)`)
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
  // Stripe may send several v1 values during a secret rotation — any match is valid.
  if (!signatures.some(sig => timingSafeEqual(sig, expected))) {
    throw new StripeSignatureError("Signature mismatch")
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw new StripeSignatureError("Body is not valid JSON")
  }
}

/** POST form-encoded params to the Stripe REST API. */
export async function stripeApi(
  path: string,
  secretKey: string,
  params: URLSearchParams,
): Promise<Record<string, any>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })
  return await res.json()
}
