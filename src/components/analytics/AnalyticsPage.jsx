import PageHeader from '../ui/PageHeader'
import Icon from '../../icons/Icon'
import { STATUS_COLORS, SERVICES } from '../../constants/services'
import { fmtMoney } from '../../utils/helpers'
const I = Icon

export default function AnalyticsPage({ leads, clients, onNav }) {
  if(leads.length===0) return (
    <div style={{ textAlign:"center",padding:"100px 20px",color:"var(--txt2)" }}>
      <I n="bar" s={44}/><p style={{ marginTop:16,fontSize:15 }}>Run searches to unlock analytics.</p>
    </div>
  );
  const byStatus={},bySvc={},byCountry={},bySat={};
  leads.forEach(l=>{
    const st=l.status||"new"; byStatus[st]=(byStatus[st]||0)+1;
    bySvc[l.serviceId]=(bySvc[l.serviceId]||0)+1;
    byCountry[l.country||"Unknown"]=(byCountry[l.country||"Unknown"]||0)+1;
    const sat=l.marketSaturation||"competitive"; bySat[sat]=(bySat[sat]||0)+1;
  });
  const won=leads.filter(l=>l.status==="won");
  const totalMRR=leads.reduce((a,l)=>a+(l.myMonthlyRate||l.suggestedMonthlyRate||0),0);
  const wonMRR=won.reduce((a,l)=>a+(l.myMonthlyRate||l.suggestedMonthlyRate||0),0);
  const avgScore=Math.round(leads.reduce((a,l)=>a+l.score,0)/leads.length);
  const avgDemand=Math.round(leads.reduce((a,l)=>a+(l.demandScore||50),0)/leads.length);
  const conv=leads.length?Math.round(won.length/leads.length*100):0;
  const mrr=clients.filter(c=>c.status==="active").reduce((a,c)=>a+Number(c.monthly||0),0);
  const satColors={underserved:"var(--green)",competitive:"var(--amber)",saturated:"var(--red)"};

  const Bar=({label,val,max,color})=>(
    <div style={{ marginBottom:9 }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3 }}>
        <span style={{ color:"var(--txt2)" }}>{label}</span><span style={{ fontWeight:600 }}>{val}</span>
      </div>
      <div className="prog"><div className="prog-fill" style={{ width:(val/Math.max(max,1)*100)+"%",background:color||"var(--lime)" }}/></div>
    </div>
  );

  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <PageHeader title="Analytics" onBack={() => onNav("home")} onHome={() => onNav("home")} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(135px,1fr))",gap:10,marginBottom:18 }}>
        {[
          {l:"Potential MRR",v:"$"+totalMRR.toLocaleString(),c:"var(--lime)"},
          {l:"Won MRR",v:"$"+wonMRR.toLocaleString(),c:"var(--green)"},
          {l:"Avg Opp Score",v:avgScore,c:"var(--amber)"},
          {l:"Avg Demand",v:avgDemand,c:"var(--blue)"},
          {l:"Win Rate",v:conv+"%",c:"var(--purple)"},
          {l:"Active Client MRR",v:"$"+mrr.toLocaleString(),c:"var(--teal)"},
        ].map((k,i)=>(
          <div key={i} className="card fu" style={{ padding:"14px 16px",animationDelay:i*0.05+"s" }}>
            <div style={{ fontSize:11,color:"var(--txt3)",marginBottom:7 }}>{k.l}</div>
            <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:20,color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding:19,marginBottom:12 }}>
        <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",gap:7,alignItems:"center" }}>
          <I n="compass" s={14} c="var(--teal)"/>Market Saturation
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:11 }}>
          {["underserved","competitive","saturated"].map(s=>{
            const n=bySat[s]||0,pct=leads.length?Math.round(n/leads.length*100):0;
            return (
              <div key={s} style={{ padding:13,background:"var(--s2)",borderRadius:10,border:"1.5px solid "+satColors[s]+"33" }}>
                <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:26,color:satColors[s] }}>{n}</div>
                <div style={{ fontSize:12,fontWeight:700,color:satColors[s],textTransform:"capitalize",marginBottom:5 }}>{s}</div>
                <div style={{ fontSize:11,color:"var(--txt3)" }}>{pct}% of leads</div>
                <div className="sat-bar" style={{ marginTop:7 }}>
                  <div style={{ height:"100%",borderRadius:4,background:satColors[s],width:pct+"%",transition:"width .5s" }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12 }}>
        {[
          {title:"By Status",icon:"trending",color:"var(--amber)",data:Object.entries(byStatus).sort((a,b)=>b[1]-a[1]),label:([s])=>s.charAt(0).toUpperCase()+s.slice(1)},
          {title:"By Service",icon:"briefcase",color:"var(--blue)",data:Object.entries(bySvc).sort((a,b)=>b[1]-a[1]),label:([s])=>SERVICES.find(sv=>sv.id===s)?.label||s},
          {title:"By Country",icon:"map",color:"var(--green)",data:Object.entries(byCountry).sort((a,b)=>b[1]-a[1]),label:([c])=>c},
        ].map(sect=>(
          <div key={sect.title} className="card" style={{ padding:18 }}>
            <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",gap:7,alignItems:"center" }}>
              <I n={sect.icon} s={13} c={sect.color}/>{sect.title}
            </div>
            {sect.data.map(([k,v])=><Bar key={k} label={sect.label([k])} val={v} max={leads.length} color={sect.color}/>)}
          </div>
        ))}
      </div>
    </div>
  );
}
