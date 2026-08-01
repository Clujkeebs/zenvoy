// Supabase Edge Function — admin-actions
//
// Every privileged admin operation, in one authenticated place.
//
// This exists because the admin dashboard was calling saveUser(email, …), and
// saveUser ignored its email argument and wrote to the *caller's own* row. So
// banning a user banned the admin, and changing someone's plan changed the
// admin's plan. There was also no server-side check that the caller was an
// admin at all — the client simply hid the nav item.
//
// Now: the caller's role is verified here, the target is addressed explicitly,
// and every action writes an admin_actions audit row.
//
// Deploy: supabase functions deploy admin-actions

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight, requireUser, AuthError, type AuthedProfile } from "../_shared/http.ts";

const VALID_PLANS = new Set(["free", "starter", "growth", "pro", "scale", "enterprise"]);
const VALID_ROLES = new Set(["user", "moderator", "admin", "owner"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let actor: AuthedProfile;
  try {
    actor = await requireUser(req, supabase);
  } catch (err) {
    if (err instanceof AuthError) return json(req, { error: err.message }, err.status);
    throw err;
  }

  const isOwner = actor.role === "owner";
  const isAdmin = isOwner || actor.role === "admin";
  if (!isAdmin) {
    return json(req, { error: "Admin access required" }, 403);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Body must be JSON" }, 400);
  }

  const action = String(body.action || "");
  const targetId = body.targetId ? String(body.targetId) : "";

  // ─── Resolve the target explicitly ────────────────────────────────────
  let target: { id: string; email: string; role: string; plan: string } | null = null;
  if (targetId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, role, plan")
      .eq("id", targetId)
      .maybeSingle();
    if (!data) return json(req, { error: "Target user not found" }, 404);
    target = data;
  }

  /** Actions that would let an admin dismantle the account hierarchy. */
  function guardTarget(): string | null {
    if (!target) return "Missing targetId";
    if (target.id === actor.id) return "You can't apply admin actions to your own account";
    if (target.role === "owner" && !isOwner) return "Only the owner can modify the owner account";
    return null;
  }

  const audit = async (detail: Record<string, unknown>) => {
    await supabase.from("admin_actions").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      target_id: target?.id ?? null,
      target_email: target?.email ?? null,
      detail,
    });
  };

  try {
    switch (action) {
      case "set_role": {
        const err = guardTarget();
        if (err) return json(req, { error: err }, 403);

        const role = String(body.role || "");
        if (!VALID_ROLES.has(role)) return json(req, { error: "Invalid role" }, 400);
        // Handing out admin (or owner) is an owner-only power.
        if ((role === "admin" || role === "owner") && !isOwner) {
          return json(req, { error: "Only the owner can grant admin or owner" }, 403);
        }
        if (role === "owner" && target!.role !== "owner") {
          return json(req, { error: "There can only be one owner account" }, 400);
        }

        await supabase.from("profiles").update({ role }).eq("id", target!.id);
        await audit({ from: target!.role, to: role });
        return json(req, { ok: true, role });
      }

      case "ban":
      case "unban": {
        const err = guardTarget();
        if (err) return json(req, { error: err }, 403);

        const banned = action === "ban";
        const updates: Record<string, unknown> = { banned };
        // Strip elevated roles on the way out.
        if (banned && target!.role !== "user") updates.role = "user";

        await supabase.from("profiles").update(updates).eq("id", target!.id);
        await audit({ banned, previousRole: target!.role });
        return json(req, { ok: true, banned });
      }

      case "change_plan": {
        const err = guardTarget();
        if (err) return json(req, { error: err }, 403);

        const plan = String(body.plan || "");
        if (!VALID_PLANS.has(plan)) return json(req, { error: "Invalid plan" }, 400);

        // A manual plan grant is not a subscription — clear any trial window so
        // the client doesn't show a countdown that Stripe knows nothing about.
        await supabase.from("profiles").update({
          plan,
          trial_end: null,
          scans_used: 0,
          scans_reset_at: new Date().toISOString(),
        }).eq("id", target!.id);

        await audit({ from: target!.plan, to: plan, manual: true });
        return json(req, { ok: true, plan });
      }

      case "grant_scans": {
        const err = guardTarget();
        if (err) return json(req, { error: err }, 403);

        const amount = Number(body.amount);
        if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) {
          return json(req, { error: "Amount must be a non-zero integer up to 1000" }, 400);
        }

        const { data: cur } = await supabase
          .from("profiles").select("bonus_scans").eq("id", target!.id).single();
        const next = Math.max(0, (cur?.bonus_scans || 0) + amount);

        await supabase.from("profiles").update({ bonus_scans: next }).eq("id", target!.id);
        await audit({ delta: amount, from: cur?.bonus_scans || 0, to: next });
        return json(req, { ok: true, bonusScans: next });
      }

      case "reset_scans": {
        const err = guardTarget();
        if (err) return json(req, { error: err }, 403);

        await supabase.from("profiles").update({
          scans_used: 0,
          scans_reset_at: new Date().toISOString(),
        }).eq("id", target!.id);
        await audit({ reset: true });
        return json(req, { ok: true });
      }

      case "resolve_report": {
        const reportId = String(body.reportId || "");
        if (!reportId) return json(req, { error: "Missing reportId" }, 400);
        await supabase.from("reports").update({
          status: String(body.status || "resolved"),
          resolved_by: actor.id,
          resolved_at: new Date().toISOString(),
        }).eq("id", reportId);
        await audit({ reportId, status: body.status || "resolved" });
        return json(req, { ok: true });
      }

      // ── Affiliates ────────────────────────────────────────────────────
      case "create_affiliate": {
        if (!target) return json(req, { error: "Missing targetId" }, 400);
        const type = body.type === "scans" ? "scans" : "payment";
        const promoCode = String(body.promoCode || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (promoCode.length < 3) return json(req, { error: "Promo code too short" }, 400);

        const rate = type === "payment" ? Number(body.commissionRate ?? 50) : 0;
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
          return json(req, { error: "Commission rate must be 0-100" }, 400);
        }

        const { data, error } = await supabase.from("affiliates").insert({
          user_id: target.id,
          name: body.name ?? null,
          email: target.email,
          promo_code: promoCode,
          type,
          commission_rate: rate,
          status: "active",
        }).select().single();

        if (error) {
          return json(req, {
            error: error.code === "23505" ? "That promo code is already taken" : error.message,
          }, 400);
        }
        await audit({ affiliateId: data.id, promoCode, type, rate });
        return json(req, { ok: true, affiliate: data });
      }

      case "update_affiliate": {
        const affiliateId = String(body.affiliateId || "");
        if (!affiliateId) return json(req, { error: "Missing affiliateId" }, 400);

        const updates: Record<string, unknown> = {};
        if (body.status && ["active", "paused", "banned"].includes(body.status)) {
          updates.status = body.status;
        }
        if (body.commissionRate != null) {
          const rate = Number(body.commissionRate);
          if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            return json(req, { error: "Commission rate must be 0-100" }, 400);
          }
          updates.commission_rate = rate;
        }
        if (Object.keys(updates).length === 0) {
          return json(req, { error: "Nothing to update" }, 400);
        }

        await supabase.from("affiliates").update(updates).eq("id", affiliateId);
        await audit({ affiliateId, updates });
        return json(req, { ok: true });
      }

      case "mark_payout": {
        if (!isOwner) return json(req, { error: "Only the owner can record payouts" }, 403);
        const affiliateId = String(body.affiliateId || "");
        if (!affiliateId) return json(req, { error: "Missing affiliateId" }, 400);

        const { data: aff } = await supabase
          .from("affiliates").select("pending_payout, paid_total").eq("id", affiliateId).single();
        if (!aff) return json(req, { error: "Affiliate not found" }, 404);

        const paid = Number(aff.pending_payout) || 0;
        await supabase.from("affiliates").update({
          pending_payout: 0,
          paid_total: (Number(aff.paid_total) || 0) + paid,
          last_payout_at: new Date().toISOString(),
        }).eq("id", affiliateId);

        await supabase.from("affiliate_conversions")
          .update({ status: "paid" })
          .eq("affiliate_id", affiliateId)
          .eq("status", "pending");

        await audit({ affiliateId, amount: paid });
        return json(req, { ok: true, paid });
      }

      default:
        return json(req, { error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (err) {
    console.error("admin-actions failed:", action, err);
    return json(req, { error: "Action failed" }, 500);
  }
});
