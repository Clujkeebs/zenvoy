import Icon from '../../icons/Icon'
import { fmtDate } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

export default function HistoryPage({ user }) {
  const scans=DB.getScans(user.email);
  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(18px,3vw,24px)",marginBottom:20,wordBreak:"break-word" }}>Scan History</h2>
      {scans.length===0
        ? <div style={{ textAlign:"center",padding:"80px 20px",color:"var(--txt2)" }}>
            <I n="clock" s={36}/><p style={{ marginTop:14 }}>No scans yet. Run your first search!</p>
          </div>
        : <div className="card" style={{ overflow:"hidden" }}>
            {scans.map((s,i)=>(
              <div key={s.id} className="fu" style={{ display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",gap:12,padding:"12px 18px",borderBottom:i<scans.length-1?"1.5px solid var(--brd)":"none",animationDelay:i*0.04+"s" }}>
                <div>
                  <div style={{ fontWeight:600,fontSize:14 }}>{s.service}</div>
                  <div style={{ fontSize:12,color:"var(--txt2)",marginTop:2 }}>{s.city?s.city+", ":""}{s.country} · {fmtDate(s.date)}</div>
                </div>
                <span className="chip c-lime"><I n="target" s={10}/>{s.count} leads</span>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
