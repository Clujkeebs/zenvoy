import { useState, useMemo } from 'react'
import Icon from '../../icons/Icon'
import LeadCard from './LeadCard'
import { STATUSES, STATUS_COLORS, SERVICES } from '../../constants/services'
import { canAI } from '../../constants/plans'
import { csvExport, scoreColor, demandColor } from '../../utils/helpers'
const I = Icon

export default function LeadsPage({ user, leads, onUpdate, onDelete, onSearch, onUpgrade }) {
  const [openId,    setOpenId]    = useState(null);
  const [status,    setStatus]    = useState("all");
  const [sort,      setSort]      = useState("score");
  const [q,         setQ]         = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [cmpIds,    setCmpIds]    = useState([]);
  const [showCmp,   setShowCmp]   = useState(false);

  const filtered = leads
    .filter(l=>status==="all"?true:l.status===status)
    .filter(l=>!savedOnly||l.saved)
    .filter(l=>!q||l.name.toLowerCase().includes(q.toLowerCase())||(l.btype||"").toLowerCase().includes(q.toLowerCase())||(l.city||"").toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>sort==="score"?(b.score-a.score):sort==="value"?((b.myMonthlyRate||b.suggestedMonthlyRate||0)-(a.myMonthlyRate||a.suggestedMonthlyRate||0)):sort==="demand"?((b.demandScore||0)-(a.demandScore||0)):(b.addedAt-a.addedAt));

  const toggleCmp = id => {
    if(cmpIds.includes(id)) setCmpIds(cmpIds.filter(x=>x!==id));
    else if(cmpIds.length<3) setCmpIds([...cmpIds,id]);
  };

  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <div>
          <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(18px,3vw,24px)",wordBreak:"break-word" }}>Leads</h2>
          <p style={{ color:"var(--txt2)",fontSize:13,marginTop:2 }}>{leads.length} total · {leads.filter(l=>l.saved).length} saved · {leads.filter(l=>l.status==="won").length} won</p>
        </div>
        <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
          {cmpIds.length>=2 && <button className="btn btn-blue" onClick={()=>setShowCmp(true)}><I n="layers" s={14}/>Compare ({cmpIds.length})</button>}
          {leads.length>0 && <button className="btn btn-ghost" onClick={()=>csvExport(leads)}><I n="download" s={14}/>Export CSV</button>}
          <button className="btn btn-lime" onClick={onSearch}><I n="search" s={14}/>New Search</button>
        </div>
      </div>

      <div style={{ display:"flex",gap:7,marginBottom:11,flexWrap:"wrap",alignItems:"center" }}>
        <input className="inp" placeholder="Search leads…" value={q} onChange={e=>setQ(e.target.value)} style={{ flex:"1 1 160px",minWidth:140,fontSize:13 }}/>
        <select className="inp" value={sort} onChange={e=>setSort(e.target.value)} style={{ width:"auto",fontSize:13,padding:"10px 12px" }}>
          <option value="score">Highest Score</option>
          <option value="demand">Highest Demand</option>
          <option value="value">Highest Rate</option>
          <option value="date">Newest First</option>
        </select>
        <button className={"btn "+(savedOnly?"btn-lime":"btn-ghost")} onClick={()=>setSavedOnly(!savedOnly)}>
          <I n="save" s={13}/>{savedOnly?"Show All":"Saved Only"}
        </button>
      </div>

      <div style={{ display:"flex",gap:4,marginBottom:14,flexWrap:"wrap" }}>
        {["all",...STATUSES].map(s=>{
          const cnt=s==="all"?leads.length:leads.filter(l=>l.status===s).length;
          return (
            <button key={s} onClick={()=>setStatus(s)}
              style={{ padding:"5px 11px",borderRadius:7,fontSize:12,fontWeight:600,
                background:status===s?"var(--lime)":"var(--s2)",color:status===s?"#0c0e13":"var(--txt2)",
                border:"1.5px solid "+(status===s?"var(--lime)":"var(--brd)"),cursor:"pointer",transition:"all .15s" }}>
              {s.charAt(0).toUpperCase()+s.slice(1)} ({cnt})
            </button>
          );
        })}
      </div>

      {cmpIds.length>0 && (
        <div style={{ marginBottom:11,padding:"8px 13px",background:"rgba(61,142,248,.06)",border:"1.5px solid rgba(61,142,248,.18)",borderRadius:9,
          display:"flex",alignItems:"center",gap:9,fontSize:13 }}>
          <I n="layers" s={13} c="var(--blue)"/>
          <span style={{ color:"var(--blue)" }}>Comparing {cmpIds.length} lead{cmpIds.length>1?"s":""}.</span>
          <span style={{ color:"var(--txt3)" }}>Select up to 3.</span>
          <button style={{ marginLeft:"auto",fontSize:12,color:"var(--red)",cursor:"pointer",background:"none",border:"none" }} onClick={()=>setCmpIds([])}>Clear</button>
        </div>
      )}

      {leads.length===0
        ? <div className="empty-state">
            <div className="empty-icon"><I n="target" s={32} c="var(--lime)"/></div>
            <h3 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:20 }}>No leads yet</h3>
            <p style={{ color:"var(--txt2)",fontSize:14,maxWidth:320,lineHeight:1.7 }}>Hit <strong style={{color:"var(--txt)"}}>New Search</strong> to discover local businesses that need your service — ranked by opportunity score.</p>
            <button className="btn btn-lime" style={{ padding:"12px 28px",fontSize:15,marginTop:4 }} onClick={onSearch}><I n="search" s={16}/>Find My First Leads</button>
          </div>
        : filtered.length===0
          ? <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--txt2)" }}>
              <I n="search" s={28}/><p style={{ marginTop:12 }}>No leads match your filters.</p>
            </div>
          : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {filtered.map(lead=>(
                <div key={lead.id} style={{ position:"relative" }}>
                  <div style={{ position:"absolute",top:15,right:50,zIndex:2 }} onClick={e=>e.stopPropagation()}>
                    <div style={{ cursor:"pointer" }} onClick={()=>toggleCmp(lead.id)} title="Compare">
                      <div style={{ width:15,height:15,borderRadius:4,border:"1.5px solid",
                        borderColor:cmpIds.includes(lead.id)?"var(--blue)":"var(--brd2)",
                        background:cmpIds.includes(lead.id)?"var(--blue)":"transparent",
                        display:"flex",alignItems:"center",justifyContent:"center" }}>
                        {cmpIds.includes(lead.id)&&<I n="check" s={9} c="#fff"/>}
                      </div>
                    </div>
                  </div>
                  <LeadCard lead={lead} userName={user.name} userPlan={user.plan}
                    open={openId===lead.id} onToggle={()=>setOpenId(openId===lead.id?null:lead.id)}
                    onUpdate={onUpdate} onDelete={onDelete} onUpgrade={onUpgrade}/>
                </div>
              ))}
            </div>
      }

      {/* Compare modal */}
      {showCmp && cmpIds.length>=2 && (()=>{
        const cmpLeads=leads.filter(l=>cmpIds.includes(l.id));
        return (
          <div className="modal-wrap" onClick={()=>setShowCmp(false)}>
            <div className="modal" style={{ maxWidth:780 }} onClick={e=>e.stopPropagation()}>
              <div style={{ padding:"17px 22px",borderBottom:"1.5px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:18 }}>Lead Comparison</h3>
                <button className="btn btn-ghost" style={{ padding:"5px 7px" }} onClick={()=>setShowCmp(false)}><I n="x" s={15}/></button>
              </div>
              <div style={{ padding:"20px 22px",overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                  <thead>
                    <tr>
                      <td style={{ padding:"8px 12px",color:"var(--txt3)",fontWeight:700,fontSize:11,textTransform:"uppercase" }}>Metric</td>
                      {cmpLeads.map(l=><td key={l.id} style={{ padding:"8px 12px",fontFamily:"var(--fh)",fontWeight:800,fontSize:14 }}>{l.name}</td>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {l:"Business Type",     f:l=>l.btype},
                      {l:"Location",          f:l=>l.city?l.city+", "+l.country:l.country},
                      {l:"Opp Score",         f:l=><b style={{color:scoreColor(l.score)}}>{l.score}/100</b>},
                      {l:"Demand",            f:l=><b style={{color:demandColor(l.demandScore||50)}}>{l.demandScore||"?"}/100</b>},
                      {l:"Competition",       f:l=>l.competitionScore||"?"},
                      {l:"Difficulty",        f:l=>l.difficultyRating||"?"},
                      {l:"Market",            f:l=>l.marketSaturation||"?"},
                      {l:"Monthly Rate",      f:l=>"$"+(l.myMonthlyRate||l.suggestedMonthlyRate||"?")},
                      {l:"Monthly Profit",    f:l=>"$"+Math.max(0,(l.myMonthlyRate||l.suggestedMonthlyRate||0)-(l.toolsCostMonthly||0))},
                      {l:"Setup Cost",        f:l=>"$"+(l.setupCost||"?")},
                      {l:"Reviews",           f:l=>l.reviews},
                      {l:"Rating",            f:l=>l.rating?"★"+l.rating:"N/A"},
                      {l:"PageSpeed",         f:l=>l.speed+"/100"},
                      {l:"SSL",               f:l=>l.ssl?"✓ Yes":"✗ No"},
                    ].map(row=>(
                      <tr key={row.l} style={{ borderTop:"1px solid var(--brd)" }}>
                        <td style={{ padding:"8px 12px",color:"var(--txt3)",fontSize:12 }}>{row.l}</td>
                        {cmpLeads.map(l=><td key={l.id} style={{ padding:"8px 12px" }}>{row.f(l)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
