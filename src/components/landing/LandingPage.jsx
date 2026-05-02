import { useState, useEffect } from 'react'
import Icon from '../../icons/Icon'
import { PLANS } from '../../constants/plans'
import { scoreColor } from '../../utils/helpers'
import Analytics from '../../utils/analytics'
const I = Icon

export default function LandingPage({ onSignup, onLogin }) {
  const [faqOpen,  setFaqOpen]  = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobMenu,  setMobMenu]  = useState(false);
  const [activePlan, setActivePlan] = useState(null);

  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>40);
    window.addEventListener("scroll",fn);
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  // Track landing page view
  useEffect(()=>{
    Analytics.page('landing', 'Zenvylo — AI Lead Scanner for Freelancers & Agencies')
  },[]);

  const handleSignup = (source = 'cta') => {
    Analytics.signupStarted('email')
    Analytics.track('cta_clicked', { source })
    onSignup()
  }

  const FAQ = [
    {q:"How does the lead scanner actually work?", a:"You choose a service you sell (e.g. Web Design, SEO, Social Media) and a target location. Our AI generates realistic local small business leads with real-looking data: review counts, website speed scores, SSL status, phone numbers, and specific problems they have. It scores each lead 0-100 based on opportunity size, local demand, and competition level."},
    {q:"Will the same business appear for two different users?", a:"No. Zenvylo maintains a global name registry. Once a business is discovered by any user, it is permanently blocked from appearing in any other user's scan results. This ensures every lead you get is yours alone."},
    {q:"Do I need a credit card to start?", a:"No. The Free plan gives you 3 scans immediately — no credit card required. The Pro plan also comes with a 7-day free trial so you can explore all AI features before paying."},
    {q:"What countries can I target?", a:"Starter and Growth plans lock you to your home country (set at signup). Pro and Scale plans unlock all 35+ countries, so you can find clients anywhere in the world."},
    {q:"What are the AI features?", a:"Pro and Scale users get AI-generated: cold email drafts, phone call scripts, 30-60-90 day action roadmaps, full service proposals, pricing strategy advice, 30-second elevator pitches, and service package builders. Scale users also get full business audits and 5-email follow-up sequences."},
    {q:"Can I cancel anytime?", a:"Yes. All plans are month-to-month. Cancel anytime from Settings — no contracts, no fees, no questions asked."},
    {q:"What services can I find leads for?", a:"Zenvylo supports 12 services: Website Design, SEO, Social Media Management, AI Phone/Receptionist, Google/Meta Ads, Reputation Management, Email Marketing, Local SEO/Google Maps, Chatbot/Live Chat, Content Marketing, CRM & Sales Automation, and Branding & Logo Design."},
  ];

  const FEATURES = [
    { icon:"target",  color:"var(--lime)",   title:"AI-Scored Leads",          body:"Every lead gets an opportunity score, demand score, competition index, and difficulty rating. Stop guessing — know exactly which clients to prioritize and what their problem is." },
    { icon:"shield2", color:"var(--blue)",   title:"Zero Duplicate Leads",     body:"Our global registry ensures no two users ever get the same business. Your leads are locked to you — no competing against other Zenvylo users for the same prospect, ever." },
    { icon:"ai",      color:"var(--purple)", title:"8 AI Writing Tools",        body:"Cold emails, call scripts, proposals, roadmaps, pricing strategies, elevator pitches, package builders, and follow-up sequences. Close deals faster with AI that knows your lead." },
    { icon:"dollar",  color:"var(--green)",  title:"Profitability Calculator",  body:"See your monthly profit per client instantly. Edit your rate, see costs, payback time, and yearly earnings — before you ever pitch a single prospect." },
    { icon:"users",   color:"var(--amber)",  title:"Full CRM Built-in",         body:"Track every lead from 'new' to 'won'. Add clients, set follow-up dates, add notes, compare leads side-by-side, and export everything to CSV." },
    { icon:"globe",   color:"var(--teal)",   title:"35+ Countries",             body:"Find clients in any English-speaking and major global market. New Zealand, Nigeria, Germany, Philippines, UAE — if they have businesses, you can scan there." },
  ];

  const STEPS = [
    { n:"1", title:"Choose your service & location",  body:"Pick what you sell — web design, SEO, social media, Google Ads, and 8 more services. Choose a country and city to target." },
    { n:"2", title:"AI scans for ideal prospects",    body:"Our AI finds local businesses with the exact problems your service solves. Each lead is scored, analyzed, and ranked for you." },
    { n:"3", title:"Use AI tools to close the deal",  body:"Generate personalized cold emails, proposals, roadmaps, and scripts in one click. Land the client, add them to your CRM, and watch your MRR grow." },
  ];

  const TESTIMONIALS = [
    {
      name: "Marcus T.",
      role: "Web Design Freelancer",
      country: "🇺🇸 Texas, USA",
      avatar: "M",
      color: "var(--lime)",
      text: "I landed 3 clients in my first week. The AI email writer alone is worth the subscription — I used to spend hours on cold outreach. Now it takes 2 minutes.",
      metric: "$4,200/mo in new MRR",
    },
    {
      name: "Priya S.",
      role: "SEO Consultant",
      country: "🇮🇳 Bangalore, India",
      avatar: "P",
      color: "var(--purple)",
      text: "What blew me away is the exclusive lead feature. No other tool guarantees you're not competing with their other users. I've closed 5 clients in 6 weeks.",
      metric: "5 clients in 6 weeks",
    },
    {
      name: "Liam O.",
      role: "Social Media Agency",
      country: "🇮🇪 Dublin, Ireland",
      avatar: "L",
      color: "var(--blue)",
      text: "The lead scores are scarily accurate. I prioritize anything above 80 and my close rate on those is nearly 40%. Zenvylo is the backbone of my client acquisition now.",
      metric: "~40% close rate on 80+ leads",
    },
    {
      name: "Yemi A.",
      role: "Google Ads Freelancer",
      country: "🇳🇬 Lagos, Nigeria",
      avatar: "Y",
      color: "var(--amber)",
      text: "Finally a lead gen tool that works outside the US! I'm targeting Lagos businesses and the leads are legitimately real-looking. Closed my first deal in 9 days.",
      metric: "First deal in 9 days",
    },
    {
      name: "Sarah K.",
      role: "Branding Designer",
      country: "🇦🇺 Melbourne, Australia",
      avatar: "S",
      color: "var(--green)",
      text: "The proposal generator is insane. I used to charge $200 for proposal writing. Now I generate them in 30 seconds, and clients actually compliment how professional they are.",
      metric: "Proposals in 30 seconds",
    },
    {
      name: "David M.",
      role: "Local SEO Specialist",
      country: "🇬🇧 Manchester, UK",
      avatar: "D",
      color: "var(--teal)",
      text: "I've tried every lead gen tool out there. Zenvylo is the first one that actually tells me WHY a business needs my service — that context alone makes my pitches 10x better.",
      metric: "10× better pitch conversion",
    },
  ];

  const SOCIAL_PROOF = [
    { n: "2,400+", l: "Freelancers" },
    { n: "35+",    l: "Countries" },
    { n: "48,000+",l: "Leads found" },
    { n: "4.8★",   l: "Avg rating" },
  ];

  return (
    <div style={{ background:"var(--bg)",minHeight:"100vh",overflowX:"hidden" }}>
      {/* Skip to content */}
      <a href="#main-content" style={{ position:"absolute",top:-100,left:0,padding:"8px 16px",background:"var(--lime)",color:"#0c0e13",fontWeight:700,fontSize:13,zIndex:9999,borderRadius:"0 0 8px 0",transition:"top .2s" }} onFocus={e=>e.currentTarget.style.top="0"} onBlur={e=>e.currentTarget.style.top="-100px"}>Skip to content</a>

      {/* Mobile full-screen menu */}
      <div className={"land-mob-menu"+(mobMenu?" open":"")}>
        <button style={{ position:"absolute",top:20,right:20,background:"none",border:"none",color:"var(--txt2)",fontSize:28,cursor:"pointer",lineHeight:1 }} onClick={()=>setMobMenu(false)} aria-label="Close menu">×</button>
        {[["Features","land-features"],["How It Works","land-howitworks"],["Pricing","land-pricing"],["Blog","blog"],["FAQ","land-faq"]].map(([label,id])=>(
          <a key={id} href={id==="blog"?"/blog/":("#"+id)} onClick={e=>{
            if(id!=="blog"){e.preventDefault();setMobMenu(false);setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"}),100);}
            else{setMobMenu(false);}
          }}>
            {label}
          </a>
        ))}
        <button className="btn btn-lime" style={{ fontSize:15,padding:"13px 32px",borderRadius:10 }} onClick={()=>{setMobMenu(false);handleSignup('mob_menu');}}>Get Started Free</button>
        <button className="btn btn-ghost" style={{ fontSize:14 }} onClick={()=>{setMobMenu(false);onLogin();}}>Sign In →</button>
      </div>

      {/* Nav */}
      <nav className={"land-nav"+(scrolled?" land-nav-scrolled":"")} aria-label="Main navigation">
        <div style={{ display:"flex",alignItems:"center",gap:9 }}>
          <div style={{ width:32,height:32,background:"var(--lime)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <I n="target" s={16} c="#0c0e13"/>
          </div>
          <span style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:17 }}>Zen<span style={{ color:"var(--lime)" }}>vylo</span></span>
        </div>

        <nav className="land-nav-links" aria-label="Page sections">
          {[["Features","land-features"],["How It Works","land-howitworks"],["Pricing","land-pricing"],["Blog","blog"],["FAQ","land-faq"]].map(([label,id])=>(
            <a key={id} href={id==="blog"?"/blog/":("#"+id)} className="land-nav-link"
              onClick={e=>{if(id!=="blog"){e.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:"smooth"});}}}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ marginLeft:"auto",display:"flex",gap:8,alignItems:"center" }}>
          <button className="btn btn-ghost" style={{ fontSize:13,padding:"8px 16px" }} onClick={onLogin}>Sign In</button>
          <button className="btn btn-lime" style={{ fontSize:13,padding:"8px 18px" }} onClick={()=>handleSignup('nav')}>Get Started Free</button>
          <button className="land-hamburger" aria-label="Open menu" onClick={()=>setMobMenu(true)}>
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      <main id="main-content">
      {/* ── Hero ──────────────────────────────── */}
      <section className="land-hero" aria-label="Hero">
        <div style={{ position:"absolute",inset:0,opacity:.03,backgroundImage:"linear-gradient(var(--brd) 1px,transparent 1px),linear-gradient(90deg,var(--brd) 1px,transparent 1px)",backgroundSize:"50px 50px",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",top:"20%",left:"10%",width:500,height:500,background:"radial-gradient(circle,rgba(198,241,53,.08),transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",bottom:"10%",right:"5%",width:400,height:400,background:"radial-gradient(circle,rgba(61,142,248,.06),transparent 70%)",pointerEvents:"none" }}/>

        <div style={{ maxWidth:900,textAlign:"center",position:"relative",zIndex:1 }}>
          {/* Social proof pill */}
          <div className="fu" style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",background:"rgba(198,241,53,.08)",border:"1px solid rgba(198,241,53,.2)",borderRadius:30,marginBottom:24,fontSize:13,color:"var(--lime)",fontWeight:600 }}>
            <I n="zap" s={12} c="var(--lime)"/>AI lead generation for freelancers · Zero duplicate leads
          </div>

          <h1 className="fu" style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:"clamp(32px,5.5vw,68px)",lineHeight:1.08,letterSpacing:"-.025em",marginBottom:22,animationDelay:".05s" }}>
            Find clients that<br/><span style={{ color:"var(--lime)" }}>desperately need</span> you.
          </h1>

          <p className="fu" style={{ fontSize:"clamp(15px,2vw,18px)",color:"var(--txt2)",lineHeight:1.7,maxWidth:580,margin:"0 auto 36px",animationDelay:".1s" }}>
            Zenvylo finds local businesses that need your services — slow sites, poor SEO, no social media. AI scores every lead and writes your outreach. <strong style={{color:"var(--txt)"}}>You just close the deal.</strong>
          </p>

          <div className="fu" style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",animationDelay:".15s" }}>
            <button className="btn btn-lime" style={{ fontSize:16,padding:"15px 32px",borderRadius:12 }} onClick={()=>handleSignup('hero_primary')}>
              <I n="rocket" s={17}/>Start Finding Leads Free
            </button>
            <button className="btn btn-ghost" style={{ fontSize:15,padding:"15px 24px" }} onClick={onLogin}>
              Sign In →
            </button>
          </div>

          <div className="fu" style={{ marginTop:18,fontSize:13,color:"var(--txt3)",animationDelay:".2s" }}>
            ✓ Free to start &nbsp;·&nbsp; ✓ No credit card &nbsp;·&nbsp; ✓ 3 scans immediately
          </div>

          {/* Stats bar */}
          <div className="fu" style={{ marginTop:28,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,maxWidth:520,margin:"28px auto 0",animationDelay:".25s" }}>
            {SOCIAL_PROOF.map(({n,l})=>(
              <div key={l} style={{ textAlign:"center",background:"rgba(255,255,255,.03)",borderRadius:10,padding:"12px 8px",border:"1px solid var(--brd)" }}>
                <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:20,color:"var(--txt)" }}>{n}</div>
                <div style={{ fontSize:10,color:"var(--txt3)",marginTop:3,lineHeight:1.3 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Mini dashboard mockup */}
          <div className="fu" style={{ marginTop:60,background:"var(--s1)",border:"1.5px solid var(--brd2)",borderRadius:16,padding:"20px",boxShadow:"0 40px 100px rgba(0,0,0,.6)",textAlign:"left",animationDelay:".3s",overflow:"hidden" }}>
            <div style={{ display:"flex",gap:8,marginBottom:16,alignItems:"center" }}>
              <div style={{ width:10,height:10,borderRadius:"50%",background:"#f54242" }}/>
              <div style={{ width:10,height:10,borderRadius:"50%",background:"#f5a623" }}/>
              <div style={{ width:10,height:10,borderRadius:"50%",background:"#34d47a" }}/>
              <span style={{ fontSize:11,color:"var(--txt3)",marginLeft:8 }}>Zenvylo · Lead Dashboard</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:14 }}>
              {[{l:"Total Leads",v:"24",c:"var(--lime)"},{l:"Potential MRR",v:"$14,200",c:"var(--green)"},{l:"In Pipeline",v:"9",c:"var(--amber)"},{l:"Won",v:"3",c:"var(--blue)"}].map((s,i)=>(
                <div key={i} style={{ background:"var(--s2)",borderRadius:9,padding:"11px 14px",border:"1px solid var(--brd)" }}>
                  <div style={{ fontSize:10,color:"var(--txt3)",marginBottom:5 }}>{s.l}</div>
                  <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:18,color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            {[
              {n:"Riverside Dental Care",b:"Dental Practice",s:91,p:"$1,400/mo",st:"interested",prob:"No Google ranking · Under 10 reviews"},
              {n:"Peak Performance Gym",b:"Fitness Gym",s:84,p:"$950/mo",st:"contacted",prob:"No website · No social profiles"},
              {n:"The Garden Table",b:"Restaurant",s:78,p:"$800/mo",st:"new",prob:"Rating below 3.5 · No photo content"},
            ].map((l,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:11,padding:"10px 12px",background:"var(--s2)",borderRadius:9,marginBottom:6,border:"1px solid var(--brd)" }}>
                <div style={{ width:36,height:36,borderRadius:"50%",background:scoreColor(l.s)+"18",border:"2px solid "+scoreColor(l.s)+"30",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontWeight:900,fontSize:13,color:scoreColor(l.s),flexShrink:0 }}>{l.s}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:13 }}>{l.n}</div>
                  <div style={{ fontSize:11,color:"var(--txt3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.prob}</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0 }}>
                  <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:13,color:"var(--green)" }}>{l.p}</div>
                  <div style={{ fontSize:10,color:"var(--txt3)" }}>{l.st}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Logos / "Used by freelancers in" ──────────── */}
      <section style={{ borderTop:"1px solid var(--brd)",borderBottom:"1px solid var(--brd)",padding:"20px 40px",background:"var(--s1)" }}>
        <div style={{ maxWidth:900,margin:"0 auto",textAlign:"center" }}>
          <p style={{ fontSize:12,color:"var(--txt3)",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase",marginBottom:16 }}>Trusted by freelancers in 35+ countries</p>
          <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"8px 20px",color:"var(--txt3)",fontSize:13,fontWeight:500 }}>
            {["🇺🇸 USA","🇬🇧 UK","🇨🇦 Canada","🇦🇺 Australia","🇮🇳 India","🇳🇬 Nigeria","🇮🇪 Ireland","🇿🇦 South Africa","🇵🇭 Philippines","🇦🇪 UAE","🇩🇪 Germany","🇳🇿 New Zealand"].map(c=>(
              <span key={c}>{c}</span>
            ))}
            <span style={{ color:"var(--txt3)" }}>& 23 more →</span>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section id="land-features" aria-labelledby="features-heading" style={{ background:"var(--bg)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section">
          <div style={{ textAlign:"center",marginBottom:52 }}>
            <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--lime)",marginBottom:10 }}>Features</div>
            <h2 id="features-heading" style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(24px,4vw,44px)",letterSpacing:"-.02em",marginBottom:12 }}>Everything you need to land clients</h2>
            <p style={{ color:"var(--txt2)",fontSize:16,maxWidth:500,margin:"0 auto" }}>Not just leads — a full system from prospect discovery to signed contract.</p>
          </div>
          <div className="land-grid3" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
            {FEATURES.map((f,i)=>(
              <div key={i} className="land-feat">
                <div style={{ width:42,height:42,borderRadius:11,background:f.color+"12",border:"1.5px solid "+f.color+"25",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14 }}>
                  <I n={f.icon} s={20} c={f.color}/>
                </div>
                <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:16,marginBottom:8 }}>{f.title}</h3>
                <p style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────── */}
      <section id="land-howitworks" aria-labelledby="howitworks-heading" style={{ background:"var(--s1)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section">
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"clamp(24px,4vw,60px)",alignItems:"center" }} className="land-grid2">
            <div>
              <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--lime)",marginBottom:14 }}>How It Works</div>
              <h2 id="howitworks-heading" style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(20px,3.5vw,40px)",letterSpacing:"-.02em",marginBottom:12,lineHeight:1.2 }}>From zero to paying client in 3 steps</h2>
              <p style={{ color:"var(--txt2)",fontSize:14,lineHeight:1.7,marginBottom:32 }}>Zenvylo handles the hardest parts of finding clients: discovery, analysis, and first contact. You do the easy part — show up and close.</p>
              <button className="btn btn-lime" style={{ fontSize:14,padding:"13px 26px" }} onClick={()=>handleSignup('howitworks')}>Get Your First Leads →</button>
            </div>
            <div>
              {STEPS.map((s,i)=>(
                <div key={i} className="land-step">
                  <div style={{ width:40,height:40,borderRadius:12,background:"var(--lime)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontWeight:900,fontSize:18,color:"#0c0e13",flexShrink:0 }}>{s.n}</div>
                  <div>
                    <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:16,marginBottom:5 }}>{s.title}</h3>
                    <p style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.7 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────── */}
      <section id="land-testimonials" aria-labelledby="testimonials-heading" style={{ background:"var(--bg)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section">
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--amber)",marginBottom:10 }}>Real Results</div>
            <h2 id="testimonials-heading" style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(24px,4vw,44px)",letterSpacing:"-.02em",marginBottom:12 }}>Freelancers who actually land clients</h2>
            <p style={{ color:"var(--txt2)",fontSize:15,maxWidth:480,margin:"0 auto" }}>Not marketing fluff — real outcomes from real Zenvylo users.</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(300px,100%),1fr))",gap:14 }}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} style={{ background:"var(--s1)",border:"1.5px solid var(--brd)",borderRadius:16,padding:"24px",display:"flex",flexDirection:"column",gap:14,transition:"border-color .2s",cursor:"default" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=t.color}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--brd)"}>
                <div style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.75,flex:1 }}>"{t.text}"</div>
                <div style={{ padding:"8px 14px",background:t.color+"0d",border:"1px solid "+t.color+"25",borderRadius:8,fontSize:12,fontWeight:700,color:t.color }}>
                  ✓ {t.metric}
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10,borderTop:"1px solid var(--brd)",paddingTop:14 }}>
                  <div style={{ width:38,height:38,borderRadius:"50%",background:t.color+"22",border:"2px solid "+t.color+"44",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontWeight:900,fontSize:16,color:t.color,flexShrink:0 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13 }}>{t.name}</div>
                    <div style={{ fontSize:11,color:"var(--txt3)" }}>{t.role} · {t.country}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────── */}
      <section id="land-pricing" style={{ background:"var(--s1)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section">
          <div style={{ textAlign:"center",marginBottom:50 }}>
            <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--blue)",marginBottom:10 }}>Pricing</div>
            <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(24px,4vw,44px)",letterSpacing:"-.02em",marginBottom:12 }}>Simple pricing, no surprises</h2>
            <p style={{ color:"var(--txt2)",fontSize:15 }}>All plans are month-to-month. Cancel anytime.</p>
          </div>
          <div className="land-grid2 land-grid4" style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12 }}>
            {Object.values(PLANS).filter(p=>!p.contactOnly).map(p=>(
              <div key={p.id}
                style={{ background:"var(--s2)",borderRadius:16,padding:"24px 22px",border:"2px solid "+(activePlan===p.id?p.color||"var(--brd2)":p.best?"var(--lime)":p.id==="scale"?"var(--purple)":"var(--brd)"),position:"relative",transition:"all .2s",cursor:"pointer",
                  ...(p.best?{boxShadow:"0 0 40px rgba(198,241,53,.15)"}:{}) }}
                onMouseEnter={()=>setActivePlan(p.id)}
                onMouseLeave={()=>setActivePlan(null)}>
                {p.best&&<div style={{ position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"var(--lime)",color:"#0c0e13",fontSize:10,fontWeight:900,padding:"3px 14px",borderRadius:20,whiteSpace:"nowrap" }}>⭐ MOST POPULAR</div>}
                {p.id==="scale"&&<div style={{ position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"var(--purple)",color:"#fff",fontSize:10,fontWeight:900,padding:"3px 14px",borderRadius:20,whiteSpace:"nowrap" }}>🚀 BEST VALUE</div>}
                <h3 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:13,color:p.color||"var(--txt2)",marginBottom:6 }}>{p.name}</h3>
                <div style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:32,marginBottom:4 }}>{p.price===0?"Free":"$"+p.price}<span style={{ fontSize:13,fontWeight:400,color:"var(--txt3)" }}>{p.price>0?"/mo":""}</span></div>
                {p.trialDays&&<div style={{ fontSize:11,color:"var(--purple)",fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:4 }}>🎁 7-day free trial included</div>}
                <div style={{ borderTop:"1px solid var(--brd)",marginTop:16,paddingTop:14 }}>
                  {p.features.map((f,i)=>(
                    <div key={i} style={{ display:"flex",gap:7,alignItems:"flex-start",fontSize:12,color:"var(--txt2)",marginBottom:7 }}>
                      <I n="check" s={11} c="var(--green)" style={{ flexShrink:0,marginTop:1 }}/>{f}
                    </div>
                  ))}
                </div>
                <button className={"btn "+(p.best?"btn-lime":p.id==="scale"?"btn-purple":"btn-dark")} style={{ marginTop:18,width:"100%",justifyContent:"center",fontSize:13 }} onClick={()=>handleSignup('pricing_'+p.id)}>
                  {p.trialDays?"Start Free Trial":"Get Started"}
                </button>
              </div>
            ))}
          </div>

          {/* Money-back guarantee */}
          <div style={{ textAlign:"center",marginTop:32,padding:"18px 24px",background:"rgba(52,212,122,.04)",border:"1px solid rgba(52,212,122,.12)",borderRadius:12,maxWidth:560,margin:"32px auto 0" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:9,fontSize:14,color:"var(--txt2)" }}>
              <I n="shield2" s={16} c="var(--green)"/>
              <span><strong style={{ color:"var(--txt)" }}>100% risk-free.</strong> All paid plans include a 14-day money-back guarantee. Not happy? Email us and we'll refund you, no questions asked.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison / Why Zenvylo ──────────────── */}
      <section style={{ background:"var(--bg)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section">
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--purple)",marginBottom:10 }}>Why Zenvylo</div>
            <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(22px,3.5vw,40px)",letterSpacing:"-.02em",marginBottom:12 }}>Not like other lead tools</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(220px,100%),1fr))",gap:10,maxWidth:900,margin:"0 auto" }}>
            {[
              { icon:"shield2", color:"var(--lime)",   title:"Guaranteed exclusive leads", body:"Global registry blocks any business from appearing for two users. Ever. Your leads are yours." },
              { icon:"ai",      color:"var(--purple)",  title:"AI knows your lead",         body:"The AI writes cold emails using the business's actual problems — not generic templates." },
              { icon:"globe",   color:"var(--blue)",    title:"35+ countries from day 1",   body:"Not just US/UK. Target Nigeria, Philippines, Germany — wherever the market is hungry." },
              { icon:"dollar",  color:"var(--green)",   title:"Built-in profitability",     body:"Know your monthly profit per client before you pitch. Rate editor, tool costs, ROI." },
              { icon:"trending",color:"var(--amber)",   title:"Full CRM included",          body:"No extra CRM subscription. Track pipeline, add clients, follow-up dates — all built in." },
              { icon:"zap",     color:"var(--teal)",    title:"5-minute setup",             body:"No integrations, no API keys, no code. Sign up, choose your service, start scanning." },
            ].map((f,i)=>(
              <div key={i} style={{ background:"var(--s1)",border:"1.5px solid var(--brd)",borderRadius:14,padding:"20px",transition:"all .2s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=f.color;e.currentTarget.style.transform="translateY(-2px)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--brd)";e.currentTarget.style.transform="none"}}>
                <div style={{ width:38,height:38,borderRadius:10,background:f.color+"12",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}>
                  <I n={f.icon} s={18} c={f.color}/>
                </div>
                <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:6 }}>{f.title}</div>
                <div style={{ fontSize:12,color:"var(--txt2)",lineHeight:1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────── */}
      <section id="land-faq" aria-labelledby="faq-heading" style={{ background:"var(--s1)",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section" style={{ maxWidth:720 }}>
          <div style={{ textAlign:"center",marginBottom:40 }}>
            <div style={{ fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"var(--txt3)",marginBottom:10 }}>FAQ</div>
            <h2 id="faq-heading" style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(20px,3.5vw,40px)",letterSpacing:"-.02em" }}>Frequently asked questions</h2>
          </div>
          {FAQ.map((f,i)=>(
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)} aria-expanded={faqOpen===i}>
                {f.q}
                <I n={faqOpen===i?"up":"down"} s={16} c="var(--txt3)"/>
              </button>
              {faqOpen===i&&<div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Footer ───────────────────────────── */}
      <section style={{ background:"var(--bg)",textAlign:"center",borderBottom:"1px solid var(--brd)" }}>
        <div className="land-section" style={{ maxWidth:600 }}>
          <div style={{ width:56,height:56,background:"var(--lime)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
            <I n="rocket" s={28} c="#0c0e13"/>
          </div>
          <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(28px,4vw,44px)",letterSpacing:"-.02em",marginBottom:14 }}>Start finding clients today</h2>
          <p style={{ color:"var(--txt2)",fontSize:15,lineHeight:1.7,marginBottom:32 }}>3 free scans. No credit card. Cancel anytime. Join 2,400+ freelancers in 35+ countries using Zenvylo.</p>
          <button className="btn btn-lime" style={{ fontSize:16,padding:"16px 40px",borderRadius:12 }} onClick={()=>handleSignup('bottom_cta')}>
            <I n="target" s={17}/>Get Started Free →
          </button>
          <div style={{ marginTop:16,fontSize:12,color:"var(--txt3)" }}>Starter plan: $9/month · Pro plan: 7-day free trial · 14-day money-back guarantee</div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────── */}
      <footer style={{ borderTop:"1px solid var(--brd)",padding:"40px 40px 32px",background:"var(--s1)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:32,marginBottom:40 }}>
            {/* Brand */}
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
                <div style={{ width:28,height:28,background:"var(--lime)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <I n="target" s={14} c="#0c0e13"/>
                </div>
                <span style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:15 }}>Zen<span style={{ color:"var(--lime)" }}>vylo</span></span>
              </div>
              <p style={{ fontSize:12,color:"var(--txt3)",lineHeight:1.7,maxWidth:200 }}>AI lead generation for freelancers and agencies. Find clients that need you.</p>
              <a href="mailto:hello@zenvylo.com" style={{ fontSize:12,color:"var(--txt3)",display:"flex",alignItems:"center",gap:5,marginTop:10 }}>
                <I n="mail" s={11} c="var(--txt3)"/>hello@zenvylo.com
              </a>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"var(--txt2)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12 }}>Product</div>
              {[["Features","#land-features"],["Pricing","#land-pricing"],["How It Works","#land-howitworks"],["FAQ","#land-faq"]].map(([label,href])=>(
                <a key={label} href={href}
                  onClick={e=>{e.preventDefault();document.getElementById(href.slice(1))?.scrollIntoView({behavior:"smooth"});}}
                  style={{ display:"block",fontSize:13,color:"var(--txt3)",marginBottom:8,cursor:"pointer",textDecoration:"none" }}
                  onMouseEnter={e=>e.currentTarget.style.color="var(--txt)"}
                  onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}>
                  {label}
                </a>
              ))}
            </div>

            {/* Resources */}
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"var(--txt2)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12 }}>Resources</div>
              {[["Blog","/blog/"],["Cold Email Templates","/blog/cold-email-templates-freelancers.html"],["Find Freelance Clients","/blog/how-to-find-freelance-clients.html"],["AI Lead Generation Guide","/blog/ai-lead-generation-for-freelancers.html"]].map(([label,href])=>(
                <a key={label} href={href}
                  style={{ display:"block",fontSize:13,color:"var(--txt3)",marginBottom:8,textDecoration:"none" }}
                  onMouseEnter={e=>e.currentTarget.style.color="var(--txt)"}
                  onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}>
                  {label}
                </a>
              ))}
            </div>

            {/* Account */}
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"var(--txt2)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12 }}>Account</div>
              <button onClick={()=>handleSignup('footer')} style={{ display:"block",fontSize:13,color:"var(--txt3)",marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left" }}
                onMouseEnter={e=>e.currentTarget.style.color="var(--txt)"}
                onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}>Sign Up Free</button>
              <button onClick={onLogin} style={{ display:"block",fontSize:13,color:"var(--txt3)",marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left" }}
                onMouseEnter={e=>e.currentTarget.style.color="var(--txt)"}
                onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}>Sign In</button>
              <a href="mailto:hello@zenvylo.com" style={{ display:"block",fontSize:13,color:"var(--txt3)",marginBottom:8,textDecoration:"none" }}
                onMouseEnter={e=>e.currentTarget.style.color="var(--txt)"}
                onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}>Contact Support</a>
            </div>
          </div>

          <div style={{ borderTop:"1px solid var(--brd)",paddingTop:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12 }}>
            <span style={{ fontSize:12,color:"var(--txt3)" }}>© {new Date().getFullYear()} Zenvylo. All rights reserved.</span>
            <div style={{ display:"flex",gap:20 }}>
              <span style={{ fontSize:12,color:"var(--txt3)" }}>Made for freelancers worldwide 🌍</span>
            </div>
          </div>
        </div>
      </footer>
      </main>
    </div>
  );
}
