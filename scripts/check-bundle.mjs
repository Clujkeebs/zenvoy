// Fail the build if the app entry chunk grows past the budget.
// Vendor (React) and the Supabase client are separate chunks and are not
// counted here. Heavy pages are lazy-loaded so they stay out of the entry.

import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dir = 'dist/assets'
const ENTRY_GZIP_LIMIT = 140 * 1024

const files = readdirSync(dir).filter(name => name.endsWith('.js'))
const rows = files.map(name => {
  const buf = readFileSync(join(dir, name))
  return { name, raw: buf.length, gzip: gzipSync(buf).length }
}).sort((a, b) => b.gzip - a.gzip)

for (const row of rows) {
  console.log(`${row.name}  ${(row.raw / 1024).toFixed(1)} kB  gzip ${(row.gzip / 1024).toFixed(1)} kB`)
}

const entry = rows.find(row => row.name.startsWith('index-'))
if (!entry) {
  console.error('No entry chunk found in dist/assets')
  process.exit(1)
}
if (entry.gzip > ENTRY_GZIP_LIMIT) {
  console.error(`Entry chunk gzip ${(entry.gzip / 1024).toFixed(1)} kB exceeds the ${(ENTRY_GZIP_LIMIT / 1024).toFixed(0)} kB budget`)
  process.exit(1)
}
