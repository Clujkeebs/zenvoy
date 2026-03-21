import { useState } from 'react'
import Icon from '../../icons/Icon'
const I = Icon

const FAQ = [
  { q: "How many free scans do I get?", a: "Free accounts get 3 scans per month. Each scan finds 5 local business leads scored by opportunity, demand, and competition. Your scan count resets on the 1st of each month." },
  { q: "How do I upgrade my plan?", a: "Go to Settings → Subscription and choose a plan. Starter ($9/mo), Growth ($19/mo), Pro ($39/mo), and Scale ($79/mo) are available. Pro includes a 7-day free trial." },
  { q: "What happens during the Pro trial?", a: "You get full Pro features for 7 days — 50 scans, 10 leads each, AI writing tools, and multi-country search. After 7 days, you'll need to subscribe or your account reverts to the Free plan." },
  { q: "Can I cancel my subscription?", a: "Yes, anytime. Go to Settings → Subscription → Manage Billing. All plans are month-to-month with no contracts or cancellation fees." },
  { q: "Why was my message blocked in the community?", a: "We use an automated filter to keep the community professional. If your message was flagged incorrectly, reach out to support and we'll review it." },
  { q: "How do I change my password or email?", a: "Go to Settings → Profile to update your name and service. Email changes require contacting support. Password reset is available from the login screen." },
  { q: "What does the opportunity score mean?", a: "Each lead gets a 0–100 score based on how much they need your service. Scores above 75 are high-priority leads — businesses with real, fixable problems like no website, slow speeds, or few reviews." },
  { q: "How is billing handled?", a: "We use Stripe for all payments. Your card is charged monthly on the day you subscribed. You can update payment info or cancel from the Stripe customer portal via Settings." },
  { q: "What's the Enterprise plan?", a: "Enterprise is for teams and agencies that need custom limits, dedicated support, and SLAs. Contact support@zenvoy.com to discuss pricing." },
  { q: "My scan failed — what do I do?", a: "AI scans occasionally fail due to network issues or API load. Try again — it usually works on the second attempt. If it keeps failing, check your internet connection or contact support." },
]

export default function SupportPage() {
  const [open, setOpen] = useState(null)

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 4px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(61,142,248,.1)", border: "2px solid rgba(61,142,248,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <I n="info" s={26} c="var(--blue)" />
        </div>
        <h1 style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 26, marginBottom: 8 }}>Support</h1>
        <p style={{ color: "var(--txt2)", fontSize: 14, lineHeight: 1.7 }}>
          Need help? Email us at{" "}
          <a href="mailto:support@zenvoy.com" style={{ color: "var(--blue)", fontWeight: 700, textDecoration: "none" }}>
            support@zenvoy.com
          </a>
        </p>
      </div>

      <h2 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <I n="book" s={16} c="var(--lime)" /> Frequently Asked Questions
      </h2>

      <div style={{ borderTop: "1.5px solid var(--brd)" }}>
        {FAQ.map((f, i) => (
          <div key={i} className="faq-item" style={{ borderBottom: "1px solid var(--brd)", overflow: "hidden" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: "100%", textAlign: "left", padding: "16px 0",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 14, fontWeight: 600, color: "var(--txt)",
                cursor: "pointer", background: "none", border: "none",
              }}
            >
              {f.q}
              <I n={open === i ? "up" : "down"} s={14} c="var(--txt3)" />
            </button>
            {open === i && (
              <div style={{ padding: "0 0 16px", fontSize: 13, color: "var(--txt2)", lineHeight: 1.8 }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
