import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyStripeEvent, StripeSignatureError } from "../_shared/stripe.ts";

// Webhook handler — called by Stripe when subscription events happen.
//
// Deploy WITHOUT the JWT gate (Stripe can't present a Supabase JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets:
//   STRIPE_WEBHOOK_SECRET  — from Stripe Dashboard → Webhooks → your endpoint
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected automatically)
//
// Events to subscribe to: customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted,
//   invoice.payment_succeeded, checkout.session.completed

const VALID_PLANS = new Set(["free", "starter", "growth", "pro", "scale", "enterprise"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read the body as raw text — re-serialising would break the HMAC.
  const rawBody = await req.text();

  let event: Record<string, any>;
  try {
    event = await verifyStripeEvent(
      rawBody,
      req.headers.get("Stripe-Signature"),
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
    );
  } catch (err) {
    if (err instanceof StripeSignatureError) {
      // 400 tells Stripe not to retry — this payload is not from Stripe.
      console.warn("Rejected webhook:", err.message);
      return json({ error: "Invalid signature" }, 400);
    }
    throw err;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const eventId = String(event.id || "");
  const type = String(event.type || "");
  const obj = (event.data as any)?.object ?? {};

  // ─── Idempotency ──────────────────────────────────────────────────────
  // Stripe retries on any non-2xx and can deliver the same event twice.
  // The primary key on stripe_events makes replays a no-op.
  if (eventId) {
    const { error: dupErr } = await supabase
      .from("stripe_events")
      .insert({ id: eventId, type });
    if (dupErr) {
      // 23505 = unique violation → we've already handled this event.
      if (dupErr.code === "23505") return json({ received: true, duplicate: true });
      console.error("stripe_events insert failed:", dupErr.message);
    }
  }

  try {
    switch (type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const uid = await resolveUserId(supabase, obj);
        const plan = String(obj.metadata?.plan || "");
        if (!uid) { console.warn("No user for subscription", obj.id); break; }
        if (!VALID_PLANS.has(plan)) { console.warn("Unknown plan in metadata:", plan); break; }

        const status = String(obj.status || "");
        const entitled = status === "active" || status === "trialing";

        const updates: Record<string, unknown> = {
          plan: entitled ? plan : "free",
          stripe_subscription_id: obj.id,
          subscription_status: status,
          scans_used: 0,
          scans_reset_at: new Date().toISOString(),
        };

        if (status === "trialing" && obj.trial_end) {
          updates.trial_end = new Date(obj.trial_end * 1000).toISOString();
          updates.trial_started = new Date().toISOString();
        } else {
          // Left the trial (converted or lapsed) — clear the window so the
          // client stops showing a trial banner.
          updates.trial_end = null;
        }

        await supabase.from("profiles").update(updates).eq("id", uid);
        break;
      }

      case "customer.subscription.deleted": {
        const uid = await resolveUserId(supabase, obj);
        if (!uid) break;
        await supabase.from("profiles").update({
          plan: "free",
          stripe_subscription_id: null,
          subscription_status: "canceled",
          trial_end: null,
          scans_used: 0,
          scans_reset_at: new Date().toISOString(),
        }).eq("id", uid);
        break;
      }

      case "invoice.payment_succeeded": {
        // Monthly renewal — reset the scan allowance for the new period.
        const subId = obj.subscription;
        if (!subId) break;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, plan, referred_by_affiliate")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();
        if (!profile) break;

        await supabase.from("profiles").update({
          scans_used: 0,
          scans_reset_at: new Date().toISOString(),
        }).eq("id", profile.id);

        // Affiliate commission — recorded here rather than in the browser, so
        // it reflects money that actually arrived.
        const amountUsd = (Number(obj.amount_paid) || 0) / 100;
        if (profile.referred_by_affiliate && amountUsd > 0) {
          await creditAffiliate(
            supabase,
            profile.referred_by_affiliate,
            profile,
            amountUsd,
            // First invoice of a subscription is the upgrade; later ones rebill.
            obj.billing_reason === "subscription_create" ? "upgrade" : "rebill",
          );
        }
        break;
      }

      case "checkout.session.completed": {
        // One-time scan packs — subscriptions are handled by the events above.
        if (obj.mode !== "payment") break;
        const uid = obj.metadata?.supabase_uid;
        const packScans = Number(obj.metadata?.pack_scans || 0);
        if (!uid || !packScans) break;
        await supabase.rpc("add_bonus_scans", { p_user_id: uid, p_amount: packScans });
        break;
      }

      default:
        // Unhandled event types are fine — acknowledge so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", type, err);
    // 500 makes Stripe retry. The idempotency row is already written, so clear
    // it to let the retry actually re-run the handler.
    if (eventId) await supabase.from("stripe_events").delete().eq("id", eventId);
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Find the Supabase user for a subscription. Prefers the metadata we set at
 * checkout, then falls back to the Stripe customer id — metadata is absent on
 * subscriptions created outside our checkout flow (e.g. from the Dashboard).
 */
async function resolveUserId(supabase: any, obj: any): Promise<string | null> {
  const fromMeta = obj?.metadata?.supabase_uid;
  if (fromMeta) return String(fromMeta);
  if (!obj?.customer) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", obj.customer)
    .maybeSingle();
  return data?.id ?? null;
}

async function creditAffiliate(
  supabase: any,
  affiliateId: string,
  profile: { id: string; email: string; plan: string },
  amountUsd: number,
  eventType: "upgrade" | "rebill",
) {
  const { data: aff } = await supabase
    .from("affiliates")
    .select("id, commission_rate, type, status")
    .eq("id", affiliateId)
    .maybeSingle();
  if (!aff || aff.status !== "active" || aff.type !== "payment") return;

  const commission = Math.round(amountUsd * ((aff.commission_rate || 0) / 100) * 100) / 100;

  await supabase.from("affiliate_conversions").insert({
    affiliate_id: aff.id,
    referred_user_id: profile.id,
    referred_email: profile.email,
    event_type: eventType,
    plan: profile.plan,
    amount_usd: amountUsd,
    commission_usd: commission,
    status: "pending",
  });

  if (commission > 0) {
    await supabase.rpc("add_affiliate_earnings", {
      p_affiliate_id: aff.id,
      p_amount: commission,
    });
  }
}
