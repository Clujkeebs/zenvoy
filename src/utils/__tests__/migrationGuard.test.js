import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const root = new URL('../../../', import.meta.url)

function read(path) {
  return readFileSync(new URL(path, root), 'utf8')
}

describe('migration history', () => {
  it('keeps the unapplied drop out of the migrations folder', () => {
    const live = new URL('supabase/migrations/20260801040000_drop_aimediabot_schemas.sql', root)
    const archived = new URL('supabase/archive/20260801040000_drop_aimediabot_schemas.sql', root)
    expect(existsSync(live)).toBe(false)
    expect(existsSync(archived)).toBe(true)
    const sql = readFileSync(archived, 'utf8')
    expect(sql).toContain('DROP SCHEMA IF EXISTS aimediabot CASCADE')
    expect(sql).toContain('DROP SCHEMA IF EXISTS analytics  CASCADE')
  })

  it('records the live local_benchmark version without inventing schema', () => {
    const sql = read('supabase/migrations/20260801145756_local_benchmark.sql').toLowerCase()
    expect(sql).not.toMatch(/drop\s+schema/)
    expect(sql).not.toMatch(/create\s+table/)
  })

  it('does not drop a schema in the pending desk migration', () => {
    const sql = read('supabase/migrations/20261019044856_desk_notices_and_digest.sql').toLowerCase()
    expect(sql).not.toMatch(/drop\s+schema/)
    expect(sql).toContain('digest_opt_in')
    expect(sql).toContain('daily-digest')
  })
})
