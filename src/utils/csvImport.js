/* ── csvImport.js — bring your existing prospect list in ─────────────────
 *
 * Every freelancer already has a list somewhere: a spreadsheet, a Google Sheet
 * export, a scrape someone sold them. Until now the only way to get leads into
 * this app was to spend scans re-discovering businesses the user already knew
 * about.
 *
 * Importing costs no scans. The value we add isn't finding the names — it's
 * measuring the websites and scoring them, which is exactly what the evidence
 * engine already does.
 *
 * Parsing is done here rather than with a library because the whole job is one
 * well-understood function, and CSV edge cases (quoted commas, embedded
 * newlines, doubled quotes, BOMs, CRLF) are easier to test than to trust.
 * ─────────────────────────────────────────────────────────────────────── */

/**
 * Parse CSV text into headers + rows.
 *
 * Handles: quoted fields, commas and newlines inside quotes, "" escapes,
 * CRLF, a UTF-8 BOM, and trailing blank lines.
 *
 * @returns {{headers: string[], rows: string[][]}}
 */
export function parseCsv(text) {
  if (!text) return { headers: [], rows: [] }

  // Excel writes a BOM; left in place it becomes part of the first header.
  const input = text.replace(/^\uFEFF/, '')

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < input.length) {
    const c = input[i]

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }

    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }

    if (c === '\r' || c === '\n') {
      // Consume CRLF as a single break.
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
      i++
      continue
    }

    field += c; i++
  }

  // Whatever is left after the final character is the last field.
  row.push(field)
  rows.push(row)

  // Drop rows that are entirely empty (trailing newline, blank separators).
  const cleaned = rows.filter(r => r.some(v => v.trim() !== ''))
  if (cleaned.length === 0) return { headers: [], rows: [] }

  const headers = cleaned[0].map(h => h.trim())
  return { headers, rows: cleaned.slice(1) }
}

/** Fields we can populate from a spreadsheet. */
export const IMPORT_FIELDS = [
  { key: 'name',    label: 'Business name', required: true },
  { key: 'website', label: 'Website' },
  { key: 'phone',   label: 'Phone' },
  { key: 'btype',   label: 'Business type' },
  { key: 'address', label: 'Address' },
  { key: 'city',    label: 'City' },
  { key: 'notes',   label: 'Notes' },
]

// Header names people actually use, lower-cased and stripped of punctuation.
const ALIASES = {
  name:    ['name', 'business', 'businessname', 'company', 'companyname', 'title', 'client'],
  website: ['website', 'url', 'site', 'web', 'domain', 'webaddress', 'link', 'homepage'],
  phone:   ['phone', 'telephone', 'tel', 'mobile', 'phonenumber', 'contactnumber', 'number'],
  btype:   ['type', 'businesstype', 'category', 'industry', 'niche', 'sector'],
  address: ['address', 'street', 'location', 'fulladdress', 'addressline1'],
  city:    ['city', 'town', 'locality', 'area'],
  notes:   ['notes', 'note', 'comment', 'comments', 'description', 'remarks'],
}

const normalise = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Guess which column feeds which field, so the common case needs no clicking.
 * Exact alias matches win over partial ones, and a column is only used once.
 */
export function guessMapping(headers) {
  const mapping = {}
  const taken = new Set()
  const norm = headers.map(normalise)

  for (const { key } of IMPORT_FIELDS) {
    const aliases = ALIASES[key] || []

    let idx = norm.findIndex((h, i) => !taken.has(i) && aliases.includes(h))
    if (idx === -1) {
      idx = norm.findIndex((h, i) =>
        !taken.has(i) && h.length > 2 && aliases.some(a => h.includes(a)))
    }

    if (idx !== -1) { mapping[key] = idx; taken.add(idx) }
  }
  return mapping
}

/** Normalise a website cell into something fetchable, or null. */
export function normaliseWebsite(raw) {
  const v = String(raw || '').trim()
  if (!v || /^(n\/?a|none|-|null)$/i.test(v)) return null

  let url = v.replace(/\s+/g, '')
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '')

  try {
    const parsed = new URL(url)
    // A hostname with no dot isn't a real site ("localhost", typos).
    if (!parsed.hostname.includes('.')) return null
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * Turn mapped rows into lead objects, skipping junk and duplicates.
 *
 * @returns {{leads: Array, skipped: {reason: string, row: number}[]}}
 */
export function rowsToLeads(rows, mapping, { country, city, service, existingNames = [] } = {}) {
  const leads = []
  const skipped = []
  const seen = new Set(existingNames.map(n => String(n).toLowerCase().trim()))

  const cell = (row, key) => {
    const idx = mapping[key]
    return idx === undefined ? '' : String(row[idx] ?? '').trim()
  }

  rows.forEach((row, i) => {
    const name = cell(row, 'name')
    if (!name) { skipped.push({ reason: 'no business name', row: i + 2 }); return }

    const key = name.toLowerCase()
    if (seen.has(key)) { skipped.push({ reason: 'already in your leads', row: i + 2 }); return }
    seen.add(key)

    leads.push({
      id: 'imp_' + Date.now() + '_' + i,
      name: name.slice(0, 200),
      website: normaliseWebsite(cell(row, 'website')),
      phone: cell(row, 'phone').slice(0, 60) || null,
      btype: cell(row, 'btype').slice(0, 80) || 'Local Business',
      address: cell(row, 'address').slice(0, 300) || '',
      city: cell(row, 'city').slice(0, 80) || city || '',
      notes: cell(row, 'notes').slice(0, 1000) || '',
      country: country || '',
      serviceId: service?.isCustom ? 'custom' : (service?.id || 'web'),
      serviceLabel: service?.label || 'Website Design / Rebuild',
      serviceCustom: service?.isCustom ? service.label : null,

      // Nothing measured yet — the audit step fills these in.
      findings: [],
      score: 0,
      siteMeasurement: null,
      auditedAt: null,
      problems: [],
      why: '',
      status: 'new',
      saved: false,
      followUpDate: null,
      outreachStep: 0,
      createdAt: new Date().toISOString(),
    })
  })

  return { leads, skipped }
}

/** How many of these can we actually measure? Drives the UI copy. */
export function auditableCount(leads) {
  return leads.filter(l => l.website).length
}
