// Supabase Edge Function — audit-site
//
// Measures real websites and returns observed facts. This is the function that
// makes Zenvylo something a chat assistant can't replace: it actually fetches
// the prospect's site and reports what's there.
//
// POST { urls: string[] }            → measure up to 24 sites (scan pipeline)
// POST { url: string, leadId?: uuid } → re-measure one site (refresh button)
//
// Deploy: supabase functions deploy audit-site

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight, requireUser, AuthError } from "../_shared/http.ts";
import { measureAll, measureSite } from "../_shared/measure.ts";

const MAX_URLS = 24;

// Measuring costs us egress and time, so it gets a rate limit of its own.
const LIMIT_PER_MINUTE = 6;
const LIMIT_PER_DAY = 200;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let profile;
  try {
    profile = await requireUser(req, supabase);
  } catch (err) {
    if (err instanceof AuthError) return json(req, { error: err.message }, err.status);
    throw err;
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Body must be JSON" }, 400);
  }

  const single = typeof body.url === "string" ? body.url : null;
  const many = Array.isArray(body.urls) ? body.urls.filter((u: unknown) => typeof u === "string") : null;

  if (!single && (!many || many.length === 0)) {
    return json(req, { error: "Provide `url` or a non-empty `urls` array" }, 400);
  }

  const { data: rate, error: rateErr } = await supabase.rpc("record_ai_call", {
    p_user_id: profile.id,
    p_task: "audit_site",
    p_limit_minute: LIMIT_PER_MINUTE,
    p_limit_day: LIMIT_PER_DAY,
  });
  if (rateErr) {
    console.error("record_ai_call failed:", rateErr.message);
    return json(req, { error: "Usage tracking unavailable, try again shortly." }, 503);
  }
  if (rate && rate.allowed === false) {
    return json(req, {
      error: rate.reason === "minute"
        ? "Too many audits at once — wait a moment."
        : "Daily audit limit reached. It resets at midnight UTC.",
      retryAfter: rate.retry_after_seconds ?? 60,
    }, 429);
  }

  try {
    if (single) {
      const measurement = await measureSite(single);

      // Persist onto the lead when the caller owns it, so a refreshed audit
      // survives a page reload. RLS is bypassed here (service role), hence the
      // explicit ownership filter.
      if (body.leadId) {
        await supabase
          .from("leads")
          .update({
            site_measurement: measurement,
            audited_at: measurement.measuredAt,
          })
          .eq("id", body.leadId)
          .eq("user_id", profile.id);
      }

      return json(req, { measurement });
    }

    const urls = many!.slice(0, MAX_URLS);
    const measurements = await measureAll(urls);
    return json(req, { measurements });
  } catch (err) {
    console.error("audit-site failed:", err);
    return json(req, { error: "Measurement failed" }, 500);
  }
});
