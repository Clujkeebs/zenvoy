// Typecheck every edge function entry point with Deno.
// Vite accepts extensionless imports. Deno does not. This is the check that
// stops `supabase functions deploy` from failing on the next shared module.

import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const dir = 'supabase/functions'
const entries = readdirSync(dir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'node_modules')
  .map(entry => join(dir, entry.name, 'index.ts'))
  .sort()

if (!entries.length) {
  console.error('No function entry points found.')
  process.exit(1)
}

const result = spawnSync('deno', ['check', '--config', 'supabase/functions/deno.json', ...entries], { stdio: 'inherit' })
if (result.error) {
  console.error('deno check could not start. Install Deno and retry.')
  process.exit(1)
}
process.exit(result.status ?? 1)
