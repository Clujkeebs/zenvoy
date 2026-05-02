import { useState, useEffect, useCallback } from 'react'
import Icon from '../../icons/Icon'
import { COUNTRIES } from '../../constants/services'
import * as DB from '../../utils/db'
import { getDefaultRole } from '../../utils/roles'
const I = Icon

export default function Auth({ onAuth, initialMode = "login" }) {
  const [mode, setMode]       = useState(initialMode)
  const [name, setName]       = useState("")
  const [email, setEmail]     = useState("")
  const [country, setCountry] = useState("")
  const [refCode, setRefCode] = useState("")
  const [hasRef, setHasRef]   = useState(false)
  const [err, setErr]         = useState("")
  const [busy, setBusy]       = useState(false)
  const [sent, setSent]       = useState(false)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      setRefCode(ref.toUpperCase())
      setHasRef(true)
      setMode("signup")
    }
  }, [])

  const submit = useCallback(async (e) => {
    e?.preventDefault?.()
    setErr("")
    if (!email) return setErr("Enter your email.")
    if (mode === "signup") {
      if (!name) return setErr("Enter your name.")
      if (!country) return setErr("Select your country.")
    }
    setBusy(true)
    try {
      // Persist referral so App.jsx can process it after the magic link is clicked
      if (refCode && mode === "signup") {
        localStorage.setItem('zv_pending_ref', refCode)
      }

      await DB.sendMagicLink({
        email,
        ...(mode === "signup" && {
          name,
          country,
          svc: "web",
          currency: "USD",
          role: getDefaultRole(email),
        }),
      })

      setSent(true)
    } catch (e) {
      const msg = (e.message || "").toLowerCase()
      if (msg.includes("rate limit") || msg.includes("429"))
        setErr("Too many attempts. Wait a minute.")
      else if (msg.includes("invalid email"))
        setErr("Invalid email address.")
      else if (msg.includes("network") || msg.includes("fetch"))
        setErr("Network error. Check your connection.")
      else
        setErr(e.message || "Something went wrong.")
    }
    setBusy(false)
  }, [mode, email, name, country, refCode])

  const switchMode = useCallback((m) => {
    setMode(m); setErr(""); setSent(false)
  }, [])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px 16px", background: "var(--bg)", position: "relative",
    }}>
      {/* Soft glow */}
      <div aria-hidden style={{
        position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
        width: 800, height: 800, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(198,241,53,.06) 0%, transparent 55%)",
        pointerEvents: "none", filter: "blur(60px)",
      }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 28 }}>
            <div style={{
              width: 36, height: 36, background: "var(--lime)", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <I n="target" s={19} c="#0a0c11" />
            </div>
            <span style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 24, letterSpacing: "-.035em" }}>
              Zen<span style={{ color: "var(--lime)" }}>vylo</span>
            </span>
          </a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, lineHeight: 1.1 }}>
            {sent
              ? "Check your inbox"
              : mode === "login" ? "Welcome back" : "Get started free"}
          </h1>
          <p style={{ color: "var(--txt2)", fontSize: 14.5, lineHeight: 1.5 }}>
            {sent
              ? `We sent a magic link to ${email}.`
              : mode === "login"
                ? "Sign in with a magic link — no password needed."
                : "3 free scans every month. No credit card."}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--s1)", border: "1px solid var(--brd)", borderRadius: 16,
          padding: 24, animation: "fadeUp .25s ease both",
        }}>

          {/* Tabs */}
          {!sent && (
            <div role="tablist" style={{
              display: "flex", gap: 0, marginBottom: 20,
              borderBottom: "1px solid var(--brd)",
            }}>
              {["login", "signup"].map(m => (
                <button key={m} type="button" role="tab" aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1, padding: "10px 0", marginBottom: -1,
                    fontFamily: "var(--fh)", fontWeight: 700, fontSize: 14,
                    background: "transparent",
                    color: mode === m ? "var(--txt)" : "var(--txt3)",
                    borderBottom: "2px solid " + (mode === m ? "var(--lime)" : "transparent"),
                    cursor: "pointer", transition: "color .15s, border-color .15s",
                  }}>
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>
          )}

          {/* Referral banner */}
          {hasRef && mode === "signup" && !sent && (
            <div style={{
              padding: "10px 12px", marginBottom: 16, borderRadius: 10,
              background: "rgba(198,241,53,.07)", border: "1px solid rgba(198,241,53,.22)",
              display: "flex", alignItems: "center", gap: 10, fontSize: 13.5,
            }}>
              <I n="gift" s={15} c="var(--lime)" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--txt)" }}>+5 bonus scans applied</div>
                <div style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "var(--fm)", marginTop: 1 }}>{refCode}</div>
              </div>
            </div>
          )}

          {/* ── Email sent confirmation ── */}
          {sent ? (
            <div style={{ textAlign: "center", padding: "4px 0" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "rgba(198,241,53,.1)", border: "1.5px solid rgba(198,241,53,.25)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <I n="mail" s={28} c="var(--lime)" />
              </div>
              <p style={{ color: "var(--txt2)", fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
                Magic link sent to
              </p>
              <p style={{
                fontWeight: 700, fontSize: 14, color: "var(--lime)", marginBottom: 16,
                fontFamily: "var(--fm)", wordBreak: "break-all",
              }}>{email}</p>
              <p style={{ fontSize: 12.5, color: "var(--txt3)", marginBottom: 20, lineHeight: 1.6 }}>
                Click the link in the email to sign in instantly.
                No password required. Check your spam folder if you don't see it.
              </p>

              <button className="btn btn-lime btn-xl" style={{ width: "100%", marginBottom: 10 }}
                onClick={() => window.open(`https://mail.google.com`, '_blank')}>
                Open Gmail
              </button>
              <button className="btn btn-ghost" style={{ width: "100%" }}
                onClick={() => { setSent(false); setErr("") }}>
                ← Use a different email
              </button>
            </div>

          ) : (
            /* ── Auth form ── */
            <form onSubmit={submit} autoComplete="on">

              {mode === "signup" && (
                <label style={{ display: "block", marginBottom: 13 }}>
                  <span className="auth-lbl">Full name</span>
                  <input className="inp" name="name" placeholder="Alex Johnson" autoComplete="name"
                    value={name} onChange={e => setName(e.target.value)} />
                </label>
              )}

              <label style={{ display: "block", marginBottom: mode === "signup" ? 13 : 16 }}>
                <span className="auth-lbl">Email</span>
                <input className="inp" type="email" name="email" placeholder="you@agency.com"
                  autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </label>

              {mode === "signup" && (
                <label style={{ display: "block", marginBottom: 13 }}>
                  <span className="auth-lbl">Country</span>
                  <select className="inp" value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}

              {mode === "signup" && !hasRef && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{
                    fontSize: 12, color: "var(--txt3)", cursor: "pointer",
                    userSelect: "none", fontWeight: 500, padding: "4px 0",
                  }}>
                    Have a referral code?
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    <input className="inp inp-mono" placeholder="ZL-XXXX-XXXX"
                      value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} />
                  </div>
                </details>
              )}

              {err && (
                <div style={{
                  background: "rgba(245,66,66,.08)", border: "1px solid rgba(245,66,66,.22)",
                  borderRadius: 9, padding: "9px 12px", marginBottom: 14,
                  color: "#ff8a8a", fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
                }}>
                  <I n="alert" s={13} c="var(--red)" /><span>{err}</span>
                </div>
              )}

              <button type="submit" className="btn btn-lime btn-xl"
                style={{ width: "100%" }} disabled={busy}>
                {busy && (
                  <span style={{
                    width: 15, height: 15, border: "2.5px solid rgba(0,0,0,.2)",
                    borderTopColor: "#000", borderRadius: "50%",
                    animation: "spin .7s linear infinite",
                  }} />
                )}
                {busy ? "Sending…" : mode === "login" ? "Send magic link" : "Create account"}
              </button>

              {mode === "login" && (
                <p style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--txt3)" }}>
                  We'll email you a secure, one-click link — no password ever.
                </p>
              )}
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--txt3)" }}>
          {mode === "signup"
            ? "By signing up you agree to our Terms & Privacy."
            : "Free forever · 3 scans/month"}
        </p>
      </div>

      <style>{`
        .auth-lbl{font-size:11.5px;font-weight:600;color:var(--txt2);letter-spacing:.005em;margin-bottom:6px;display:block}
      `}</style>
    </div>
  )
}
