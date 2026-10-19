// Scheduled re-check of saved prospect websites.
//
// pg_cron calls this once a day. It measures a small batch of websites the
// user already saved, diffs them against the stored measurement, and appends
// watch_log only when something actually changed. The first measurement of a
// site is not a change. This does not use a scan credit and it does not send
// email.
//
// Deploy: supabase functions deploy recheck-saved
// Secret: RECHECK_CRON_SECRET if set, otherwise the Vault value
// recheck_cron_secret (see 20261019132911_recheck_secret_from_vault.sql).
// The cron job is scheduled by 20261019130555_recheck_saved_prospects.sql.
// Do not put the secret in git.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { measureSite } from "../_shared/measure.ts";
import { pickRecheckBatch, RECHECK_STALE_MS } from "../_shared/recheckQueue.js";
import { applyRescan } from "../../../src/utils/watch.js";
import { secretsMatch } from "../_shared/cronAuth.js";
import { resolveCronSecret } from "../_shared/cronSecret.js";

const CANDIDATES = 40;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const expected = await resolveCronSecret(Deno.env.get("RECHECK_CRON_SECRET") || "", async () => {
    const { data, error } = await supabase.rpc("read_recheck_cron_secret");
    if (error) {
      console.error("cron secret lookup failed:", error.message);
      return "";
    }
    return data;
  });
  const got = req.headers.get("x-recheck-secret") || "";
  if (!secretsMatch(got, expected)) {
    return json(req, { error: "Unauthorized" }, 401);
  }

  const cutoff = new Date(Date.now() - RECHECK_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("id,name,phone,website,status,service_id,site_measurement,findings,score,ssl,speed,problems,watch_log,last_watch_at")
    .not("website", "is", null)
    .or(`status.is.null,status.neq.lost`)
    .or(`last_watch_at.is.null,last_watch_at.lt.${cutoff}`)
    .order("last_watch_at", { ascending: true, nullsFirst: true })
    .limit(CANDIDATES);

  if (error) {
    console.error("recheck query failed:", error.message);
    return json(req, { error: "Could not read saved leads" }, 500);
  }

  const batch = pickRecheckBatch((data || []).map((row: Record<string, any>) => ({
    ...row,
    serviceId: row.service_id,
    siteMeasurement: row.site_measurement,
    watchLog: row.watch_log || [],
    lastWatchAt: row.last_watch_at,
  })));

  let changed = 0;
  let failed = 0;
  for (const lead of batch) {
    try {
      const measurement = await measureSite(lead.website);
      const next = applyRescan(lead, measurement);
      if ((next.watchLog || []).length > (lead.watchLog || []).length) changed += 1;
      const { error: writeErr } = await supabase
        .from("leads")
        .update({
          site_measurement: next.siteMeasurement,
          findings: next.findings,
          score: next.score,
          audited_at: next.auditedAt,
          ssl: next.ssl,
          speed: next.speed,
          problems: next.problems,
          watch_log: next.watchLog,
          last_watch_at: next.lastWatchAt,
        })
        .eq("id", lead.id);
      if (writeErr) {
        failed += 1;
        console.error("recheck write failed:", lead.id, writeErr.message);
      }
    } catch (err) {
      failed += 1;
      console.error("recheck measure failed:", lead.id, err);
      // Remember the attempt so one broken site does not fill every batch.
      // No watch entry is written, because there is no new measurement.
      await supabase.from("leads").update({
        last_watch_at: new Date().toISOString(),
      }).eq("id", lead.id);
    }
  }

  return json(req, { ok: true, checked: batch.length, changed, failed });
});
