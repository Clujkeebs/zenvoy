// A business owner replies on a proof page.
//
// The visitor has no account. The proof token is the credential: we recompute
// its hash and read the owner id from that signed document, not from a field
// the visitor can set on their own. The note is stored for the freelancer.
// Nothing is emailed to the business. If the freelancer opted into the daily
// note and mail is configured, a copy can go to profiles.email only.
//
// Deploy: supabase functions deploy audit-interest
// Gateway: verify_jwt = false (see supabase/config.toml).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { decodeProof, verifyProof } from "../../../src/utils/proof.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
const PER_OWNER = 20;
const PER_CODE = 5;

async function emailFreelancer(to: string, subject: string, text: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("DIGEST_FROM") || "";
  if (!key || !from || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Body must be JSON" }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  const fromName = typeof body.fromName === "string" ? body.fromName.trim().slice(0, 80) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!fromName) return json(req, { error: "Add your name." }, 400);

  const doc = decodeProof(token);
  if (!doc) return json(req, { error: "This link is not a report." }, 400);
  const check = await verifyProof(doc);
  if (!check.ok) return json(req, { error: "This report was edited after it was signed." }, 400);
  if (doc.sample || !doc.ownerId || !UUID.test(String(doc.ownerId))) {
    return json(req, { error: "This report cannot reach a desk." }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ownerId = String(doc.ownerId);
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, name, digest_opt_in")
    .eq("id", ownerId)
    .maybeSingle();
  if (profileErr) {
    console.error("audit-interest profile failed:", profileErr.message);
    return json(req, { error: "The inbox is not set up yet." }, 503);
  }
  if (!profile) return json(req, { error: "This report cannot reach a desk." }, 404);

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const ownerCount = await supabase
    .from("audit_interest")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .gte("created_at", since);
  const codeCount = await supabase
    .from("audit_interest")
    .select("id", { count: "exact", head: true })
    .eq("proof_code", doc.code)
    .gte("created_at", since);
  if (ownerCount.error || codeCount.error) {
    const message = ownerCount.error?.message || codeCount.error?.message || "";
    console.error("audit-interest count failed:", message);
    return json(req, { error: "The inbox is not set up yet." }, 503);
  }
  if ((ownerCount.count || 0) >= PER_OWNER || (codeCount.count || 0) >= PER_CODE) {
    return json(req, { error: "Too many notes on this report today. Try again tomorrow." }, 429);
  }

  const businessName = String(doc.name || "A measured business").slice(0, 120);
  const { error: insertErr } = await supabase.from("audit_interest").insert({
    user_id: ownerId,
    business_name: businessName,
    from_name: fromName,
    note,
    proof_code: doc.code,
  });
  if (insertErr) {
    console.error("audit-interest insert failed:", insertErr.message);
    return json(req, { error: "The note was not saved." }, 500);
  }

  const bodyText = note
    ? `${fromName} wrote about ${businessName}: ${note}`
    : `${fromName} asked about ${businessName}. They did not leave a note.`;
  await supabase.from("desk_notices").insert({
    user_id: ownerId,
    kind: "interest",
    title: `${fromName} asked about ${businessName}`,
    body: bodyText,
    business_name: businessName,
  });

  if (profile.digest_opt_in && profile.email) {
    const text = `${bodyText}\n\nThis note is for you. It was not sent to any business.`;
    await emailFreelancer(profile.email, `Zenvylo desk — ${fromName} asked about ${businessName}`, text);
  }

  return json(req, { ok: true });
});
