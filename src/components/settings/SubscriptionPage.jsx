import PageHeader from '../ui/PageHeader'
import { useState } from 'react'
import Icon from '../../icons/Icon'
import { PLANS, PLAN_ORDER, getScansLeft, SCAN_PACKS, getBonusScans, getScansLimit } from '../../constants/plans'
import { startTrial, isTrialActive, getTrialDaysLeft } from '../../utils/trial'
import { supabase } from '../../lib/supabase'
import * as DB from '../../utils/db'
const I = Icon

export default function SubscriptionPage({ user, onUpdate, onNav }) {
  const [showEnterprise, setShowEnterprise] = useState(false)
  const [loading, setLoading] = useState(null) // planId being loaded

  const upgradePlan = async (planId) => {
    const plan = PLANS[planId]
    if (!plan) return
    if (plan.contactOnly) { setShowEnterprise(true); return }

    // Free plan — just downgrade locally
    if (planId === "free") {
      const u = { ...user, plan: "free", scansUsed: 0 }
      DB.saveUser(user.email, u)
      onUpdate(u)
      return
    }

    // Paid plans — redirect to Stripe Checkout
    setLoading(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        import.meta.env.VITE_SUPABASE_URL + "/functions/v1/stripe-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + session?.access_token,
          },
          body: JSON.stringify({
            plan: planId,
            return_url: window.location.origin + window.location.pathname,
          }),
        }
      )
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url // redirect to Stripe
      } else {
        alert(data.error || "Could not start checkout. Try again.")
      }
    } catch (e) {
      alert("Checkout error: " + e.message)
    }
    setLoading(null)
  }

  const currentPlan = user.plan || "free"
  const scansRemaining = getScansLeft(user)
  const trialActive = isTrialActive(user)
  const trialDays = trialActive ? getTrialDaysLeft(user) : 0

  if (showEnterprise) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(245,166,35,.1)", border: "2px solid rgba(245,166,35,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <I n="briefcase" s={28} c="var(--amber)" />
        </div>
        <h2 style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Enterprise Access</h2>
        <p style={{ color: "var(--txt2)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          For enterprise access, contact us at
        </p>
        <a href="mailto:support@zenvylo.com" style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)", textDecoration: "none" }}>
          support@zenvylo.com
        </a>
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => setShowEnterprise(false)}>
            ← Back to plans
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: "hidden", minWidth: 0 }}>
      <PageHeader title="Subscription" onBack={() => onNav("home")} onHome={() => onNav("home")} />
      <p style={{ color: "var(--txt2)", fontSize: 13, marginBottom: 20 }}>
        You're on <strong style={{ color: PLANS[currentPlan]?.color || "var(--txt)" }}>{PLANS[currentPlan]?.name || "Free"}</strong>
        {trialActive && <span style={{ color: "var(--purple)", fontWeight: 700 }}> — Trial: {trialDays} days left</span>}
        {" · "}{scansRemaining} scans remaining this month
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 12, marginBottom: 20 }}>
        {PLAN_ORDER.map(pid => {
          const p = PLANS[pid]
          const isCurrent = currentPlan === pid
          const isContact = p.contactOnly
          return (
            <div key={pid} style={{
              position: "relative", borderRadius: 12, padding: "15px 17px",
              border: "2px solid " + (isCurrent ? (p.best ? "var(--lime)" : p.color) : "var(--brd)"),
              background: isCurrent ? (p.best ? "rgba(198,241,53,.04)" : "rgba(255,255,255,.01)") : "var(--s2)",
              ...(p.best && isCurrent ? { boxShadow: "0 0 0 1px var(--lime),0 0 20px rgba(198,241,53,.12)" } : {}),
            }}>
              {p.best && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "var(--lime)", color: "#0c0e13", fontSize: 10, fontWeight: 900, padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
              {pid === "pro" && !isCurrent && <div style={{ position: "absolute", top: 9, right: 9, background: "rgba(168,85,247,.15)", border: "1px solid rgba(168,85,247,.3)", borderRadius: 20, fontSize: 9, fontWeight: 800, color: "var(--purple)", padding: "2px 7px" }}>7-DAY TRIAL</div>}

              <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 13, color: p.color, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22, marginBottom: 10 }}>
                {isContact ? "Custom" : p.price === 0 ? "Free" : "$" + p.price}
                {!isContact && p.price > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--txt3)" }}>/mo</span>}
              </div>
              {p.features.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 5, alignItems: "flex-start", fontSize: 12, color: "var(--txt2)", marginBottom: 4 }}>
                  <I n="check" s={11} c="var(--green)" style={{ marginTop: 1, flexShrink: 0 }} />{f}
                </div>
              ))}
              {pid === "pro" && !isCurrent && <div style={{ fontSize: 11, color: "var(--purple)", marginTop: 6, fontWeight: 600 }}>🎁 7-day free trial included</div>}
              <button className={"btn " + (isCurrent ? "btn-ghost" : p.best ? "btn-lime" : "btn-dark")}
                style={{ marginTop: 11, width: "100%", justifyContent: "center", fontSize: 12, padding: "9px" }}
                disabled={isCurrent || loading === pid} onClick={() => upgradePlan(pid)}>
                {loading === pid ? "Redirecting to Stripe…"
                  : isCurrent ? "Current Plan ✓"
                  : isContact ? "Contact Sales"
                  : pid === "pro" ? "Start 7-Day Free Trial"
                  : "Switch to " + p.name}
              </button>
            </div>
          )
        })}
      </div>

      {getBonusScans(user) > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(198,241,53,.04)", border: "1.5px solid rgba(198,241,53,.15)", borderRadius: 9, marginBottom: 16 }}>
          <I n="zap" s={14} c="var(--lime)" />
          <span style={{ fontSize: 13, color: "var(--txt2)" }}>
            You have <strong style={{ color: "var(--lime)" }}>{getBonusScans(user)} bonus scans</strong> from scan packs (never expire)
          </span>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Need more scans?</h3>
        <p style={{ color: "var(--txt3)", fontSize: 12, marginBottom: 12 }}>One-time purchase. Never expire. Stack on top of any plan.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(160px,100%),1fr))", gap: 10 }}>
          {SCAN_PACKS.map(pk => (
            <div key={pk.id} style={{
              position: "relative", borderRadius: 10, padding: "14px 16px",
              border: pk.best ? "2px solid var(--lime)" : "1.5px solid var(--brd)",
              background: pk.best ? "rgba(198,241,53,.03)" : "var(--s2)",
            }}>
              {pk.best && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--lime)", color: "#0c0e13", fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>BEST VALUE</div>}
              <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 15, marginBottom: 2 }}>{pk.label}</div>
              <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 20 }}>
                ${pk.price}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--txt3)" }}> · ${pk.perScan}/scan</span>
              </div>
              {pk.savings && <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>{pk.savings}</div>}
              <button className={"btn " + (pk.best ? "btn-lime" : "btn-dark")}
                style={{ marginTop: 10, width: "100%", justifyContent: "center", fontSize: 12, padding: "8px" }}
                disabled={loading === pk.id}
                onClick={async () => {
                  setLoading(pk.id)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const res = await fetch(
                      import.meta.env.VITE_SUPABASE_URL + "/functions/v1/stripe-checkout",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session?.access_token },
                        body: JSON.stringify({ pack: pk.id, return_url: window.location.origin + window.location.pathname }),
                      }
                    )
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                    else alert(data.error || "Could not start checkout.")
                  } catch (e) { alert("Error: " + e.message) }
                  setLoading(null)
                }}>
                {loading === pk.id ? "Redirecting…" : "Buy " + pk.label}
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 8, fontStyle: "italic" }}>
          Tip: Subscriptions are always the best deal — Starter gives you 20 scans for just $0.45/scan.
        </p>
      </div>

      <div className="card" style={{ padding: "16px 20px", background: "rgba(61,142,248,.04)", border: "1.5px solid rgba(61,142,248,.15)" }}>
        <div style={{ fontSize: 13, color: "var(--blue)", fontWeight: 700, marginBottom: 4 }}>All plans include:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px,100%),1fr))", gap: 6 }}>
          {["Lead deduplication — your leads are exclusive", "Profitability calculator", "Scan history & analytics", "Mobile-friendly dashboard"].map(f => (
            <div key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: "var(--txt2)" }}>
              <I n="check" s={11} c="var(--blue)" style={{ marginTop: 1, flexShrink: 0 }} />{f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
