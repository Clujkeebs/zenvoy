import { useState } from 'react'
import Icon from '../../icons/Icon'
import PasswordInput from '../ui/PasswordInput'
import { COUNTRIES, SERVICES, CURRENCIES } from '../../constants/services'
import { supabase } from '../../lib/supabase'
import * as DB from '../../utils/db'
import { mkRefCode } from '../../utils/helpers'
import { getDefaultRole } from '../../utils/roles'
const I = Icon

export default function Auth({ onAuth, initialMode = "login" }) {
  const [mode,     setMode]     = useState(initialMode)
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [pass,     setPass]     = useState("")
  const [pass2,    setPass2]    = useState("")
  const [country,  setCountry]  = useState("")
  const [currency, setCurrency] = useState("USD")
  const [svc,      setSvc]      = useState("web")
  const [refCode,  setRefCode]  = useState("")
  const [err,      setErr]      = useState("")
  const [busy,     setBusy]     = useState(false)
  const [step,     setStep]     = useState(1)
  const [resetSent, setResetSent] = useState(false)

  const sendReset = async () => {
    if (!email) return setErr("Enter your email first.")
    setBusy(true)
    setErr("")
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) throw error
      setResetSent(true)
    } catch (e) {
      setErr(e.message || "Could not send reset email.")
    }
    setBusy(false)
  }

  const go = async () => {
    setErr("")
    if (!email || !pass) return setErr("Fill in all fields.")
    if (mode === "signup") {
      if (!name) return setErr("Enter your name.")
      if (!country) return setErr("Select your country.")
      if (pass.length < 6) return setErr("Password must be at least 6 characters.")
      if (pass !== pass2) return setErr("Passwords do not match.")
    }
    setBusy(true)
    try {
      if (mode === "login") {
        await DB.signIn({ email, password: pass })
        const u = await DB.getUser(email)
        if (!u) { setErr("Profile not found."); setBusy(false); return }
        if (u.banned) { setErr("This account has been suspended."); setBusy(false); return }
        onAuth(u)
      } else {
        // Handle referral bonus
        if (refCode) {
          const refUser = await DB.findUserByRef(refCode)
          if (refUser && refUser.email !== email) {
            const updated = { ...refUser, scansUsed: Math.max(0, (refUser.scansUsed || 0) - 10), referrals: (refUser.referrals || 0) + 1 }
            DB.saveUser(refUser.email, updated) // fire-and-forget
          }
        }
        await DB.signUp({
          email,
          password: pass,
          name,
          country,
          svc,
          currency: currency || "USD",
          role: getDefaultRole(email),
        })
        // Wait a moment for the trigger to create the profile
        await new Promise(r => setTimeout(r, 1000))
        const u = await DB.getUser(email)
        if (u) {
          onAuth(u)
        } else {
          // Profile not created yet — check email for confirmation
          setErr("Check your email to confirm your account, then sign in.")
        }
      }
    } catch (e) {
      setErr(e.message || "Something went wrong.")
    }
    setBusy(false)
  }

  const gridBg = {
    position: "fixed", inset: 0, opacity: .025,
    backgroundImage: "linear-gradient(var(--brd) 1px,transparent 1px),linear-gradient(90deg,var(--brd) 1px,transparent 1px)",
    backgroundSize: "44px 44px", pointerEvents: "none",
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      background: "radial-gradient(ellipse at 25% 30%,rgba(198,241,53,.05) 0%,transparent 55%),var(--bg)" }}>
      <div style={gridBg} />
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="fu" style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, background: "var(--lime)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I n="target" s={24} c="#0c0e13" />
            </div>
            <span style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 26, letterSpacing: "-.03em" }}>
              Zen<span style={{ color: "var(--lime)" }}>vylo</span>
            </span>
          </div>
          <p style={{ color: "var(--txt2)", fontSize: 14 }}>Find clients. Close deals. Grow your business.</p>
        </div>

        <div className="card fu" style={{ padding: 28, animationDelay: ".06s" }}>
          <div style={{ display: "flex", gap: 3, background: "var(--s2)", borderRadius: 9, padding: 4, marginBottom: 22 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setStep(1) }}
                style={{ flex: 1, padding: "8px", borderRadius: 7, fontFamily: "var(--fh)", fontWeight: 700, fontSize: 13,
                  background: mode === m ? "var(--s3)" : "transparent",
                  color: mode === m ? "var(--txt)" : "var(--txt2)",
                  border: "none", cursor: "pointer", transition: "all .18s" }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            resetSent ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(198,241,53,.1)", border: "2px solid rgba(198,241,53,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <I n="check" s={22} c="var(--lime)" />
                </div>
                <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Check Your Email</div>
                <p style={{ color: "var(--txt2)", fontSize: 13, lineHeight: 1.6 }}>
                  We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
                </p>
                <button style={{ marginTop: 14, fontSize: 12, color: "var(--blue)", cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}
                  onClick={() => { setResetSent(false); setErr("") }}>← Back to Sign In</button>
              </div>
            ) : (
            <>
              <div style={{ marginBottom: 13 }}>
                <span className="lbl">Email</span>
                <input className="inp" type="email" placeholder="you@agency.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <span className="lbl">Password</span>
                <PasswordInput value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
              </div>
              <div style={{ textAlign: "right", marginBottom: 16 }}>
                <button style={{ fontSize: 11, color: "var(--blue)", cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}
                  onClick={sendReset} disabled={busy}>Forgot password?</button>
              </div>
            </>
            )
          ) : (
            step === 1 ? (
              <>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Your Name</span>
                  <input className="inp" placeholder="Alex Johnson" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Email</span>
                  <input className="inp" type="email" placeholder="you@agency.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Password</span>
                  <PasswordInput value={pass} onChange={e => setPass(e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Confirm Password</span>
                  <PasswordInput value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Re-enter password" />
                  {pass2 && pass !== pass2 && (
                    <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <I n="alert" s={10} /> Passwords do not match
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Your Country</span>
                  <select className="inp" value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="">Select your country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span className="lbl">Your Currency</span>
                  <select className="inp" value={currency} onChange={e => setCurrency(e.target.value)}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-lime" style={{ width: "100%", justifyContent: "center", padding: "12px" }}
                  onClick={() => {
                    if (!name || !email || !pass || !country) return setErr("Fill in all fields.")
                    if (pass.length < 6) return setErr("Password must be at least 6 characters.")
                    if (pass !== pass2) return setErr("Passwords do not match.")
                    setErr(""); setStep(2)
                  }}>
                  Continue →
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 13 }}>
                  <span className="lbl">Primary Service You Sell</span>
                  <select className="inp" value={svc} onChange={e => setSvc(e.target.value)}>
                    {SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span className="lbl">Referral Code (optional)</span>
                  <input className="inp" placeholder="ZL-XXXX-XXXX" value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} />
                </div>
              </>
            )
          )}

          {err && <div style={{ background: "rgba(245,66,66,.1)", border: "1.5px solid rgba(245,66,66,.25)",
            borderRadius: 8, padding: "9px 13px", marginBottom: 14, color: "var(--red)", fontSize: 13,
            display: "flex", gap: 7, alignItems: "center" }}>
            <I n="alert" s={13} />{err}
          </div>}

          {((mode === "login" && !resetSent) || (mode === "signup" && step === 2)) && (
            <button className="btn btn-lime" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={go} disabled={busy}>
              {busy && <span style={{ width: 16, height: 16, border: "2.5px solid rgba(0,0,0,.2)", borderTopColor: "#000", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} />}
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Free Account"}
            </button>
          )}

          {mode === "signup" && step === 2 && (
            <button style={{ width: "100%", marginTop: 10, padding: "8px", color: "var(--txt3)", fontSize: 12, cursor: "pointer", background: "none", border: "none" }}
              onClick={() => setStep(1)}>← Back</button>
          )}
        </div>
        <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--txt3)" }}>
          Free forever: 3 scans/month · No credit card needed
        </p>
      </div>
    </div>
  )
}
