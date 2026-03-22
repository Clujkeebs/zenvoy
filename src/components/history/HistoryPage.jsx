import PageHeader from '../ui/PageHeader'
import { useState, useEffect } from 'react'
import Icon from '../../icons/Icon'
import { fmtDate } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

export default function HistoryPage({ user, onNav }) {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DB.getScans(user.email).then(s => { setScans(s); setLoading(false) })
  }, [user.email])

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--txt3)" }}>Loading…</div>
  if (scans.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon"><I n="clock" s={24} c="var(--txt3)"/></div>
      <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:16 }}>No Scan History</h3>
      <p style={{ color:"var(--txt2)",fontSize:13 }}>Your completed scans will appear here.</p>
    </div>
  )
  return (
    <div>
      <PageHeader title="Scan History" onBack={() => onNav("home")} onHome={() => onNav("home")} />
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {scans.map((s,i)=>(
          <div key={s.id||i} className="card" style={{ padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:700,fontSize:13 }}>{s.service}</div>
              <div style={{ fontSize:12,color:"var(--txt2)" }}>{s.city?s.city+", ":""}{s.country}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12,fontWeight:600 }}>{s.count||s.leadCount||"?"} leads</div>
              <div style={{ fontSize:11,color:"var(--txt3)" }}>{fmtDate(s.date||s.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
