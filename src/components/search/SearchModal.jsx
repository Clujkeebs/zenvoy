import { useState, useEffect, useRef } from 'react'
import Icon from '../../icons/Icon'
import { COUNTRIES, resolveService, normalizeServiceName } from '../../constants/services'
import { PLANS, canMulti, getLeadCap, canChooseLeadCount, getScansLeft, getScansLimit, getBonusScans } from '../../constants/plans'
import { generateLeads } from '../../utils/ai'
import ServicePicker from '../ui/ServicePicker'
import * as DB from '../../utils/db'
import Analytics from '../../utils/analytics'
const I = Icon

export default function SearchModal({ user, onClose, onDone, onUpgrade }) {
  const [svc,       setSvc]       = useState(user.svc || 'web')
  const [customSvc, setCustomSvc] = useState('')
  const [country,   setCountry]   = useState(canMulti(user) ? '' : (user.country || 'United Kingdom'))
  const [city,      setCity]      = useState('')
  const leadCap = getLeadCap(user)
  const [leadCount, setLeadCount] = useState(() => {
    const saved = Number(localStorage.getItem('zv_lead_count'))
    return saved >= 1 && saved <= leadCap ? saved : leadCap
  })
  const [lowBudget, setLowBudget] = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [log,       setLog]       = useState([])
  const [err,       setErr]       = useState('')
  const [failed,    setFailed]    = useState(false)
  const logRef = useRef(null)

  const plan          = PLANS[user.plan] || PLANS.free
  const planScansLeft = getScansLeft(user)
  const bonusScans    = getBonusScans(user)
  const scansLeft     = planScansLeft + bonusScans
  const scansTotal    = getScansLimit(user)
  const multiAllowed  = canMulti(user)
  const isOwner       = user.role === 'owner'

  const service = resolveService(svc, customSvc)
  const serviceReady = !!svc || normalizeServiceName(customSvc).length >= 2

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 9999 }, [log])

  const say = msg => setLog(p => [...p, msg])

  const run = async () => {
    if (!country) { setErr('Select a country first.'); return }
    if (!serviceReady) { setErr('Pick a service, or type what you sell.'); return }
    if (!isOwner && scansLeft <= 0) {
      setErr('No scans left — upgrade your plan or buy a scan pack.')
      return
    }

    setErr(''); setFailed(false); setScanning(true); setLog([])
    Analytics.scanStarted(service.label, country)

    // ── Spend the scan server-side, before doing any work ──────────────
    // The database decides whether this is allowed. The browser used to
    // decrement a number and post it, which meant a scan cost nothing.
    say('Checking your scan allowance…')
    const charge = await DB.consumeScan()

    if (!charge.allowed) {
      const message = {
        no_scans_left: 'You have no scans left this month. Upgrade or buy a scan pack to keep going.',
        banned: 'This account is suspended. Contact support.',
        not_authenticated: 'Your session expired — sign in again.',
        no_profile: "We couldn't load your profile. Try reloading the page.",
      }[charge.reason] || charge.message || "Couldn't start the scan. Try again."

      setLog([]); setErr(message); setScanning(false)
      if (charge.reason === 'no_scans_left' && onUpgrade) onUpgrade('More scans', 'growth')
      return
    }

    try {
      const existingLeads = await DB.getLeads()
      const existing = existingLeads.map(l => l.name)

      const leads = await generateLeads({
        service: svc,
        customService: customSvc,
        country,
        city,
        existingNames: existing,
        lowBudget,
        count: leadCount,
        maxCount: leadCap,
        onProgress: say,
      })

      const measured = leads.filter(l => l.auditedAt).length
      const withIssues = leads.filter(l => (l.findings || []).length > 0).length
      say(`Done — ${leads.length} lead${leads.length === 1 ? '' : 's'}, ${measured} site${measured === 1 ? '' : 's'} measured, ${withIssues} with verified issues.`)

      DB.recordScan({
        service: service.label,
        country,
        city,
        leadCount: leads.length,
      })

      // Remember a typed service so it's one tap next time.
      const nextCustom = service.isCustom
        ? [service.label, ...(user.customServices || []).filter(s => s.toLowerCase() !== service.label.toLowerCase())].slice(0, 12)
        : user.customServices

      if (service.isCustom) {
        DB.updateOwnProfile({ customServices: nextCustom })
      }

      await new Promise(r => setTimeout(r, 350))

      onDone(leads, {
        scansUsed: charge.scansUsed ?? user.scansUsed,
        bonusScans: charge.bonusScans ?? user.bonusScans,
        customServices: nextCustom,
      })
    } catch (e) {
      // The scan was charged before the work started, so give it back.
      await DB.refundScan(charge.source)

      const msg = e.message?.includes('already in your leads')
        ? e.message
        : e.message?.includes('network') || e.message?.includes('connection')
          ? 'Network error — check your connection and try again.'
          : e.message || 'Something went wrong.'

      say('Scan failed: ' + msg)
      say('Your scan has been refunded.')
      setErr(msg)
      setFailed(true)
    }
  }

  const reset = () => { setScanning(false); setLog([]); setErr(''); setFailed(false) }

  return (
    <div className="modal-wrap" style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
      onClick={e => e.target === e.currentTarget && !scanning && onClose()}>
      <div className="modal" style={{ maxWidth: 600, overflowY: 'auto', maxHeight: '90vh' }}>
        <div style={{
          padding: '20px 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1.5px solid var(--brd)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 20 }}>
              {scanning ? 'Scanning ' + (city || country || 'your location') + '…' : 'Find New Leads'}
            </div>
            {scanning && (
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                Real businesses from OpenStreetMap, with their websites measured
              </div>
            )}
          </div>
          {!scanning && (
            <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={onClose}>
              <I n="x" s={16} />
            </button>
          )}
        </div>

        {!scanning ? (
          <div style={{ padding: '22px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <ServicePicker
                value={svc}
                customValue={customSvc}
                recent={user.customServices || []}
                onChange={({ serviceId, customService }) => {
                  setSvc(serviceId)
                  setCustomSvc(customService)
                }}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(160px,100%),1fr))',
              gap: 13, marginBottom: 14,
            }}>
              <div>
                <span className="lbl">
                  Country {!multiAllowed && <span style={{ color: 'var(--txt3)' }}>(locked to your country)</span>}
                </span>
                {multiAllowed ? (
                  <select className="inp" value={country} onChange={e => { setCountry(e.target.value); setCity('') }}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <div className="inp" style={{ opacity: .7, cursor: 'not-allowed' }}>{user.country}</div>
                )}
              </div>
              <div>
                <span className="lbl">City / State (optional)</span>
                <input className="inp" placeholder={country ? 'e.g. Austin, TX' : 'Select country first'}
                  value={city} onChange={e => setCity(e.target.value)} disabled={!country} />
              </div>
            </div>

            {!multiAllowed && (
              <div style={{
                marginBottom: 14, padding: '10px 13px', background: 'rgba(61,142,248,.06)',
                border: '1.5px solid rgba(61,142,248,.15)', borderRadius: 9,
                display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--blue)',
              }}>
                <I n="info" s={13} />
                Multi-country search requires Pro or Scale.
                <button
                  style={{
                    marginLeft: 'auto', fontWeight: 700, cursor: 'pointer',
                    background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12,
                  }}
                  onClick={() => onUpgrade && onUpgrade('Multi-country search', 'pro')}
                >
                  Upgrade →
                </button>
              </div>
            )}

            {canChooseLeadCount(user) ? (
              <div style={{
                marginBottom: 14, padding: '12px 14px', background: 'var(--s2)',
                borderRadius: 9, border: '1.5px solid var(--brd)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                  <span className="lbl" style={{ marginBottom: 0 }}>How many leads?</span>
                  <span style={{ fontFamily: 'var(--fh)', fontWeight: 900, fontSize: 17, color: 'var(--lime)' }}>
                    {leadCount}
                  </span>
                </div>

                <input
                  type="range" min={1} max={leadCap} step={1} value={leadCount}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setLeadCount(v)
                    localStorage.setItem('zv_lead_count', String(v))
                  }}
                  style={{ width: '100%', accentColor: 'var(--lime)', cursor: 'pointer' }}
                  aria-label="Leads per scan"
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--txt3)', marginTop: 2 }}>
                  <span>1</span>
                  <span>{leadCap} max on {plan.name}</span>
                </div>

                <p style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 8, lineHeight: 1.55 }}>
                  It costs one scan either way. Fewer leads finish faster and keep
                  your list focused; more gives you a wider net to sort through.
                </p>
              </div>
            ) : (
              <div style={{
                marginBottom: 14, padding: '10px 13px', background: 'var(--s2)',
                borderRadius: 9, border: '1.5px solid var(--brd)',
                display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--txt2)',
              }}>
                <I n="target" s={13} c="var(--txt3)" />
                <span>{leadCap} leads per scan on {plan.name}</span>
                <button
                  style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: 'none', border: 'none', color: 'var(--blue)',
                  }}
                  onClick={() => onUpgrade && onUpgrade('Choose how many leads per scan', 'growth')}
                >
                  Get more →
                </button>
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, padding: '10px 13px',
              background: 'var(--s2)', borderRadius: 9, border: '1.5px solid var(--brd)', cursor: 'pointer',
            }} onClick={() => setLowBudget(!lowBudget)}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: '2px solid ' + (lowBudget ? 'var(--lime)' : 'var(--brd2)'),
                background: lowBudget ? 'var(--lime)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {lowBudget && <I n="check" s={11} c="#0c0e13" />}
              </div>
              <span style={{ fontSize: 13, color: 'var(--txt2)' }}>
                Low Budget Mode — only suggest setups under $500
              </span>
            </div>

            <div style={{
              marginBottom: 14, padding: '11px 14px', background: 'rgba(198,241,53,.05)',
              border: '1.5px solid rgba(198,241,53,.16)', borderRadius: 9,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--lime)', textTransform: 'uppercase',
                letterSpacing: '.05em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <I n="shield2" s={12} c="var(--lime)" />What we actually check
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.65 }}>
                We fetch each business's website and measure it: HTTPS, mobile
                readiness, response time, page title and description, contact
                and booking links, analytics, and how stale the content is.
                Every issue on a lead card is something we observed — so you can
                quote it to the owner and they can check it.
              </div>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 13px', background: 'var(--s2)', borderRadius: 8,
              border: '1.5px solid var(--brd)', marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Scans left this month</span>
              <span style={{
                fontFamily: 'var(--fh)', fontWeight: 800,
                color: isOwner ? '#FFD700' : scansLeft <= 1 ? 'var(--red)' : scansLeft <= 3 ? 'var(--amber)' : 'var(--lime)',
              }}>
                {isOwner ? '∞' : `${scansLeft} / ${scansTotal}`}
              </span>
            </div>

            {err && (
              <div style={{
                background: 'rgba(245,66,66,.08)', border: '1.5px solid rgba(245,66,66,.2)',
                borderRadius: 9, padding: '10px 14px', marginBottom: 12,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <I n="alert" s={14} c="var(--red)" />
                <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{err}</div>
              </div>
            )}

            <button className="btn btn-lime"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}
              onClick={run} disabled={!country || !serviceReady || (!isOwner && scansLeft <= 0)}>
              <I n="search" s={16} />
              Scan for {leadCount} {service.label} lead{leadCount === 1 ? '' : 's'} in {city || country || 'your location'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '22px 24px' }}>
            <div style={{ height: 3, background: 'var(--s3)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: failed ? 'var(--red)' : 'var(--lime)',
                transition: 'width .4s ease',
                width: (Math.min(log.length / 7, 1) * 100) + '%',
              }} />
            </div>
            <div ref={logRef} style={{
              background: '#060810', borderRadius: 10, padding: '16px 18px',
              height: 220, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, marginBottom: 14,
            }}>
              {log.map((l, i) => (
                <div key={i} style={{
                  color: l.startsWith('Scan failed') ? 'var(--red)'
                    : l.startsWith('Done') ? 'var(--green)'
                      : i === log.length - 1 ? 'var(--lime)' : 'var(--txt2)',
                  marginBottom: 7, animation: 'slideIn .2s ease both',
                }}>{l}</div>
              ))}
              {!failed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--txt3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)', animation: 'pulse 1s infinite' }} />
                  Working…
                </div>
              )}
            </div>

            {failed ? (
              <div>
                <div style={{
                  padding: '10px 14px', background: 'rgba(245,66,66,.08)',
                  border: '1.5px solid rgba(245,66,66,.2)', borderRadius: 9,
                  marginBottom: 10, fontSize: 13, color: 'var(--red)',
                }}>
                  {err}
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
                    Your scan was refunded — trying again won't cost you another.
                  </div>
                </div>
                <button className="btn btn-lime"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}
                  onClick={reset}>
                  Try Again
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'center' }}>
                Measuring real websites takes 10–20 seconds. Worth the wait.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
