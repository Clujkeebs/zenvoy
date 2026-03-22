import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Webhook handler — called by Stripe when subscription events happen.
// Endpoint URL: https://tyhhtbtxdwxjcziwmrpx.supabase.co/functions/v1/stripe-webhook
// Add this URL in Stripe Dashboard → Webhooks → Add Endpoint
// Events to listen for: customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_succeeded

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const event = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const type = event.type;
    const obj = event.data?.object;

    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const uid = obj.metadata?.supabase_uid;
      const plan = obj.metadata?.plan;
      const status = obj.status; // active, trialing, past_due, canceled, etc.

      if (uid && plan) {
        const updates: Record<string, unknown> = {
          plan: status === "active" || status === "trialing" ? plan : "free",
          stripe_subscription_id: obj.id,
          scans_used: 0, // reset scans on new subscription
        };

        if (status === "trialing") {
          updates.trial_end = obj.trial_end
            ? new Date(obj.trial_end * 1000).toISOString()
            : null;
          updates.trial_started = new Date().toISOString();
        }

        await supabase.from("profiles").update(updates).eq("id", uid);
      }
    }

    if (type === "customer.subscription.deleted") {
      const uid = obj.metadata?.supabase_uid;
      if (uid) {
        await supabase.from("profiles").update({
          plan: "free",
          stripe_subscription_id: null,
          scans_used: 0,
        }).eq("id", uid);
      }
    }

    if (type === "invoice.payment_succeeded") {
      // Monthly renewal — reset scan count
      const subId = obj.subscription;
      if (subId) {
        await supabase.from("profiles").update({ scans_used: 0 })
          .eq("stripe_subscription_id", subId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
