import Icon from '../../icons/Icon'
import { PLANS } from '../../constants/plans'
const I = Icon

export default function UpgradeModal({ feature, requiredPlan, onClose, onGoSettings }) {
  const plan = PLANS[requiredPlan] || PLANS.pro;
  return (
    <div className="upgrade-modal-wrap" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--s1)",border:"2px solid "+plan.color,borderRadius:"20px 20px 0 0",padding:"28px 24px 32px",maxWidth:460,width:"100%",textAlign:"center",animation:"slideUp .28s cubic-bezier(.32,1,.5,1) both",boxShadow:"0 0 60px "+(plan.color)+"22" }}>
        <div style={{ width:64,height:64,borderRadius:"50%",background:plan.color+"12",border:"2px solid "+plan.color+"30",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px" }}>
          <I n="crown" s={28} c={plan.color}/>
        </div>
        <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:plan.color,marginBottom:8 }}>
          {plan.name} Plan Required
        </div>
        <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:22,marginBottom:10 }}>
          Unlock {feature}
        </h2>
        <p style={{ color:"var(--txt2)",fontSize:14,lineHeight:1.7,marginBottom:22 }}>
          This feature is available on the <strong style={{ color:plan.color }}>{plan.name}</strong> plan (${plan.price}/month).
          {requiredPlan==="pro" && " Start with a 7-day free trial — no credit card required."}
        </p>
        <div style={{ background:"var(--s2)",borderRadius:12,padding:"14px 18px",marginBottom:22,textAlign:"left" }}>
          {plan.features.slice(0,4).map((f,i)=>(
            <div key={i} style={{ display:"flex",gap:8,alignItems:"center",fontSize:13,color:"var(--txt2)",marginBottom:i<3?7:0 }}>
              <I n="check" s={11} c="var(--green)"/>{f}
            </div>
          ))}
        </div>
        <button className="btn btn-lime" style={{ width:"100%",justifyContent:"center",padding:"13px",fontSize:15,marginBottom:9 }}
          onClick={()=>{onGoSettings();onClose();}}>
          {requiredPlan==="pro"?"Start 7-Day Free Trial →":"Upgrade to "+plan.name+" →"}
        </button>
        <button style={{ fontSize:12,color:"var(--txt3)",cursor:"pointer",background:"none",border:"none" }} onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

