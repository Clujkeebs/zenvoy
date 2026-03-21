import { useState, memo } from 'react'
import Icon from '../../icons/Icon'
import { STATUS_COLORS, STATUSES } from '../../constants/services'
import { scoreColor, demandColor } from '../../utils/helpers'
import { genOutreach, genRoadmap, genProposal, genAudit, genPricingAdvice, genScript, genServicePackages, genFollowUpSequence } from '../../utils/ai'
const I = Icon

const LeadCard = memo(function LeadCard({ lead, onUpdate, onDelete, userName, userPlan, open, onToggle, onUpgrade }) {
  const userCanAI   = ["pro","scale"].includes(userPlan);
  const userIsScale = userPlan === "scale";

  const [noteOpen,     setNoteOpen]     = useState(false);
  const [noteVal,      setNoteVal]      = useState(lead.notes || "");
  const [outreach,     setOutreach]     = useState("");
  const [outType,      setOutType]      = useState("email");
  const [outBusy,      setOutBusy]      = useState(false);
  const [showOut,      setShowOut]      = useState(false);
  const [roadmap,      setRoadmap]      = useState("");
  const [roadBusy,     setRoadBusy]     = useState(false);
  const [showRoad,     setShowRoad]     = useState(false);
  const [proposal,     setProposal]     = useState("");
  const [propBusy,     setPropBusy]     = useState(false);
  const [showProp,     setShowProp]     = useState(false);
  const [pricing,      setPricing]      = useState("");
  const [priceBusy,    setPriceBusy]    = useState(false);
  const [showPrice,    setShowPrice]    = useState(false);
  const [audit,        setAudit]        = useState("");
  const [auditBusy,    setAuditBusy]    = useState(false);
  const [showAudit,    setShowAudit]    = useState(false);
  const [script,       setScript]       = useState("");
  const [scriptBusy,   setScriptBusy]   = useState(false);
  const [showScript,   setShowScript]   = useState(false);
  const [packages,     setPackages]     = useState("");
  const [pkgBusy,      setPkgBusy]      = useState(false);
  const [showPkg,      setShowPkg]      = useState(false);
  const [followUp,     setFollowUp]     = useState("");
  const [fuBusy,       setFuBusy]       = useState(false);
  const [showFU,       setShowFU]       = useState(false);
  const [showCostTip,  setShowCostTip]  = useState(false);
  const [myRate,       setMyRate]       = useState(String(lead.myMonthlyRate || lead.suggestedMonthlyRate || ""));
  const [copied,       setCopied]       = useState("");

  const sc  = scoreColor(lead.score);
  const upd = ch => onUpdate({ ...lead, ...ch });

  const copy = (txt, key) => { navigator.clipboard.writeText(txt); setCopied(key); setTimeout(()=>setCopied(""),2000); };

  const runOut = async type => {
    setOutBusy(true); setOutreach("");
    try { setOutreach(await genOutreach(lead, type, userName)); }
    catch(e) { setOutreach("Error: "+e.message); }
    setOutBusy(false);
  };
  const runRoadmap   = async () => { if(roadmap) return; setRoadBusy(true); try { setRoadmap(await genRoadmap(lead, userName)); } catch(e){ setRoadmap("Error: "+e.message); } setRoadBusy(false); };
  const runProposal  = async () => { if(proposal) return; setPropBusy(true); try { setProposal(await genProposal(lead, userName)); } catch(e){ setProposal("Error: "+e.message); } setPropBusy(false); };
  const runPricing   = async () => { if(pricing) return; setPriceBusy(true); try { setPricing(await genPricingAdvice(lead)); } catch(e){ setPricing("Error: "+e.message); } setPriceBusy(false); };
  const runAudit     = async () => { if(audit) return; setAuditBusy(true); try { setAudit(await genAudit(lead, userName)); } catch(e){ setAudit("Error: "+e.message); } setAuditBusy(false); };
  const runScript    = async () => { if(script) return; setScriptBusy(true); try { setScript(await genScript(lead, userName)); } catch(e){ setScript("Error: "+e.message); } setScriptBusy(false); };
  const runPackages  = async () => { if(packages) return; setPkgBusy(true); try { setPackages(await genServicePackages(lead)); } catch(e){ setPackages("Error: "+e.message); } setPkgBusy(false); };
  const runFollowUp  = async () => { if(followUp) return; setFuBusy(true); try { setFollowUp(await genFollowUpSequence(lead, userName)); } catch(e){ setFollowUp("Error: "+e.message); } setFuBusy(false); };

  const saveRate = () => { const n=parseInt(myRate)||0; upd({myMonthlyRate:n}); };

  const satColor  = { underserved:"var(--green)", competitive:"var(--amber)", saturated:"var(--red)" };
  const diffColor = { easy:"var(--green)", medium:"var(--amber)", hard:"var(--red)" };
  const myRateNum     = parseInt(myRate)||lead.myMonthlyRate||lead.suggestedMonthlyRate||0;
  const toolsCost     = lead.toolsCostMonthly||0;
  const profit        = myRateNum - toolsCost;
  const setupCost     = lead.setupCost||0;
  const payback       = (profit>0&&setupCost>0) ? Math.ceil(setupCost/profit) : null;

  const AiBox = ({ show, busy, txt, label, color, icon, onRedo, cKey }) => !show ? null : (
    <div className="fi" style={{ margin:"0 18px 14px", border:"1.5px solid "+color+"30", borderRadius:10, overflow:"hidden" }}>
      <div style={{ background:color+"0d", padding:"8px 14px", display:"flex", alignItems:"center", gap:8,
        borderBottom:"1.5px solid "+color+"20" }}>
        <I n={icon} s={13} c={color}/>
        <span style={{ fontWeight:700, fontSize:13, color, flex:1 }}>{label}</span>
        {txt && !busy && <>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 9px" }} onClick={()=>copy(txt,cKey)}>
            <I n="copy" s={10}/>{copied===cKey?"Copied!":"Copy"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 9px" }} onClick={onRedo}>
            <I n="refresh" s={10}/>Redo
          </button>
        </>}
      </div>
      <div style={{ padding:"13px 16px", background:"var(--s1)", minHeight:56 }}>
        {busy
          ? <div style={{ display:"flex", gap:9, alignItems:"center", color:"var(--txt2)", fontSize:13 }}>
              <span style={{ width:13,height:13,border:"2px solid var(--brd2)",borderTopColor:color,borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }}/>
              Generating…
            </div>
          : <pre style={{ fontSize:13, lineHeight:1.8, color:"var(--txt)", whiteSpace:"pre-wrap", fontFamily:"var(--fb)", wordBreak:"break-word", overflowWrap:"break-word" }}>{txt}</pre>
        }
      </div>
    </div>
  );

  return (
    <div className="card card-h" style={{overflow:"hidden",minWidth:0}}>
      {/* Header */}
      <div style={{ padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer" }} onClick={onToggle}>
        <div className="score-badge" style={{ background:sc+"18",color:sc,border:"2px solid "+sc+"28",boxShadow:lead.score>=75?"0 0 12px "+sc+"40":"none" }}>
          {lead.score}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"var(--fh)", fontWeight:800, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lead.name}</div>
              <div style={{ fontSize:12, color:"var(--txt2)", marginTop:2 }}>{lead.btype} · {lead.city?lead.city+", ":""}{lead.country}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
              <I n={open?"up":"down"} s={13} c="var(--txt3)" style={{ marginBottom:2 }}/>
              {myRateNum>0 && <>
                <div style={{ fontFamily:"var(--fh)", fontWeight:800, fontSize:14, color:"var(--green)" }}>
                  ${myRateNum.toLocaleString()}<span style={{ fontSize:10, fontWeight:400, color:"var(--txt3)" }}>/mo</span>
                </div>
                {profit>0 && <div style={{ fontSize:10, color:"var(--txt3)" }}>~${profit.toLocaleString()} profit</div>}
              </>}
              <div style={{ display:"flex", gap:4, justifyContent:"flex-end", marginTop:2 }}>
                <span className={"chip "+(STATUS_COLORS[lead.status]||"c-gray")} style={{ fontSize:10 }}>{lead.status}</span>
                {lead.saved && <span className="chip c-lime" style={{ fontSize:10 }}><I n="save" s={9}/>saved</span>}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:7 }}>
            {(lead.problems||[]).map(p=><span key={p} className="chip c-amber" style={{ fontSize:10 }}>{p}</span>)}
            {lead.marketSaturation && (
              <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,border:"1.5px solid",
                color:satColor[lead.marketSaturation],borderColor:satColor[lead.marketSaturation]+"44",
                background:satColor[lead.marketSaturation]+"11" }}>
                {lead.marketSaturation==="underserved"?"🟢":lead.marketSaturation==="competitive"?"🟡":"🔴"} {lead.marketSaturation}
              </span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="fi">
          <div className="sep"/>
          {/* Score grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", borderBottom:"1.5px solid var(--brd)" }}>
            {[
              { l:"Opp Score",   v:lead.score,                 c:sc,                                                                                    tip:"Overall opportunity quality 0-100" },
              { l:"Demand",      v:lead.demandScore||"?",       c:demandColor(lead.demandScore||50),                                                      tip:"Market demand for this service" },
              { l:"Competition", v:lead.competitionScore||"?",  c:(lead.competitionScore||50)>60?"var(--red)":(lead.competitionScore||50)>35?"var(--amber)":"var(--green)", tip:"Lower = fewer competitors" },
              { l:"Difficulty",  v:lead.difficultyRating||"?", c:diffColor[lead.difficultyRating]||"var(--txt)",                                          tip:"How hard to close this client" },
            ].map(st=>(
              <div key={st.l} title={st.tip} style={{ padding:"10px 8px",textAlign:"center",background:"var(--s2)",borderRight:"1.5px solid var(--brd)",cursor:"help" }}>
                <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:16,color:st.c }}>{st.v}</div>
                <div style={{ fontSize:10,color:"var(--txt3)",marginTop:2 }}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* Pricing panel */}
          <div style={{ padding:"15px 18px", background:"rgba(52,212,122,.03)", borderBottom:"1.5px solid var(--brd)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:11 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"var(--txt)",display:"flex",alignItems:"center",gap:7 }}>
                <I n="dollar" s={14} c="var(--green)"/>Your Deal Numbers
              </div>
              {lead.suggestedMonthlyRate && (
                <div style={{ fontSize:12,color:"var(--txt3)" }}>
                  AI suggests: <span style={{ color:"var(--lime)",fontWeight:700 }}>${lead.suggestedMonthlyRate.toLocaleString()}/mo</span>
                </div>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:9, marginBottom:10 }}>
              {/* Rate */}
              <div style={{ background:"var(--s1)",borderRadius:10,padding:"12px 13px",border:"1.5px solid var(--brd)" }}>
                <div style={{ fontSize:11,color:"var(--txt3)",marginBottom:5,display:"flex",justifyContent:"space-between" }}>
                  <span>You charge</span>
                  <span style={{ fontSize:9,color:"var(--lime)",background:"rgba(198,241,53,.1)",border:"1px solid rgba(198,241,53,.2)",borderRadius:4,padding:"1px 5px" }}>EDITABLE</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:3 }}>
                  <span style={{ fontSize:16,fontWeight:700,color:"var(--txt2)" }}>$</span>
                  <input value={myRate} onChange={e=>setMyRate(e.target.value.replace(/[^0-9]/g,""))}
                    onBlur={saveRate} onKeyDown={e=>e.key==="Enter"&&saveRate()}
                    style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:20,color:"var(--green)",width:"100%",background:"none",border:"none",outline:"none" }}
                    placeholder={String(lead.suggestedMonthlyRate||800)}/>
                </div>
                <div style={{ fontSize:10,color:"var(--txt3)",marginTop:3 }}>= ${(myRateNum*12).toLocaleString()}/year</div>
              </div>
              {/* Costs */}
              <div style={{ background:"var(--s1)",borderRadius:10,padding:"12px 13px",border:"1.5px solid var(--brd)" }}>
                <div style={{ fontSize:11,color:"var(--txt3)",marginBottom:5 }}>Your monthly costs</div>
                <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:20,color:"var(--amber)" }}>${toolsCost.toLocaleString()}</div>
                <div style={{ fontSize:10,color:"var(--txt3)",marginTop:3 }}>tools + software</div>
                {setupCost>0 && (
                  <button onClick={()=>setShowCostTip(!showCostTip)}
                    style={{ marginTop:5,fontSize:11,color:"var(--blue)",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:4 }}>
                    <I n="info" s={10}/>Setup: ${setupCost}
                  </button>
                )}
              </div>
              {/* Profit */}
              <div style={{ background:profit>0?"rgba(52,212,122,.07)":"rgba(245,66,66,.05)",borderRadius:10,padding:"12px 13px",
                border:"1.5px solid "+(profit>0?"rgba(52,212,122,.25)":"rgba(245,66,66,.2)") }}>
                <div style={{ fontSize:11,color:"var(--txt3)",marginBottom:5 }}>Monthly profit</div>
                <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:20,color:profit>0?"var(--green)":"var(--red)" }}>
                  {profit>=0?"$"+profit.toLocaleString():"-$"+Math.abs(profit).toLocaleString()}
                </div>
                {payback && <div style={{ fontSize:10,color:"var(--lime)",marginTop:3,fontWeight:600 }}>Break even in {payback} mo</div>}
                {!payback && profit>0 && <div style={{ fontSize:10,color:"var(--txt3)",marginTop:3 }}>${(profit*12).toLocaleString()}/year</div>}
              </div>
            </div>
            {showCostTip && setupCost>0 && (
              <div className="fi" style={{ padding:"9px 12px",background:"rgba(61,142,248,.06)",border:"1.5px solid rgba(61,142,248,.15)",borderRadius:8,fontSize:12,color:"var(--txt2)",lineHeight:1.6,marginBottom:8 }}>
                <strong style={{ color:"var(--txt)" }}>Setup cost ~${setupCost}</strong> is your one-time investment to start serving this client — software licenses, ad spend, design assets, or tools you need to buy once.
                After that you only pay ${toolsCost}/mo in running costs.
                {payback && <span style={{ color:"var(--lime)" }}> You'll recover it in {payback} month{payback!==1?"s":""}.</span>}
              </div>
            )}
          </div>

          {/* Tech stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", borderBottom:"1.5px solid var(--brd)" }}>
            {[
              { l:"PageSpeed", v:lead.speed, c:lead.speed<40?"var(--red)":lead.speed<60?"var(--amber)":"var(--green)" },
              { l:"Reviews",   v:lead.reviews, c:lead.reviews<5?"var(--red)":lead.reviews<15?"var(--amber)":"var(--green)" },
              { l:"Rating",    v:lead.rating?"★"+lead.rating:"N/A", c:lead.rating<3.5?"var(--red)":"var(--txt)" },
              { l:"SSL",       v:lead.ssl?"✓ Secure":"✗ None", c:lead.ssl?"var(--green)":"var(--red)" },
            ].map(st=>(
              <div key={st.l} style={{ padding:"9px 10px",textAlign:"center",background:"var(--s3)",borderRight:"1.5px solid var(--brd)" }}>
                <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,color:st.c }}>{st.v}</div>
                <div style={{ fontSize:10,color:"var(--txt3)",marginTop:1 }}>{st.l}</div>
              </div>
            ))}
          </div>

          {/* Contact + Why */}
          <div style={{ padding:"11px 18px", borderBottom:"1.5px solid var(--brd)" }}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:7,marginBottom:lead.why?9:0 }}>
              {lead.phone
                ? <a href={"tel:"+lead.phone} style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--blue)",textDecoration:"none",minWidth:0,overflow:"hidden" }}><I n="phone" s={12}/>{lead.phone}</a>
                : <div style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--red)" }}><I n="phone" s={12}/>No phone</div>}
              {lead.website
                ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--blue)",overflow:"hidden" }}>
                    <I n="link" s={12}/><span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{lead.website.replace(/https?:\/\/(www\.)?/,"")}</span>
                  </a>
                : <div style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--red)" }}><I n="globe" s={12}/>No website</div>}
              {lead.employees && <div style={{ fontSize:12,color:"var(--txt2)" }}><span style={{ color:"var(--txt3)" }}>Staff: </span>{lead.employees}</div>}
              {lead.founded && <div style={{ fontSize:12,color:"var(--txt2)" }}><span style={{ color:"var(--txt3)" }}>Founded: </span>{lead.founded}</div>}
            </div>
            {lead.why && (
              <div style={{ padding:"8px 12px",background:"rgba(61,142,248,.06)",border:"1.5px solid rgba(61,142,248,.12)",borderRadius:8,fontSize:13,color:"var(--txt2)",display:"flex",gap:7 }}>
                <I n="ai" s={13} c="var(--blue)" style={{ flexShrink:0,marginTop:1 }}/><span>{lead.why}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding:"10px 18px 11px",display:"flex",flexWrap:"wrap",gap:5,alignItems:"center",WebkitOverflowScrolling:"touch" }}>
            <select value={lead.status} onChange={e=>upd({status:e.target.value})}
              style={{ fontSize:12,padding:"7px 10px",borderRadius:8,border:"1.5px solid var(--brd)",background:"var(--s2)",color:"var(--txt)",cursor:"pointer" }}>
              {STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
            <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px" }} onClick={()=>upd({saved:!lead.saved})}>
              <I n="save" s={12}/>{lead.saved?"Saved ✓":"Save"}
            </button>
            {lead.status==="won" && <span style={{ fontSize:11,color:"var(--green)",fontWeight:700,padding:"6px 10px",background:"rgba(52,212,122,.08)",borderRadius:8,border:"1px solid rgba(52,212,122,.2)" }}>🎉 Won! Add to Clients tab</span>}
            <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px" }} onClick={()=>setNoteOpen(!noteOpen)}>
              <I n="note" s={12}/>Notes
            </button>
            <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--txt2)" }}>
              <I n="clock" s={11}/>
              <input type="date" value={lead.followUpDate||""} onChange={e=>upd({followUpDate:e.target.value})}
                style={{ fontSize:12,padding:"6px 9px",borderRadius:7,border:"1.5px solid var(--brd)",background:"var(--s2)",color:"var(--txt)",cursor:"pointer" }}
                title="Follow-up date"/>
            </div>

            {/* Pro+ AI actions — always visible, locked ones show upgrade modal */}
            <>
              {["pro","scale"].includes(userPlan)?(<>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--blue)",borderColor:"rgba(61,142,248,.25)" }}
                  onClick={()=>{ const n=!showOut; setShowOut(n); if(n&&!outreach) runOut(outType); }}>
                  <I n="mail" s={12}/>Outreach
                </button>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--purple)",borderColor:"rgba(168,85,247,.25)" }}
                  onClick={()=>{ const n=!showRoad; setShowRoad(n); if(n) runRoadmap(); }}>
                  <I n="rocket" s={12}/>Roadmap
                </button>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--teal)",borderColor:"rgba(20,184,166,.25)" }}
                  onClick={()=>{ const n=!showProp; setShowProp(n); if(n) runProposal(); }}>
                  <I n="note" s={12}/>Proposal
                </button>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--lime)",borderColor:"rgba(198,241,53,.25)" }}
                  onClick={()=>{ const n=!showPrice; setShowPrice(n); if(n) runPricing(); }}>
                  <I n="dollar" s={12}/>Pricing AI
                </button>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--amber)",borderColor:"rgba(245,166,35,.25)" }}
                  onClick={()=>{ const n=!showScript; setShowScript(n); if(n) runScript(); }}>
                  <I n="phone" s={12}/>Pitch Script
                </button>
                <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--green)",borderColor:"rgba(52,212,122,.25)" }}
                  onClick={()=>{ const n=!showPkg; setShowPkg(n); if(n) runPackages(); }}>
                  <I n="package" s={12}/>Packages
                </button>
              </>):(<>
                {[{l:"Outreach",c:"var(--blue)"},{l:"Roadmap",c:"var(--purple)"},{l:"Proposal",c:"var(--teal)"},{l:"Pricing AI",c:"var(--lime)"},{l:"Pitch Script",c:"var(--amber)"},{l:"Packages",c:"var(--green)"}].map(f=>(
                  <button key={f.l} className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:f.c,opacity:.6,borderColor:f.c+"22" }}
                    onClick={()=>onUpgrade&&onUpgrade("AI "+f.l,"pro")}>
                    <I n="shield2" s={11} c={f.c}/>🔒 {f.l}
                  </button>
                ))}
              </>)}
            </>

            {/* Scale-only: always visible, locked for non-Scale */}
            {userIsScale?(<>
              <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--red)",borderColor:"rgba(245,66,66,.25)" }}
                onClick={()=>{ const n=!showAudit; setShowAudit(n); if(n) runAudit(); }}>
                <I n="eye" s={12}/>Full Audit
              </button>
              <button className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:"var(--purple)",borderColor:"rgba(168,85,247,.25)" }}
                onClick={()=>{ const n=!showFU; setShowFU(n); if(n) runFollowUp(); }}>
                <I n="layers" s={12}/>Follow-up Seq.
              </button>
            </>):(<>
              {[{l:"Full Audit",c:"var(--red)"},{l:"Follow-up Seq.",c:"var(--purple)"}].map(f=>(
                <button key={f.l} className="btn btn-dark" style={{ fontSize:12,padding:"6px 10px",color:f.c,opacity:.6,borderColor:f.c+"22" }}
                  onClick={()=>onUpgrade&&onUpgrade("AI "+f.l,"scale")}>
                  <I n="shield2" s={11} c={f.c}/>🔒 {f.l}
                </button>
              ))}
            </>)}
            <button className="btn btn-red" style={{ marginLeft:"auto",fontSize:12,padding:"5px 9px" }} onClick={()=>onDelete(lead.id)}>
              <I n="trash" s={12}/>
            </button>
          </div>

          {/* Notes */}
          {noteOpen && (
            <div style={{ padding:"0 18px 13px" }} className="fi">
              <textarea className="inp" rows={3} placeholder="Notes, next steps, follow-up details…"
                value={noteVal} onChange={e=>setNoteVal(e.target.value)} style={{ resize:"vertical",fontSize:13,marginBottom:7 }}/>
              <button className="btn btn-lime" style={{ fontSize:12,padding:"7px 13px" }}
                onClick={()=>{ upd({notes:noteVal}); setNoteOpen(false); }}>
                <I n="check" s={12}/>Save Note
              </button>
            </div>
          )}

          {/* Outreach panel (special because of type toggle) */}
          {showOut && (
            <div className="fi" style={{ margin:"0 18px 13px",border:"1.5px solid rgba(61,142,248,.25)",borderRadius:10,overflow:"hidden" }}>
              <div style={{ background:"rgba(61,142,248,.07)",padding:"8px 13px",display:"flex",alignItems:"center",gap:7,borderBottom:"1.5px solid rgba(61,142,248,.15)" }}>
                <I n="ai" s={13} c="var(--blue)"/>
                <span style={{ fontWeight:700,fontSize:13,color:"var(--blue)",flex:1 }}>AI Outreach</span>
                <div style={{ display:"flex",gap:4 }}>
                  {["email","call"].map(t=>(
                    <button key={t} onClick={()=>{ setOutType(t); setOutreach(""); runOut(t); }}
                      style={{ fontSize:11,padding:"3px 10px",borderRadius:6,border:"1.5px solid",
                        borderColor:outType===t?"var(--blue)":"var(--brd)",
                        background:outType===t?"rgba(61,142,248,.1)":"transparent",
                        color:outType===t?"var(--blue)":"var(--txt2)",cursor:"pointer",fontWeight:600 }}>
                      {t==="email"?"✉ Email":"📞 Script"}
                    </button>
                  ))}
                </div>
                {outreach&&!outBusy&&<>
                  <button className="btn btn-ghost" style={{ fontSize:11,padding:"3px 8px" }} onClick={()=>copy(outreach,"out")}><I n="copy" s={10}/>{copied==="out"?"Copied!":"Copy"}</button>
                  <button className="btn btn-ghost" style={{ fontSize:11,padding:"3px 8px" }} onClick={()=>{ setOutreach(""); runOut(outType); }}><I n="refresh" s={10}/></button>
                </>}
              </div>
              <div style={{ padding:13,background:"var(--s1)",minHeight:56 }}>
                {outBusy
                  ? <div style={{ display:"flex",gap:8,alignItems:"center",color:"var(--txt2)",fontSize:13 }}>
                      <span style={{ width:13,height:13,border:"2px solid var(--brd2)",borderTopColor:"var(--blue)",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }}/>Generating…
                    </div>
                  : <pre style={{ fontSize:13,lineHeight:1.8,color:"var(--txt)",whiteSpace:"pre-wrap",fontFamily:"var(--fb)",wordBreak:"break-word",overflowWrap:"break-word" }}>{outreach}</pre>
                }
              </div>
            </div>
          )}

          <AiBox show={showRoad}   busy={roadBusy}   txt={roadmap}   label="30-60-90 Day Roadmap"      color="var(--purple)" icon="rocket"    onRedo={()=>{setRoadmap("");runRoadmap();}}   cKey="road"/>
          <AiBox show={showProp}   busy={propBusy}   txt={proposal}  label="Service Proposal"          color="var(--teal)"   icon="note"     onRedo={()=>{setProposal("");runProposal();}} cKey="prop"/>
          <AiBox show={showPrice}  busy={priceBusy}  txt={pricing}   label="Pricing Strategy"         color="var(--lime)"   icon="dollar"   onRedo={()=>{setPricing("");runPricing();}}   cKey="price"/>
          <AiBox show={showScript} busy={scriptBusy} txt={script}    label="30-Second Elevator Pitch"  color="var(--amber)"  icon="phone"    onRedo={()=>{setScript("");runScript();}}     cKey="script"/>
          <AiBox show={showPkg}    busy={pkgBusy}    txt={packages}  label="Service Package Builder"   color="var(--green)"  icon="package"  onRedo={()=>{setPackages("");runPackages();}} cKey="pkg"/>
          <AiBox show={showAudit}  busy={auditBusy}  txt={audit}     label="Full Business Audit"       color="var(--red)"    icon="eye"      onRedo={()=>{setAudit("");runAudit();}}       cKey="audit"/>
          <AiBox show={showFU}     busy={fuBusy}     txt={followUp}  label="5-Email Follow-up Sequence (Scale)" color="var(--purple)" icon="layers" onRedo={()=>{setFollowUp("");runFollowUp();}} cKey="fu"/>
        </div>
      )}
    </div>
  );
}
)
export default LeadCard
