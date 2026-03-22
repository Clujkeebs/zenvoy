import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Price map — matches frontend plans
const PRICE_MAP: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER") || "",
  growth:  Deno.env.get("STRIPE_PRICE_GROWTH") || "",
  pro:     Deno.env.get("STRIPE_PRICE_PRO") || "",
  scale:   Deno.env.get("STRIPE_PRICE_SCALE") || "",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan, return_url } = await req.json();
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Invalid plan: " + plan }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has a Stripe customer ID already
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + stripeKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: profile?.email || user.email || "",
          "metadata[supabase_uid]": user.id,
        }),
      });
      const cust = await custRes.json();
      customerId = cust.id;

      // Save customer ID to profile
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Create Checkout Session
    const params = new URLSearchParams({
      "mode": "subscription",
      "customer": customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "success_url": (return_url || "https://zenvoy-jade.vercel.app") + "?session_id={CHECKOUT_SESSION_ID}&plan=" + plan,
      "cancel_url": (return_url || "https://zenvoy-jade.vercel.app") + "?canceled=1",
      "subscription_data[metadata][supabase_uid]": user.id,
      "subscription_data[metadata][plan]": plan,
    });

    // Add 7-day trial for Pro
    if (plan === "pro") {
      params.set("subscription_data[trial_period_days]", "7");
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + stripeKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await sessionRes.json();

    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
