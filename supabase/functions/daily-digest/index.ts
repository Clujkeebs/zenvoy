// Morning note for freelancers who opted in.
//
// pg_cron calls this once a day. It writes a desk_notices row when a saved
// site changed or a follow-up date is due. Email goes only to profiles.email,
// and only when RESEND_API_KEY and DIGEST_FROM are set. Lead emails are not
// read and are not mailed.
//
// Deploy: supabase functions deploy daily-digest
// Auth: the same RECHECK_CRON_SECRET as recheck-saved, header x-recheck-secret.
// See the unapplied migration 20261019044856_desk_notices_and_digest.sql.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { buildDailyDigest } from "../_shared/digest.js";
import { secretsMatch } from "../_shared/cronAuth.js";
import { emailFreelancer } from "../_shared/mail.js";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const expected = Deno.env.get("RECHECK_CRON_SECRET") || "";
  const got = req.headers.get("x-recheck-secret") || "";
  if (!secretsMatch(got, expected)) {
    return json(req, { error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("digest_opt_in", true);

  if (error) {
    console.error("digest profiles failed:", error.message);
    return json(req, { error: "Could not read opt-in accounts" }, 500);
  }

  let noticed = 0;
  let emailed = 0;
  let skipped = 0;

  for (const profile of profiles || []) {
    const { data: leads, error: leadErr } = await supabase
      .from("leads")
      .select("name, status, watch_log, follow_up_date")
      .eq("user_id", profile.id);
    if (leadErr) {
      console.error("digest leads failed:", leadErr.message);
      continue;
    }

    const digest = buildDailyDigest(leads || [], Date.now(), profile.name || "");
    if (!digest) {
      skipped += 1;
      continue;
    }

    const title = digest.changes
      ? `Zenvylo desk — ${digest.changes} measured change${digest.changes === 1 ? "" : "s"}`
      : "Zenvylo desk — follow-ups due";

    const { error: noteErr } = await supabase.from("desk_notices").insert({
      user_id: profile.id,
      kind: "digest",
      title,
      body: digest.text,
    });
    if (noteErr) {
      console.error("digest notice failed:", noteErr.message);
      continue;
    }
    noticed += 1;

    if (profile.email && await emailFreelancer({
      to: profile.email,
      subject: title,
      text: digest.text,
      key: Deno.env.get("RESEND_API_KEY") || "",
      from: Deno.env.get("DIGEST_FROM") || "",
    })) {
      emailed += 1;
    }
  }

  return json(req, { noticed, emailed, skipped });
});
