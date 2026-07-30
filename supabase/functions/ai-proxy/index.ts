// Supabase Edge Function — AI Proxy
//
// Calls Claude server-side so the API key never reaches the browser.
//
// This function used to accept an arbitrary `prompt` from the client with no
// authentication, which made it a free general-purpose LLM billed to us. It now
// takes a task name plus typed params and builds the prompt server-side, behind
// auth, plan checks and rate limits.
//
// Deploy: supabase functions deploy ai-proxy
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          supabase secrets set ALLOWED_ORIGINS=https://your-domain.com

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight, requireUser, planAllowsAI, AuthError } from "../_shared/http.ts";
import { buildPrompt } from "../_shared/prompts.ts";

const MODEL = "claude-haiku-4-5-20251001";
const HARD_TOKEN_CAP = 4000;

// Per-user ceilings. Generous for real use, ruinous for a scraper.
const LIMIT_PER_MINUTE = 12;
const LIMIT_PER_DAY = 400;

// Tasks that don't need a paid plan — the scan pipeline itself runs for
// everyone, since a Free user still needs their 3 scans to produce leads.
const FREE_TASKS = new Set(["lead_analysis"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json(req, { error: "AI is not configured on this deployment." }, 503);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ─── Who's calling ────────────────────────────────────────────────────
  let profile;
  try {
    profile = await requireUser(req, supabase);
  } catch (err) {
    if (err instanceof AuthError) return json(req, { error: err.message }, err.status);
    throw err;
  }

  // ─── What are they asking for ─────────────────────────────────────────
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Body must be JSON" }, 400);
  }

  const task = String(body.task || "");
  const spec = buildPrompt(task, body.params || {});
  if (!spec) {
    return json(req, { error: `Unknown task: ${task || "(none)"}` }, 400);
  }

  // ─── Entitlement, checked server-side ─────────────────────────────────
  if (!FREE_TASKS.has(task) && !planAllowsAI(profile)) {
    return json(req, {
      error: "This feature is on the Pro plan and above.",
      upgrade: "pro",
    }, 402);
  }

  // ─── Rate limit ───────────────────────────────────────────────────────
  const { data: rate, error: rateErr } = await supabase.rpc("record_ai_call", {
    p_user_id: profile.id,
    p_task: task,
    p_limit_minute: LIMIT_PER_MINUTE,
    p_limit_day: LIMIT_PER_DAY,
  });

  if (rateErr) {
    // Fail closed: if we can't account for usage, we don't spend money.
    console.error("record_ai_call failed:", rateErr.message);
    return json(req, { error: "Usage tracking unavailable, try again shortly." }, 503);
  }
  if (rate && rate.allowed === false) {
    return json(req, {
      error: rate.reason === "minute"
        ? "You're going a bit fast — wait a moment and try again."
        : "Daily AI limit reached. It resets at midnight UTC.",
      retryAfter: rate.retry_after_seconds ?? 60,
    }, 429);
  }

  // ─── Call Claude ──────────────────────────────────────────────────────
  const maxTokens = Math.min(spec.maxTokens, HARD_TOKEN_CAP);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: spec.prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("Anthropic fetch failed:", err);
    return json(req, { error: "AI service unreachable. Try again." }, 502);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Don't leak upstream error detail to the browser; log it instead.
    console.error("Anthropic error", res.status, err);
    const status = res.status === 429 || res.status === 529 ? 429 : 502;
    return json(req, {
      error: status === 429
        ? "AI is busy right now — try again in a few seconds."
        : "AI request failed.",
    }, status);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  // Best-effort usage accounting; never block the response on it.
  supabase.rpc("record_ai_tokens", {
    p_user_id: profile.id,
    p_input: data.usage?.input_tokens ?? 0,
    p_output: data.usage?.output_tokens ?? 0,
  }).then(undefined, () => {});

  return json(req, { text });
});
