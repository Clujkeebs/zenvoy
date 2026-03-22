import { useState } from 'react'
import Icon from '../../icons/Icon'
const I = Icon

const ONBOARD_STEPS = [
  { icon:"target", title:"Welcome to Zenvylo!", body:"You're about to discover businesses that desperately need your services. Here's a quick walkthrough to get you scanning in 60 seconds." },
  { icon:"search", title:"How Scans Work", body:"Each scan searches a location for businesses with problems you can solve. Our AI scores each lead 0–100 based on opportunity size, demand, and competition." },
  { icon:"filter", title:"Smart Filters", body:"Filter leads by status, sort by score or value, save your best prospects, and set follow-up reminders so nothing falls through the cracks." },
  { icon:"zap", title:"Scan Limits", body:"Your plan sets how many scans you get per month. Starter gets 5 leads per scan, Pro gets 10, and Scale gets 25. Upgrade anytime in Settings." },
  { icon:"rocket", title:"You're Ready!", body:"Start by clicking 'New Search' in the sidebar. Pick your service, choose a location, and let the AI find your next client. Good luck!" },
];

export default function OnboardOverlay({ onDone }) {
  const [step, setStep] = useState(0);
  const s = ONBOARD_STEPS[step];
  const isLast = step === ONBOARD_STEPS.length - 1;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(12px)",
      zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div className="pop" style={{background:"var(--s1)",border:"1.5px solid var(--brd2)",
        borderRadius:20,padding:"36px 40px",maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(198,241,53,.1)",
          border:"2px solid rgba(198,241,53,.3)",display:"flex",alignItems:"center",
          justifyContent:"center",margin:"0 auto 20px"}}>
          <I n={s.icon||"target"} s={28} c="var(--lime)"/>
        </div>
        <h2 style={{fontFamily:"var(--fh)",fontWeight:900,fontSize:22,marginBottom:12}}>{s.title}</h2>
        <p style={{color:"var(--txt2)",fontSize:14,lineHeight:1.7,marginBottom:28}}>{s.body}</p>
        <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:24}}>
          {ONBOARD_STEPS.map((_,i)=>(
            <div key={i} style={{width:i===step?24:7,height:7,borderRadius:4,
              background:i<=step?"var(--lime)":"var(--brd2)",transition:"all .25s"}}/>
          ))}
        </div>
        <button className="btn btn-lime" style={{width:"100%",justifyContent:"center",padding:"13px",fontSize:15}}
          onClick={()=>isLast?onDone():setStep(step+1)}>
          {isLast?"Start Scanning →":"Next →"}
        </button>
        {!isLast&&<button style={{marginTop:12,fontSize:12,color:"var(--txt3)",cursor:"pointer",background:"none",border:"none"}}
          onClick={onDone}>Skip tutorial</button>}
      </div>
    </div>
  );
}
