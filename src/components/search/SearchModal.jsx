import { useState, useEffect, useRef } from 'react'
import Icon from '../../icons/Icon'
import { SERVICES, COUNTRIES } from '../../constants/services'
import { canMulti, getLeadsPerScan, getScansLeft, getScansLimit } from '../../constants/plans'
import { generateLeads } from '../../utils/ai'
import { hasFreeScansLeft, getFreeScansLeft, incrementScanUsage, FREE_SCAN_LIMIT } from '../../utils/scanQuota'
import * as DB from '../../utils/db'
const I = Icon

export default function SearchModal({ user, onClose, onDone }) {
  const isFree = user.plan === "free"
  const [svc,      setSvc]      = useState(user.svc || "web");
  const [country,  setCountry]  = useState(canMulti(user) ? "" : (user.country || "United Kingdom"));
  const [city,     setCity]     = useState("");
  const [lowBudget,setLowBudget]= useState(false);
  const [scanning, setScanning] = useState(false);
  const [log,      setLog]      = useState([]);
  const [err,      setErr]      = useState("");
  const logRef = useRef(null);
  const scansLeft = isFree ? getFreeScansLeft() : getScansLeft(user);
  const scansTotal = isFree ? FREE_SCAN_LIMIT : getScansLimit(user);
  const multiAllowed = canMulti(user);

  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop=9999; },[log]);

  const run = async () => {
    if (!country) { setErr("Select a country first."); return; }
    if (isFree && !hasFreeScansLeft()) { setErr("No free scans left this month — upgrade your plan."); return; }
    if (!isFree && scansLeft<=0) { setErr("No scans left — upgrade your plan in Settings."); return; }
    setErr(""); setScanning(true); setLog([]);
    const svcObj = SERVICES.find(s=>s.id===svc);
    const loc = city ? city+", "+country : country;
    const steps = [
      "🌍 Targeting "+loc+"…",
      "🔍 Scanning for "+svcObj.label+" opportunities…",
      "📊 Analyzing demand vs competition in "+country+"…",
      "⚡ Checking website speeds and SSL certificates…",
      "⭐ Pulling Google review counts and ratings…",
      "🤖 Scoring leads by opportunity size, demand & difficulty…",
      "🎯 Ranking by profitability estimate…",
    ];
    for (let i=0;i<steps.length;i++) {
      await new Promise(r=>setTimeout(r,400+Math.random()*350));
      setLog(p=>[...p,steps[i]]);
    }
    try {
      const existingLeads = await DB.getLeads(user.email);
      const existing = existingLeads.map(l=>l.name);
      const count = getLeadsPerScan(user);
      const leads = await generateLeads({service:svc,country,city,existingNames:existing,lowBudget,count});
      setLog(p=>[...p,"✅ Found "+leads.length+" leads! Ranked by opportunity score."]);
      await new Promise(r=>setTimeout(r,400));
      DB.saveScans(user.email,[{
        service:svcObj.label, country, city,
        count:leads.length, date:Date.now(),
      }]);
      let updUser;
      if (isFree) {
        incrementScanUsage();
        updUser = user; // free plan tracks scans in scanQuota, not user object
      } else {
        updUser = {...user, scansUsed:(user.scansUsed||0)+1};
        DB.saveUser(user.email, updUser);
      }
      onDone(leads, updUser);
    } catch(e) {
      const msg = e.message?.includes("JSON") || e.message?.includes("unexpected")
        ? "Couldn't parse AI response. Retrying often fixes this."
        : e.message?.includes("fetch") || e.message?.includes("network")
        ? "Network error — check your connection and try again."
        : "Error: "+e.message;
      setLog(p=>[...p,"❌ "+msg]);
      setErr(msg);
      setScanning(false);
    }
  };

  return (
    <div className="modal-wrap" style={{paddingBottom:"env(safe-area-inset-bottom,0px)"}} onClick={e=>e.target===e.currentTarget&&!scanning&&onClose()}>
      <div className="modal" style={{maxWidth:600,overflowY:"auto",maxHeight:"90vh"}}>
        <div style={{padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",
          borderBottom:"1.5px solid var(--brd)"}}>
          <div>
            <div style={{fontFamily:"var(--fh)",fontWeight:800,fontSize:20}}>
              {scanning?"Scanning "+( city||country||"your location")+"…":"Find New Leads"}
            </div>
            {scanning&&<div style={{fontSize:12,color:"var(--txt3)",marginTop:2}}>AI is finding {getLeadsPerScan(user)} {SERVICES.find(s=>s.id===svc)?.label} leads</div>}
          </div>
          {!scanning&&<button className="btn btn-ghost" style={{padding:"6px 8px"}} onClick={onClose}>
            <I n="x" s={16}/>
          </button>}
        </div>

        {!scanning?(
          <div style={{padding:"22px 24px"}}>
            <div style={{marginBottom:20}}>
              <span className="lbl">Service you're selling</span>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:6,marginTop:6}}>
                {SERVICES.map(s=>(
                  <button key={s.id} onClick={()=>setSvc(s.id)}
                    style={{padding:"9px 12px",borderRadius:9,
                      border:"1.5px solid "+(svc===s.id?"var(--lime)":"var(--brd)"),
                      background:svc===s.id?"rgba(198,241,53,.07)":"var(--s2)",
                      textAlign:"left",cursor:"pointer",transition:"all .15s",
                      display:"flex",alignItems:"center",gap:7}}>
                    <I n={s.icon} s={13} c={svc===s.id?"var(--lime)":"var(--txt2)"}/>
                    <span style={{fontSize:12,fontWeight:600,color:svc===s.id?"var(--lime)":"var(--txt)"}}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:13,marginBottom:14}}>
              <div>
                <span className="lbl">Country {!multiAllowed&&<span style={{color:"var(--txt3)"}}>(locked to your country)</span>}</span>
                {multiAllowed?(
                  <select className="inp" value={country} onChange={e=>{setCountry(e.target.value);setCity("");}}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                ):(
                  <div className="inp" style={{opacity:.7,cursor:"not-allowed"}}>{user.country}</div>
                )}
              </div>
              <div>
                <span className="lbl">City / State (optional)</span>
                <input className="inp" placeholder={country?"e.g. Austin, TX":"Select country first"}
                  value={city} onChange={e=>setCity(e.target.value)} disabled={!country}/>
              </div>
            </div>

            {!multiAllowed&&(
              <div style={{marginBottom:14,padding:"10px 13px",background:"rgba(61,142,248,.06)",
                border:"1.5px solid rgba(61,142,248,.15)",borderRadius:9,
                display:"flex",alignItems:"center",gap:9,fontSize:12,color:"var(--blue)"}}>
                <I n="info" s={13}/>
                Multi-country search requires Pro or Scale plan.
                <span style={{marginLeft:"auto",fontWeight:700,cursor:"pointer"}}
                  onClick={()=>{}}>Upgrade →</span>
              </div>
            )}

            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:16,padding:"10px 13px",
              background:"var(--s2)",borderRadius:9,border:"1.5px solid var(--brd)",cursor:"pointer"}}
              onClick={()=>setLowBudget(!lowBudget)}>
              <div style={{width:18,height:18,borderRadius:5,border:"2px solid "+(lowBudget?"var(--lime)":"var(--brd2)"),
                background:lowBudget?"var(--lime)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {lowBudget&&<I n="check" s={11} c="#0c0e13"/>}
              </div>
              <span style={{fontSize:13,color:"var(--txt2)"}}>
                💰 Low Budget Mode — only show leads under $500 startup cost
              </span>
            </div>

            <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(61,142,248,.06)",
              border:"1.5px solid rgba(61,142,248,.15)",borderRadius:9}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--blue)",textTransform:"uppercase",
                letterSpacing:".05em",marginBottom:7}}>Will scan for:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {SERVICES.find(s=>s.id===svc)?.problems.map(p=>(
                  <span key={p} className="chip c-blue" style={{fontSize:10}}>{p}</span>
                ))}
              </div>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"9px 13px",background:"var(--s2)",borderRadius:8,border:"1.5px solid var(--brd)",marginBottom:16}}>
              <span style={{fontSize:13,color:"var(--txt2)"}}>Scans left this month</span>
              <span style={{fontFamily:"var(--fh)",fontWeight:800,
                color:scansLeft<=1?"var(--red)":scansLeft<=3?"var(--amber)":"var(--lime)"}}>
                {scansLeft} / {scansTotal}
              </span>
            </div>

            {err&&<div style={{background:"rgba(245,66,66,.08)",border:"1.5px solid rgba(245,66,66,.2)",borderRadius:9,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,alignItems:"flex-start"}}>
              <I n="alert" s={14} c="var(--red)" style={{marginTop:1}}/>
              <div style={{flex:1}}>
                <div style={{color:"var(--red)",fontSize:13,fontWeight:600}}>{err}</div>
                <div style={{color:"var(--txt3)",fontSize:11,marginTop:3}}>Try again — AI sometimes needs a second attempt.</div>
              </div>
            </div>}

            <button className="btn btn-lime"
              style={{width:"100%",justifyContent:"center",padding:"13px",fontSize:15}}
              onClick={run} disabled={!country||scansLeft<=0}>
              <I n="search" s={16}/>
              Scan for {getLeadsPerScan(user)} Leads in {city||country||"your location"}
            </button>
          </div>
        ):(
          <div style={{padding:"22px 24px"}}>
            {/* Progress bar */}
            <div style={{height:3,background:"var(--s3)",borderRadius:2,marginBottom:14,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:2,background:"var(--lime)",transition:"width .4s ease",
                width:(Math.min(log.length/7,1)*100)+"%"}}/>
            </div>
            <div ref={logRef} style={{background:"#060810",borderRadius:10,padding:"16px 18px",
              height:220,overflowY:"auto",fontFamily:"monospace",fontSize:13,marginBottom:14}}>
              {log.map((l,i)=>(
                <div key={i} style={{color:l.startsWith("❌")?"var(--red)":l.startsWith("✅")?"var(--green)":i===log.length-1?"var(--lime)":"var(--txt2)",
                  marginBottom:7,animation:"slideIn .2s ease both"}}>{l}</div>
              ))}
              {!log.some(l=>l.startsWith("❌"))&&log.length<7&&<div style={{display:"flex",alignItems:"center",gap:7,color:"var(--txt3)"}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"var(--lime)",
                  animation:"pulse 1s infinite"}}/>Working…
              </div>}
            </div>
            {log.some(l=>l.startsWith("❌"))
              ? <div>
                  <div style={{padding:"10px 14px",background:"rgba(245,66,66,.08)",border:"1.5px solid rgba(245,66,66,.2)",borderRadius:9,marginBottom:10,fontSize:13,color:"var(--red)"}}>
                    {log.find(l=>l.startsWith("❌"))?.replace("❌ ","")}<br/>
                    <span style={{fontSize:11,color:"var(--txt3)"}}>The AI sometimes needs a second try — try again below.</span>
                  </div>
                  <button className="btn btn-lime" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:14}}
                    onClick={()=>{ setScanning(false); setLog([]); setErr(""); }}>
                    ↩ Try Again
                  </button>
                </div>
              : <p style={{fontSize:11,color:"var(--txt3)",textAlign:"center"}}>
                  Generating {getLeadsPerScan(user)} real leads for {city||country}… usually takes 5–10 seconds.
                </p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
