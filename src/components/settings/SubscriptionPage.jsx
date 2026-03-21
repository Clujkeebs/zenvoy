import { useState } from 'react'
import Icon from '../../icons/Icon'
import { PLANS, PLAN_ORDER, getScansLeft } from '../../constants/plans'
import { startTrial, isTrialActive, getTrialDaysLeft } from '../../utils/trial'
import { getFreeScansLeft, FREE_SCAN_LIMIT } from '../../utils/scanQuota'
import * as DB from '../../utils/db'
const I = Icon

export default function SubscriptionPage({ user, onUpdate }) {
  const [showEnterprise, setShowEnterprise] = useState(false)

  const upgradePlan = (planId) => {
    const plan = PLANS[planId]
    if (!plan) return
    if (plan.contactOnly) { setShowEnterprise(true); return }

    let u
    if (planId === "pro" && plan.trialDays && !user.trialEnd) {
      // Start Pro trial
      u = startTrial(user)
    } else {
      u = { ...user, plan: planId, scansUsed: 0 }
    }
    DB.saveUser(user.email, u)
    onUpdate(u)
  }

  const currentPlan = user.plan || "free"
  const isFree = currentPlan === "free"
  const scansRemaining = isFree ? getFreeScansLeft() : getScansLeft(user)
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
        <a href="mailto:support@zenvoy.com" style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)", textDecoration: "none" }}>
          support@zenvoy.com
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
      <h2 style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: "clamp(18px,3vw,24px)", marginBottom: 4 }}>
        Subscription
      </h2>
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
                disabled={isCurrent} onClick={() => upgradePlan(pid)}>
                {isCurrent ? "Current Plan ✓"
                  : isContact ? "Contact Sales"
                  : pid === "pro" && !user.trialEnd ? "Start 7-Day Free Trial"
                  : "Switch to " + p.name}
              </button>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: "16px 20px", background: "rgba(61,142,248,.04)", border: "1.5px solid rgba(61,142,248,.15)" }}>
        <div style={{ fontSize: 13, color: "var(--blue)", fontWeight: 700, marginBottom: 4 }}>All plans include:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px,100%),1fr))", gap: 6 }}>
          {["Lead deduplication — your leads are exclusive", "Profitability calculator", "Community access", "Mobile-friendly dashboard"].map(f => (
            <div key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: "var(--txt2)" }}>
              <I n="check" s={11} c="var(--blue)" style={{ marginTop: 1, flexShrink: 0 }} />{f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
