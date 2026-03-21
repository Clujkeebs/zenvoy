// ─── Storage Layer ──────────────────────────────────────
// Currently: localStorage
// To migrate to Supabase: replace function bodies, keep the same exports.

import { SEED_GROUPS } from '../constants/community'
import { getDefaultRole } from './roles'

const PREFIX = "oh6_"

function get(k) {
  try { return JSON.parse(localStorage.getItem(PREFIX + k)) }
  catch { return null }
}

function set(k, v) {
  try { localStorage.setItem(PREFIX + k, JSON.stringify(v)) }
  catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22) {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX + "scn_") || k.startsWith(PREFIX + "gf_"))
        keys.forEach(k => localStorage.removeItem(k))
        localStorage.setItem(PREFIX + k, JSON.stringify(v))
      } catch { console.warn("Storage full — data not saved.") }
    }
  }
}

function del(k) { localStorage.removeItem(PREFIX + k) }

// ─── User ──────────────────────────────────────────────
export function getUser(email) { return (get("users") || {})[email] || null }
export function saveUser(email, user) { const a = get("users") || {}; a[email] = user; set("users", a) }
export function getAllUsers() { return Object.values(get("users") || {}) }
export function findUserByRef(code) {
  const all = get("users") || {}
  return Object.values(all).find(u => u.refCode === code) || null
}

// ─── Session ───────────────────────────────────────────
export function getSession() { return get("sess") }
export function setSession(email) { set("sess", email) }
export function clearSession() { del("sess") }

// ─── Leads ─────────────────────────────────────────────
export function getLeads(email) { return get("lds_" + email) || [] }
export function saveLeads(email, v) { set("lds_" + email, v) }

// ─── Clients ───────────────────────────────────────────
export function getClients(email) { return get("cls_" + email) || [] }
export function saveClients(email, v) { set("cls_" + email, v) }

// ─── Scans ─────────────────────────────────────────────
export function getScans(email) { return get("scn_" + email) || [] }
export function saveScans(email, v) { set("scn_" + email, v.slice(0, 100)) }

// ─── Community ─────────────────────────────────────────
export function getPosts() { try { const p = JSON.parse(localStorage.getItem(PREFIX + "posts")); return Array.isArray(p) ? p : [] } catch { return [] } }
export function savePosts(v) { localStorage.setItem(PREFIX + "posts", JSON.stringify(v)) }
export function getGroups() { try { const g = JSON.parse(localStorage.getItem(PREFIX + "groups")); return Array.isArray(g) && g.length >= 10 ? g : SEED_GROUPS } catch { return SEED_GROUPS } }
export function saveGroups(v) { localStorage.setItem(PREFIX + "groups", JSON.stringify(v)) }
export function getMyGroups(email) { try { return JSON.parse(localStorage.getItem(PREFIX + "mg_" + email)) || [] } catch { return [] } }
export function saveMyGroups(email, v) { localStorage.setItem(PREFIX + "mg_" + email, JSON.stringify(v)) }
export function getGroupFeed(id) { try { return JSON.parse(localStorage.getItem(PREFIX + "gf_" + id)) || [] } catch { return [] } }
export function saveGroupFeed(id, v) { localStorage.setItem(PREFIX + "gf_" + id, JSON.stringify(v)) }

// ─── Global Lead Registry ──────────────────────────────
export function getGlobalNames() { try { return JSON.parse(localStorage.getItem(PREFIX + "gnames")) || [] } catch { return [] } }
export function addGlobalNames(names) {
  const existing = getGlobalNames()
  const merged = [...new Set([...existing, ...names.map(n => n.toLowerCase())])].slice(-600)
  localStorage.setItem(PREFIX + "gnames", JSON.stringify(merged))
}

// ─── Reports (community moderation) ────────────────────
export function getReports() { return get("reports") || [] }
export function saveReport(report) {
  const reports = getReports()
  reports.push({ ...report, id: "rpt_" + Date.now(), createdAt: Date.now() })
  set("reports", reports)
}

// ─── Profile Images ────────────────────────────────────
// In localStorage we store base64 data URIs. In Supabase this becomes a storage bucket URL.
export function getProfileImage(email) { return get("avatar_" + email) || null }
export function saveProfileImage(email, dataUrl) { set("avatar_" + email, dataUrl) }
