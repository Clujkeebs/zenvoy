import { useEffect, useState } from 'react'
import Icon from '../../icons/Icon'
import { PLANS, getScansLeft, getBonusScans } from '../../constants/plans'
import { timeAgo } from '../../utils/helpers'
import { buildDesk } from '../../utils/desk'
import { nextActions, buildDigest } from '../../utils/agent'
import { applyRescan, watchableLeads } from '../../utils/watch'
import { proofLink } from '../../utils/proof'
import { localNotices, seenNoticeIds, dismissNotice } from '../../utils/notices'
import { SITE_ORIGIN } from '../../constants/site'
import * as DB from '../../utils/db'
import WorkQueue from './WorkQueue'
import GoalTracker from './GoalTracker'
const I = Icon

export default function Home({ user, leads, clients, onSearch, onNav, onUpdateUser, onUpdateLead, onAddClient, onShowSetup }) {
  const desk = buildDesk(leads)
  const actions = nextActions(leads)
  const digest = buildDigest(leads)
  const scansLeft = getScansLeft(user) + getBonusScans(user)
  const plan = PLANS[user.plan] || PLANS.free
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')
  const [hidden, setHidden] = useState(() => seenNoticeIds())
  const [serverNotices, setServerNotices] = useState([])

  useEffect(() => {
    if (user.sample) return undefined
    let gone = false
    DB.listDeskNotices().then(rows => { if (!gone) setServerNotices(rows) })
    return () => { gone = true }
  }, [user.sample])

  const notices = [
    ...serverNotices.filter(item => !item.readAt),
    ...localNotices(leads).filter(item => !hidden.has(item.id)),
  ].slice(0, 8)

  const hideNotice = (item) => {
    if (item.server) {
      DB.markNoticeRead(item.id)
      setServerNotices(prev => prev.filter(row => row.id !== item.id))
      return
    }
    setHidden(dismissNotice(item.id))
  }

  const saveInterest = (item) => {
    onAddClient?.({
      name: item.businessName || 'Audit reply',
      status: 'prospect',
      notes: item.body || '',
      btype: '',
      phone: '',
      website: '',
      monthly: '',
    })
  }

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
    let failed = 0
    for (const lead of targets) {
      try {
        const measurement = await DB.auditSite(lead.website, lead.id)
        const next = applyRescan(lead, measurement)
        if ((next.watchLog || []).length > (lead.watchLog || []).length) changed += 1
        onUpdateLead(next)
      } catch {
        failed += 1
      }
    }
    setBusy(false)
    if (failed && !changed) setNote(`${failed} site${failed === 1 ? '' : 's'} could not be re-checked.`)
    else if (changed) setNote(`${changed} site${changed === 1 ? '' : 's'} changed since the last check.`)
    else setNote('Checked. Nothing measurable changed on those sites.')
  }

  const copyProof = async (lead) => {
    try {
      const { url } = await proofLink(lead, user.name, window.location.origin || SITE_ORIGIN, {
        ownerId: user.sample ? undefined : user.id,
      })
      try {
        await navigator.clipboard.writeText(url)
        setNote('Copied. Paste it to the business. They can open it with no account.')
      } catch {
        setNote(url)
      }
      if (!user.sample) DB.saveProof(lead.id, lead.name, { url })
      setCopied(lead.id)
      setTimeout(() => setCopied(''), 4000)
    } catch {
      setNote('Could not build a proof link from this lead.')
    }
  }

  return (
    <div>
      {user.sample && (
        <div className="sample-banner">
          Sample desk. Harbour Coffee, Loom & Dye and Pike Plumbing are examples, not live scans. Sign up to measure real businesses.
          {' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginLeft: 8 }} onClick={onShowSetup}>Show setup steps</button>
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

      {notices.length > 0 && (
        <section className="card" style={{ padding: 16, marginBottom: 14 }} aria-label="Notices">
          <h2 style={{ fontSize: 26 }}>For you today</h2>
          <p style={{ color: 'var(--txt3)', fontSize: 13, marginTop: 6 }}>
            These stay on your desk. Nothing here has been emailed to a business.
          </p>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 10, marginTop: 10 }}>
            {notices.map(item => (
              <li key={item.id} style={{ borderTop: '1px solid var(--brd)', paddingTop: 10 }}>
                <strong>{item.title}</strong>
                <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 4 }}>{item.body}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {item.kind === 'interest' && (
                    <button type="button" className="btn btn-lime" style={{ fontSize: 12 }} onClick={() => saveInterest(item)}>
                      Save as client
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} aria-label={`Dismiss ${item.title}`} onClick={() => hideNotice(item)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 26 }}>Next</h2>
          <button className="btn btn-ghost" type="button" style={{ fontSize: 12 }} onClick={() => onNav('agent')}>Open the agent</button>
        </div>
        <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 6 }}>{digest.summary}</p>
        {actions.length === 0 ? (
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 8 }}>
            {leads.length === 0
              ? 'Run a scan first. Pick what you sell and a place. The desk fills in after businesses are saved.'
              : 'Nothing to do yet. Run a scan, or give the agent a goal.'}
          </p>
        ) : (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {actions.slice(0, 3).map(a => (
              <li key={a.id} style={{ margin: '6px 0', fontSize: 14 }}>
                <strong>{a.title}.</strong> {a.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 26 }}>What changed</h2>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{desk.watching} site{desk.watching === 1 ? '' : 's'} on watch</span>
        </div>
        <p style={{ color: 'var(--txt3)', fontSize: 13, marginTop: 6 }}>
          A line appears here only when a later measurement differs. The first check of a site is not a change.
        </p>
        {desk.changes.length === 0 ? (
          <p style={{ color: 'var(--txt2)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            {leads.length === 0
              ? 'Nothing is on watch yet. After a scan, come back and re-check. A change shows up here only when a later measurement differs.'
              : 'Nothing new since you last looked. Re-check a saved site after a week. A site that fixed HTTPS, or one that went down, changes the note you should send.'}
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
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>
            {leads.length === 0 ? 'No leads yet. A scan is the first step.' : 'No untouched leads. Run a scan or import a list.'}
          </p>
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
