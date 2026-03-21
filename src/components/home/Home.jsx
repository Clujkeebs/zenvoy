import Icon from '../../icons/Icon'
import { PLANS, getScansLeft, getScansLimit } from '../../constants/plans'
import { fmtMoney, fmtDate } from '../../utils/helpers'
import { STATUS_COLORS } from '../../constants/services'
import { isTrialActive } from '../../utils/trial'
const I = Icon

export default function Home({ user, leads, clients, onSearch, onNav }) {
  const saved     = leads.filter(l=>l.saved);
  const today     = new Date().toISOString().slice(0,10);
  const followUps = leads.filter(l=>l.followUpDate&&l.followUpDate<=today&&!["won","lost"].includes(l.status));
  const pipeline  = leads.filter(l=>["contacted","interested","proposal sent","negotiating"].includes(l.status));
  const won       = leads.filter(l=>l.status==="won");
  const pipeVal   = pipeline.reduce((a,l)=>a+(l.myMonthlyRate||l.suggestedMonthlyRate||0),0);
  const wonVal    = won.reduce((a,l)=>a+(l.myMonthlyRate||l.suggestedMonthlyRate||0),0);
  const totalMRR  = leads.reduce((a,l)=>a+(l.status!=="lost"?(l.myMonthlyRate||l.suggestedMonthlyRate||0):0),0);
  const recent    = [...leads].sort((a,b)=>b.addedAt-a.addedAt).slice(0,6);
  const scansLeft = getScansLeft(user);
  const onTrial   = isTrialActive(user);
  const plan      = PLANS[user.plan]||PLANS.starter;

  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:28,letterSpacing:"-.02em" }}>
            Welcome back, {user.name.split(" ")[0]} 👋
          </h1>
          <p style={{ color:"var(--txt2)",fontSize:14,marginTop:4 }}>
            {plan.name} plan · {scansLeft} scan{scansLeft!==1?"s":""} left this month
            {onTrial && <span style={{ marginLeft:8,color:"var(--purple)",fontWeight:700 }}>· Trial: {trialDaysLeft(user)} days left</span>}
          </p>
        </div>
        <button className="btn btn-lime" style={{ fontSize:15,padding:"12px 24px" }} onClick={onSearch}>
          <I n="search" s={16}/>Find New Leads
        </button>
      </div>

      {onTrial && (
        <div className="trial-banner fu" style={{ marginBottom:16 }}>
          <I n="crown" s={16} c="var(--purple)"/>
          <span style={{ color:"var(--txt)",fontWeight:600 }}>Pro Trial Active</span>
          <span style={{ color:"var(--txt2)" }}> — {trialDaysLeft(user)} days left. Full access to AI tools and all countries.</span>
          <button className="btn btn-ghost" style={{ marginLeft:"auto",fontSize:12,padding:"4px 10px" }} onClick={()=>onNav("settings")}>
            Upgrade to keep access →
          </button>
        </div>
      )}

      {/* Scan pill */}
      <div style={{ display:"inline-flex",alignItems:"center",gap:10,padding:"9px 16px",
        background:"var(--s2)",border:"1.5px solid "+(scansLeft===0?"rgba(245,66,66,.4)":scansLeft<=2?"rgba(245,166,35,.3)":"var(--brd)"),
        borderRadius:30,marginBottom:22 }}>
        <I n="zap" s={13} c={scansLeft===0?"var(--red)":scansLeft<=2?"var(--amber)":"var(--lime)"}/>
        <span style={{ fontSize:13,fontWeight:700,color:scansLeft===0?"var(--red)":scansLeft<=2?"var(--amber)":"var(--txt)" }}>
          {scansLeft} scan{scansLeft!==1?"s":""} remaining
        </span>
        <div style={{ width:60,height:4,borderRadius:2,background:"var(--s3)",overflow:"hidden" }}>
          <div style={{ height:"100%",borderRadius:2,background:scansLeft===0?"var(--red)":scansLeft<=2?"var(--amber)":"var(--lime)",
            width:((scansLeft/getScansLimit(user))*100)+"%" }}/>
        </div>
        {scansLeft===0 && <button style={{ fontSize:11,color:"var(--blue)",fontWeight:700,cursor:"pointer",background:"none",border:"none" }}
          onClick={()=>onNav("settings")}>Upgrade now →</button>}
      </div>

      {/* Stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:20 }}>
        {[
          { l:"Total Leads",    v:leads.length,    icon:"target",   c:"var(--lime)",   to:"leads" },
          { l:"Saved",          v:saved.length,    icon:"save",     c:"var(--blue)",   to:"leads" },
          { l:"In Pipeline",    v:pipeline.length, icon:"trending", c:"var(--amber)",  to:"leads", sub:fmtMoney(pipeVal)+" /mo" },
          { l:"Deals Won",      v:won.length,      icon:"check",    c:"var(--green)",  to:"leads", sub:fmtMoney(wonVal)+" /mo" },
          { l:"Clients",        v:clients.length,  icon:"users",    c:"var(--purple)", to:"clients" },
          { l:"Potential MRR",  v:"$"+totalMRR.toLocaleString(), icon:"dollar", c:"var(--teal)", sub:"from active leads" },
        ].map((s,i)=>(
          <div key={i} className="card card-h fu" style={{ padding:"15px 17px",cursor:s.to?"pointer":"default",animationDelay:i*0.05+"s" }}
            onClick={s.to?()=>onNav(s.to):undefined}>
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:8 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:s.c+"14",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <I n={s.icon} s={13} c={s.c}/>
              </div>
              <span style={{ fontSize:11,color:"var(--txt2)" }}>{s.l}</span>
            </div>
            <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:22,color:s.c }}>{s.v}</div>
            {s.sub && <div style={{ fontSize:10,color:"var(--txt3)",marginTop:2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Follow-ups */}
      {followUps.length>0 && (
        <div style={{ marginBottom:16,padding:"13px 17px",background:"rgba(245,166,35,.06)",border:"1.5px solid rgba(245,166,35,.2)",borderRadius:12 }}>
          <div style={{ fontFamily:"var(--fh)",fontWeight:700,fontSize:14,color:"var(--amber)",marginBottom:9,display:"flex",gap:7,alignItems:"center" }}>
            <I n="alert" s={14} c="var(--amber)"/>{followUps.length} Follow-up{followUps.length>1?"s":""} Due Today
          </div>
          {followUps.map(l=>(
            <div key={l.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",
              marginBottom:4,background:"rgba(245,166,35,.04)",borderRadius:8,border:"1px solid rgba(245,166,35,.12)" }}>
              <div>
                <span style={{ fontWeight:600,fontSize:13 }}>{l.name}</span>
                <span style={{ fontSize:12,color:"var(--txt2)",marginLeft:8 }}>{l.btype}</span>
              </div>
              <span className={"chip "+(STATUS_COLORS[l.status]||"c-gray")} style={{ fontSize:10 }}>{l.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline + Recent */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(260px,100%),1fr))",gap:12,marginBottom:12 }}>
        <div className="card" style={{ padding:19 }}>
          <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",gap:7,alignItems:"center" }}>
            <I n="trending" s={14} c="var(--amber)"/>Deal Pipeline
          </div>
          {["contacted","interested","proposal sent","negotiating","won","lost"].map(st=>{
            const cnt=leads.filter(l=>l.status===st).length;
            const val=leads.filter(l=>l.status===st).reduce((a,l)=>a+(l.myMonthlyRate||l.suggestedMonthlyRate||0),0);
            return (
              <div key={st} style={{ marginBottom:8 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3 }}>
                  <span style={{ color:"var(--txt2)" }}>{st.charAt(0).toUpperCase()+st.slice(1)}</span>
                  <span style={{ fontWeight:600 }}>{cnt}{val>0&&<span style={{ color:"var(--txt3)",fontWeight:400 }}> · ${val.toLocaleString()}/mo</span>}</span>
                </div>
                <div className="prog">
                  <div className="prog-fill" style={{ width:(leads.length?(cnt/leads.length)*100:0)+"%",
                    background:st==="won"?"var(--green)":st==="lost"?"var(--red)":"var(--amber)" }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div className="card" style={{ padding:19 }}>
          <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",gap:7,alignItems:"center" }}><I n="clock" s={14} c="var(--blue)"/>Recent Leads</div>
            {leads.length>6 && <button className="btn btn-ghost" style={{ fontSize:11,padding:"4px 9px" }} onClick={()=>onNav("leads")}>View all</button>}
          </div>
          {recent.length===0
            ? <div style={{ color:"var(--txt3)",fontSize:13,textAlign:"center",padding:"20px 0" }}>Run a search to see leads here.</div>
            : recent.map(l=>(
              <div key={l.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--brd)" }}>
                <div>
                  <div style={{ fontWeight:600,fontSize:13 }}>{l.name}</div>
                  <div style={{ fontSize:11,color:"var(--txt3)" }}>{l.serviceLabel}</div>
                </div>
                <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"var(--green)" }}>${(l.myMonthlyRate||l.suggestedMonthlyRate||0).toLocaleString()}/mo</span>
                  <span className={"chip "+(STATUS_COLORS[l.status]||"c-gray")} style={{ fontSize:10 }}>{l.status}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
