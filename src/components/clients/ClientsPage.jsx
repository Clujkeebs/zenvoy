import PageHeader from '../ui/PageHeader'
import { useState } from 'react'
import Icon from '../../icons/Icon'
import { fmtDate, fmtMoney } from '../../utils/helpers'
import { STATUS_COLORS } from '../../constants/services'
const I = Icon

export default function ClientsPage({ clients, leads, onAdd, onUpdate, onDelete, onNav }) {
  const [modal,      setModal]      = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [q,          setQ]          = useState("");
  const [leadPicker, setLeadPicker] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const emptyForm = {name:"",btype:"",phone:"",email:"",website:"",monthly:"",status:"active",notes:""};
  const [form, setForm] = useState(emptyForm);

  const allLeads  = leads.filter(l=>!clients.find(c=>c.name===l.name));
  const filtLeads = allLeads.filter(l=>!leadSearch||l.name.toLowerCase().includes(leadSearch.toLowerCase())||(l.btype||"").toLowerCase().includes(leadSearch.toLowerCase()));
  const wonLeads  = leads.filter(l=>l.status==="won"&&!clients.find(c=>c.name===l.name));
  const statusC   = {active:"c-green",prospect:"c-blue",paused:"c-amber",churned:"c-red"};
  const mrr       = clients.filter(c=>c.status==="active").reduce((a,c)=>a+Number(c.monthly||0),0);
  const filtered  = clients.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase()));

  const reset   = ()=>{setForm(emptyForm);setEditId(null);setModal(false);setLeadPicker(false);setLeadSearch("");};
  const save    = ()=>{ if(!form.name)return; if(editId)onUpdate({...clients.find(c=>c.id===editId),...form}); else onAdd({id:"c_"+Date.now(),...form,addedAt:Date.now()}); reset(); };
  const startEdit=c=>{setForm({name:c.name,btype:c.btype||"",phone:c.phone||"",email:c.email||"",website:c.website||"",monthly:c.monthly||"",status:c.status||"active",notes:c.notes||""});setEditId(c.id);setModal(true);};
  const fromLead=l=>{setForm({name:l.name,btype:l.btype||"",phone:l.phone||"",email:"",website:l.website||"",monthly:String(l.myMonthlyRate||l.suggestedMonthlyRate||""),status:"prospect",notes:l.why||""});setLeadPicker(false);setLeadSearch("");setModal(true);};

  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div>
          <PageHeader title="Clients" onBack={() => onNav("home")} onHome={() => onNav("home")} />
          <p style={{ color:"var(--txt2)",fontSize:13,marginTop:2 }}>{clients.length} total · <span style={{ color:"var(--green)",fontWeight:700 }}>${mrr.toLocaleString()}/mo MRR</span></p>
        </div>
        <div style={{ display:"flex",gap:7 }}>
          {allLeads.length>0&&<button className="btn btn-dark" onClick={()=>setLeadPicker(true)}><I n="target" s={14}/>Add from Leads</button>}
          <button className="btn btn-lime" onClick={()=>setModal(true)}><I n="plus" s={14}/>Add Client</button>
        </div>
      </div>

      {wonLeads.length>0&&(
        <div style={{ marginBottom:15,padding:"12px 17px",background:"rgba(52,212,122,.05)",border:"1.5px solid rgba(52,212,122,.2)",borderRadius:12 }}>
          <div style={{ fontSize:13,fontWeight:700,color:"var(--green)",marginBottom:8,display:"flex",gap:6,alignItems:"center" }}>
            <I n="crown" s={13} c="var(--green)"/>Won leads ready to convert:
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {wonLeads.map(l=>(
              <button key={l.id} className="btn btn-dark" style={{ fontSize:12,padding:"5px 10px",borderColor:"rgba(52,212,122,.3)",color:"var(--green)" }}
                onClick={()=>fromLead(l)}><I n="plus" s={11}/>{l.name}</button>
            ))}
          </div>
        </div>
      )}

      <input className="inp" placeholder="Search clients…" value={q} onChange={e=>setQ(e.target.value)} style={{ marginBottom:13,fontSize:13,maxWidth:300 }}/>

      {clients.length===0
        ? <div style={{ textAlign:"center",padding:"80px 20px" }}>
            <div style={{ width:66,height:66,borderRadius:"50%",background:"var(--s2)",border:"2px solid var(--brd)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
              <I n="users" s={28} c="var(--txt3)"/>
            </div>
            <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:18,marginBottom:8 }}>No clients yet</h3>
            <p style={{ color:"var(--txt2)",fontSize:14,marginBottom:20 }}>Add clients manually or import directly from your leads.</p>
            <div style={{ display:"flex",gap:8,justifyContent:"center" }}>
              {allLeads.length>0&&<button className="btn btn-dark" onClick={()=>setLeadPicker(true)}><I n="target" s={14}/>Pick from Leads</button>}
              <button className="btn btn-lime" onClick={()=>setModal(true)}><I n="plus" s={14}/>Add Manually</button>
            </div>
          </div>
        : <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(260px,100%),1fr))",gap:10 }}>
            {filtered.map((c,i)=>(
              <div key={c.id} className="card card-h fu" style={{ padding:"16px 18px",animationDelay:i*0.04+"s" }}>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
                  <div>
                    <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14 }}>{c.name}</div>
                    {c.btype&&<div style={{ fontSize:12,color:"var(--txt2)",marginTop:2 }}>{c.btype}</div>}
                  </div>
                  <span className={"chip "+(statusC[c.status]||"c-gray")}>{c.status}</span>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:10 }}>
                  {c.phone&&<div style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--txt2)" }}><I n="phone" s={12}/>{c.phone}</div>}
                  {c.email&&<div style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--txt2)" }}><I n="mail" s={12}/>{c.email}</div>}
                  {c.website&&<a href={c.website} target="_blank" rel="noreferrer" style={{ display:"flex",gap:6,alignItems:"center",fontSize:13,color:"var(--blue)" }}><I n="link" s={12}/>{c.website.replace(/https?:\/\/(www\.)?/,"")}</a>}
                  {c.monthly&&<div style={{ display:"flex",gap:6,alignItems:"center",fontSize:14,fontWeight:700,color:"var(--green)" }}><I n="dollar" s={12}/>${Number(c.monthly).toLocaleString()}/mo</div>}
                </div>
                {c.notes&&<div style={{ fontSize:12,color:"var(--txt2)",padding:"6px 9px",background:"var(--s2)",borderRadius:7,marginBottom:10 }}>{c.notes}</div>}
                <div style={{ display:"flex",gap:5 }}>
                  <button className="btn btn-dark" style={{ fontSize:12,padding:"5px 10px" }} onClick={()=>startEdit(c)}><I n="edit" s={12}/>Edit</button>
                  <button className="btn btn-red"  style={{ fontSize:12,padding:"5px 10px" }} onClick={()=>onDelete(c.id)}><I n="trash" s={12}/></button>
                </div>
              </div>
            ))}
          </div>
      }

      {/* Lead picker modal */}
      {leadPicker&&(
        <div className="modal-wrap" onClick={e=>e.target===e.currentTarget&&(setLeadPicker(false),setLeadSearch(""))}>
          <div className="modal" style={{ maxWidth:520 }}>
            <div style={{ padding:"16px 20px",borderBottom:"1.5px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:17 }}>Pick a Lead to Convert</h3>
                <p style={{ color:"var(--txt2)",fontSize:12,marginTop:2 }}>Pre-fills the client form with lead data</p>
              </div>
              <button className="btn btn-ghost" style={{ padding:"4px 6px" }} onClick={()=>{setLeadPicker(false);setLeadSearch("");}}>
                <I n="x" s={15}/>
              </button>
            </div>
            <div style={{ padding:"11px 20px",borderBottom:"1.5px solid var(--brd)" }}>
              <input className="inp" placeholder="Search leads…" value={leadSearch} autoFocus onChange={e=>setLeadSearch(e.target.value)} style={{ fontSize:13 }}/>
            </div>
            <div style={{ maxHeight:360,overflowY:"auto" }}>
              {filtLeads.length===0
                ? <div style={{ padding:24,textAlign:"center",color:"var(--txt3)",fontSize:13 }}>No leads found.</div>
                : filtLeads.map(l=>(
                  <div key={l.id} onClick={()=>fromLead(l)}
                    style={{ padding:"11px 20px",borderBottom:"1px solid var(--brd)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,transition:"background .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:14 }}>{l.name}</div>
                      <div style={{ fontSize:12,color:"var(--txt2)",marginTop:2 }}>{l.btype} · {l.city?l.city+", ":""}{l.country}</div>
                      {l.why&&<div style={{ fontSize:11,color:"var(--txt3)",marginTop:2,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.why}</div>}
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,color:"var(--green)" }}>${(l.myMonthlyRate||l.suggestedMonthlyRate||0).toLocaleString()}/mo</div>
                      <span className={"chip "+(STATUS_COLORS[l.status]||"c-gray")} style={{ fontSize:10 }}>{l.status}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal&&(
        <div className="modal-wrap" onClick={e=>e.target===e.currentTarget&&reset()}>
          <div className="modal" style={{ maxWidth:500 }}>
            <div style={{ padding:"17px 22px",borderBottom:"1.5px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:17 }}>{editId?"Edit":"Add"} Client</h3>
              <button className="btn btn-ghost" style={{ padding:"5px 7px" }} onClick={reset}><I n="x" s={15}/></button>
            </div>
            <div style={{ padding:"17px 22px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:11 }}>
              {[
                {k:"name",l:"Business Name *",full:true},
                {k:"btype",l:"Business Type"},
                {k:"phone",l:"Phone"},
                {k:"email",l:"Email"},
                {k:"website",l:"Website"},
                {k:"monthly",l:"Monthly Rate ($)"},
              ].map(f=>(
                <div key={f.k} style={f.full?{gridColumn:"1/-1"}:{}}>
                  <span className="lbl">{f.l}</span>
                  <input className="inp" value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}
                    placeholder={f.k==="monthly"?"e.g. 1200":f.k==="website"?"https://":""}/>
                </div>
              ))}
              <div>
                <span className="lbl">Status</span>
                <select className="inp" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                  {["active","prospect","paused","churned"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <span className="lbl">Notes</span>
                <textarea className="inp" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{ resize:"vertical" }}/>
              </div>
            </div>
            <div style={{ padding:"0 22px 17px",display:"flex",gap:7 }}>
              <button className="btn btn-lime" onClick={save} disabled={!form.name}><I n="check" s={14}/>{editId?"Save Changes":"Add Client"}</button>
              <button className="btn btn-ghost" onClick={reset}>Cancel</button>
              {!editId&&allLeads.length>0&&<button className="btn btn-dark" style={{ marginLeft:"auto" }} onClick={()=>{setModal(false);setLeadPicker(true);}}><I n="target" s={13}/>Pick from leads</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
