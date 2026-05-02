// ─── Supabase Storage Layer ─────────────────────────────
// Replaces the localStorage version. Same function names, now async.
// 
// WRITE functions return Promises — callers don't need to await them
// because React state already has the correct data. Supabase syncs in background.
//
// READ functions must be awaited.

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

// ─── Auth / Session ────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.email || null
}

export async function setSession(_email) {
  // No-op — Supabase handles sessions after signIn/signUp
}

export async function clearSession() {
  await supabase.auth.signOut()
}

// ─── Sign Up / Sign In (old password-based — DEPRECATED) ───
// Use sendMagicLink instead for passwordless auth
// These are kept for backwards compatibility only
export async function signUp() {
  throw new Error('Password auth is deprecated. Use sendMagicLink instead.')
}

export async function signIn() {
  throw new Error('Password auth is deprecated. Use sendMagicLink instead.')
}

// ─── Magic Link (passwordless) ─────────────────────────
export async function sendMagicLink({ email, name, country, svc, currency, role }) {
  const opts = {
    shouldCreateUser: true,
    emailRedirectTo: window.location.origin,
  }
  // Pass metadata for new-user profile creation (Supabase trigger picks this up)
  if (name) {
    opts.data = { name, country, svc, currency: currency || 'USD', role: role || 'user' }
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: opts })
  if (error) throw error
}

// ─── Pending Referral (magic-link flow) ───────────────
// Called in App.jsx after a fresh magic-link session is established.
// Reads the ref code stored in localStorage before the link was sent,
// applies the referral bonus, and clears the key.
export async function processPendingRef(email) {
  const refCode = localStorage.getItem('zv_pending_ref')
  if (!refCode) return

  const userId = await getUserId()
  if (!userId) return

  // Check if we already recorded a referrer for this user
  const { data: row } = await supabase
    .from('profiles')
    .select('referred_by')
    .eq('id', userId)
    .maybeSingle()
  if (row?.referred_by) {
    localStorage.removeItem('zv_pending_ref')
    return
  }

  localStorage.removeItem('zv_pending_ref')

  // Fire-and-forget: apply bonus + record affiliate conversion
  Promise.resolve().then(async () => {
    try {
      // ── Regular referral bonus (user ref code) ──────────────
      const ref = await findUserByRef(refCode).catch(() => null)
      if (ref?.id) {
        await supabase.from('profiles')
          .update({ referred_by: ref.id, bonus_scans: 5 })
          .eq('id', userId).catch(() => {})
        await supabase.rpc('increment_referral_count', { p_user_id: ref.id }).catch(() => {})
      }

      // ── Affiliate promo code ─────────────────────────────────
      const aff = await findAffiliateByCode(refCode).catch(() => null)
      if (aff) {
        if (aff.type === 'scans') {
          // Scan affiliate: credit +3 bonus scans to the affiliate's own profile
          const { data: affProfile } = await supabase
            .from('profiles').select('bonus_scans').eq('id', aff.userId).maybeSingle()
          await supabase.from('profiles')
            .update({ bonus_scans: (affProfile?.bonus_scans || 0) + 3 })
            .eq('id', aff.userId).catch(() => {})
          // Track signup + total scans earned on the affiliate row
          const { data: cur } = await supabase
            .from('affiliates').select('total_signups, scans_earned').eq('id', aff.id).single()
          await supabase.from('affiliates').update({
            total_signups: (cur?.total_signups || 0) + 1,
            scans_earned:  (cur?.scans_earned  || 0) + 3,
          }).eq('id', aff.id).catch(() => {})
          // Still record the signup event (commission = 0) for the history table
          recordAffiliateConversion({
            affiliateId: aff.id, referredUserId: userId,
            referredEmail: email, eventType: 'signup', plan: 'free',
            amountUsd: 0, commissionUsd: 0,
          }).catch(() => {})
        } else {
          // Payment affiliate: track commission conversion as before
          recordAffiliateConversion({
            affiliateId: aff.id, referredUserId: userId,
            referredEmail: email, eventType: 'signup', plan: 'free',
            amountUsd: 0, commissionUsd: 0,
          }).catch(() => {})
        }
      }
    } catch (_) {}
  })
}

// ─── User / Profile ───────────────────────────────────
export async function getUser(email) {
  try {
    // Query by authenticated user ID (more secure, avoids RLS issues)
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

export async function saveUser(email, updates) {
  const userId = await getUserId()
  if (!userId) return

  const row = toSnake(updates)
  delete row.pass
  delete row.id
  delete row.email // don't change email
  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error) console.error('saveUser error:', error.message)
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('getAllUsers error:', error.message); return [] }
  return (data || []).map(toCamel)
}

export async function findUserByRef(code) {
  // Uses SECURITY DEFINER RPC — returns only the referrer's id, no PII leak
  if (!code) return null
  const { data, error } = await supabase.rpc('lookup_referrer', { p_code: code })
  if (error || !data) return null
  return { id: data }
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
  // First get the affiliate record id
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

export async function createAffiliate(record) {
  const row = toSnake(record)
  const { data, error } = await supabase.from('affiliates').insert(row).select().single()
  if (error) throw new Error(error.message)
  return toCamel(data)
}

export async function updateAffiliate(id, updates) {
  const row = toSnake(updates)
  const { error } = await supabase.from('affiliates').update(row).eq('id', id)
  if (error) console.error('updateAffiliate error:', error.message)
}

export async function findAffiliateByCode(code) {
  if (!code) return null
  const { data } = await supabase
    .from('affiliates')
    .select('*')
    .eq('promo_code', code.toUpperCase())
    .eq('status', 'active')
    .maybeSingle()
  return data ? toCamel(data) : null
}

export async function recordAffiliateConversion({ affiliateId, referredUserId, referredEmail, eventType, plan, amountUsd, commissionUsd }) {
  const row = {
    affiliate_id: affiliateId,
    referred_user_id: referredUserId,
    referred_email: referredEmail,
    event_type: eventType,
    plan,
    amount_usd: amountUsd,
    commission_usd: commissionUsd,
    status: 'pending',
  }
  const { error } = await supabase.from('affiliate_conversions').insert(row)
  if (error) console.error('recordAffiliateConversion error:', error.message)
  // Update affiliate totals
  if (!error) {
    if (eventType === 'signup') {
      // Increment signup count via raw SQL update
      const { data: cur } = await supabase
        .from('affiliates').select('total_signups').eq('id', affiliateId).single()
      if (cur) {
        await supabase.from('affiliates')
          .update({ total_signups: (cur.total_signups || 0) + 1 })
          .eq('id', affiliateId)
      }
    }
    if (eventType === 'upgrade' || eventType === 'rebill') {
      await supabase.rpc('add_affiliate_earnings', {
        p_affiliate_id: affiliateId,
        p_amount: commissionUsd || 0,
      })
    }
  }
}

// ─── Referral System ───────────────────────────────
export async function getReferrals(_email) {
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

export async function signUpWithRef(signupData, refCode) {
  // Sign up normally
  const user = await signUp(signupData)
  if (!user?.user?.id || !refCode) return user

  // Find the referrer by code
  const referrer = await findUserByRef(refCode)
  if (!referrer?.id) return user

  // Save the referred_by link
  const { error } = await supabase
    .from('profiles')
    .update({ referred_by: referrer.id })
    .eq('id', user.user.id)

  if (!error) {
    // Increment referrer's referral count
    await supabase.rpc('increment_referral_count', { p_user_id: referrer.id })
  }

  return user
}

// ─── Leads ─────────────────────────────────────────────
export async function getLeads(_email) {
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

export async function insertLeads(leads) {
  const userId = await getUserId()
  if (!userId || !leads.length) return leads
  // Only keep fields that exist in the leads table
  const LEAD_COLS = new Set([
    'name','btype','address','phone','website','rating','reviews','speed','ssl',
    'employees','founded','problems','why','score','suggested_monthly_rate',
    'my_monthly_rate','tools_cost_monthly','setup_cost','demand_score',
    'competition_score','difficulty_rating','market_saturation','country','city',
    'service_id','service_label','status','saved','notes','follow_up_date','user_id'
  ])
  const rows = leads.map(l => {
    const r = toSnake(l)
    r.user_id = userId
    // Strip unknown fields
    for (const k of Object.keys(r)) {
      if (!LEAD_COLS.has(k)) delete r[k]
    }
    return r
  })
  const { data, error } = await supabase.from('leads').insert(rows).select()
  if (error) { console.error('insertLeads error:', error.message); return leads }
  return data ? data.map(toCamel) : leads
}

export async function updateLead(lead) {
  const row = toSnake(lead)
  delete row.user_id
  const { error } = await supabase.from('leads').update(row).eq('id', lead.id)
  if (error) console.error('updateLead error:', error.message)
}

export async function deleteLead(id) {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) console.error('deleteLead error:', error.message)
}

export async function saveLeads(_email, leads) {
  const userId = await getUserId()
  if (!userId) return
  const rows = leads.map(l => ({ ...toSnake(l), user_id: userId }))
  const { error } = await supabase.from('leads').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveLeads error:', error.message)
}

// ─── Clients ───────────────────────────────────────────
export async function getClients(_email) {
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
  if (!row.id || row.id.startsWith('c_')) delete row.id
  const { data, error } = await supabase.from('clients').insert(row).select().single()
  if (error) { console.error('insertClient error:', error.message); return client }
  return data ? toCamel(data) : client
}

export async function updateClient(client) {
  const row = toSnake(client)
  delete row.user_id
  const { error } = await supabase.from('clients').update(row).eq('id', client.id)
  if (error) console.error('updateClient error:', error.message)
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) console.error('deleteClient error:', error.message)
}

export async function saveClients(_email, clients) {
  const userId = await getUserId()
  if (!userId) return
  const rows = clients.map(c => ({ ...toSnake(c), user_id: userId }))
  const { error } = await supabase.from('clients').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveClients error:', error.message)
}

// ─── Scans ─────────────────────────────────────────────
export async function getScans(_email) {
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

export async function saveScans(_email, scans) {
  const userId = await getUserId()
  if (!userId || !scans.length) return
  const newest = { ...toSnake(scans[0]), user_id: userId }
  delete newest.id
  const { error } = await supabase.from('scans').insert(newest)
  if (error) console.error('saveScans error:', error.message)
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
  delete row.user_id // don't change ownership
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

export async function saveGroups(groups) {
  const rows = groups.map(g => toSnake(g))
  const { error } = await supabase.from('groups').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveGroups error:', error.message)
}

export async function getMyGroups(_email) {
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('user_id', userId)
  if (error) { console.error('getMyGroups error:', error.message); return [] }
  return (data || []).map(r => r.group_id)
}

export async function saveMyGroups(_email, groupIds) {
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

export async function resolveReport(reportId) {
  const userId = await getUserId()
  const { error } = await supabase
    .from('reports')
    .update({ status: 'resolved', resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) console.error('resolveReport error:', error.message)
}

// ─── Profile Images ────────────────────────────────────
export async function getProfileImage(email) {
  const userId = await getUserId()
  if (!userId) return null

  const { data } = await supabase
    .from('profiles')
    .select('profile_image_url')
    .eq('id', userId)
    .single()
  return data?.profile_image_url || null
}

export async function saveProfileImage(email, file) {
  const userId = await getUserId()
  if (!userId) return null
  const ext = file.name?.split('.').pop() || 'png'
  const path = `${userId}/avatar.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) { console.error('Upload error:', uploadErr.message); return null }
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  await supabase.from('profiles').update({ profile_image_url: publicUrl }).eq('id', userId)
  return publicUrl
}

// ─── Auth State Listener ───────────────────────────────
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return subscription
}

// ─── Monthly Scan Reset ────────────────────────────────
export async function checkMonthlyScanReset() {
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase.rpc('check_and_reset_monthly_scans', { p_user_id: userId })
  if (error) {
    console.error('Monthly reset check error:', error.message)
    return null
  }
  return data // returns the current scans_used (0 if just reset)
}
