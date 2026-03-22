import PageHeader from '../ui/PageHeader'
import { useState, useEffect } from 'react'
import Icon from '../../icons/Icon'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import { PLANS } from '../../constants/plans'
import { isAdmin } from '../../utils/roles'
import { fmtDate } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

export default function AdminDashboard({ user, onNav }) {
  const [tab, setTab] = useState("users")
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      const [u, r] = await Promise.all([DB.getAllUsers(), DB.getReports()])
      setUsers(u)
      setReports(r)
    }
    load()
  }, [])

  if (!isAdmin(user)) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><I n="shield2" s={28} c="var(--red)" /></div>
        <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 18 }}>Access Denied</h3>
        <p style={{ color: "var(--txt2)", fontSize: 13 }}>Only admins can view this page.</p>
      </div>
    )
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingReports = reports.filter(r => r.status === "pending")

  const setRole = async (email, role) => {
    // Update in state immediately
    setUsers(prev => prev.map(u => u.email === email ? { ...u, role } : u))
    // Sync to Supabase in background
    DB.saveUser(email, { role })
  }

  const banUser = async (email) => {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, banned: true, role: "user" } : u))
    DB.saveUser(email, { banned: true, role: "user" })
  }

  const resolveReport = (idx) => {
    const report = reports[idx]
    if (!report) return
    const updated = [...reports]
    updated[idx] = { ...updated[idx], status: "resolved", resolvedAt: Date.now() }
    setReports(updated)
    if (report.id) DB.resolveReport(report.id) // fire-and-forget
  }

  const TABS = [
    { id: "users", icon: "users", label: "Users", count: users.length },
    { id: "reports", icon: "flag", label: "Reports", count: pendingReports.length },
  ]

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle={users.length + " users · " + pendingReports.length + " pending reports"} onBack={() => onNav("home")} onHome={() => onNav("home")} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.id} className={"btn " + (tab === t.id ? "btn-lime" : "btn-ghost")}
            style={{ fontSize: 12 }} onClick={() => setTab(t.id)}>
            <I n={t.icon} s={13} /> {t.label}
            {t.count > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .7 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div>
          <input className="inp" placeholder="Search users..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ marginBottom: 14 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredUsers.map(u => {
              const plan = PLANS[u.plan] || PLANS.free
              return (
                <div key={u.email} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar user={u} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name}
                      </span>
                      <RoleBadge user={u} size={12} />
                      {u.banned && <span className="chip c-red" style={{ fontSize: 9 }}>BANNED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--txt3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: plan.color }}>{plan.name}</div>
                    <div style={{ fontSize: 10, color: "var(--txt3)" }}>
                      {u.scansUsed || 0} scans
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {u.email !== user.email && (
                      <>
                        <select
                          value={u.role || "user"}
                          onChange={e => setRole(u.email, e.target.value)}
                          style={{ fontSize: 11, background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 6, color: "var(--txt)", padding: "4px 6px", cursor: "pointer" }}
                        >
                          <option value="user">User</option>
                          <option value="moderator">Mod</option>
                          <option value="admin">Admin</option>
                        </select>
                        {!u.banned && (
                          <button className="btn btn-red" style={{ fontSize: 10, padding: "4px 8px" }}
                            onClick={() => banUser(u.email)}>
                            Ban
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredUsers.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--txt3)", fontSize: 13 }}>
                No users found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
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
                  <span className={"chip " + (r.status === "pending" ? "c-amber" : "c-green")} style={{ fontSize: 10 }}>
                    {r.status}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 8 }}>
                    {r.offenderName || "Unknown"}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "var(--txt3)" }}>
                  {r.createdAt ? fmtDate(r.createdAt) : "—"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--txt2)", marginBottom: 4 }}>
                <strong>Reason:</strong> {r.reason}
              </div>
              {r.detail && (
                <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 8 }}>{r.detail}</div>
              )}
              {r.status === "pending" && (
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }}
                  onClick={() => resolveReport(i)}>
                  <I n="check" s={12} /> Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
