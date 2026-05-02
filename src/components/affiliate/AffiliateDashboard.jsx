import { useState, useEffect } from 'react'
import Icon from '../../icons/Icon'
import { fmtDate } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

// Plan prices (USD) for commission calculation — match constants/plans.js
const PLAN_PRICES = { starter: 9, growth: 19, pro: 39, scale: 79 }

function StatCard({ label, value, sub, color = "var(--lime)", icon }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--s2)", borderRadius: 10, border: "1.5px solid var(--brd)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        {icon && <I n={icon} s={13} c={color} />}
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      </div>
      <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 24, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function AffiliateDashboard({ user }) {
  const [aff, setAff] = useState(null)
  const [conversions, setConversions] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState("")

  useEffect(() => {
    async function load() {
      const [record, convs] = await Promise.all([
        DB.getMyAffiliateRecord(),
        DB.getMyAffiliateConversions(),
      ])
      setAff(record)
      setConversions(convs)
      setLoading(false)
    }
    load()
  }, [user.email])

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(""), 2000)
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
      <div style={{ width: 28, height: 28, border: "3px solid var(--brd)", borderTopColor: "var(--lime)", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  )

  // Not an approved affiliate yet
  if (!aff) return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--s2)", border: "2px solid var(--brd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <I n="dollar" s={28} c="var(--txt3)" />
      </div>
      <h2 style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22, marginBottom: 10 }}>Become a Zenvylo Affiliate</h2>
      <p style={{ color: "var(--txt2)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        Earn <strong style={{ color: "var(--lime)" }}>30% recurring commission</strong> for every customer you refer.
        Average creator earns <strong>$200–$800/month</strong> once their audience is onboarded.
      </p>
      <div style={{ background: "var(--s2)", borderRadius: 12, padding: "20px 22px", border: "1.5px solid var(--brd)", marginBottom: 24, textAlign: "left" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>How It Works</div>
        {[
          { icon: "link", text: "Get a custom promo code (e.g. YOUR20)" },
          { icon: "users", text: "Share it in your YouTube, TikTok, Twitter" },
          { icon: "dollar", text: "Earn 30% of every subscription they pay" },
          { icon: "zap", text: "Get paid monthly via PayPal or Wise" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <I n={item.icon} s={13} c="var(--lime)" />
            </div>
            <span style={{ fontSize: 13, color: "var(--txt2)" }}>{item.text}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--txt3)" }}>
        Contact <a href="mailto:hello@zenvylo.com" style={{ color: "var(--blue)" }}>hello@zenvylo.com</a> with your channel to apply.
      </div>
    </div>
  )

  // ── Shared promo-link card ───────────────────────────────
  const refLink = `https://www.zenvylo.app?ref=${aff.promoCode}`

  const PromoCard = () => (
    <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Your Referral Link</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div className="inp" style={{ flex: 1, fontSize: 12, color: "var(--txt2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {refLink}
        </div>
        <button className="btn btn-lime" style={{ whiteSpace: "nowrap", minWidth: 100 }} onClick={() => copy(refLink, "link")}>
          <I n="copy" s={13} />{copied === "link" ? "Copied!" : "Copy Link"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="inp" style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".06em", color: "var(--lime)", fontFamily: "monospace", flex: "0 0 auto" }}>
          {aff.promoCode}
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => copy(aff.promoCode, "code")}>
          <I n="copy" s={13} />{copied === "code" ? "Copied!" : "Copy Code"}
        </button>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--txt3)" }}>
          <code style={{ padding: "2px 6px", background: "var(--s2)", borderRadius: 4 }}>?ref={aff.promoCode}</code>
        </div>
      </div>
    </div>
  )

  const StatusBadge = () => (
    <span style={{
      padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: aff.status === 'active' ? "rgba(52,212,122,.12)" : "rgba(245,66,66,.1)",
      color: aff.status === 'active' ? "var(--green)" : "var(--red)",
      border: "1.5px solid " + (aff.status === 'active' ? "rgba(52,212,122,.25)" : "rgba(245,66,66,.2)"),
      textTransform: "uppercase",
    }}>{aff.status}</span>
  )

  // ════════════════════════════════════════════════════════
  // SCAN AFFILIATE DASHBOARD
  // ════════════════════════════════════════════════════════
  if (aff.type === 'scans') {
    const totalScansEarned = aff.scansEarned || aff.totalSignups * 3 || 0
    const signupList = conversions.filter(c => c.eventType === 'signup')

    return (
      <div style={{ maxWidth: 680 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22 }}>Scan Affiliate</div>
            <div style={{ fontSize: 13, color: "var(--txt2)", marginTop: 3 }}>
              Code: <strong style={{ color: "var(--blue)", letterSpacing: ".05em" }}>{aff.promoCode}</strong>
              &nbsp;·&nbsp;+3 scans per referral
            </div>
          </div>
          <StatusBadge />
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px,100%), 1fr))", gap: 10, marginBottom: 14 }}>
          <StatCard label="Total Referrals" value={aff.totalSignups || 0} sub="people signed up" color="var(--blue)" icon="users" />
          <StatCard label="Scans Earned" value={totalScansEarned} sub="+3 per referral" color="var(--lime)" icon="zap" />
        </div>

        {/* Policy banner */}
        <div style={{
          padding: "11px 14px", marginBottom: 14, borderRadius: 12,
          background: "linear-gradient(135deg, rgba(56,189,248,.08), rgba(198,241,53,.04))",
          border: "1px solid rgba(56,189,248,.2)",
          display: "flex", alignItems: "center", gap: 10, fontSize: 13,
        }}>
          <I n="zap" s={15} c="var(--blue)" />
          <span style={{ color: "var(--txt2)" }}>
            Every time someone signs up with your code, you get <strong style={{ color: "var(--lime)" }}>+3 bonus scans</strong> added to your account automatically.
          </span>
        </div>

        <PromoCard />

        {/* Signup history */}
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 13 }}>Referral History</div>
            <span className="chip c-blue" style={{ fontSize: 10 }}>{signupList.length} signups</span>
          </div>
          {signupList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--txt3)", fontSize: 13 }}>
              No referrals yet — share your link to start earning scans!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {signupList.map((c, i) => (
                <div key={c.id || i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 13px", background: "var(--s2)", borderRadius: 8, border: "1.5px solid var(--brd)",
                }}>
                  <div style={{ fontSize: 13, color: "var(--txt2)" }}>{c.referredEmail}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "var(--lime)" }}>+3 scans</span>
                    <span style={{ fontSize: 11, color: "var(--txt3)" }}>{fmtDate(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // PAYMENT AFFILIATE DASHBOARD (existing)
  // ════════════════════════════════════════════════════════
  const convRate = aff.totalSignups > 0 ? ((aff.totalConversions / aff.totalSignups) * 100).toFixed(1) : "0.0"
  const signups  = conversions.filter(c => c.eventType === 'signup')
  const upgrades = conversions.filter(c => c.eventType === 'upgrade' || c.eventType === 'rebill')
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  const totalSpentByReferrals = conversions
    .filter(c => c.eventType !== 'signup' && c.amountUsd)
    .filter(c => {
      const firstSeen = signups.find(s => s.referredUserId === c.referredUserId)
      if (!firstSeen) return true
      return (new Date(c.createdAt) - new Date(firstSeen.createdAt)) <= oneYearMs
    })
    .reduce((sum, c) => sum + Number(c.amountUsd || 0), 0)

  return (
    <div style={{ maxWidth: 780 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22 }}>Affiliate Dashboard</div>
          <div style={{ fontSize: 13, color: "var(--txt2)", marginTop: 3 }}>
            Your code: <strong style={{ color: "var(--lime)", letterSpacing: ".05em" }}>{aff.promoCode}</strong>
            &nbsp;·&nbsp;{aff.commissionRate}% commission
          </div>
        </div>
        <StatusBadge />
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px,100%), 1fr))", gap: 10, marginBottom: 12 }}>
        <StatCard label="Pending Payout" value={`$${Number(aff.pendingPayout).toFixed(2)}`} sub="Next payment" color="var(--lime)" icon="dollar" />
        <StatCard label="Total Earned" value={`$${Number(aff.totalEarned).toFixed(2)}`} sub={`$${Number(aff.paidTotal).toFixed(2)} paid out`} color="var(--green)" icon="crown" />
        <StatCard label="Referrals Spent" value={`$${totalSpentByReferrals.toFixed(2)}`} sub="lifetime · 1yr window" color="var(--amber)" icon="bar" />
        <StatCard label="Conversions" value={aff.totalConversions} sub={`${aff.totalSignups} signups · ${convRate}% rate`} color="var(--blue)" icon="target" />
      </div>

      {/* Policy banner */}
      <div style={{
        padding: "11px 14px", marginBottom: 14, borderRadius: 12,
        background: "linear-gradient(135deg, rgba(198,241,53,.08), rgba(168,85,247,.04))",
        border: "1px solid rgba(198,241,53,.2)",
        display: "flex", alignItems: "center", gap: 10, fontSize: 13,
      }}>
        <I n="zap" s={15} c="var(--lime)" />
        <span style={{ color: "var(--txt2)" }}>
          You earn <strong style={{ color: "var(--lime)" }}>{aff.commissionRate}%</strong> of every referred user's spend
          {' '}for <strong style={{ color: "var(--txt)" }}>1 full year</strong> from their signup date.
        </span>
      </div>

      <PromoCard />

      {/* Commission Table */}
      <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Your Commission Per Sale</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px,100%), 1fr))", gap: 8 }}>
          {Object.entries(PLAN_PRICES).map(([plan, price]) => (
            <div key={plan} style={{ padding: "10px 13px", background: "var(--s2)", borderRadius: 8, border: "1.5px solid var(--brd)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase", marginBottom: 4 }}>{plan}</div>
              <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 18, color: "var(--lime)" }}>
                ${(price * aff.commissionRate / 100).toFixed(0)}<span style={{ fontSize: 11, color: "var(--txt3)", fontWeight: 400 }}>/mo</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 2 }}>${price}/mo plan</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment info */}
      <div className="card" style={{ padding: "16px 18px", marginBottom: 14, border: "1.5px solid rgba(198,241,53,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <I n="dollar" s={15} c="var(--lime)" />
          <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 13 }}>Payments</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 3 }}>Pending Payout</div>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 20, color: "var(--lime)" }}>${Number(aff.pendingPayout).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--txt3)", marginBottom: 3 }}>Paid Out (all time)</div>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 20, color: "var(--green)" }}>${Number(aff.paidTotal).toFixed(2)}</div>
          </div>
        </div>
        {aff.paypalEmail ? (
          <div style={{ fontSize: 12, color: "var(--txt2)", padding: "8px 11px", background: "var(--s2)", borderRadius: 7 }}>
            <I n="check" s={11} c="var(--green)" /> Payments sent to PayPal: <strong>{aff.paypalEmail}</strong>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--amber)", padding: "8px 11px", background: "rgba(255,177,0,.06)", borderRadius: 7, border: "1px solid rgba(255,177,0,.2)" }}>
            <I n="alert" s={11} c="var(--amber)" /> No payment method on file. Email <a href="mailto:hello@zenvylo.com" style={{ color: "var(--blue)" }}>hello@zenvylo.com</a> to set up payouts.
          </div>
        )}
        {aff.lastPayoutAt && (
          <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 8 }}>Last payment: {fmtDate(aff.lastPayoutAt)}</div>
        )}
      </div>

      {/* Conversions list */}
      <div className="card" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 13 }}>Referral History</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="chip c-blue" style={{ fontSize: 10 }}>{signups.length} signups</span>
            <span className="chip c-green" style={{ fontSize: 10 }}>{upgrades.length} paid</span>
          </div>
        </div>
        {conversions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--txt3)", fontSize: 13 }}>
            No referrals yet — share your link to start earning!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--brd)" }}>
                  {["User", "Event", "Plan", "Commission", "Date", "Status"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversions.map((c, i) => (
                  <tr key={c.id || i} style={{ borderBottom: "1px solid var(--brd)" }}>
                    <td style={{ padding: "9px 10px", color: "var(--txt2)" }}>{c.referredEmail}</td>
                    <td style={{ padding: "9px 10px" }}>
                      <span className={`chip ${c.eventType === 'signup' ? 'c-blue' : 'c-green'}`} style={{ fontSize: 10 }}>{c.eventType}</span>
                    </td>
                    <td style={{ padding: "9px 10px", color: "var(--txt2)" }}>{c.plan || "—"}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 700, color: "var(--lime)" }}>
                      {c.commissionUsd ? `$${Number(c.commissionUsd).toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", color: "var(--txt3)" }}>{fmtDate(c.createdAt)}</td>
                    <td style={{ padding: "9px 10px" }}>
                      <span className={`chip ${c.status === 'paid' ? 'c-green' : c.status === 'cancelled' ? 'c-red' : 'c-amber'}`} style={{ fontSize: 10 }}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
