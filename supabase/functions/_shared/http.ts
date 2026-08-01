// ─── Shared HTTP / auth helpers for edge functions ──────────────────────

/**
 * Allowed browser origins. Set ALLOWED_ORIGINS to a comma-separated list in
 * production (e.g. "https://zenvylo.com,https://www.zenvylo.com").
 * Falls back to "*" only when unset, so local dev keeps working.
 */
function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
}

export function corsHeaders(req: Request): Record<string, string> {
  const list = allowedOrigins()
  const origin = req.headers.get("Origin") || ""
  const allow = list.length === 0
    ? "*"
    : (list.includes(origin) ? origin : list[0])

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  })
}

export function preflight(req: Request): Response {
  return new Response(null, { headers: corsHeaders(req) })
}

export interface AuthedProfile {
  id: string
  email: string
  name: string
  plan: string
  role: string
  country: string
  banned: boolean
  trial_end: string | null
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

/**
 * Resolve the caller's profile from their Supabase JWT.
 *
 * The anon key is public by definition (it ships in the client bundle), so the
 * platform's own JWT gate proves nothing about *who* is calling. Every function
 * that spends money or touches other users' data must call this.
 */
export async function requireUser(req: Request, supabase: any): Promise<AuthedProfile> {
  const header = req.headers.get("Authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token) throw new AuthError("Missing bearer token")

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new AuthError("Invalid or expired session")

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, name, plan, role, country, banned, trial_end")
    .eq("id", user.id)
    .maybeSingle()

  if (pErr) throw new AuthError("Could not load profile", 500)
  if (!profile) throw new AuthError("No profile for this account", 403)
  if (profile.banned) throw new AuthError("This account is suspended", 403)

  return profile as AuthedProfile
}

const AI_PLANS = new Set(["pro", "scale", "enterprise"])

/** Server-side truth for "can this account use AI features". */
export function planAllowsAI(profile: AuthedProfile): boolean {
  if (profile.role === "owner") return true
  if (AI_PLANS.has(profile.plan)) return true
  // An active trial grants Pro-level access.
  if (profile.trial_end && new Date(profile.trial_end).getTime() > Date.now()) return true
  return false
}
