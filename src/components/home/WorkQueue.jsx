import Icon from '../../icons/Icon'
import { buildWorkQueue } from '../../utils/workqueue'
import { summarize } from '../../utils/evidence'
const I = Icon

const TONES = {
  amber:  { color: 'var(--amber)',  bg: 'rgba(245,166,35,.06)',  brd: 'rgba(245,166,35,.2)' },
  lime:   { color: 'var(--lime)',   bg: 'rgba(198,241,53,.05)',  brd: 'rgba(198,241,53,.18)' },
  blue:   { color: 'var(--blue)',   bg: 'rgba(61,142,248,.06)',  brd: 'rgba(61,142,248,.18)' },
  purple: { color: 'var(--purple)', bg: 'rgba(167,109,255,.06)', brd: 'rgba(167,109,255,.2)' },
}

/**
 * The first thing you should see when you open the app: what to do today,
 * in order, with the reason attached.
 *
 * The dashboard used to open on six counters. Counters tell you how much work
 * exists; they don't tell you what to do next, which is the thing a freelancer
 * with forty half-worked leads actually needs.
 */
export default function WorkQueue({ leads, onNav, onSearch }) {
  const { groups, total } = buildWorkQueue(leads)

  if (leads.length === 0) return null

  if (total === 0) {
    return (
      <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'rgba(52,212,122,.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <I n="check" s={16} c="var(--green)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 14 }}>
              Nothing needs chasing
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
              Every open lead has been contacted and none have gone quiet. Good time to find more.
            </div>
          </div>
          <button className="btn btn-lime" style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }} onClick={onSearch}>
            <I n="search" s={13} />New scan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <I n="target" s={15} c="var(--lime)" />
          <span style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 15 }}>Today</span>
          <span className="chip c-gray" style={{ fontSize: 10 }}>{total} to work</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => onNav('leads')}>
          Open leads →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => {
          const tone = TONES[group.tone] || TONES.lime
          return (
            <div key={group.id} style={{
              border: '1.5px solid ' + tone.brd, background: tone.bg,
              borderRadius: 10, padding: '11px 13px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: tone.color }}>{group.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)' }}>{group.count}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8 }}>{group.hint}</div>

              {group.leads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => onNav('leads')}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', borderTop: '1px solid var(--brd)',
                    padding: '8px 0 7px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--fh)', fontWeight: 900, fontSize: 13,
                    color: tone.color, width: 26, flexShrink: 0,
                  }}>
                    {lead.score}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: 700, color: 'var(--txt)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {lead.name}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--txt3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {summarize(lead.findings || [], 1)}
                    </div>
                  </div>
                  <I n="right" s={12} c="var(--txt3)" />
                </button>
              ))}

              {group.count > group.leads.length && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', paddingTop: 7, borderTop: '1px solid var(--brd)' }}>
                  +{group.count - group.leads.length} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
