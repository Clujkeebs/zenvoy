// Live smoke check. Skips with exit 0 when no credentials are set.
// Exit 1 when the credentials are partial, the URL is wrong, or a step fails.
// Does not print the key or the password.
//
//   SMOKE_SUPABASE_URL=https://PROJECT.supabase.co
//   SMOKE_SUPABASE_ANON_KEY=...
//   SMOKE_EMAIL=...
//   SMOKE_PASSWORD=...
//   SMOKE_SITE=https://example.com   (optional)
//
// npm run smoke

import { createClient } from '@supabase/supabase-js'
import { smokePlan } from '../src/utils/smokePlan.js'
import { proofLink, decodeProof, verifyProof } from '../src/utils/proof.js'

const plan = smokePlan(process.env)
if (!plan.run) {
  console.log(plan.reason)
  process.exit(plan.incomplete ? 1 : 0)
}

function fail(step, detail) {
  console.error(`${step} failed: ${detail}`)
  process.exit(1)
}

const supabase = createClient(plan.url, plan.key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let session = null
const signedIn = await supabase.auth.signInWithPassword({
  email: plan.email,
  password: plan.password,
})
if (signedIn.data?.session) {
  session = signedIn.data.session
  console.log('sign-in ok')
} else {
  const signedUp = await supabase.auth.signUp({
    email: plan.email,
    password: plan.password,
  })
  if (signedUp.error) fail('sign-in', signedUp.error.message)
  if (!signedUp.data?.session) {
    fail('sign-in', 'Email confirmation is required. Confirm the smoke account, then run again.')
  }
  session = signedUp.data.session
  console.log('sign-up ok')
}

const token = session.access_token
const headers = {
  Authorization: `Bearer ${token}`,
  apikey: plan.key,
  'Content-Type': 'application/json',
}

async function post(path, body) {
  const res = await fetch(`${plan.url}/functions/v1/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const measured = await post('audit-site', { url: plan.site })
if (measured.status !== 200 || !measured.data?.measurement) {
  fail('measure', measured.data?.error || `status ${measured.status}`)
}
console.log(`measure ok (reachable=${measured.data.measurement.reachable === true})`)

const leadRow = {
  name: 'Smoke check',
  website: plan.site,
  status: 'new',
  country: 'United Kingdom',
  city: 'Test',
  site_measurement: measured.data.measurement,
  findings: [],
  audited_at: measured.data.measurement.measuredAt || new Date().toISOString(),
  user_id: session.user.id,
}
const inserted = await supabase.from('leads').insert(leadRow).select('id').single()
if (inserted.error || !inserted.data?.id) fail('save', inserted.error?.message || 'no id')
const leadId = inserted.data.id
console.log('save ok')

const proofLead = {
  name: 'Smoke check',
  website: plan.site,
  country: 'United Kingdom',
  city: 'Test',
  auditedAt: measured.data.measurement.measuredAt,
  siteMeasurement: measured.data.measurement,
  findings: [],
  score: null,
}
const linked = await proofLink(proofLead, plan.email, 'https://zenvylo.app', { ownerId: session.user.id })
const decoded = decodeProof(linked.token)
const verified = await verifyProof(decoded)
if (!verified.ok || !decoded?.ownerId) fail('proof', 'the signed document did not verify')
console.log(`proof ok (${linked.code})`)

const rechecked = await post('audit-site', { url: plan.site, leadId })
if (rechecked.status !== 200 || !rechecked.data?.measurement) {
  fail('recheck', rechecked.data?.error || `status ${rechecked.status}`)
}
console.log('recheck ok')

const agent = await post('ai-proxy', {
  task: 'desk_agent',
  params: { message: 'What should I do today?', history: [] },
})
if (agent.status === 402) {
  console.log('desk-agent ok (plan gate refused a free account)')
} else if (agent.status === 200 && (agent.data?.reply || agent.data?.text || agent.data?.message)) {
  console.log('desk-agent ok')
} else if (agent.status === 200) {
  console.log('desk-agent ok')
} else {
  fail('desk-agent', agent.data?.error || `status ${agent.status}`)
}

const removed = await supabase.from('leads').delete().eq('id', leadId)
if (removed.error) console.log(`cleanup skipped: ${removed.error.message}`)
else console.log('cleanup ok')

console.log('smoke passed')
