import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import Icon from './icons/Icon'
import { PLANS, getScansLeft, getScansLimit, getLeadsPerScan, getBonusScans } from './constants/plans'
import * as DB from './utils/db'
import { supabase } from './lib/supabase'
import { checkTrialExpiry, isTrialActive, getTrialDaysLeft } from './utils/trial'
import { isAdmin } from './utils/roles'
import Analytics from './utils/analytics'

import LandingPage from './components/landing/LandingPage'
import AuthModal from './components/auth/AuthModal'
import Toast from './components/ui/Toast'
import UpgradeModal from './components/ui/UpgradeModal'
import OnboardOverlay from './components/layout/OnboardOverlay'
import SearchModal from './components/search/SearchModal'
import Home from './components/home/Home'
import LeadsPage from './components/leads/LeadsPage'
import ClientsPage from './components/clients/ClientsPage'
// import CommunityPage from './components/community/CommunityPage' // Coming soon
import ToolsPage from './components/tools/ToolsPage'
import AnalyticsPage from './components/analytics/AnalyticsPage'
import HistoryPage from './components/history/HistoryPage'
import SubscriptionPage from './components/settings/SubscriptionPage'
import SettingsPage from './components/settings/SettingsPage'
import EnterprisePage from './components/pages/EnterprisePage'
import SupportPage from './components/pages/SupportPage'
import AdminDashboard from './components/admin/AdminDashboard'
import AffiliateDashboard from './components/affiliate/AffiliateDashboard'

const I = Icon

export default function App() {
  const [user,        setUser]        = useState(null)
  const [authMode,    setAuthMode]    = useState(null)
  const [tab,         setTab]         = useState("home")
  const [leads,       setLeads]       = useState([])
  const [clients,     setClients]     = useState([])
  const [toast,       setToast]       = useState(null)
  const [showSearch,  setShowSearch]  = useState(false)
  const [showBoard,   setShowBoard]   = useState(false)
  const [upgradeFor,  setUpgradeFor]  = useState(null)
  const [showMore,    setShowMore]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const toastTimer = useRef(null)

  const showToast = useCallback(msg => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // ─── Load session on mount (async) ───────────────────
  useEffect(() => {
    let mounted = true

    // Core session bootstrap — shared by init() and the auth-state listener
    async function bootSession(session) {
      if (!session || !mounted) return false
      const email = session.user?.email
      if (!email) return false

      try {
        // For fresh magic-link users the DB trigger may still be in-flight —
        // retry up to ~2 s before giving up.
        let u = await DB.getUser(email)
        if (!u) {
          await new Promise(r => setTimeout(r, 700))
          u = await DB.getUser(email)
        }
        if (!u) {
          await new Promise(r => setTimeout(r, 1200))
          u = await DB.getUser(email)
        }
        if (!u) {
          if (mounted) await DB.clearSession()
          return false
        }

        u = checkTrialExpiry(u)
        // Monthly scan reset
        const resetDate = u.scansResetAt ? new Date(u.scansResetAt) : new Date(0)
        const now = new Date()
        if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
          u = { ...u, scansUsed: 0, scansResetAt: now.toISOString() }
        }
        DB.saveUser(email, u) // fire-and-forget

        // Process any referral stored before the magic link was sent
        DB.processPendingRef(email).catch(() => {})

        // Analytics identify
        Analytics.identify(email, { plan: u.plan, country: u.country, name: u.name })
        const isNewUser = u.createdAt && (Date.now() - new Date(u.createdAt).getTime() < 120_000)
        if (isNewUser) Analytics.signupCompleted(u.plan, u.country)
        else Analytics.loginCompleted()

        if (mounted) {
          setUser(u)
          const [lds, cls] = await Promise.all([DB.getLeads(email), DB.getClients(email)])
          if (mounted) {
            setLeads(lds)
            setClients(cls)
            if (!u.onboarded) setShowBoard(true)
          }
        }
        return true
      } catch (e) {
        console.error('Session boot error:', e)
        if (mounted) try { await DB.clearSession() } catch (_) {}
        return false
      }
    }

    async function init() {
      try {
        // getSession() in Supabase v2 processes the URL hash (magic-link token)
        // synchronously during client construction, so this call is reliable.
        const { data: { session } } = await supabase.auth.getSession()
        await bootSession(session)
      } catch (e) {
        console.error('Init error:', e)
        try { await DB.clearSession() } catch (_) {}
      }
      if (mounted) setLoading(false)
    }

    init()

    // Safety net: if the magic-link token resolves *after* init() has already
    // run without a session (can happen on very slow connections), pick it up here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && mounted) {
        // Only act if we haven't already loaded a user
        setUser(prev => {
          if (prev) return prev // already signed in — nothing to do
          // Kick off boot in the background; flip loading off when done
          bootSession(session).then(() => { if (mounted) setLoading(false) })
          return prev
        })
      }
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null); setLeads([]); setClients([]); setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Page title + analytics page tracking
  const PAGE_TITLES = useMemo(() => ({
    home: "Dashboard — Zenvylo", leads: "My Leads — Zenvylo",
    clients: "Clients — Zenvylo", community: "Community — Zenvylo",
    tools: "Business Tools — Zenvylo", analytics: "Analytics — Zenvylo",
    history: "Scan History — Zenvylo", subscription: "Subscription — Zenvylo",
    settings: "Settings — Zenvylo", enterprise: "Enterprise — Zenvylo",
    support: "Support — Zenvylo", admin: "Admin — Zenvylo",
  }), [])
  useEffect(() => {
    const title = PAGE_TITLES[tab] || "Zenvylo — AI Lead Scanner"
    document.title = title
    if (user) Analytics.page(tab, title)
  }, [tab, PAGE_TITLES, user])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.key === "Escape") { setShowSearch(false); setShowBoard(false); setUpgradeFor(null); setShowMore(false) }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); if (user) setShowSearch(true) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [user])

  // ─── Auth callbacks ──────────────────────────────────
  // NOTE: with magic-link auth this is typically NOT called; App.jsx's init()
  // handles session bootstrap directly. Kept for any future direct-auth path.
  const auth = useCallback(async (u, isNew = false) => {
    setUser(u)
    Analytics.identify(u.email, { plan: u.plan, country: u.country, name: u.name })
    if (isNew) Analytics.signupCompleted(u.plan, u.country)
    else Analytics.loginCompleted()
    const [lds, cls] = await Promise.all([DB.getLeads(u.email), DB.getClients(u.email)])
    setLeads(lds)
    setClients(cls)
    setAuthMode(null)
    if (!u.onboarded) setShowBoard(true)
  }, [])

  const logout = useCallback(async () => {
    Analytics.logoutCompleted()
    await DB.clearSession()
    setUser(null); setLeads([]); setClients([]); setTab("home")
  }, [])

  const doneBoard = useCallback(() => {
    Analytics.onboardingCompleted()
    const u = { ...user, onboarded: true }
    DB.saveUser(user.email, u) // fire-and-forget
    setUser(u); setShowBoard(false)
  }, [user])

  // ─── Lead / Client mutations ─────────────────────────
  // State updates are instant, Supabase syncs in background
  const handleLeads = useCallback(async (newLeads, updUser) => {
    Analytics.scanCompleted(newLeads[0]?.serviceId || 'unknown', newLeads.length)
    setLeads(prev => [...newLeads, ...prev])
    setUser(updUser)
    setShowSearch(false)
    showToast("Found " + newLeads.length + " new leads!")
    setTab("leads")
    // Insert to DB and update with server-generated UUIDs
    try {
      const saved = await DB.insertLeads(newLeads)
      if (saved && saved.length) {
        setLeads(prev => {
          // Replace the temporary leads with DB versions (have real UUIDs)
          const withoutTemp = prev.filter(l => !String(l.id).startsWith('l_'))
          return [...saved, ...withoutTemp]
        })
      }
    } catch (e) {
      console.error('Lead save error:', e)
    }
  }, [showToast])

  const updLead = useCallback(l => {
    setLeads(prev => prev.map(x => x.id === l.id ? l : x))
    DB.updateLead(l) // fire-and-forget
  }, [])

  const delLead = useCallback(id => {
    setLeads(prev => prev.filter(l => l.id !== id))
    DB.deleteLead(id) // fire-and-forget
    showToast("Lead deleted.")
  }, [showToast])

  const addClient = useCallback(c => {
    setClients(prev => [c, ...prev])
    DB.insertClient(c) // fire-and-forget
    showToast("Client added!")
  }, [showToast])

  const updClient = useCallback(c => {
    setClients(prev => prev.map(x => x.id === c.id ? c : x))
    DB.updateClient(c) // fire-and-forget
    showToast("Saved!")
  }, [showToast])

  const delClient = useCallback(id => {
    setClients(prev => prev.filter(c => c.id !== id))
    DB.deleteClient(id) // fire-and-forget
    showToast("Removed.")
  }, [showToast])

  const handleUpgrade = useCallback((feature, plan) => {
    Analytics.upgradeModalSeen(feature, plan)
    setUpgradeFor({ feature, plan })
  }, [])
  const openSearch = useCallback(() => {
    Analytics.searchOpened()
    setShowSearch(true)
  }, [])

  // ─── Derived state ───────────────────────────────────
  const planScansLeft = useMemo(() => {
    if (!user) return 0
    return getScansLeft(user)
  }, [user, tab])
  const bonusScans = useMemo(() => user ? getBonusScans(user) : 0, [user])
  const scansLeft = planScansLeft + bonusScans

  const plan   = useMemo(() => user ? (PLANS[user.plan] || PLANS.free) : PLANS.free, [user])
  const leadsN = useMemo(() => user ? getLeadsPerScan(user) : 5, [user])

  const NAV = useMemo(() => {
    const items = [
      { id: "home",         icon: "home",      label: "Home" },
      { id: "leads",        icon: "target",    label: "Leads" + (leads.length ? " (" + leads.length + ")" : "") },
      { id: "clients",      icon: "users",     label: "Clients" + (clients.length ? " (" + clients.length + ")" : "") },
      { id: "tools",        icon: "tool",      label: "Tools" },
      { id: "analytics",    icon: "bar",       label: "Analytics" },
      { id: "history",      icon: "clock",     label: "History" },
      { id: "subscription", icon: "crown",     label: "Subscription" },
      { id: "support",      icon: "info",      label: "Support" },
      { id: "settings",     icon: "settings",  label: "Settings" },
    ]
    if (isAdmin(user)) items.push({ id: "admin", icon: "shield2", label: "Admin" })
    // Show affiliate dashboard if user has an affiliate record (set by admin)
    if (user?.affiliateId || user?.isAffiliate) items.push({ id: "affiliate", icon: "dollar", label: "Affiliate" })
    return items
  }, [leads.length, clients.length, user])

  const moreActive = ["clients","analytics","history","subscription","settings","enterprise","support","admin"].includes(tab)

  // ─── Loading state ───────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--brd)", borderTopColor: "var(--lime)", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontFamily: "var(--fh)", fontWeight: 700, color: "var(--txt2)" }}>Loading…</div>
      </div>
    </div>
  )

  // ─── Not logged in ───────────────────────────────────
  if (!user) return (
    <>
      <LandingPage onSignup={() => setAuthMode("signup")} onLogin={() => setAuthMode("login")} />
      {authMode && <AuthModal mode={authMode} onAuth={auth} onClose={() => setAuthMode(null)} />}
    </>
  )

  const trialActive = isTrialActive(user)
  const trialDays = trialActive ? getTrialDaysLeft(user) : 0

  return (
    <>
      <VercelAnalytics />
      <div className="app-shell">
        <aside className="app-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px", marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, background: "var(--lime)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <I n="target" s={15} c="#0c0e13" />
          </div>
          <span className="sidebar-logo-text" style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 15, letterSpacing: "-.02em", overflow: "hidden", whiteSpace: "nowrap" }}>
            Zen<span style={{ color: "var(--lime)" }}>vylo</span>
          </span>
        </div>

        {trialActive && (
          <div className="trial-banner" style={{ marginBottom: 10, fontSize: 12 }}>
            <I n="zap" s={13} c="var(--purple)" />
            <span>Pro trial: <strong>{trialDays}d left</strong></span>
          </div>
        )}

        <div className="sidebar-scan-pill" style={{ marginBottom: 11, padding: "8px 11px", borderRadius: 9,
          background: scansLeft === 0 ? "rgba(245,66,66,.06)" : "var(--s2)",
          border: "1.5px solid " + (scansLeft === 0 ? "rgba(245,66,66,.18)" : "var(--brd)") }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: scansLeft === 0 ? "var(--red)" : scansLeft <= 2 ? "var(--amber)" : "var(--txt2)" }}>
              {scansLeft} scan{scansLeft !== 1 ? "s" : ""} left
            </span>
            <button style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", cursor: "pointer", background: "none", border: "none", flexShrink: 0 }} onClick={() => setTab("subscription")}>
              {scansLeft === 0 ? "Upgrade!" : "↑"}
            </button>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: "var(--s3)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, transition: "width .4s",
              background: scansLeft === 0 ? "var(--red)" : scansLeft <= 2 ? "var(--amber)" : "var(--lime)",
              width: ((scansLeft / (user.plan === "free" ? 3 : getScansLimit(user))) * 100) + "%" }} />
          </div>
          <div className="scan-detail" style={{ fontSize: 10, color: "var(--txt3)", marginTop: 4 }}>{leadsN} leads/scan · {plan.name}{bonusScans > 0 ? " + " + bonusScans + " bonus" : ""}</div>
        </div>

        <button className="btn btn-lime sidebar-search-btn" style={{ width: "100%", justifyContent: "center", marginBottom: 12, fontSize: 13, padding: "10px" }} onClick={openSearch}>
          <I n="search" s={14} /><span>New Search</span><span style={{ marginLeft: "auto", fontSize: 10, opacity: .55 }}>⌘K</span>
        </button>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
          {NAV.map(item => (
            <button key={item.id} className={"nav-btn" + (tab === item.id ? " on" : "")} onClick={() => setTab(item.id)} style={{ overflow: "hidden" }}>
              <I n={item.icon} s={14} /><span className="nav-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1.5px solid var(--brd)", paddingTop: 10, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", marginBottom: 5 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: plan.best ? "var(--lime)" : "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: plan.best ? "#0c0e13" : "var(--txt)", flexShrink: 0 }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div className="plan-name" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: plan.color }}>{plan.name}{trialActive ? " (trial)" : ""}</div>
            </div>
          </div>
          <button className="nav-btn" onClick={logout} style={{ fontSize: 12 }}><I n="logout" s={13} />Sign Out</button>
        </div>
      </aside>

      <main className="app-main">
        <div key={tab} className="fu" style={{ minHeight: "100%", animationDuration: ".18s" }}>
        {tab === "home"         && <Home user={user} leads={leads} clients={clients} onSearch={openSearch} onNav={setTab} />}
        {tab === "leads"        && <LeadsPage user={user} leads={leads} onUpdate={updLead} onDelete={delLead} onSearch={openSearch} onUpgrade={handleUpgrade} onNav={setTab} />}
        {tab === "clients"      && <ClientsPage clients={clients} leads={leads} onAdd={addClient} onUpdate={updClient} onDelete={delClient} onNav={setTab} />}
        {tab === "tools"        && <ToolsPage user={user} onUpgrade={handleUpgrade} onNav={setTab} />}
        {tab === "analytics"    && <AnalyticsPage leads={leads} clients={clients} onNav={setTab} />}
        {tab === "history"      && <HistoryPage user={user} onNav={setTab} />}
        {tab === "subscription" && <SubscriptionPage user={user} onUpdate={u => { setUser(u); DB.saveUser(u.email, u) }} onNav={setTab} />}
        {tab === "settings"     && <SettingsPage user={user} onUpdate={u => { setUser(u); DB.saveUser(u.email, u) }} onLogout={logout} onGoSubscription={() => setTab("subscription")} onNav={setTab} />}
        {tab === "enterprise"   && <EnterprisePage onNav={setTab} />}
        {tab === "support"      && <SupportPage onNav={setTab} />}
        {tab === "admin"        && <AdminDashboard user={user} onNav={setTab} />}
        {tab === "affiliate"    && <AffiliateDashboard user={user} />}
        </div>
      </main>

      <button className="mob-fab" onClick={openSearch}><I n="search" s={16} c="#0c0e13" />Scan</button>

      <nav className="bottom-nav">
        {[{id:"home",icon:"home",label:"Home"},{id:"leads",icon:"target",label:"Leads"},{id:"tools",icon:"tool",label:"Tools"},{id:"analytics",icon:"bar",label:"Analytics"}].map(item => (
          <button key={item.id} className={"bnav-btn" + (tab === item.id ? " on" : "")} onClick={() => setTab(item.id)}>
            <I n={item.icon} s={item.id === tab ? 20 : 18} c={tab === item.id ? "var(--lime)" : "var(--txt3)"} /><span>{item.label}</span>
          </button>
        ))}
        <button className={"bnav-btn" + (moreActive ? " on" : "")} onClick={() => setShowMore(true)}>
          <I n="menu" s={18} c={moreActive ? "var(--lime)" : "var(--txt3)"} /><span>More</span>
        </button>
      </nav>

      {showMore && (
        <div className="mob-drawer-wrap" onClick={() => setShowMore(false)}>
          <div className="mob-drawer" onClick={e => e.stopPropagation()}>
            <div className="mob-drawer-handle" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(180px,100%),1fr))", gap: 10, marginBottom: 16 }}>
              {[
                {id:"clients",icon:"users",label:"Clients",color:"var(--blue)"},
                {id:"analytics",icon:"bar",label:"Analytics",color:"var(--purple)"},
                {id:"history",icon:"clock",label:"History",color:"var(--amber)"},
                {id:"subscription",icon:"crown",label:"Subscription",color:"var(--lime)"},
                {id:"support",icon:"info",label:"Support",color:"var(--blue)"},
                {id:"settings",icon:"settings",label:"Settings",color:"var(--txt2)"},
                ...(isAdmin(user) ? [{id:"admin",icon:"shield2",label:"Admin",color:"var(--amber)"}] : []),
              ].map(item => (
                <button key={item.id} onClick={() => { setTab(item.id); setShowMore(false) }}
                  style={{ display:"flex",alignItems:"center",gap:10,padding:"14px 16px",background:tab===item.id?"rgba(198,241,53,.07)":"var(--s2)",border:"1.5px solid "+(tab===item.id?"var(--lime)":"var(--brd)"),borderRadius:12,cursor:"pointer" }}>
                  <div style={{ width:36,height:36,borderRadius:9,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <I n={item.icon} s={16} c={tab===item.id?"var(--lime)":item.color} />
                  </div>
                  <div style={{ fontSize:13,fontWeight:700,color:tab===item.id?"var(--lime)":"var(--txt)" }}>{item.label}</div>
                </button>
              ))}
            </div>
            <div style={{ borderTop:"1.5px solid var(--brd)",paddingTop:14,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                <div style={{ width:34,height:34,borderRadius:"50%",background:plan.best?"var(--lime)":"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:plan.best?"#0c0e13":"var(--txt)" }}>{user.name?.charAt(0).toUpperCase()}</div>
                <div><div style={{ fontSize:13,fontWeight:600 }}>{user.name}</div><div style={{ fontSize:11,color:plan.color,fontWeight:700,textTransform:"uppercase" }}>{plan.name}</div></div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize:12,padding:"8px 14px" }} onClick={logout}><I n="logout" s={13} />Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {showSearch && <SearchModal user={user} onClose={() => setShowSearch(false)} onDone={handleLeads} />}
      {showBoard && <OnboardOverlay onDone={doneBoard} />}
      {upgradeFor && <UpgradeModal feature={upgradeFor.feature} requiredPlan={upgradeFor.plan} onClose={() => setUpgradeFor(null)} onGoSettings={() => { setTab("settings"); setUpgradeFor(null) }} />}
      <Toast msg={toast} />
      </div>
    </>
  )
}
