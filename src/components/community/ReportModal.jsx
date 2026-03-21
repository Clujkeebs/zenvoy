import { useState } from 'react'
import Icon from '../../icons/Icon'
import * as DB from '../../utils/db'

const REASONS = [
  "Spam or advertising",
  "Harassment or bullying",
  "Inappropriate content",
  "Impersonation",
  "Misinformation",
  "Other",
]

export default function ReportModal({ reporterId, offenderId, offenderName, messageId, onClose, onDone }) {
  const [reason, setReason] = useState("")
  const [detail, setDetail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const submit = () => {
    if (!reason) return
    DB.saveReport({
      reporterId,
      offenderId,
      offenderName: offenderName || "Unknown",
      messageId: messageId || null,
      reason,
      detail: detail.trim(),
      status: "pending",
    })
    setSubmitted(true)
    setTimeout(() => { onDone?.(); onClose() }, 1500)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(10px)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--s1)", border: "1.5px solid var(--brd2)", borderRadius: 16, padding: "24px", maxWidth: 420, width: "100%", animation: "pop .2s ease both" }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Icon n="check" s={32} c="var(--green)" />
            <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 18, marginTop: 12 }}>Report Submitted</div>
            <p style={{ color: "var(--txt2)", fontSize: 13, marginTop: 6 }}>We'll review this within 24 hours.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 17 }}>
                Report {messageId ? "Message" : "User"}
              </div>
              <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={onClose}>
                <Icon n="x" s={14} />
              </button>
            </div>

            {offenderName && (
              <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 14 }}>
                Reporting: <strong style={{ color: "var(--txt2)" }}>{offenderName}</strong>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  style={{
                    padding: "10px 14px", borderRadius: 9, textAlign: "left", fontSize: 13,
                    background: reason === r ? "rgba(198,241,53,.07)" : "var(--s2)",
                    border: "1.5px solid " + (reason === r ? "var(--lime)" : "var(--brd)"),
                    color: reason === r ? "var(--lime)" : "var(--txt)",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              className="inp"
              placeholder="Additional details (optional)..."
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={3}
              style={{ resize: "vertical", marginBottom: 16 }}
            />

            <button className="btn btn-red" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={!reason}>
              <Icon n="flag" s={14} /> Submit Report
            </button>
          </>
        )}
      </div>
    </div>
  )
}
