// ─── Plan Definitions ──────────────────────────────────
// Order: free → starter → growth → pro → scale → enterprise
export const PLANS = {
  free: {
    id:"free", name:"Free", price:0, scans:3, leadsPerScan:5, ai:false, multiCountry:false,
    color:"var(--txt3)",
    features:["3 scans/month","Single country","Lead dashboard","Basic filters"],
  },
  starter: {
    id:"starter", name:"Starter", price:9, scans:10, leadsPerScan:5, ai:false, multiCountry:false,
    color:"var(--txt2)",
    features:["10 scans/month","Single country","Lead dashboard","Advanced filters","CSV export"],
  },
  growth: {
    id:"growth", name:"Growth", price:19, scans:30, leadsPerScan:5, ai:false, multiCountry:false,
    color:"var(--blue)",
    features:["30 scans/month","Single country","All Starter features","Client CRM","Scan history"],
  },
  pro: {
    id:"pro", name:"Pro", price:39, scans:50, leadsPerScan:10, ai:true, multiCountry:true,
    trialDays:7, color:"var(--lime)", best:true,
    features:["50 scans/month · 10 leads each","All countries","AI outreach, roadmaps & proposals","Opportunity comparison","Full analytics","AI pricing advisor"],
  },
  scale: {
    id:"scale", name:"Scale", price:79, scans:9999, leadsPerScan:25, ai:true, multiCountry:true,
    color:"var(--purple)",
    features:["Unlimited scans · 25 leads each","All countries","Everything in Pro","Full business audit AI","Advanced analytics","Priority search weighting"],
  },
  enterprise: {
    id:"enterprise", name:"Enterprise", price:null, scans:9999, leadsPerScan:50, ai:true, multiCountry:true,
    color:"var(--amber)", contactOnly:true,
    features:["Custom scan limits","Dedicated support","Custom integrations","Team management","SLA guarantee","Priority everything"],
  },
}

export const PLAN_ORDER = ["free","starter","growth","pro","scale","enterprise"]

// ─── Plan Helpers ──────────────────────────────────────
export const canAI = u => ["pro","scale","enterprise"].includes(u?.plan)
export const canScale = u => ["scale","enterprise"].includes(u?.plan)
export const getLeadsPerScan = u => PLANS[u?.plan]?.leadsPerScan || 5
export const canMulti = u => ["pro","scale","enterprise"].includes(u?.plan)
export const getScansLimit = u => PLANS[u?.plan]?.scans || 3
export const getScansLeft = u => Math.max(0, getScansLimit(u) - (u?.scansUsed || 0))
export const isPaidPlan = u => u?.plan && u.plan !== "free"
export const isEnterprise = u => u?.plan === "enterprise"
