import { useMemo, useState } from 'react'
import Icon from '../../icons/Icon'
import { COUNTRIES } from '../../constants/services'
import { generateLeads, polishDraft, UpgradeRequiredError } from '../../utils/ai'
import { applyRescan } from '../../utils/watch'
import {
  agentLimits, parseGoal, businessPrefer, analysedKeep, selectForGoal,
  buildDigest, answerDesk, proposeAction, draftFollowUp,
} from '../../utils/agent'
import * as DB from '../../utils/db'
const I = Icon

export default function AgentDesk({ user, leads, onSave, onUpdateLead, onUpgrade }) {
  const limits = agentLimits(user)
  const [goalText, setGoalText] = useState('find 10 dentists in Austin with no online booking')
  const [countryOverride, setCountryOverride] = useState('')
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [found, setFound] = useState(null)
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState([])
  const [pending, setPending] = useState(null)
  const [draft, setDraft] = useState(null)
  const [polishNote, setPolishNote] = useState('')

  const parsed = useMemo(() => parseGoal(goalText, {
    maxCount: limits.leadCap,
    serviceId: user.svc || 'web',
  }), [goalText, limits.leadCap, user.svc])

  const country = countryOverride || parsed.goal.country
  const digest = useMemo(() => buildDigest(leads), [leads])
  const scansLabel = Number.isFinite(limits.scansLeft) ? `${limits.scansLeft} scan${limits.scansLeft === 1 ? '' : 's'} left` : 'Unlimited scans'

  const say = msg => setLog(p => [...p, msg])

  const run = async () => {
    setErr('')
    setFound(null)
    if (limits.sample) {
      setErr('This is the sample desk. A real scan measures sites on the server and needs your account.')
      return
    }
    const plan = parseGoal(goalText, { maxCount: limits.leadCap, serviceId: user.svc || 'web' })
    if (!plan.ok && !(plan.missing.length === 1 && plan.missing[0] === 'country' && country)) {
      setErr(plan.missing.includes('city')
        ? 'Name a city, like “in Austin”. I will not pick a place for you.'
        : 'Add a place before running this.')
      return
    }
    if (!country) {
      setErr('Confirm a country. I will not guess one that is not in the sentence or the city hint.')
      return
    }
    if (!limits.sample && Number.isFinite(limits.scansLeft) && limits.scansLeft <= 0) {
      setErr('No scans left. Upgrade or buy a scan pack. Asking the desk below does not use a scan.')
      if (onUpgrade) onUpgrade('More scans', 'growth')
      return
    }
    const goal = { ...plan.goal, country }
    setBusy(true)
    setLog(['Checking your scan allowance…'])
    const charge = await DB.consumeScan()
    if (!charge.allowed) {
      setBusy(false)
      setLog([])
      setErr(charge.reason === 'no_scans_left'
        ? 'You have no scans left this month.'
        : (charge.message || 'The scan could not start.'))
      return
    }
    try {
      const existing = leads.map(l => l.name)
      const rows = await generateLeads({
        service: user.svc || 'web',
        country: goal.country,
        city: goal.city,
        existingNames: existing,
        count: goal.count,
        maxCount: limits.leadCap,
        prefer: businessPrefer(goal),
        keep: analysedKeep(goal),
        onProgress: say,
      })
      const selected = selectForGoal(rows, goal)
      setFound({ goal, rows, ...selected, quota: {
        scansUsed: charge.scansUsed ?? user.scansUsed,
        bonusScans: charge.bonusScans ?? user.bonusScans,
      } })
      say(selected.matches.length
        ? `${selected.matches.length} matched the filter. Nothing is saved until you keep them.`
        : 'The scan finished. None of the measured sites matched the filter, so nothing was saved.')
    } catch (e) {
      setErr(e.message || 'The scan failed.')
    }
    setBusy(false)
  }

  const keep = () => {
    if (!found?.matches?.length) return
    onSave(found.matches.map(m => m.lead), found.quota)
  }

  const ask = (text) => {
    const q = text.trim()
    if (!q) return
    const action = proposeAction(q, leads)
    if (action?.type === 'draft') {
      setDraft({ ...action.draft, name: action.name, leadId: action.leadId })
      setPolishNote('')
      setThread(t => [...t, { role: 'you', text: q }, { role: 'desk', text: action.message }])
      setPending(null)
    } else if (action) {
      setPending(action)
      setThread(t => [...t, { role: 'you', text: q }, { role: 'desk', text: action.message }])
    } else {
      const answer = answerDesk(q, leads)
      setThread(t => [...t, { role: 'you', text: q }, { role: 'desk', text: answer.text, citations: answer.citations }])
      setPending(null)
    }
    setQuestion('')
  }

  const confirm = async () => {
    if (!pending) return
    const lead = leads.find(l => l.id === pending.leadId)
    if (!lead) { setPending(null); return }
    if (pending.type === 'move_stage') {
      onUpdateLead({ ...lead, status: pending.status })
      setThread(t => [...t, { role: 'desk', text: `${lead.name} is now “${pending.status}”. No email was sent.` }])
    }
    if (pending.type === 'recheck') {
      if (limits.sample) {
        setThread(t => [...t, { role: 'desk', text: 'The sample desk cannot fetch a live site.' }])
      } else {
        try {
          const measurement = await DB.auditSite(lead.website, lead.id)
          onUpdateLead(applyRescan(lead, measurement))
          setThread(t => [...t, { role: 'desk', text: `Re-checked ${lead.name}. Any change is on Today.` }])
        } catch (e) {
          setThread(t => [...t, { role: 'desk', text: e.message || 'The re-check failed.' }])
        }
      }
    }
    setPending(null)
  }

  const polish = async () => {
    if (!draft?.ok) return
    if (!limits.model) {
      setPolishNote('A model rewrite is on Pro and above. This draft already uses only the measurements listed.')
      if (onUpgrade) onUpgrade('AI draft rewrite', 'pro')
      return
    }
    setPolishNote('Rewriting from the same findings…')
    const lead = leads.find(l => l.id === draft.leadId)
    try {
      const text = await polishDraft({
        business: draft.name,
        website: lead?.website || '',
        evidence: (lead?.findings || []).slice(0, 6),
        draft: draft.body,
      })
      setDraft({ ...draft, body: text || draft.body })
      setPolishNote('Rewritten. Still not sent.')
    } catch (e) {
      if (e instanceof UpgradeRequiredError) {
        setPolishNote(e.message)
        if (onUpgrade) onUpgrade('AI draft rewrite', 'pro')
      } else setPolishNote(e.message || 'The rewrite failed. The measured draft is unchanged.')
    }
  }

  const copyDraft = async () => {
    if (!draft?.body) return
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`)
      setPolishNote('Copied. Paste it into your own email. Zenvylo did not send it.')
    } catch {
      setPolishNote('Could not copy from this browser.')
    }
  }

  return (
    <div>
      <p className="proof-kicker" style={{ color: 'var(--signal)' }}>Agent</p>
      <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: '6px 0 8px' }}>Ask the desk to do the work.</h1>
      <p style={{ color: 'var(--txt2)', maxWidth: 640, lineHeight: 1.5 }}>
        It plans a scan, keeps businesses whose measured checks match, and answers from leads you already saved.
        {` ${scansLabel}. `}
        Asking the desk does not use a scan. A model rewrite of a draft is on Pro (daily AI limit on the server). Nothing is emailed unless you copy it and send it yourself.
      </p>

      <section className="card" style={{ padding: 16, margin: '16px 0' }}>
        <label htmlFor="agent-goal" style={{ fontWeight: 650 }}>Prospecting goal</label>
        <textarea id="agent-goal" className="inp" rows={2} value={goalText} onChange={e => setGoalText(e.target.value)} style={{ marginTop: 8, width: '100%' }} />
        <div style={{ marginTop: 10 }}>
          {parsed.plan.map(line => <p key={line} style={{ fontSize: 14, color: 'var(--txt2)', margin: '4px 0' }}>{line}</p>)}
        </div>
        {parsed.goal.countryInferred && (
          <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>
            Country
            <select className="inp" value={country} onChange={e => setCountryOverride(e.target.value)} style={{ marginTop: 4 }}>
              <option value="">Choose…</option>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        )}
        {err && <p role="alert" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</p>}
        <button className="btn btn-lime" type="button" onClick={run} disabled={busy} style={{ marginTop: 12 }}>
          <I n="search" s={14} />{busy ? 'Working…' : 'Run this scan'}
        </button>
        {log.length > 0 && (
          <ol aria-live="polite" style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: 'var(--txt2)' }}>
            {log.map((line, i) => <li key={i}>{line}</li>)}
          </ol>
        )}
        {found && (
          <div style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: 22 }}>{found.matches.length} matched</h2>
            {found.matches.length === 0 && <p style={{ color: 'var(--txt2)' }}>Nothing to keep. The scan credit was still used.</p>}
            {found.matches.map(m => (
              <article key={m.lead.id || m.lead.name} style={{ borderTop: '1px solid var(--brd)', padding: '10px 0' }}>
                <strong>{m.lead.name}</strong>
                <span style={{ color: 'var(--txt3)', marginLeft: 8 }}>{m.lead.btype}</span>
                <p style={{ fontSize: 14, margin: '4px 0 0' }}>{m.citation.text}</p>
              </article>
            ))}
            {found.skipped.slice(0, 3).map(s => (
              <p key={(s.lead.id || s.lead.name) + s.reason} style={{ fontSize: 13, color: 'var(--txt3)' }}>{s.lead.name}: {s.reason}</p>
            ))}
            {found.matches.length > 0 && (
              <button className="btn btn-lime" type="button" onClick={keep}>Keep these on the desk</button>
            )}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22 }}>This week</h2>
        <p style={{ color: 'var(--txt2)' }}>{digest.summary}</p>
        <ul style={{ paddingLeft: 18 }}>
          {digest.events.slice(0, 5).map(e => (
            <li key={e.leadId + e.key + e.at} style={{ margin: '6px 0' }}><strong>{e.name}.</strong> {e.detail}</li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 22 }}>Ask your desk</h2>
        <p style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 8 }}>
          Try “which lead has no booking?” or “draft a follow-up for Harbour Coffee” or “move Harbour Coffee to contacted”.
        </p>
        <div aria-live="polite" style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          {thread.length === 0 && <p style={{ color: 'var(--txt2)' }}>Answers cite a saved check. If nothing on the desk matches, it says so.</p>}
          {thread.map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{m.role === 'you' ? 'You' : 'Desk'}</div>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.text}</p>
              {(m.citations || []).filter(c => !m.text.includes(c.text)).map(c => (
                <p key={c.leadId + c.text} style={{ fontSize: 13, color: 'var(--txt2)', margin: '4px 0 0' }}>
                  {c.name}: {c.text}
                </p>
              ))}
            </div>
          ))}
        </div>
        {pending?.needsConfirm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-lime" type="button" onClick={confirm}>Confirm</button>
            <button className="btn btn-ghost" type="button" onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); ask(question) }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="sr-only" htmlFor="desk-q">Question</label>
          <input id="desk-q" className="inp" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about a saved lead" style={{ flex: '1 1 220px' }} />
          <button className="btn btn-lime" type="submit">Ask</button>
        </form>
        {draft && (
          <div style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: 18 }}>{draft.subject || 'Draft'}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--fb)', fontSize: 14 }}>{draft.body}</pre>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" type="button" onClick={copyDraft}>Copy</button>
              <button className="btn btn-ghost" type="button" onClick={polish}>Rewrite with AI</button>
            </div>
            {polishNote && <p style={{ fontSize: 13, color: 'var(--txt2)' }}>{polishNote}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
