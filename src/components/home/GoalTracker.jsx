import { useState } from 'react'
import Icon from '../../icons/Icon'
import { pipelineStats } from '../../utils/workqueue'
import { getCurrSym } from '../../constants/services'
const I = Icon

/**
 * "Am I on track this month, and what would close the gap?"
 *
 * The dashboard could already tell you how many leads you had. It couldn't
 * tell you whether you were going to make rent. This turns won revenue into
 * the only number most freelancers actually care about, and — more usefully —
 * converts the shortfall into a concrete number of clients at *your* average
 * deal size, so the answer is "sign 2 more" rather than "try harder".
 */
export default function GoalTracker({ user, leads, onUpdate, onSearch }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(user.monthlyGoal || ''))

  const sym = getCurrSym(user)
  const goal = Number(user.monthlyGoal) || 0
  const stats = pipelineStats(leads)

  const won = stats.wonValue
  const pct = goal > 0 ? Math.min(100, Math.round((won / goal) * 100)) : 0
  const gap = Math.max(0, goal - won)

  // Average of what you've actually closed, not what you hoped to charge.
  const wonDeals = leads.filter(l => l.status === 'won')
  const avgDeal = wonDeals.length
    ? Math.round(wonDeals.reduce((n, l) => n + (l.wonValue || l.myMonthlyRate || l.suggestedMonthlyRate || 0), 0) / wonDeals.length)
    : 0
  const dealsNeeded = gap > 0 && avgDeal > 0 ? Math.ceil(gap / avgDeal) : 0

  const save = () => {
    const v = Math.max(0, Math.round(Number(draft) || 0))
    onUpdate({ ...user, monthlyGoal: v })
    setEditing(false)
  }

  if (!goal && !editing) {
    return (
      <div className="card" style={{ padding: '15px 19px', marginBottom: 16, display: 'flex',
        alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <I n="target" s={15} c="var(--lime)" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 14 }}>Set a monthly revenue goal</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
            We'll track it against what you've actually closed and tell you how many more clients you need.
          </div>
        </div>
        <button className="btn btn-lime" style={{ fontSize: 12, padding: '8px 14px' }}
          onClick={() => setEditing(true)}>Set goal</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '17px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <I n="trending" s={15} c="var(--lime)" />
          <span style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 15 }}>This month</span>
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--txt2)' }}>{sym}</span>
            <input className="inp" type="number" min="0" value={draft} autoFocus
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={{ width: 110, fontSize: 13, padding: '6px 9px' }} />
            <button className="btn btn-lime" style={{ fontSize: 12, padding: '6px 12px' }} onClick={save}>Save</button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 9px' }}
              onClick={() => { setDraft(String(goal || '')); setEditing(false) }}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => setEditing(true)}>Goal: {sym}{goal.toLocaleString()}/mo · Edit</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--fh)', fontWeight: 900, fontSize: 28,
          color: pct >= 100 ? 'var(--green)' : 'var(--txt)' }}>
          {sym}{won.toLocaleString()}
        </span>
        <span style={{ fontSize: 13, color: 'var(--txt3)' }}>
          of {sym}{goal.toLocaleString()} closed
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800,
          color: pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--lime)' : 'var(--amber)' }}>
          {pct}%
        </span>
      </div>

      <div style={{ height: 7, borderRadius: 4, background: 'var(--s3)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%', borderRadius: 4, width: pct + '%', transition: 'width .5s ease',
          background: pct >= 100 ? 'var(--green)' : 'linear-gradient(90deg,var(--lime),var(--green))',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {pct >= 100 ? (
          <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
            Goal hit. Everything from here is upside.
          </span>
        ) : dealsNeeded > 0 ? (
          <span style={{ fontSize: 13, color: 'var(--txt2)' }}>
            <strong style={{ color: 'var(--txt)' }}>{dealsNeeded} more client{dealsNeeded > 1 ? 's' : ''}</strong>
            {' '}at your average of {sym}{avgDeal.toLocaleString()}/mo closes the {sym}{gap.toLocaleString()} gap.
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--txt2)' }}>
            {sym}{gap.toLocaleString()} to go. Close your first deal and we'll work out how many more you need.
          </span>
        )}

        {stats.inFlight > 0 && (
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
            · {sym}{stats.pipelineValue.toLocaleString()} in play across {stats.inFlight} open deal{stats.inFlight > 1 ? 's' : ''}
          </span>
        )}

        {pct < 100 && (
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px', marginLeft: 'auto' }}
            onClick={onSearch}>
            <I n="search" s={11} />Find more leads
          </button>
        )}
      </div>

      {stats.contacted >= 5 && (
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--brd)',
          fontSize: 12, color: 'var(--txt3)' }}>
          You close <strong style={{ color: 'var(--txt2)' }}>{Math.round(stats.winRate * 100)}%</strong> of
          the leads you contact — so roughly{' '}
          <strong style={{ color: 'var(--txt2)' }}>
            {stats.winRate > 0 ? Math.ceil(dealsNeeded / stats.winRate) || 0 : 0}
          </strong>{' '}
          more conversations to get there.
        </div>
      )}
    </div>
  )
}
