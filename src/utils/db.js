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

// ─── Sign Up / Sign In (new) ───────────────────────────
export async function signUp({ email, password, name, country, svc, currency, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, country, svc, currency, role }
    }
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ─── User / Profile ───────────────────────────────────
export async function getUser(email) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error || !data) return null
    return toCamel(data)
  } catch (e) {
    console.error('getUser error:', e.message)
    return null
  }
}

export async function saveUser(email, updates) {
  const row = toSnake(updates)
  delete row.pass
  delete row.id
  const { error } = await supabase.from('profiles').update(row).eq('email', email)
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
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('ref_code', code)
    .single()
  return data ? toCamel(data) : null
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
  const rows = leads.map(l => {
    const r = toSnake(l)
    r.user_id = userId
    if (r.id?.startsWith('l_')) delete r.id
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
  const { data } = await supabase
    .from('profiles')
    .select('profile_image_url')
    .eq('email', email)
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
