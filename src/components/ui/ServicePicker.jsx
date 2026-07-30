import { useState, useRef, useEffect, useMemo } from 'react'
import Icon from '../../icons/Icon'
import { SERVICES, normalizeServiceName } from '../../constants/services'
const I = Icon

/**
 * Pick a preset service or type your own.
 *
 * The preset list only ever covered twelve things people sell. Anyone selling
 * drone photography, POS installs, bookkeeping or menu design had to pick the
 * nearest wrong option, and every downstream prompt then described the wrong
 * service. Typing a service is now a first-class path: it flows through the
 * scan, the scoring and the AI copy the same way a preset does.
 *
 * Custom entries are remembered on the profile so they're one click next time.
 *
 * @param {string}   value        — selected preset id, or "" when custom
 * @param {string}   customValue  — the typed service name
 * @param {string[]} recent       — previously typed services (from the profile)
 * @param {Function} onChange     — ({ serviceId, customService }) => void
 */
export default function ServicePicker({ value, customValue, recent = [], onChange }) {
  const [typing, setTyping] = useState(!value && !!customValue)
  const [draft, setDraft] = useState(customValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (typing) inputRef.current?.focus()
  }, [typing])

  // De-duplicate against the presets so we don't offer "SEO" twice.
  const savedCustom = useMemo(() => {
    const presetLabels = new Set(SERVICES.map(s => s.label.toLowerCase()))
    const seen = new Set()
    return recent
      .map(normalizeServiceName)
      .filter(Boolean)
      .filter(r => {
        const k = r.toLowerCase()
        if (presetLabels.has(k) || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 6)
  }, [recent])

  const choosePreset = id => {
    setTyping(false)
    setDraft('')
    onChange({ serviceId: id, customService: '' })
  }

  const chooseCustom = raw => {
    const label = normalizeServiceName(raw)
    if (!label) return
    setDraft(label)
    setTyping(true)
    onChange({ serviceId: '', customService: label })
  }

  const customActive = !value && !!customValue

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span className="lbl">What are you selling?</span>
        <button
          type="button"
          onClick={() => (typing ? choosePreset(SERVICES[0].id) : setTyping(true))}
          style={{
            fontSize: 11, fontWeight: 700, background: 'none', border: 'none',
            color: 'var(--blue)', cursor: 'pointer', padding: 0,
          }}
        >
          {typing ? '← Pick from list' : 'Type my own →'}
        </button>
      </div>

      {typing ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              className="inp"
              placeholder="e.g. Drone photography, Bookkeeping, POS setup…"
              value={draft}
              maxLength={60}
              onChange={e => {
                setDraft(e.target.value)
                onChange({ serviceId: '', customService: normalizeServiceName(e.target.value) })
              }}
              style={{
                paddingRight: 74,
                borderColor: customActive ? 'var(--lime)' : 'var(--brd)',
              }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 10, color: 'var(--txt3)', pointerEvents: 'none',
            }}>
              {draft.length}/60
            </span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6, lineHeight: 1.5 }}>
            We'll still measure every prospect's website the same way — scoring
            just won't be tuned to your niche the way the presets are.
          </p>

          {savedCustom.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)', alignSelf: 'center' }}>Recent:</span>
              {savedCustom.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => chooseCustom(r)}
                  className="chip c-gray"
                  style={{
                    cursor: 'pointer', border: '1.5px solid var(--brd)',
                    background: draft.toLowerCase() === r.toLowerCase() ? 'rgba(198,241,53,.1)' : 'var(--s2)',
                    color: draft.toLowerCase() === r.toLowerCase() ? 'var(--lime)' : 'var(--txt2)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          gap: 6, marginTop: 6,
        }}>
          {SERVICES.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => choosePreset(s.id)}
              style={{
                padding: '9px 12px', borderRadius: 9,
                border: '1.5px solid ' + (value === s.id ? 'var(--lime)' : 'var(--brd)'),
                background: value === s.id ? 'rgba(198,241,53,.07)' : 'var(--s2)',
                textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              <I n={s.icon} s={13} c={value === s.id ? 'var(--lime)' : 'var(--txt2)'} />
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: value === s.id ? 'var(--lime)' : 'var(--txt)',
              }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
