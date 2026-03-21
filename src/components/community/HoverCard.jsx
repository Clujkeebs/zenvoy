import { useState, useRef, useEffect } from 'react'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import { PLANS } from '../../constants/plans'
import { getRoleBadge } from '../../utils/roles'
import { fmtDate } from '../../utils/helpers'

export default function HoverCard({ user, children, onReport }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const timerRef = useRef(null)

  const open = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 280) })
      }
      setShow(true)
    }, 400)
  }

  const close = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShow(false), 200)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!user) return children

  const plan = PLANS[user.plan] || PLANS.free
  const badge = getRoleBadge(user)

  return (
    <>
      <span ref={triggerRef} onMouseEnter={open} onMouseLeave={close} style={{ cursor: "pointer" }}>
        {children}
      </span>

      {show && (
        <div
          onMouseEnter={() => clearTimeout(timerRef.current)}
          onMouseLeave={close}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 600,
            background: "var(--s1)", border: "1.5px solid var(--brd2)", borderRadius: 14,
            padding: 16, width: 260, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
            animation: "pop .15s ease both",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <Avatar user={user} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </span>
                <RoleBadge user={user} size={13} />
              </div>
              <div style={{ fontSize: 11, color: badge.color, fontWeight: 700, textTransform: "uppercase" }}>
                {badge.label}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "var(--s2)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--txt3)", marginBottom: 2 }}>Plan</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: plan.color }}>{plan.name}</div>
            </div>
            <div style={{ background: "var(--s2)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--txt3)", marginBottom: 2 }}>Joined</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user.joinedAt ? fmtDate(user.joinedAt) : "—"}</div>
            </div>
          </div>

          {onReport && (
            <button
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "7px" }}
              onClick={() => { setShow(false); onReport(user) }}
            >
              Report User
            </button>
          )}
        </div>
      )}
    </>
  )
}
