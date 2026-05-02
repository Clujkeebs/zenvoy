// ─── Plan Definitions ──────────────────────────────────
// Order: free → starter → growth → pro → scale → enterprise
export const PLANS = {
  free: {
    id:"free", name:"Free", price:0, scans:3, leadsPerScan:5, ai:false, multiCountry:false,
    color:"var(--txt3)",
    features:["3 scans/month","5 leads per scan","Single country","Lead dashboard"],
  },
  starter: {
    id:"starter", name:"Starter", price:9, scans:20, leadsPerScan:5, ai:false, multiCountry:false,
    color:"var(--txt2)",
    features:["20 scans/month","5 leads per scan","CSV export","Scan history","Advanced filters"],
  },
  growth: {
    id:"growth", name:"Growth", price:19, scans:50, leadsPerScan:8, ai:false, multiCountry:true,
    color:"var(--blue)",
    features:["50 scans/month","8 leads per scan","All countries","Client CRM","Scan history"],
  },
  pro: {
    id:"pro", name:"Pro", price:39, scans:100, leadsPerScan:10, ai:true, multiCountry:true,
    trialDays:7, color:"var(--lime)", best:true,
    features:["100 scans/month","10 leads per scan","All countries","AI outreach & proposals","Full analytics","7-day free trial"],
  },
  scale: {
    id:"scale", name:"Scale", price:79, scans:200, leadsPerScan:15, ai:true, multiCountry:true,
    color:"var(--purple)",
    features:["200 scans/month","15 leads per scan","Everything in Pro","Business audit AI","Priority weighting","Advanced analytics"],
  },
  enterprise: {
    id:"enterprise", name:"Enterprise", price:null, scans:500, leadsPerScan:25, ai:true, multiCountry:true,
    color:"var(--amber)", contactOnly:true,
    features:["Custom scan limits","Dedicated account manager","Priority support & SLA","Team management","Custom integrations","Onboarding assistance"],
  },
}

// Scan Packs (one-time, never expire, stack on any plan)
export const SCAN_PACKS = [
  { id:"pack5",  scans:5,  price:5,  perScan:"1.00", label:"5 Scans" },
  { id:"pack20", scans:20, price:15, perScan:"0.75", label:"20 Scans", savings:"25% off" },
  { id:"pack50", scans:50, price:30, perScan:"0.60", label:"50 Scans", savings:"40% off", best:true },
]

export const PLAN_ORDER = ["free","starter","growth","pro","scale","enterprise"]

// ─── Plan Helpers ──────────────────────────────────────
// Owner (role === 'owner') gets unlimited everything
const _isOwner = u => u?.role === "owner"

export const canAI          = u => _isOwner(u) || ["pro","scale","enterprise"].includes(u?.plan)
export const canScale       = u => _isOwner(u) || ["scale","enterprise"].includes(u?.plan)
export const canMulti       = u => _isOwner(u) || ["pro","scale","enterprise"].includes(u?.plan)
export const getLeadsPerScan = u => _isOwner(u) ? 9999 : (PLANS[u?.plan]?.leadsPerScan || 5)
export const getScansLimit  = u => _isOwner(u) ? Infinity : (PLANS[u?.plan]?.scans || 3)
export const getScansLeft   = u => _isOwner(u) ? Infinity : Math.max(0, getScansLimit(u) - (u?.scansUsed || 0))
export const getBonusScans  = u => u?.bonusScans || 0
export const getTotalScansLeft = u => _isOwner(u) ? Infinity : (getScansLeft(u) + getBonusScans(u))
export const isPaidPlan     = u => _isOwner(u) || (u?.plan && u.plan !== "free")
export const isEnterprise   = u => _isOwner(u) || u?.plan === "enterprise"
