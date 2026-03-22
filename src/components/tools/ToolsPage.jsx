import PageHeader from '../ui/PageHeader'
import { useState } from 'react'
import Icon from '../../icons/Icon'
import { canAI, canScale } from '../../constants/plans'
import { aiCall } from '../../utils/ai'
import { SERVICES, COUNTRIES } from '../../constants/services'
const I = Icon

export default function ToolsPage({ user, onUpgrade, onNav }) {
  const [activeSection, setActiveSection] = useState("directory");
  const [invoiceData, setInvoiceData] = useState({client:"",service:"",amount:"",hours:"",currency:"USD",notes:""});
  const [invoiceOut, setInvoiceOut] = useState(""); const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [objection, setObjection] = useState(""); const [objOut, setObjOut] = useState(""); const [objBusy, setObjBusy] = useState(false);
  const [niche, setNiche] = useState({country:"",service:"web"}); const [nicheOut, setNicheOut] = useState(""); const [nicheBusy, setNicheBusy] = useState(false);
  const [onboard, setOnboard] = useState({client:"",service:"web",rate:""}); const [onboardOut, setOnboardOut] = useState(""); const [onboardBusy, setOnboardBusy] = useState(false);
  const [rateCalc, setRateCalc] = useState({country:"",service:"web",exp:"",hours:""}); const [rateOut, setRateOut] = useState(""); const [rateBusy, setRateBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const copy = (txt,k) => { navigator.clipboard.writeText(txt); setCopied(k); setTimeout(()=>setCopied(""),2000); };

  const isAI = ["pro","scale"].includes(user?.plan);

  const lockGate = (fn, feature) => isAI ? fn() : (onUpgrade && onUpgrade(feature, "pro"));

  const AiSection = ({ title, icon, color, children, lockedFor }) => (
    <div className="card" style={{ padding:22, marginBottom:14, borderColor: lockedFor ? "var(--brd)" : color+"33" }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
        <div style={{ width:36,height:36,borderRadius:10,background:color+"15",border:"1.5px solid "+color+"25",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <I n={icon} s={17} c={color}/>
        </div>
        <div>
          <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:15 }}>{title}</div>
          {lockedFor && <div style={{ fontSize:11,color:"var(--amber)",fontWeight:700 }}>⭐ Pro+ feature</div>}
        </div>
        {lockedFor && <button className="btn btn-ghost" style={{ marginLeft:"auto",fontSize:12,padding:"6px 12px",color:"var(--amber)",borderColor:"rgba(245,166,35,.3)" }} onClick={()=>lockGate(()=>{},lockedFor)}><I n="shield2" s={12}/>Unlock</button>}
      </div>
      {children}
    </div>
  );

  const OutBox = ({ txt, busy, cKey, color }) => !txt && !busy ? null : (
    <div style={{ marginTop:11,borderRadius:9,overflow:"hidden",border:"1.5px solid "+color+"25" }}>
      <div style={{ background:color+"0d",padding:"7px 13px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+color+"18" }}>
        <span style={{ fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".05em" }}>Result</span>
        {txt&&!busy&&<button className="btn btn-ghost" style={{ fontSize:11,padding:"3px 8px" }} onClick={()=>copy(txt,cKey)}><I n="copy" s={10}/>{copied===cKey?"Copied!":"Copy"}</button>}
      </div>
      <div style={{ padding:14,background:"var(--s2)" }}>
        {busy
          ? <div style={{ display:"flex",gap:8,alignItems:"center",color:"var(--txt2)",fontSize:13 }}>
              <span style={{ width:13,height:13,border:"2px solid var(--brd2)",borderTopColor:color,borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }}/>Generating…
            </div>
          : <pre style={{ fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"var(--fb)",color:"var(--txt)",wordBreak:"break-word",overflowWrap:"break-word" }}>{txt}</pre>
        }
      </div>
    </div>
  );

  const SECTIONS = [
    {id:"directory", label:"Tool Directory", icon:"briefcase"},
    {id:"invoice",   label:"Invoice Writer", icon:"dollar"},
    {id:"objection", label:"Objection Handler", icon:"shield2"},
    {id:"niche",     label:"Niche Finder", icon:"compass"},
    {id:"onboard",   label:"Onboarding Kit", icon:"package"},
    {id:"rate",      label:"Rate Calculator", icon:"calculator"},
  ];

  const TOOLS=[
    {cat:"Business Formation",color:"var(--lime)",items:[
      {name:"Stripe Atlas",desc:"Incorporate your US LLC online in minutes. Trusted by thousands of international founders.",icon:"briefcase",cta:"Start LLC",url:"https://stripe.com/atlas"},
      {name:"Doola",desc:"Form your US LLC from anywhere in the world. Handles all the paperwork.",icon:"globe",cta:"Form LLC",url:"https://www.doola.com"},
      {name:"Northwest Registered Agent",desc:"Fast, private LLC formation with registered agent included.",icon:"shield2",cta:"Form LLC",url:"https://www.northwestregisteredagent.com"},
    ]},
    {cat:"Website & Design",color:"var(--blue)",items:[
      {name:"Framer",desc:"No-code website builder with stunning templates. Best for agency portfolio sites.",icon:"layers",cta:"Build Free",url:"https://www.framer.com"},
      {name:"Webflow",desc:"Professional CMS builder — the industry standard for web design agencies.",icon:"tool",cta:"Start Building",url:"https://webflow.com"},
      {name:"Hostinger",desc:"Blazing fast hosting with free domain. Best value for client websites.",icon:"zap",cta:"Get Hosting",url:"https://www.hostinger.com"},
      {name:"Squarespace",desc:"Beautiful templates to build and resell to small business clients.",icon:"layers",cta:"Start Trial",url:"https://www.squarespace.com"},
    ]},
    {cat:"Cold Email & Outreach",color:"var(--amber)",items:[
      {name:"Instantly.ai",desc:"Cold email at scale with inbox rotation. Top choice for lead outreach campaigns.",icon:"mail",cta:"Start Outreach",url:"https://instantly.ai"},
      {name:"Apollo.io",desc:"Find verified emails and phone numbers. 300M+ contacts database.",icon:"search",cta:"Find Contacts",url:"https://www.apollo.io"},
      {name:"Mailerlite",desc:"Simple email marketing to resell newsletter management to clients.",icon:"mail",cta:"Try Free",url:"https://www.mailerlite.com"},
      {name:"Beehiiv",desc:"Best newsletter platform. Build your audience while serving clients.",icon:"trending",cta:"Start Newsletter",url:"https://www.beehiiv.com"},
    ]},
    {cat:"CRM & Sales",color:"var(--purple)",items:[
      {name:"HubSpot CRM",desc:"Free CRM to manage all your client relationships. Scales with you as you grow.",icon:"users",cta:"Free CRM",url:"https://www.hubspot.com/products/crm"},
      {name:"Close CRM",desc:"Sales-focused CRM with built-in calling. Best for active outreach agencies.",icon:"phone",cta:"Start Trial",url:"https://www.close.com"},
      {name:"GoHighLevel",desc:"All-in-one agency platform. White-label and resell to clients as your own software.",icon:"briefcase",cta:"Start Trial",url:"https://www.gohighlevel.com"},
    ]},
    {cat:"Payments & Accounting",color:"var(--green)",items:[
      {name:"Stripe",desc:"Global standard for online payments. Subscriptions, invoices, and payouts worldwide.",icon:"dollar",cta:"Set Up Payments",url:"https://stripe.com"},
      {name:"Wave",desc:"100% free accounting and invoicing for freelancers. No subscription ever.",icon:"bar",cta:"Free Accounting",url:"https://www.waveapps.com"},
      {name:"FreshBooks",desc:"Simple invoicing and time tracking built for service businesses.",icon:"dollar",cta:"Try Free",url:"https://www.freshbooks.com"},
    ]},
    {cat:"AI & Automation",color:"var(--teal)",items:[
      {name:"Make",desc:"Visual automation builder. Connect all your tools and automate client workflows.",icon:"zap",cta:"Automate Free",url:"https://www.make.com"},
      {name:"Zapier",desc:"5,000+ app integrations. Most popular no-code automation for agencies.",icon:"zap",cta:"Try Zapier",url:"https://zapier.com"},
      {name:"n8n",desc:"Open-source self-hosted automation. Full control, no usage limits.",icon:"tool",cta:"Get Started",url:"https://n8n.io"},
    ]},
    {cat:"SEO & Analytics",color:"var(--red)",items:[
      {name:"Ahrefs",desc:"The #1 SEO tool for keyword research, backlinks, and competitor analysis.",icon:"trending",cta:"Start Trial",url:"https://ahrefs.com"},
      {name:"Google Search Console",desc:"Free from Google. Track client search rankings and fix SEO issues.",icon:"search",cta:"Free Access",url:"https://search.google.com/search-console"},
      {name:"Semrush",desc:"All-in-one SEO platform for agencies running client SEO campaigns.",icon:"bar",cta:"Free Trial",url:"https://www.semrush.com"},
    ]},
  ];
  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <div style={{ marginBottom:20 }}>
        <PageHeader title="Business Tools" onBack={() => onNav("home")} onHome={() => onNav("home")} />
        <p style={{ color:"var(--txt2)",fontSize:14,marginTop:6 }}>AI-powered tools + curated resource directory to run your freelance business.</p>
      </div>

      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:22 }}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{ padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",
              background:activeSection===s.id?"var(--lime)":"var(--s2)",
              color:activeSection===s.id?"#0c0e13":"var(--txt2)",
              border:"1.5px solid "+(activeSection===s.id?"var(--lime)":"var(--brd)"),
              display:"flex",alignItems:"center",gap:6 }}>
            <I n={s.icon} s={12} c={activeSection===s.id?"#0c0e13":"var(--txt2)"}/><span className="nav-label">{s.label}</span>
          </button>
        ))}
      </div>

      {activeSection==="directory" && TOOLS.map(cat=>(
        <div key={cat.cat} style={{ marginBottom:28 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <div style={{ width:4,height:16,borderRadius:2,background:cat.color }}/>
            <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:13,color:"var(--txt2)",textTransform:"uppercase",letterSpacing:".07em" }}>{cat.cat}</h3>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(220px,100%),1fr))",gap:9 }}>
            {cat.items.map(t=>(
              <div key={t.name} className="tool-card">
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:9 }}>
                  <div style={{ width:34,height:34,borderRadius:9,background:cat.color+"12",border:"1.5px solid "+cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <I n={t.icon||"tool"} s={16} c={cat.color}/>
                  </div>
                  <span style={{ fontFamily:"var(--fh)",fontWeight:700,fontSize:14 }}>{t.name}</span>
                </div>
                <p style={{ fontSize:12,color:"var(--txt2)",lineHeight:1.6,marginBottom:11 }}>{t.desc}</p>
                <a href={t.url} target="_blank" rel="noreferrer"
                  style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"7px 13px",background:cat.color+"12",border:"1.5px solid "+cat.color+"25",borderRadius:8,fontSize:12,fontWeight:700,color:cat.color,textDecoration:"none" }}>
                  {t.cta} <I n="link" s={10} c={cat.color}/>
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}

      {activeSection==="invoice" && (
        <AiSection title="AI Invoice Writer" icon="dollar" color="var(--green)" lockedFor={!isAI?"Invoice Writer":null}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:10,marginBottom:12 }}>
            {[{k:"client",l:"Client Name",ph:"e.g. Oak Street Dental"},{k:"service",l:"Service Delivered",ph:"e.g. Local SEO – March"},{k:"amount",l:"Amount ($)",ph:"e.g. 1200"},{k:"hours",l:"Hours Worked (optional)",ph:"e.g. 12"}].map(f=>(
              <div key={f.k}><span className="lbl">{f.l}</span><input className="inp" placeholder={f.ph} value={invoiceData[f.k]} onChange={e=>setInvoiceData({...invoiceData,[f.k]:e.target.value})} style={{ fontSize:13 }}/></div>
            ))}
            <div style={{ gridColumn:"1/-1" }}><span className="lbl">Additional Notes</span><textarea className="inp" rows={2} placeholder="Payment due within 14 days." value={invoiceData.notes} onChange={e=>setInvoiceData({...invoiceData,notes:e.target.value})} style={{ resize:"vertical",fontSize:13 }}/></div>
          </div>
          <button className="btn btn-lime" style={{ fontSize:13 }} onClick={()=>lockGate(async()=>{ setInvoiceBusy(true); setInvoiceOut(""); try { setInvoiceOut(await aiCall("Write a professional invoice for:\nFreelancer: "+user.name+"\nClient: "+(invoiceData.client||"Client")+"\nService: "+(invoiceData.service||"Freelance services")+"\nAmount: $"+(invoiceData.amount||"0")+"\nHours: "+(invoiceData.hours||"not specified")+"\nNotes: "+(invoiceData.notes||"none")+"\n\nFormat as professional invoice text:\nINVOICE #[random 4-digit]\nDate: [today]\nDue: [14 days]\nBill To / From / Description / Amount / Total / Payment terms / Thank you note\nUnder 200 words.",600)); } catch(e){setInvoiceOut("Error: "+e.message);} setInvoiceBusy(false); }, "Invoice Writer")}><I n="dollar" s={14}/>Generate Invoice</button>
          <OutBox txt={invoiceOut} busy={invoiceBusy} cKey="inv" color="var(--green)"/>
        </AiSection>
      )}

      {activeSection==="objection" && (
        <AiSection title="Sales Objection Handler" icon="shield2" color="var(--blue)" lockedFor={!isAI?"Objection Handler":null}>
          <p style={{ fontSize:13,color:"var(--txt2)",marginBottom:14 }}>Type any objection a prospect gave you. Get 3 confident rebuttals.</p>
          <div style={{ marginBottom:12 }}><span className="lbl">What did they say?</span><textarea className="inp" rows={3} placeholder={`"We already have someone."\n"Too expensive."\n"Need to think about it."`} value={objection} onChange={e=>setObjection(e.target.value)} style={{ resize:"vertical",fontSize:13 }}/></div>
          <button className="btn btn-blue" style={{ fontSize:13 }} onClick={()=>lockGate(async()=>{ setObjBusy(true); setObjOut(""); try { setObjOut(await aiCall("Sales coach for freelancers selling digital services.\nObjection: \""+objection+"\"\nFreelancer: "+user.name+" ("+( SERVICES.find(s=>s.id===user.svc)?.label||"digital services")+")\n\nWrite 3 rebuttals:\nREBUTTAL 1 — Empathy + Reframe (under 60 words, end with soft question)\nREBUTTAL 2 — Social Proof (under 60 words, end with soft question)\nREBUTTAL 3 — Direct Closer (under 60 words, end with soft question)",700)); } catch(e){setObjOut("Error: "+e.message);} setObjBusy(false); }, "Objection Handler")}><I n="shield2" s={14}/>Get Rebuttals</button>
          <OutBox txt={objOut} busy={objBusy} cKey="obj" color="var(--blue)"/>
        </AiSection>
      )}

      {activeSection==="niche" && (
        <AiSection title="Niche Opportunity Finder" icon="compass" color="var(--purple)" lockedFor={!isAI?"Niche Finder":null}>
          <p style={{ fontSize:13,color:"var(--txt2)",marginBottom:14 }}>Find underserved niches where demand is high and competition is low.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:10,marginBottom:12 }}>
            <div><span className="lbl">Country</span><select className="inp" value={niche.country} onChange={e=>setNiche({...niche,country:e.target.value})} style={{ fontSize:13 }}><option value="">Select country…</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><span className="lbl">Service You Sell</span><select className="inp" value={niche.service} onChange={e=>setNiche({...niche,service:e.target.value})} style={{ fontSize:13 }}>{SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          </div>
          <button className="btn btn-purple" style={{ fontSize:13 }} onClick={()=>lockGate(async()=>{ setNicheBusy(true); setNicheOut(""); try { setNicheOut(await aiCall("Freelance market research consultant.\nCountry: "+(niche.country||"United States")+"\nService: "+SERVICES.find(s=>s.id===niche.service)?.label+"\n\n5 underserved niches with HIGH demand and LOW freelancer competition:\n\n1. [NICHE] — Market size: S/M/L | Avg rate: $X-Y/mo | Why underserved: [1 sentence] | Find them: [source] | Quick win: [1 sentence]\n\n(repeat for 2-5)\n\nBe specific to this country. Under 300 words.",900)); } catch(e){setNicheOut("Error: "+e.message);} setNicheBusy(false); }, "Niche Finder")}><I n="compass" s={14}/>Find Best Niches</button>
          <OutBox txt={nicheOut} busy={nicheBusy} cKey="niche" color="var(--purple)"/>
        </AiSection>
      )}

      {activeSection==="onboard" && (
        <AiSection title="Client Onboarding Kit" icon="package" color="var(--teal)" lockedFor={!isAI?"Onboarding Kit":null}>
          <p style={{ fontSize:13,color:"var(--txt2)",marginBottom:14 }}>Generate a welcome email, access checklist, and 30-day promise for a new client.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:10,marginBottom:12 }}>
            <div><span className="lbl">Client Name</span><input className="inp" placeholder="e.g. Green Valley Dental" value={onboard.client} onChange={e=>setOnboard({...onboard,client:e.target.value})} style={{ fontSize:13 }}/></div>
            <div><span className="lbl">Service Starting</span><select className="inp" value={onboard.service} onChange={e=>setOnboard({...onboard,service:e.target.value})} style={{ fontSize:13 }}><option value="">Select service…</option>{SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div><span className="lbl">Monthly Rate ($)</span><input className="inp" placeholder="e.g. 1200" value={onboard.rate} onChange={e=>setOnboard({...onboard,rate:e.target.value})} style={{ fontSize:13 }}/></div>
          </div>
          <button className="btn" style={{ fontSize:13,background:"var(--teal)",color:"#0c0e13" }} onClick={()=>lockGate(async()=>{ setOnboardBusy(true); setOnboardOut(""); try { setOnboardOut(await aiCall("Client onboarding kit:\nFreelancer: "+user.name+"\nClient: "+(onboard.client||"New Client")+"\nService: "+SERVICES.find(s=>s.id===onboard.service)?.label+"\nRate: $"+(onboard.rate||"??")+"/mo\n\n1. WELCOME EMAIL (80 words, warm and professional)\n2. ONBOARDING CHECKLIST (6-8 items the client must provide)\n3. MONTH 1 PROMISE (3 bullet deliverables)\n4. COMMUNICATION RULES (response times, reporting)\n\nUnder 280 words.",900)); } catch(e){setOnboardOut("Error: "+e.message);} setOnboardBusy(false); }, "Onboarding Kit")}><I n="package" s={14}/>Generate Kit</button>
          <OutBox txt={onboardOut} busy={onboardBusy} cKey="onb" color="var(--teal)"/>
        </AiSection>
      )}

      {activeSection==="rate" && (
        <AiSection title="Market Rate Calculator" icon="calculator" color="var(--amber)">
          <p style={{ fontSize:13,color:"var(--txt2)",marginBottom:14 }}>Find what you should charge based on your country, experience, and service. Free for all plans.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:10,marginBottom:12 }}>
            <div><span className="lbl">Your Country</span><select className="inp" value={rateCalc.country} onChange={e=>setRateCalc({...rateCalc,country:e.target.value})} style={{ fontSize:13 }}><option value="">Select country…</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><span className="lbl">Service</span><select className="inp" value={rateCalc.service} onChange={e=>setRateCalc({...rateCalc,service:e.target.value})} style={{ fontSize:13 }}>{SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div><span className="lbl">Experience Level</span><select className="inp" value={rateCalc.exp} onChange={e=>setRateCalc({...rateCalc,exp:e.target.value})} style={{ fontSize:13 }}><option value="">Select…</option><option value="beginner">Beginner (0–1 yr)</option><option value="intermediate">Intermediate (1–3 yr)</option><option value="experienced">Experienced (3–5 yr)</option><option value="expert">Expert (5+ yr)</option></select></div>
            <div><span className="lbl">Hrs/Client/Month</span><input className="inp" type="number" placeholder="e.g. 10" value={rateCalc.hours} onChange={e=>setRateCalc({...rateCalc,hours:e.target.value})} style={{ fontSize:13 }}/></div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize:13,borderColor:"rgba(245,166,35,.4)",color:"var(--amber)" }} onClick={async()=>{ setRateBusy(true); setRateOut(""); try { setRateOut(await aiCall("Freelance pricing expert.\nCountry: "+(rateCalc.country||"United States")+"\nService: "+SERVICES.find(s=>s.id===rateCalc.service)?.label+"\nExperience: "+(rateCalc.exp||"intermediate")+"\nHours/client/mo: "+(rateCalc.hours||"10")+"\n\nMarket rates:\n• Entry: $X/mo\n• Mid: $X/mo\n• Premium: $X/mo\n\nYOUR RATE: $X/mo — WHY: [2 sentences]\nHOURLY: $X/hr\nRATE JUSTIFICATION: [2 sentences to tell clients]\nNEXT LEVEL: How to charge 30% more\n\nUnder 180 words.",700)); } catch(e){setRateOut("Error: "+e.message);} setRateBusy(false); }}><I n="calculator" s={14}/>Calculate My Rate</button>
          <OutBox txt={rateOut} busy={rateBusy} cKey="rate" color="var(--amber)"/>
        </AiSection>
      )}
    </div>
  );
}

