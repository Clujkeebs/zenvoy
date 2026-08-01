import { describe, it, expect } from 'vitest'
import {
  parseCsv, guessMapping, rowsToLeads, normaliseWebsite, auditableCount,
} from '../csvImport'

/* Real spreadsheets are messy. These cases are the ones that actually break
 * naive CSV splitting, and each has cost someone a support ticket somewhere.
 */

describe('parseCsv', () => {
  it('parses a plain file', () => {
    const { headers, rows } = parseCsv('Name,Website\nJoe,joe.com\nSue,sue.com')
    expect(headers).toEqual(['Name', 'Website'])
    expect(rows).toEqual([['Joe', 'joe.com'], ['Sue', 'sue.com']])
  })

  it('keeps commas that live inside quotes', () => {
    const { rows } = parseCsv('Name,Address\n"Smith, Jones & Co","1 High St, Leeds"')
    expect(rows[0]).toEqual(['Smith, Jones & Co', '1 High St, Leeds'])
  })

  it('handles doubled quotes as an escaped quote', () => {
    const { rows } = parseCsv('Name\n"The ""Best"" Cafe"')
    expect(rows[0][0]).toBe('The "Best" Cafe')
  })

  it('handles newlines inside a quoted field', () => {
    const { rows } = parseCsv('Name,Notes\nJoe,"line one\nline two"')
    expect(rows).toHaveLength(1)
    expect(rows[0][1]).toBe('line one\nline two')
  })

  it('handles CRLF line endings from Excel', () => {
    const { headers, rows } = parseCsv('Name,Website\r\nJoe,joe.com\r\n')
    expect(headers).toEqual(['Name', 'Website'])
    expect(rows).toEqual([['Joe', 'joe.com']])
  })

  it('strips a UTF-8 BOM so the first header is not corrupted', () => {
    const { headers } = parseCsv('\uFEFFName,Website\nJoe,joe.com')
    expect(headers[0]).toBe('Name')
  })

  it('ignores blank and trailing rows', () => {
    const { rows } = parseCsv('Name\nJoe\n\n\nSue\n')
    expect(rows).toEqual([['Joe'], ['Sue']])
  })

  it('returns empty for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
    expect(parseCsv('   \n  ')).toEqual({ headers: [], rows: [] })
  })
})

describe('guessMapping', () => {
  it('matches the obvious headers', () => {
    const m = guessMapping(['Business Name', 'Website', 'Phone'])
    expect(m.name).toBe(0)
    expect(m.website).toBe(1)
    expect(m.phone).toBe(2)
  })

  it('copes with punctuation and casing', () => {
    const m = guessMapping(['company_name', 'URL', 'Tel.'])
    expect(m.name).toBe(0)
    expect(m.website).toBe(1)
    expect(m.phone).toBe(2)
  })

  it('never assigns one column to two fields', () => {
    const m = guessMapping(['Name', 'Company'])
    const used = Object.values(m)
    expect(new Set(used).size).toBe(used.length)
  })

  it('leaves unknown headers unmapped', () => {
    const m = guessMapping(['Foo', 'Bar'])
    expect(m.name).toBeUndefined()
  })
})

describe('normaliseWebsite', () => {
  it('adds a scheme when missing', () => {
    expect(normaliseWebsite('joescafe.com')).toBe('https://joescafe.com')
  })

  it('leaves an existing scheme alone', () => {
    expect(normaliseWebsite('http://joescafe.com')).toBe('http://joescafe.com')
  })

  it('rejects values that are not sites', () => {
    for (const v of ['', '   ', 'N/A', 'none', '-', 'localhost', 'not a url']) {
      expect(normaliseWebsite(v)).toBeNull()
    }
  })

  it('strips stray whitespace inside the value', () => {
    expect(normaliseWebsite(' joes cafe.com ')).toBe('https://joescafe.com')
  })
})

describe('rowsToLeads', () => {
  const headers = ['Name', 'Website', 'Phone']
  const mapping = { name: 0, website: 1, phone: 2 }

  it('builds leads from mapped rows', () => {
    const { leads } = rowsToLeads([['Joe', 'joe.com', '0161']], mapping, { country: 'United Kingdom' })
    expect(leads).toHaveLength(1)
    expect(leads[0]).toMatchObject({
      name: 'Joe', website: 'https://joe.com', phone: '0161', country: 'United Kingdom',
    })
  })

  it('skips rows with no business name', () => {
    const { leads, skipped } = rowsToLeads([['', 'x.com', '']], mapping, {})
    expect(leads).toHaveLength(0)
    expect(skipped[0].reason).toBe('no business name')
  })

  it('skips leads the user already has', () => {
    const { leads, skipped } = rowsToLeads([['Joe', 'joe.com', '']], mapping, { existingNames: ['joe'] })
    expect(leads).toHaveLength(0)
    expect(skipped[0].reason).toBe('already in your leads')
  })

  it('de-duplicates within the file itself', () => {
    const { leads, skipped } = rowsToLeads(
      [['Joe', 'a.com', ''], ['JOE', 'b.com', '']], mapping, {})
    expect(leads).toHaveLength(1)
    expect(skipped).toHaveLength(1)
  })

  it('reports the spreadsheet row number, allowing for the header', () => {
    const { skipped } = rowsToLeads([['Joe', '', ''], ['', '', '']], mapping, {})
    expect(skipped[0].row).toBe(3)
  })

  it('starts every imported lead unscored and uncontacted', () => {
    const { leads } = rowsToLeads([['Joe', 'joe.com', '']], mapping, {})
    expect(leads[0]).toMatchObject({ score: 0, findings: [], status: 'new', outreachStep: 0 })
    expect(leads[0].auditedAt).toBeNull()
  })

  it('tags leads with the service being sold', () => {
    const { leads } = rowsToLeads([['Joe', '', '']], mapping,
      { service: { id: 'custom', label: 'Drone photography', isCustom: true } })
    expect(leads[0].serviceCustom).toBe('Drone photography')
    expect(leads[0].serviceId).toBe('custom')
  })

  it('truncates absurdly long values rather than rejecting the row', () => {
    const { leads } = rowsToLeads([['x'.repeat(500), '', '']], mapping, {})
    expect(leads[0].name.length).toBe(200)
  })

  it('ignores columns the user chose to skip', () => {
    const { leads } = rowsToLeads([['Joe', 'joe.com', '0161']], { name: 0 }, {})
    expect(leads[0].website).toBeNull()
    expect(leads[0].phone).toBeNull()
  })

})

describe('auditableCount', () => {
  it('counts only leads with a website', () => {
    expect(auditableCount([{ website: 'https://a.com' }, { website: null }])).toBe(1)
  })
})
