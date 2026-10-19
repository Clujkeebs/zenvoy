import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const functionsDir = join(root, 'supabase/functions')
const IMPORT_RE = /from\s+['"](\.[^'"]+)['"]/g

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec)
  const candidates = /\.(js|ts|mjs|jsx|tsx)$/.test(spec)
    ? [base]
    : [base, `${base}.js`, `${base}.ts`, `${base}.mjs`, `${base}.jsx`]
  return candidates.find(path => existsSync(path))
}

function walk(file, seen, problems) {
  if (seen.has(file)) return
  seen.add(file)
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1]
    if (!/\.(js|ts|mjs|jsx|tsx)$/.test(spec)) {
      problems.push(`${file.slice(root.length + 1)} imports ${spec}`)
    }
    const next = resolveImport(file, spec)
    if (!next) problems.push(`${file.slice(root.length + 1)} cannot resolve ${spec}`)
    else walk(next, seen, problems)
  }
}

describe('edge function modules', () => {
  it('uses explicit extensions Deno can resolve', () => {
    const entries = readdirSync(functionsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'node_modules')
      .map(entry => join(functionsDir, entry.name, 'index.ts'))
      .filter(path => existsSync(path))
    const problems = []
    const seen = new Set()
    for (const entry of entries) walk(entry, seen, problems)
    expect(problems).toEqual([])
    expect(seen.size).toBeGreaterThan(entries.length)
  })
})
