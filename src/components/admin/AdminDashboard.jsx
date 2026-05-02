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

const emptyAff = { name: "", email: "", channelUrl: "", promoCode: "", commissionRate: "50", paypalEmail: "", notes: "", type: "payment" }

export default function AdminDashboard({ user, onNav }) {
  const [tab, setTab] = useState("users")
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [affiliates, setAffiliates] = useState([])
  const [search, setSearch] = useState("")
  const [affModal, setAffModal] = useState(false)
  const [affForm, setAffForm] = useState(emptyAff)
  const [affSaving, setAffSaving] = useState(false)
  const [affErr, setAffErr] = useState("")
  // Type-picker shown when admin clicks Creator/Scan Aff on a user row
  const [typePicker, setTypePicker] = useState(null) // { email, userId }

  useEffect(() => {
    async function load() {
      const [u, r, a] = await Promise.all([DB.getAllUsers(), DB.getReports(), DB.getAllAffiliates()])
      setUsers(u)
      setReports(r)
      setAffiliates(a)
    }
    load()
  }, [])

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
    } catch (e) {
      setAffErr(e.message || "Failed to create affiliate.")
    }
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

  // Called after admin picks a type in the type-picker modal
  const createUserAffiliate = async (email, userId, type) => {
    setTypePicker(null)
    const u = users.find(x => x.email === email)
    if (!u) return
    try {
      const promoCode = "ZL-" + Math.random().toString(36).substr(2,4).toUpperCase() + "-" + Math.random().toString(36).substr(2,4).toUpperCase()
      const aff = await DB.createAffiliate({
        userId,
        name: u.name,
        email,
        promoCode,
        commissionRate: type === 'payment' ? 50 : 0,
        type,
        status: 'active',
      })
      setUsers(prev => prev.map(x => x.email === email ? { ...x, affiliateId: aff.id } : x))
      setAffiliates(prev => [aff, ...prev])
    } catch (e) {
      alert("Error creating affiliate: " + e.message)
    }
  }

  const toggleAffiliate = (email, userId) => {
    const u = users.find(x => x.email === email)
    if (!u) return
    if (u.affiliateId) {
      // Remove affiliate status
      setUsers(prev => prev.map(x => x.email === email ? { ...x, affiliateId: null } : x))
      DB.saveUser(email, { affiliateId: null })
      setAffiliates(prev => prev.filter(a => a.id !== u.affiliateId))
    } else {
      // Show type picker
      setTypePicker({ email, userId })
    }
  }

  const resolveReport = (idx) => {
    const report = reports[idx]
    if (!report) return
    const updated = [...reports]
    updated[idx] = { ...updated[idx], status: "resolved", resolvedAt: Date.now() }
    setReports(updated)
    if (report.id) DB.resolveReport(report.id) // fire-and-forget
  }

  const totalAffPending = affiliates.reduce((s, a) => s + Number(a.pendingPayout || 0), 0)

  const TABS = [
    { id: "users",      icon: "users",   label: "Users",      count: users.length },
    { id: "affiliates", icon: "dollar",  label: "Affiliates", count: affiliates.length },
    { id: "reports",    icon: "flag",    label: "Reports",    count: pendingReports.length },
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
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: (u.referrals || 0) > 0 ? "var(--lime)" : "var(--txt2)", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                      <Icon n="gift" s={11} c={(u.referrals || 0) > 0 ? "var(--lime)" : "var(--txt3)"} />
                      {u.referrals || 0}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 1 }}>
                      referred
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: plan.color }}>{plan.name}</div>
                    <div style={{ fontSize: 10, color: "var(--txt3)" }}>
                      {u.scansUsed || 0} scans
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                    {u.email !== user.email && (
                      <>
                        {u.affiliateId && (() => {
                          const aff = affiliates.find(a => a.id === u.affiliateId)
                          return aff?.type === 'scans'
                            ? <span className="chip c-blue" style={{ fontSize: 9, flexShrink: 0 }}>SCAN AFF</span>
                            : <span className="chip c-lime" style={{ fontSize: 9, flexShrink: 0 }}>CREATOR</span>
                        })()}
                        <select
                          value={u.role || "user"}
                          onChange={e => setRole(u.email, e.target.value)}
                          style={{ fontSize: 11, background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 6, color: "var(--txt)", padding: "4px 6px", cursor: "pointer" }}
                        >
                          <option value="user">User</option>
                          <option value="moderator">Mod</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className={`btn ${u.affiliateId ? 'btn-red' : 'btn-ghost'}`}
                          style={{ fontSize: 10, padding: "4px 8px" }}
                          onClick={() => toggleAffiliate(u.email, u.id)}
                          title={u.affiliateId ? "Remove affiliate status" : "Add as affiliate"}>
                          {u.affiliateId ? "Remove" : "Affiliate ↓"}
                        </button>
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

      {/* Affiliates Tab */}
      {tab === "affiliates" && (
        <div>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(150px,100%),1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Payment Affiliates", value: affiliates.filter(a => a.type !== 'scans').length, color: "var(--lime)" },
              { label: "Scan Affiliates", value: affiliates.filter(a => a.type === 'scans').length, color: "var(--blue)" },
              { label: "Pending Payout", value: `$${totalAffPending.toFixed(2)}`, color: "var(--amber)" },
              { label: "Total Signups (all)", value: affiliates.reduce((s, a) => s + (a.totalSignups || 0), 0), color: "var(--green)" },
            ].map(s => (
              <div key={s.label} style={{ padding: "12px 14px", background: "var(--s2)", borderRadius: 9, border: "1.5px solid var(--brd)" }}>
                <div style={{ fontSize: 10, color: "var(--txt3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 20, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <button className="btn btn-lime" style={{ marginBottom: 14 }} onClick={() => setAffModal(true)}>
            <I n="plus" s={14} /> Add Affiliate Partner
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {affiliates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, color: "var(--txt3)", fontSize: 13 }}>
                No affiliates yet. Add your first partner above.
              </div>
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
                    <div>
                      <div style={{ fontSize: 10, color: "var(--txt3)" }}>Signups</div>
                      <div style={{ fontWeight: 700, color: "var(--blue)" }}>{aff.totalSignups || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--txt3)" }}>Conversions</div>
                      <div style={{ fontWeight: 700, color: "var(--green)" }}>{aff.totalConversions || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--txt3)" }}>Pending</div>
                      <div style={{ fontWeight: 700, color: aff.pendingPayout > 0 ? "var(--amber)" : "var(--txt3)" }}>
                        ${Number(aff.pendingPayout || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--txt3)" }}>Total Earned</div>
                      <div style={{ fontWeight: 700, color: "var(--lime)" }}>${Number(aff.totalEarned || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {aff.pendingPayout > 0 && (
                    <button className="btn btn-lime" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => markPaid(aff)}>
                      <I n="check" s={12} /> Mark ${Number(aff.pendingPayout).toFixed(2)} as Paid
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
                    <span style={{ fontSize: 11, color: "var(--txt3)", marginLeft: "auto", display: "flex", alignItems: "center" }}>
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
                  {/* Affiliate type selector */}
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
                  <button className="btn btn-lime" onClick={saveAffiliate} disabled={affSaving}>
                    {affSaving ? "Saving…" : "Add Affiliate"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setAffModal(false); setAffForm(emptyAff); setAffErr("") }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
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

      {/* ── Affiliate Type Picker Modal ─────────────────────── */}
      {typePicker && (
        <div className="modal-wrap" onClick={() => setTypePicker(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "var(--fh)", fontWeight: 800, fontSize: 15 }}>Choose Affiliate Type</h3>
              <button className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={() => setTypePicker(null)}><I n="x" s={14} /></button>
            </div>
            <div style={{ padding: "14px 20px 20px", display: "grid", gap: 10 }}>
              <button type="button" onClick={() => createUserAffiliate(typePicker.email, typePicker.userId, 'payment')}
                style={{
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  background: "rgba(198,241,53,.07)", border: "1.5px solid rgba(198,241,53,.25)",
                }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--lime)", marginBottom: 4 }}>💰 Payment Affiliate</div>
                <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5 }}>
                  Earns <strong>50% cash commission</strong> on every subscription their referrals pay — tracked in the affiliate dashboard, paid out via PayPal.
                </div>
              </button>
              <button type="button" onClick={() => createUserAffiliate(typePicker.email, typePicker.userId, 'scans')}
                style={{
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  background: "rgba(56,189,248,.07)", border: "1.5px solid rgba(56,189,248,.25)",
                }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--blue)", marginBottom: 4 }}>⚡ Scan Affiliate</div>
                <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5 }}>
                  Earns <strong>+3 bonus scans</strong> for every person who signs up with their promo code — no cash payout required.
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
