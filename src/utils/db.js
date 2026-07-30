// ─── Supabase Storage Layer ─────────────────────────────
//
// READ functions must be awaited. WRITE functions return Promises; callers may
// fire-and-forget the ones marked as such, because React state already holds
// the value being written.
//
// Two rules this layer now enforces that it previously didn't:
//
//  1. A function that acts on "a user" takes an explicit user id. The old
//     saveUser(email, updates) ignored `email` entirely and wrote to the
//     *caller's* row, which silently broke every admin action.
//
//  2. Anything privileged (plan, role, quota, bans, affiliates) goes through an
//     edge function or an RPC. The browser cannot write those columns any more,
//     so attempting it here would just raise.

import { supabase } from '../lib/supabase'
import { SEED_GROUPS } from '../constants/community'

// ─── Case Conversion ───────────────────────────────────
function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toSnake)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const sk = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
    out[sk] = v
  }
  return out
}

function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamel)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[ck] = v
  }
  return out
}

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/** Invoke an edge function with the caller's session attached. */
async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('You need to be signed in.')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
  })

  let payload = null
  try { payload = await res.json() } catch { /* non-JSON error body */ }

  if (!res.ok) {
    const err = new Error(payload?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.payload = payload
    throw err
  }
  return payload
}

// ─── Auth / Session ────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.email || null
}

export async function clearSession() {
  await supabase.auth.signOut()
}

// ─── Magic Link (passwordless) ─────────────────────────
export async function sendMagicLink({ email, name, country, svc, currency }) {
  const opts = {
    shouldCreateUser: true,
    emailRedirectTo: window.location.origin,
  }
  // Profile defaults for a brand-new user. Note there is deliberately no `role`
  // here: this metadata is attacker-controlled, and the signup trigger decides
  // the role from the email address instead.
  if (name) {
    opts.data = { name, country, svc, currency: currency || 'USD' }
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: opts })
  if (error) throw error
}

// ─── Pending Referral (magic-link flow) ───────────────
// A ref code arrives as ?ref=… before the user has an account, so it's parked
// in localStorage until there's a session to attach it to.
export async function processPendingRef() {
  const refCode = localStorage.getItem('zv_pending_ref')
  if (!refCode) return null

  localStorage.removeItem('zv_pending_ref')

  try {
    // One RPC does the whole thing atomically: it refuses a second referrer,
    // refuses self-referral, credits both sides, and records the conversion.
    const { data, error } = await supabase.rpc('claim_referral', { p_code: refCode })
    if (error) {
      console.error('claim_referral error:', error.message)
      return null
    }
    return data
  } catch (e) {
    console.error('claim_referral threw:', e.message)
    return null
  }
}

// ─── User / Profile ───────────────────────────────────
export async function getUser() {
  try {
    const userId = await getUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return toCamel(data)
  } catch (e) {
    console.error('getUser error:', e.message)
    return null
  }
}

/**
 * Columns a user is allowed to change about themselves. This mirrors the column
 * GRANT in the database — anything outside this list raises there, so filtering
 * here turns a confusing 42501 into a no-op.
 */
const OWN_PROFILE_FIELDS = [
  'name', 'country', 'svc', 'currency', 'onboarded', 'profileImageUrl', 'customServices',
]

/** Update the signed-in user's own profile. Safe to fire-and-forget. */
export async function updateOwnProfile(updates) {
  const userId = await getUserId()
  if (!userId) return { error: 'Not signed in' }

  const allowed = {}
  for (const key of OWN_PROFILE_FIELDS) {
    if (updates[key] !== undefined) allowed[key] = updates[key]
  }
  if (Object.keys(allowed).length === 0) return { error: null }

  const { error } = await supabase.from('profiles').update(toSnake(allowed)).eq('id', userId)
  if (error) console.error('updateOwnProfile error:', error.message)
  return { error: error?.message || null }
}

/**
 * Privileged operations on *other* users. Routed through the admin-actions
 * edge function, which verifies the caller's role server-side and writes an
 * audit row. The browser has no direct write path to these columns.
 */
export function adminAction(action, payload = {}) {
  return callFunction('admin-actions', { action, ...payload })
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('getAllUsers error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function getAdminLog(limit = 50) {
  const { data, error } = await supabase
    .from('admin_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getAdminLog error:', error.message); return [] }
  return (data || []).map(toCamel)
}

// ─── Scan Quota (server-authoritative) ─────────────────

/**
 * Spend one scan. The database decides: it rolls the month over on its own
 * clock, prefers the plan allowance, falls back to bonus scans, and refuses
 * when there's nothing left.
 *
 * @returns {Promise<{allowed:boolean, reason?:string, source?:string,
 *                    scansUsed?:number, bonusScans?:number, remaining?:number}>}
 */
export async function consumeScan() {
  const { data, error } = await supabase.rpc('consume_scan')
  if (error) {
    console.error('consume_scan error:', error.message)
    return { allowed: false, reason: 'error', message: error.message }
  }
  return toCamel(data || { allowed: false, reason: 'unknown' })
}

/** Hand a scan back when the pipeline failed after it was charged. */
export async function refundScan(source) {
  if (!source) return
  const { error } = await supabase.rpc('refund_scan', { p_source: source })
  if (error) console.error('refund_scan error:', error.message)
}

// ─── Website Auditing ──────────────────────────────────

/** Measure many sites at once (scan pipeline). Returns [] on failure. */
export async function auditSites(urls) {
  if (!urls?.length) return []
  try {
    const { measurements } = await callFunction('audit-site', { urls })
    return measurements || []
  } catch (e) {
    console.error('auditSites error:', e.message)
    return []
  }
}

/** Re-measure a single lead's site and persist it against the lead. */
export async function auditSite(url, leadId) {
  const { measurement } = await callFunction('audit-site', { url, leadId })
  return measurement
}

// ─── Affiliate System ─────────────────────────────
export async function getMyAffiliateRecord() {
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('getMyAffiliateRecord error:', error.message); return null }
  return data ? toCamel(data) : null
}

export async function getMyAffiliateConversions() {
  const userId = await getUserId()
  if (!userId) return []
  const { data: aff } = await supabase
    .from('affiliates')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!aff) return []
  const { data, error } = await supabase
    .from('affiliate_conversions')
    .select('*')
    .eq('affiliate_id', aff.id)
    .order('created_at', { ascending: false })
  if (error) { console.error('getMyAffiliateConversions error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function getAllAffiliates() {
  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .order('total_earned', { ascending: false })
  if (error) { console.error('getAllAffiliates error:', error.message); return [] }
  return (data || []).map(toCamel)
}

// ─── Referral System ───────────────────────────────
export async function getReferrals() {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('user_referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('referred_at', { ascending: false })
  if (error) { console.error('getReferrals error:', error.message); return [] }
  return (data || []).map(toCamel)
}

// ─── Leads ─────────────────────────────────────────────
export async function getLeads() {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('getLeads error:', error.message); return [] }
  return (data || []).map(toCamel)
}

// Columns that actually exist on `leads`. Anything else gets dropped rather
// than failing the whole insert.
const LEAD_COLS = new Set([
  'name', 'btype', 'address', 'phone', 'website', 'rating', 'reviews', 'speed', 'ssl',
  'employees', 'founded', 'problems', 'why', 'score', 'suggested_monthly_rate',
  'my_monthly_rate', 'tools_cost_monthly', 'setup_cost', 'demand_score',
  'competition_score', 'difficulty_rating', 'market_saturation', 'country', 'city',
  'service_id', 'service_label', 'service_custom', 'status', 'saved', 'notes',
  'follow_up_date', 'user_id', 'site_measurement', 'findings', 'audited_at',
  'osm_id', 'contacted_at', 'won_value',
])

export async function insertLeads(leads) {
  const userId = await getUserId()
  if (!userId || !leads.length) return leads
  const rows = leads.map(l => {
    const r = toSnake(l)
    r.user_id = userId
    for (const k of Object.keys(r)) {
      if (!LEAD_COLS.has(k)) delete r[k]
    }
    return r
  })
  const { data, error } = await supabase.from('leads').insert(rows).select()
  if (error) {
    console.error('insertLeads error:', error.message)
    const err = new Error(error.message)
    err.code = error.code
    throw err
  }
  return data ? data.map(toCamel) : leads
}

export async function updateLead(lead) {
  const row = toSnake(lead)
  delete row.user_id
  delete row.id
  for (const k of Object.keys(row)) {
    if (!LEAD_COLS.has(k)) delete row[k]
  }
  const { error } = await supabase.from('leads').update(row).eq('id', lead.id)
  if (error) console.error('updateLead error:', error.message)
  return { error: error?.message || null }
}

export async function deleteLead(id) {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) console.error('deleteLead error:', error.message)
  return { error: error?.message || null }
}

/** Delete every lead belonging to the signed-in user. */
export async function deleteAllLeads() {
  const userId = await getUserId()
  if (!userId) return { error: 'Not signed in' }
  const { error } = await supabase.from('leads').delete().eq('user_id', userId)
  if (error) console.error('deleteAllLeads error:', error.message)
  return { error: error?.message || null }
}

// ─── Clients ───────────────────────────────────────────
export async function getClients() {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('getClients error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function insertClient(client) {
  const userId = await getUserId()
  if (!userId) return client
  const row = { ...toSnake(client), user_id: userId }
  // Client-generated placeholder ids aren't UUIDs; let the database assign one.
  if (!row.id || String(row.id).startsWith('c_')) delete row.id
  const { data, error } = await supabase.from('clients').insert(row).select().single()
  if (error) { console.error('insertClient error:', error.message); return client }
  return data ? toCamel(data) : client
}

export async function updateClient(client) {
  const row = toSnake(client)
  delete row.user_id
  delete row.id
  const { error } = await supabase.from('clients').update(row).eq('id', client.id)
  if (error) console.error('updateClient error:', error.message)
  return { error: error?.message || null }
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) console.error('deleteClient error:', error.message)
  return { error: error?.message || null }
}

// ─── Scans (history) ──────────────────────────────────
export async function getScans() {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) { console.error('getScans error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function recordScan(scan) {
  const userId = await getUserId()
  if (!userId) return
  const row = { ...toSnake(scan), user_id: userId }
  delete row.id
  const { error } = await supabase.from('scans').insert(row)
  if (error) console.error('recordScan error:', error.message)
}

export async function deleteAllScans() {
  const userId = await getUserId()
  if (!userId) return { error: 'Not signed in' }
  const { error } = await supabase.from('scans').delete().eq('user_id', userId)
  if (error) console.error('deleteAllScans error:', error.message)
  return { error: error?.message || null }
}

// ─── Community ─────────────────────────────────────────
export async function getPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) { console.error('getPosts error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function savePosts(posts) {
  if (!posts.length) return
  const newest = toSnake(posts[0])
  if (!newest.id || String(newest.id).startsWith('p_')) delete newest.id
  const userId = await getUserId()
  if (userId) newest.user_id = userId
  const { error } = await supabase.from('posts').insert(newest)
  if (error) console.error('savePosts error:', error.message)
}

export async function updatePost(post) {
  if (!post?.id) return
  const row = toSnake(post)
  delete row.user_id
  const { error } = await supabase.from('posts').update(row).eq('id', post.id)
  if (error) console.error('updatePost error:', error.message)
}

export async function getGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data?.length) return SEED_GROUPS
  return data.map(toCamel)
}

export async function getMyGroups() {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('user_id', userId)
  if (error) { console.error('getMyGroups error:', error.message); return [] }
  return (data || []).map(r => r.group_id)
}

export async function saveMyGroups(groupIds) {
  const userId = await getUserId()
  if (!userId) return
  await supabase.from('user_groups').delete().eq('user_id', userId)
  if (groupIds.length > 0) {
    const rows = groupIds.map(gid => ({ user_id: userId, group_id: gid }))
    await supabase.from('user_groups').insert(rows)
  }
}

export async function getGroupFeed(groupId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('getGroupFeed error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function saveGroupFeed(groupId, posts) {
  if (!posts.length) return
  const newest = toSnake(posts[0])
  if (!newest.id || String(newest.id).startsWith('gp_')) delete newest.id
  newest.group_id = groupId
  const userId = await getUserId()
  if (userId) newest.user_id = userId
  const { error } = await supabase.from('posts').insert(newest)
  if (error) console.error('saveGroupFeed error:', error.message)
}

// ─── Global Lead Registry ──────────────────────────────
export async function getGlobalNames() {
  const { data, error } = await supabase
    .from('global_lead_names')
    .select('name_lower')
    .limit(600)
  if (error) { console.error('getGlobalNames error:', error.message); return [] }
  return (data || []).map(r => r.name_lower)
}

export async function addGlobalNames(names) {
  const userId = await getUserId()
  const rows = names.map(n => ({ name_lower: n.toLowerCase(), claimed_by: userId }))
  const { error } = await supabase
    .from('global_lead_names')
    .upsert(rows, { onConflict: 'name_lower', ignoreDuplicates: true })
  if (error) console.error('addGlobalNames error:', error.message)
}

// ─── Reports ───────────────────────────────────────────
export async function getReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('getReports error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function saveReport(report) {
  const row = toSnake(report)
  delete row.id
  const userId = await getUserId()
  if (userId) row.reporter_id = userId
  const { error } = await supabase.from('reports').insert(row)
  if (error) console.error('saveReport error:', error.message)
}

/** Report resolution is a moderator action — it goes through the edge function. */
export function resolveReport(reportId, status = 'resolved') {
  return adminAction('resolve_report', { reportId, status })
}

// ─── Profile Images ────────────────────────────────────
export async function getProfileImage() {
  const userId = await getUserId()
  if (!userId) return null
  const { data } = await supabase
    .from('profiles')
    .select('profile_image_url')
    .eq('id', userId)
    .single()
  return data?.profile_image_url || null
}

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export async function saveProfileImage(file) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not signed in')
  if (!AVATAR_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG or WebP image.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Image must be under 2MB.')

  // Extension from the MIME type, not the filename — a user-supplied name can
  // claim any extension it likes.
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) throw new Error(uploadErr.message)

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the new avatar shows immediately.
  const url = `${publicUrl}?v=${Date.now()}`
  await supabase.from('profiles').update({ profile_image_url: url }).eq('id', userId)
  return url
}

// ─── Auth State Listener ───────────────────────────────
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return subscription
}
