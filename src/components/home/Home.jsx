import { useState } from 'react'
import Icon from '../../icons/Icon'
import { PLANS, getScansLeft, getBonusScans } from '../../constants/plans'
import { timeAgo } from '../../utils/helpers'
import { buildDesk } from '../../utils/desk'
import { applyRescan, watchableLeads } from '../../utils/watch'
import { proofLink } from '../../utils/proof'
import { SITE_ORIGIN } from '../../constants/site'
import * as DB from '../../utils/db'
import WorkQueue from './WorkQueue'
import GoalTracker from './GoalTracker'
const I = Icon

export default function Home({ user, leads, clients, onSearch, onNav, onUpdateUser, onUpdateLead }) {
  const desk = buildDesk(leads)
  const scansLeft = getScansLeft(user) + getBonusScans(user)
  const plan = PLANS[user.plan] || PLANS.free
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')

  const recheck = async () => {
    if (user.sample) {
      setNote('This is the sample desk. Re-checking a live site needs your account and the measurement server.')
      return
    }
    const targets = watchableLeads(leads).slice(0, 5)
    if (!targets.length) {
      setNote('Save a lead with a website first. Re-checks compare that site to the last measurement.')
      return
    }
    setBusy(true)
    setNote(`Checking ${targets.length} saved site${targets.length === 1 ? '' : 's'}…`)
    let changed = 0
    for (const lead of targets) {
      try {
        const measurement = await DB.auditSite(lead.website, lead.id)
        const next = applyRescan(lead, measurement)
        if ((next.watchLog || []).length > (lead.watchLog || []).length) changed += 1
        onUpdateLead(next)
      } catch (e) {
        setNote(e.message || 'A site could not be re-checked.')
      }
    }
    setBusy(false)
    setNote(changed
      ? `${changed} site${changed === 1 ? '' : 's'} changed since the last check.`
      : 'Checked. Nothing measurable changed on those sites.')
  }

  const copyProof = async (lead) => {
    try {
      const { url } = await proofLink(lead, user.name, window.location.origin || SITE_ORIGIN)
      await navigator.clipboard.writeText(url)
      if (!user.sample) DB.saveProof(lead.id, lead.name, { url })
      setCopied(lead.id)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setNote('Could not copy a proof link from this browser.')
    }
  }

  return (
    <div>
      {user.sample && (
        <div className="sample-banner">
          Sample desk. Harbour Coffee, Loom & Dye and Pike Plumbing are examples, not live scans. Sign up to measure real businesses.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <p className="proof-kicker" style={{ color: 'var(--signal)', marginBottom: 6 }}>Today</p>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>
            {user.name?.split(' ')[0] || 'Hello'}, here is the desk.
          </h1>
          <p style={{ color: 'var(--txt2)', marginTop: 6, fontSize: 14 }}>
            {plan.name} · {Number.isFinite(scansLeft) ? `${scansLeft} scan${scansLeft === 1 ? '' : 's'} left` : 'Unlimited scans'}
            {clients.length ? ` · ${clients.length} client${clients.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={recheck} disabled={busy}>
            <I n="refresh" s={14} />{busy ? 'Checking…' : 'Re-check saved'}
          </button>
          <button className="btn btn-lime" onClick={onSearch}><I n="search" s={14} />New scan</button>
        </div>
      </div>

      {note && <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>{note}</p>}

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 26 }}>What changed</h2>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{desk.watching} site{desk.watching === 1 ? '' : 's'} on watch</span>
        </div>
        {desk.changes.length === 0 ? (
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Nothing new since you last looked. Re-check saved prospects after a week — a site that fixed HTTPS, or one that went down, changes the email you should send.
          </p>
        ) : desk.changes.map(item => (
          <article key={item.lead.id} style={{ borderTop: '1px solid var(--brd)', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{item.lead.name}</strong>
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{item.at ? timeAgo(item.at) : ''}</span>
            </div>
            <ul style={{ margin: '6px 0 8px', paddingLeft: 18, color: 'var(--txt2)', fontSize: 14 }}>
              {item.changes.slice(0, 4).map(c => (
                <li key={c.key + c.label}><span style={{ color: c.direction === 'broke' ? 'var(--red)' : c.direction === 'fixed' ? 'var(--green)' : 'var(--txt)' }}>{c.label}.</span> {c.detail}</li>
              ))}
            </ul>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => onUpdateLead({ ...item.lead, watchSeenAt: new Date().toISOString() })}>
              Mark seen
            </button>
          </article>
        ))}
      </section>

      <section style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 26, marginBottom: 8 }}>Best leads not contacted</h2>
        {desk.fresh.length === 0 ? (
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>No untouched leads. Run a scan or import a list.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {desk.fresh.map(l => (
              <div key={l.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{l.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt2)' }}>{l.findings?.[0]?.evidence || l.why || 'No measurement yet'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--fh)', fontSize: 22 }}>{l.score ?? '—'}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => copyProof(l)}>
                    {copied === l.id ? 'Copied' : 'Proof link'}
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onNav('leads')}>Open</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <GoalTracker user={user} leads={leads} onUpdate={onUpdateUser} onSearch={onSearch} />
      <WorkQueue leads={leads} onNav={onNav} onSearch={onSearch} />
    </div>
  )
}
