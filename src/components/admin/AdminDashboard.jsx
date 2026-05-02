import PageHeader from '../ui/PageHeader'
import { useState, useEffect, useMemo } from 'react'
import Icon from '../../icons/Icon'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import { PLANS } from '../../constants/plans'
import { isAdmin, isOwner } from '../../utils/roles'
import { fmtDate } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

const emptyAff = { name: "", email: "", channelUrl: "", promoCode: "", commissionRate: "50", paypalEmail: "", notes: "", type: "payment" }

// ─── Tiny stat card ────────────────────────────────────────
function StatCard({ label, value, color = "var(--lime)", sub }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--s2)", borderRadius: 10, border: "1.5px solid var(--brd)" }}>
      <div style={{ fontSize: 10, color: "var(--txt3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function AdminDashboard({ user, onNav }) {
  const [tab, setTab]           = useState("overview")
  const [users, setUsers]       = useState([])
  const [reports, setReports]   = useState([])
  const [affiliates, setAffiliates] = useState([])
  const [search, setSearch]     = useState("")
  const [affModal, setAffModal] = useState(false)
  const [affForm, setAffForm]   = useState(emptyAff)
  const [affSaving, setAffSaving] = useState(false)
  const [affErr, setAffErr]     = useState("")
  const [typePicker, setTypePicker] = useState(null)  // { email, userId }
  const [scanModal, setScanModal]   = useState(null)  // { email, name }
  const [scanAmt, setScanAmt]       = useState("5")
  const [planModal, setPlanModal]   = useState(null)  // { email, name, plan }
  const [actionBusy, setActionBusy] = useState(false)
  const [userDetail, setUserDetail] = useState(null)  // expanded user

  useEffect(() => {
    async function load() {
      const [u, r, a] = await Promise.all([DB.getAllUsers(), DB.getReports(), DB.getAllAffiliates()])
      setUsers(u)
      setReports(r)
      setAffiliates(a)
    }
    load()
  }, [])

  // ── Derived stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const now   = Date.now()
    const day   = 86400000
    const week  = 7 * day
    const month = 30 * day
    const newThisWeek  = users.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < week).length
    const newThisMonth = users.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < month).length
    const planCounts   = Object.fromEntries(Object.keys(PLANS).map(p => [p, 0]))
    let totalScansUsed = 0
    users.forEach(u => { planCounts[u.plan || 'free'] = (planCounts[u.plan || 'free'] || 0) + 1; totalScansUsed += (u.scansUsed || 0) })
    const bannedCount  = users.filter(u => u.banned).length
    const totalRef     = users.reduce((s, u) => s + (u.referrals || 0), 0)
    return { newThisWeek, newThisMonth, planCounts, totalScansUsed, bannedCount, totalRef }
  }, [users])

  const totalAffPending = affiliates.reduce((s, a) => s + Number(a.pendingPayout || 0), 0)
  const pendingReports  = reports.filter(r => r.status === "pending")

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Helpers ────────────────────────────────────────────
  const setRole = async (email, role) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, role } : u))
    DB.saveUser(email, { role })
  }

  const banUser = async (email) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, banned: true, role: "user" } : u))
    DB.saveUser(email, { banned: true, role: "user" })
  }

  const unbanUser = async (email) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, banned: false } : u))
    DB.saveUser(email, { banned: false })
  }

  const grantScans = async () => {
    const amount = parseInt(scanAmt)
    if (!amount || amount < 1) return
    setActionBusy(true)
    const target = users.find(u => u.email === scanModal.email)
    const newBonus = (target?.bonusScans || 0) + amount
    setUsers(prev => prev.map(u => u.email === scanModal.email ? { ...u, bonusScans: newBonus } : u))
    await DB.saveUser(scanModal.email, { bonusScans: newBonus })
    setScanModal(null); setScanAmt("5"); setActionBusy(false)
  }

  const changePlan = async (email, newPlan) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, plan: newPlan } : u))
    await DB.saveUser(email, { plan: newPlan })
    setPlanModal(null)
  }

  const resetScans = async (email) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, scansUsed: 0 } : u))
    DB.saveUser(email, { scansUsed: 0 })
  }

  const exportCSV = () => {
    const header = ["Name","Email","Plan","Role","Scans Used","Bonus Scans","Referrals","Joined","Banned"]
    const rows = users.map(u => [
      u.name || "", u.email || "", u.plan || "free", u.role || "user",
      u.scansUsed || 0, u.bonusScans || 0, u.referrals || 0,
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
      u.banned ? "Yes" : "No",
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url; a.download = "zenvylo-users.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const createUserAffiliate = async (email, userId, type) => {
    setTypePicker(null)
    const u = users.find(x => x.email === email)
    if (!u) return
    try {
      const promoCode = "ZL-" + Math.random().toString(36).substr(2,4).toUpperCase() + "-" + Math.random().toString(36).substr(2,4).toUpperCase()
      const aff = await DB.createAffiliate({ userId, name: u.name, email, promoCode, commissionRate: type === 'payment' ? 50 : 0, type, status: 'active' })
      setUsers(prev => prev.map(x => x.email === email ? { ...x, affiliateId: aff.id } : x))
      setAffiliates(prev => [aff, ...prev])
    } catch (e) { alert("Error: " + e.message) }
  }

  const toggleAffiliate = (email, userId) => {
    const u = users.find(x => x.email === email)
    if (!u) return
    if (u.affiliateId) {
      setUsers(prev => prev.map(x => x.email === email ? { ...x, affiliateId: null } : x))
      DB.saveUser(email, { affiliateId: null })
      setAffiliates(prev => prev.filter(a => a.id !== u.affiliateId))
    } else {
      setTypePicker({ email, userId })
    }
  }

  const saveAffiliate = async () => {
    if (!affForm.name || !affForm.email || !affForm.promoCode) { setAffErr("Name, email and promo code are required."); return }
    setAffSaving(true); setAffErr("")
    try {
      const newAff = await DB.createAffiliate({
        ...affForm,
        promoCode: affForm.promoCode.toUpperCase(),
        commissionRate: affForm.type === 'scans' ? 0 : (parseFloat(affForm.commissionRate) || 50),
        type: affForm.type || 'payment',
        status: 'active',
      })
      setAffiliates(prev => [newAff, ...prev])
      setAffModal(false); setAffForm(emptyAff)
    } catch (e) { setAffErr(e.message || "Failed to create affiliate.") }
    setAffSaving(false)
  }

  const markPaid = async (aff) => {
    if (!window.confirm(`Mark $${Number(aff.pendingPayout).toFixed(2)} as paid to ${aff.name}?`)) return
    await DB.updateAffiliate(aff.id, { pendingPayout: 0, paidTotal: (aff.paidTotal || 0) + aff.pendingPayout, lastPayoutAt: new Date().toISOString() })
    setAffiliates(prev => prev.map(a => a.id === aff.id ? { ...a, paidTotal: (a.paidTotal || 0) + a.pendingPayout, pendingPayout: 0, lastPayoutAt: new Date().toISOString() } : a))
  }

  const toggleAffStatus = async (aff) => {
    const newStatus = aff.status === 'active' ? 'paused' : 'active'
    await DB.updateAffiliate(aff.id, { status: newStatus })
    setAffiliates(prev => prev.map(a => a.id === aff.id ? { ...a, status: newStatus } : a))
  }

  const resolveReport = (idx) => {
    const report = reports[idx]
    if (!report) return
    const updated = [...reports]
    updated[idx] = { ...updated[idx], status: "resolved", resolvedAt: Date.now() }
    setReports(updated)
    if (report.id) DB.resolveReport(report.id)
  }

  if (!isAdmin(user)) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><I n="shield2" s={28} c="var(--red)" /></div>
        <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 18 }}>Access Denied</h3>
        <p style={{ color: "var(--txt2)", fontSize: 13 }}>Only admins can view this page.</p>
      </div>
    )
  }

  const ownerView = isOwner(user)

  const TABS = [
    { id: "overview",   icon: "chart",  label: "Overview" },
    { id: "users",      icon: "users",  label: "Users",      count: users.length },
    { id: "affiliates", icon: "dollar", label: "Affiliates", count: affiliates.length },
    { id: "reports",    icon: "flag",   label: "Reports",    count: pendingReports.length },
  ]

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle={`${users.length} users · ${pendingReports.length} pending reports`}
        onBack={() => onNav("home")}
        onHome={() => onNav("home")}
      />

      {/* Owner crown banner */}
      {ownerView && (
        <div style={{
          marginBottom: 18, padding: "14px 18px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(255,215,0,.09) 0%, rgba(255,165,0,.06) 100%)",
          border: "1.5px solid rgba(255,215,0,.3)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#FFD700,#FFA500)",
            boxShadow: "0 0 16px rgba(255,215,0,.5)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>👑</div>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 15, color: "#FFD700", letterSpacing: "-.01em" }}>
              You are the Owner
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,215,0,.6)", marginTop: 2 }}>
              Full access · Unlimited everything · Only you can see this panel
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} className={"btn " + (tab === t.id ? "btn-lime" : "btn-ghost")}
            style={{ fontSize: 12 }} onClick={() => setTab(t.id)}>
            <I n={t.icon} s={13} /> {t.label}
            {t.count > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .7 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════ OVERVIEW TAB ══ */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Main metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(140px,100%),1fr))", gap: 10 }}>
            <StatCard label="Total Users"     value={users.length}               color="var(--lime)" />
            <StatCard label="New This Week"   value={stats.newThisWeek}           color="var(--blue)" />
            <StatCard label="New This Month"  value={stats.newThisMonth}          color="var(--blue)" />
            <StatCard label="Total Scans Used" value={stats.totalScansUsed.toLocaleString()} color="var(--amber)" />
            <StatCard label="Total Referrals" value={stats.totalRef}              color="var(--green)" />
            <StatCard label="Banned Accounts" value={stats.bannedCount}           color="var(--red)" />
          </div>

          {/* Plan breakdown */}
          <div style={{ background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Plan Distribution</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(PLANS).map(([key, plan]) => {
                const count = stats.planCounts[key] || 0
                const pct   = users.length ? Math.round((count / users.length) * 100) : 0
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: plan.color || "var(--txt)" }}>{plan.name}</span>
                      <span style={{ fontSize: 12, color: "var(--txt3)" }}>{count} users ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--s1)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: plan.color || "var(--lime)", borderRadius: 99, transition: "width .4s ease" }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Affiliate summary */}
          <div style={{ background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Affiliate Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(120px,100%),1fr))", gap: 10 }}>
              <StatCard label="Payment Affs"  value={affiliates.filter(a => a.type !== 'scans').length} color="var(--lime)" />
              <StatCard label="Scan Affs"     value={affiliates.filter(a => a.type === 'scans').length}  color="var(--blue)" />
              <StatCard label="Pending $"     value={`$${totalAffPending.toFixed(2)}`}                   color="var(--amber)" />
              <StatCard label="Total Signups" value={affiliates.reduce((s, a) => s + (a.totalSignups || 0), 0)} color="var(--green)" />
            </div>
          </div>

          {/* Recent signups */}
          <div style={{ background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Recent Signups</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...users].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8).map(u => (
                <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar user={u} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: "var(--txt3)" }}>{u.email}</div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--txt3)", flexShrink: 0 }}>{u.createdAt ? fmtDate(u.createdAt) : "—"}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: (PLANS[u.plan] || PLANS.free).color, flexShrink: 0 }}>
                    {(PLANS[u.plan] || PLANS.free).name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ USERS TAB ══ */}
      {tab === "users" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <input className="inp" placeholder="Search by name or email…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0 }} onClick={exportCSV}>
              <I n="download" s={13} /> Export CSV
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredUsers.map(u => {
              const plan    = PLANS[u.plan] || PLANS.free
              const isMe    = u.email === user.email
              const aff     = affiliates.find(a => a.id === u.affiliateId)
              const expanded = userDetail === u.email

              return (
                <div key={u.email} className="card" style={{ padding: "0" }}>
                  {/* Main row */}
                  <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }}
                    onClick={() => setUserDetail(expanded ? null : u.email)}>
                    <Avatar user={u} size={32} />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</span>
                        <RoleBadge user={u} size={11} />
                        {u.banned && <span className="chip c-red" style={{ fontSize: 9 }}>BANNED</span>}
                        {aff && (aff.type === 'scans'
                          ? <span className="chip c-blue" style={{ fontSize: 9 }}>SCAN AFF</span>
                          : <span className="chip c-lime" style={{ fontSize: 9 }}>CREATOR</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--txt3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--txt3)", flexShrink: 0, textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: plan.color, fontSize: 11 }}>{plan.name}</div>
                      <div>{u.scansUsed || 0} / {(u.bonusScans || 0) > 0 ? `+${u.bonusScans} bonus` : ''} scans</div>
                    </div>
                    <I n={expanded ? "chevron-up" : "chevron-down"} s={13} c="var(--txt3)" />
                  </div>

                  {/* Expanded action panel */}
                  {expanded && (
                    <div style={{
                      borderTop: "1.5px solid var(--brd)", padding: "12px 16px",
                      background: "rgba(255,255,255,.015)", display: "flex", flexDirection: "column", gap: 10
                    }}>
                      {/* Stats row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8 }}>
                        {[
                          { label: "Plan",          value: plan.name,            color: plan.color },
                          { label: "Scans Used",     value: u.scansUsed || 0,    color: "var(--amber)" },
                          { label: "Bonus Scans",    value: u.bonusScans || 0,   color: "var(--lime)" },
                          { label: "Referrals",      value: u.referrals || 0,    color: "var(--blue)" },
                          { label: "Joined",         value: u.createdAt ? fmtDate(u.createdAt) : "—", color: "var(--txt2)" },
                          { label: "Country",        value: u.country || "—",    color: "var(--txt2)" },
                        ].map(s => (
                          <div key={s.label} style={{ background: "var(--s1)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--brd)" }}>
                            <div style={{ fontSize: 9, color: "var(--txt3)", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      {!isMe && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {/* Role picker */}
                          <select
                            value={u.role || "user"}
                            onChange={e => setRole(u.email, e.target.value)}
                            style={{ fontSize: 11, background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 6, color: "var(--txt)", padding: "5px 7px", cursor: "pointer" }}>
                            <option value="user">User</option>
                            <option value="moderator">Mod</option>
                            <option value="admin">Admin</option>
                            {/* owner role never shown — only set via DB */}
                          </select>

                          {/* Change plan */}
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={() => setPlanModal({ email: u.email, name: u.name, plan: u.plan || 'free' })}>
                            <I n="refresh" s={11} /> Plan
                          </button>

                          {/* Grant scans */}
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={() => { setScanModal({ email: u.email, name: u.name }); setScanAmt("5") }}>
                            <I n="zap" s={11} /> Grant Scans
                          </button>

                          {/* Reset scans */}
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={() => { if (window.confirm(`Reset scan count for ${u.name}?`)) resetScans(u.email) }}>
                            <I n="refresh" s={11} /> Reset Scans
                          </button>

                          {/* Affiliate */}
                          <button
                            className={`btn ${u.affiliateId ? 'btn-red' : 'btn-ghost'}`}
                            style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={() => toggleAffiliate(u.email, u.id)}>
                            {u.affiliateId ? "Remove Affiliate" : "Make Affiliate"}
                          </button>

                          {/* Ban / Unban */}
                          {u.banned ? (
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px", color: "var(--green)" }}
                              onClick={() => unbanUser(u.email)}>
                              <I n="check" s={11} /> Unban
                            </button>
                          ) : (
                            <button className="btn btn-red" style={{ fontSize: 11, padding: "5px 10px" }}
                              onClick={() => { if (window.confirm(`Ban ${u.name}?`)) banUser(u.email) }}>
                              <I n="x" s={11} /> Ban
                            </button>
                          )}
                        </div>
                      )}
                      {isMe && (
                        <div style={{ fontSize: 11, color: "var(--txt3)", fontStyle: "italic" }}>This is your account.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {filteredUsers.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--txt3)", fontSize: 13 }}>No users found.</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ AFFILIATES TAB ══ */}
      {tab === "affiliates" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(140px,100%),1fr))", gap: 10, marginBottom: 16 }}>
            <StatCard label="Payment Affiliates" value={affiliates.filter(a => a.type !== 'scans').length} color="var(--lime)" />
            <StatCard label="Scan Affiliates"    value={affiliates.filter(a => a.type === 'scans').length}  color="var(--blue)" />
            <StatCard label="Pending Payout"     value={`$${totalAffPending.toFixed(2)}`}                   color="var(--amber)" />
            <StatCard label="Total Signups"      value={affiliates.reduce((s, a) => s + (a.totalSignups || 0), 0)} color="var(--green)" />
          </div>

          <button className="btn btn-lime" style={{ marginBottom: 14 }} onClick={() => setAffModal(true)}>
            <I n="plus" s={14} /> Add Affiliate Partner
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {affiliates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "var(--txt3)", fontSize: 13 }}>No affiliates yet.</div>
            ) : affiliates.map(aff => (
              <div key={aff.id} className="card" style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{aff.name}</span>
                      <span className={`chip ${aff.status === 'active' ? 'c-green' : 'c-amber'}`} style={{ fontSize: 9 }}>{aff.status}</span>
                      {aff.type === 'scans'
                        ? <span className="chip c-blue" style={{ fontSize: 9 }}>SCANS +3/ref</span>
                        : <span className="chip c-lime" style={{ fontSize: 9 }}>PAYMENT {aff.commissionRate}%</span>
                      }
                      <code style={{ fontSize: 11, padding: "2px 7px", background: "rgba(198,241,53,.1)", borderRadius: 5, color: "var(--lime)", fontWeight: 700 }}>{aff.promoCode}</code>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--txt3)" }}>{aff.email}</div>
                    {aff.channelUrl && (
                      <a href={aff.channelUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--blue)", marginTop: 2, display: "block" }}>
                        {aff.channelUrl.replace(/https?:\/\/(www\.)?/, '')}
                      </a>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, flexShrink: 0, textAlign: "right" }}>
                    {[
                      { label: "Signups",    val: aff.totalSignups || 0,                                        color: "var(--blue)" },
                      { label: "Convs",      val: aff.totalConversions || 0,                                    color: "var(--green)" },
                      { label: "Pending",    val: `$${Number(aff.pendingPayout || 0).toFixed(2)}`,              color: aff.pendingPayout > 0 ? "var(--amber)" : "var(--txt3)" },
                      { label: "Earned",     val: `$${Number(aff.totalEarned || 0).toFixed(2)}`,                color: "var(--lime)" },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 10, color: "var(--txt3)" }}>{s.label}</div>
                        <div style={{ fontWeight: 700, color: s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {aff.pendingPayout > 0 && (
                    <button className="btn btn-lime" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => markPaid(aff)}>
                      <I n="check" s={12} /> Mark ${Number(aff.pendingPayout).toFixed(2)} Paid
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => toggleAffStatus(aff)}>
                    {aff.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                  {aff.paypalEmail && (
                    <span style={{ fontSize: 11, color: "var(--txt3)", display: "flex", alignItems: "center", gap: 4 }}>
                      <I n="check" s={11} c="var(--green)" /> PayPal: {aff.paypalEmail}
                    </span>
                  )}
                  {aff.lastPayoutAt && (
                    <span style={{ fontSize: 11, color: "var(--txt3)", marginLeft: "auto" }}>
                      Last paid: {fmtDate(aff.lastPayoutAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Affiliate Modal */}
          {affModal && (
            <div className="modal-wrap" onClick={e => e.target === e.currentTarget && setAffModal(false)}>
              <div className="modal" style={{ maxWidth: 480 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--brd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 16 }}>Add Affiliate Partner</h3>
                  <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setAffModal(false)}><I n="x" s={15} /></button>
                </div>
                <div style={{ padding: "16px 20px", display: "grid", gap: 11 }}>
                  <div>
                    <span className="lbl">Affiliate Type *</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { value: "payment", label: "💰 Payment", sub: "Earns % cash commission" },
                        { value: "scans",   label: "⚡ Scans",   sub: "+3 bonus scans per referral" },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setAffForm({ ...affForm, type: opt.value })}
                          style={{
                            padding: "10px 12px", borderRadius: 9, cursor: "pointer", textAlign: "left",
                            background: affForm.type === opt.value ? "rgba(198,241,53,.1)" : "var(--s2)",
                            border: "1.5px solid " + (affForm.type === opt.value ? "var(--lime)" : "var(--brd)"),
                          }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: affForm.type === opt.value ? "var(--lime)" : "var(--txt)" }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 2 }}>{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {[
                    { k: "name",       l: "Full Name *",          ph: "Alex Thompson" },
                    { k: "email",      l: "Email *",              ph: "alex@youtube.com" },
                    { k: "channelUrl", l: "Channel / Social URL", ph: "https://youtube.com/@alex" },
                    { k: "promoCode",  l: "Promo Code *",         ph: "ALEX20" },
                    ...(affForm.type !== 'scans' ? [
                      { k: "commissionRate", l: "Commission % *", ph: "50" },
                      { k: "paypalEmail",    l: "PayPal Email",   ph: "alex@paypal.com" },
                    ] : []),
                    { k: "notes", l: "Notes", ph: affForm.type === 'scans' ? "micro-influencer, agency niche" : "20k subs, freelance niche" },
                  ].map(f => (
                    <div key={f.k}>
                      <span className="lbl">{f.l}</span>
                      <input className="inp" placeholder={f.ph} value={affForm[f.k] || ""}
                        onChange={e => setAffForm({ ...affForm, [f.k]: e.target.value })} />
                    </div>
                  ))}
                  {affErr && <div style={{ fontSize: 12, color: "var(--red)", padding: "8px 11px", background: "rgba(245,66,66,.08)", borderRadius: 7 }}>{affErr}</div>}
                </div>
                <div style={{ padding: "0 20px 16px", display: "flex", gap: 8 }}>
                  <button className="btn btn-lime" onClick={saveAffiliate} disabled={affSaving}>{affSaving ? "Saving…" : "Add Affiliate"}</button>
                  <button className="btn btn-ghost" onClick={() => { setAffModal(false); setAffForm(emptyAff); setAffErr("") }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════ REPORTS TAB ══ */}
      {tab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {reports.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-icon"><I n="check" s={24} c="var(--green)" /></div>
              <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 16 }}>No Reports</h3>
              <p style={{ color: "var(--txt2)", fontSize: 13 }}>Community is clean.</p>
            </div>
          ) : reports.map((r, i) => (
            <div key={r.id || i} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <span className={"chip " + (r.status === "pending" ? "c-amber" : "c-green")} style={{ fontSize: 10 }}>{r.status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 8 }}>{r.offenderName || "Unknown"}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--txt3)" }}>{r.createdAt ? fmtDate(r.createdAt) : "—"}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--txt2)", marginBottom: 4 }}><strong>Reason:</strong> {r.reason}</div>
              {r.detail && <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 8 }}>{r.detail}</div>}
              {r.status === "pending" && (
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => resolveReport(i)}>
                  <I n="check" s={12} /> Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════ */}

      {/* Grant Scans Modal */}
      {scanModal && (
        <div className="modal-wrap" onClick={() => setScanModal(null)}>
          <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1.5px solid var(--brd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 15 }}>Grant Bonus Scans</h3>
              <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setScanModal(null)}><I n="x" s={14} /></button>
            </div>
            <div style={{ padding: "18px 20px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--txt2)", marginBottom: 14 }}>
                Add bonus scans to <strong style={{ color: "var(--txt)" }}>{scanModal.name}</strong>'s account.
              </p>
              <div style={{ marginBottom: 16 }}>
                <span className="lbl">Number of scans</span>
                <input className="inp" type="number" min="1" max="999" value={scanAmt}
                  onChange={e => setScanAmt(e.target.value)} autoFocus />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {[5, 10, 25, 50, 100].map(n => (
                  <button key={n} className={"btn " + (scanAmt == n ? "btn-lime" : "btn-ghost")}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    onClick={() => setScanAmt(String(n))}>+{n}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-lime" onClick={grantScans} disabled={actionBusy} style={{ flex: 1 }}>
                  {actionBusy ? "Saving…" : `Grant ${scanAmt} Scans`}
                </button>
                <button className="btn btn-ghost" onClick={() => setScanModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {planModal && (
        <div className="modal-wrap" onClick={() => setPlanModal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1.5px solid var(--brd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 15 }}>Change Plan</h3>
              <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setPlanModal(null)}><I n="x" s={14} /></button>
            </div>
            <div style={{ padding: "14px 20px 20px", display: "grid", gap: 8 }}>
              <p style={{ fontSize: 13, color: "var(--txt2)", marginBottom: 6 }}>
                Change plan for <strong style={{ color: "var(--txt)" }}>{planModal.name}</strong>
              </p>
              {Object.entries(PLANS).map(([key, plan]) => (
                <button key={key} type="button"
                  onClick={() => changePlan(planModal.email, key)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    background: planModal.plan === key ? "rgba(198,241,53,.07)" : "var(--s2)",
                    border: "1.5px solid " + (planModal.plan === key ? "var(--lime)" : "var(--brd)"),
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: plan.color || "var(--txt)" }}>{plan.name}</div>
                  {plan.description && <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>{plan.description}</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Affiliate Type Picker Modal */}
      {typePicker && (
        <div className="modal-wrap" onClick={() => setTypePicker(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 15 }}>Choose Affiliate Type</h3>
              <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setTypePicker(null)}><I n="x" s={14} /></button>
            </div>
            <div style={{ padding: "14px 20px 20px", display: "grid", gap: 10 }}>
              <button type="button" onClick={() => createUserAffiliate(typePicker.email, typePicker.userId, 'payment')}
                style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", background: "rgba(198,241,53,.07)", border: "1.5px solid rgba(198,241,53,.25)" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--lime)", marginBottom: 4 }}>💰 Payment Affiliate</div>
                <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5 }}>
                  Earns <strong>50% cash commission</strong> on every subscription — paid via PayPal.
                </div>
              </button>
              <button type="button" onClick={() => createUserAffiliate(typePicker.email, typePicker.userId, 'scans')}
                style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", background: "rgba(56,189,248,.07)", border: "1.5px solid rgba(56,189,248,.25)" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--blue)", marginBottom: 4 }}>⚡ Scan Affiliate</div>
                <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5 }}>
                  Earns <strong>+3 bonus scans</strong> for every signup with their promo code.
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
