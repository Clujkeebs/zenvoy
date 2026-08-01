import { useState, useMemo, useRef } from 'react'
import Icon from '../../icons/Icon'
import { COUNTRIES, resolveService } from '../../constants/services'
import {
  parseCsv, guessMapping, rowsToLeads, auditableCount, IMPORT_FIELDS,
} from '../../utils/csvImport'
import { deriveFindings, scoreFindings } from '../../utils/evidence'
import ServicePicker from '../ui/ServicePicker'
import * as DB from '../../utils/db'
const I = Icon

const AUDIT_BATCH = 24

/**
 * Import an existing prospect list and measure it.
 *
 * Costs no scans: the user already had these names. What they didn't have is
 * evidence, which is the part worth paying for — so the import runs the same
 * audit pipeline a scan does and scores every row against the service they
 * sell.
 */
export default function ImportModal({ user, existingLeads = [], onClose, onImported }) {
  const [step, setStep] = useState('paste')       // paste → map → done
  const [raw, setRaw] = useState('')
  const [mapping, setMapping] = useState({})
  const [svc, setSvc] = useState(user.svc || 'web')
  const [customSvc, setCustomSvc] = useState('')
  const [country, setCountry] = useState(user.country || '')
  const [runAudit, setRunAudit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const parsed = useMemo(() => parseCsv(raw), [raw])
  const service = resolveService(svc, customSvc)

  const preview = useMemo(() => {
    if (!parsed.headers.length) return { leads: [], skipped: [] }
    return rowsToLeads(parsed.rows, mapping, {
      country, service, existingNames: existingLeads.map(l => l.name),
    })
  }, [parsed, mapping, country, service, existingLeads])

  const loadText = text => {
    setErr('')
    const p = parseCsv(text)
    if (!p.headers.length) { setErr("That doesn't look like CSV — no header row found."); return }
    if (!p.rows.length) { setErr('Found headers but no data rows.'); return }
    setRaw(text)
    setMapping(guessMapping(p.headers))
    setStep('map')
  }

  const onFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErr('File must be under 5MB.'); return }
    const reader = new FileReader()
    reader.onload = () => loadText(String(reader.result || ''))
    reader.onerror = () => setErr("Couldn't read that file.")
    reader.readAsText(file)
  }

  const doImport = async () => {
    setBusy(true); setErr(''); setProgress('Preparing…')
    try {
      let leads = preview.leads
      if (!leads.length) throw new Error('Nothing to import.')

      // Measure the sites, in batches, so a big list still works.
      if (runAudit) {
        const withSites = leads.filter(l => l.website)
        const measurements = new Map()

        for (let i = 0; i < withSites.length; i += AUDIT_BATCH) {
          const batch = withSites.slice(i, i + AUDIT_BATCH)
          setProgress(`Measuring websites ${i + 1}–${Math.min(i + batch.length, withSites.length)} of ${withSites.length}…`)
          const results = await DB.auditSites(batch.map(l => l.website))
          results.forEach((m, j) => { if (m) measurements.set(batch[j].website, m) })
        }

        setProgress('Scoring…')
        leads = leads.map(l => {
          const m = l.website ? measurements.get(l.website) || null : null
          const all = deriveFindings(l, m)
          const { score, findings } = scoreFindings(all, service.isCustom ? 'custom' : service.id)
          return {
            ...l,
            siteMeasurement: m,
            findings,
            score,
            auditedAt: m ? m.measuredAt : null,
            ssl: m?.https ?? false,
            speed: m?.responseMs ?? null,
            problems: findings.slice(0, 5).map(f => f.label),
            why: findings.length
              ? `${l.name}: ${findings[0].evidence}`
              : 'Imported — no measurable web-presence issues found.',
          }
        })
        leads.sort((a, b) => b.score - a.score)
      }

      setProgress('Saving…')
      const saved = await DB.insertLeads(leads)

      setResult({
        imported: saved.length,
        skipped: preview.skipped.length,
        measured: leads.filter(l => l.auditedAt).length,
        withIssues: leads.filter(l => (l.findings || []).length > 0).length,
      })
      setStep('done')
      onImported(saved)
    } catch (e) {
      setErr(e.message || 'Import failed.')
    }
    setBusy(false)
    setProgress('')
  }

  const canImport = preview.leads.length > 0 && mapping.name !== undefined

  return (
    <div className="modal-wrap" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{
          padding: '18px 22px', borderBottom: '1.5px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 18 }}>
              Import your list
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
              Doesn't use any scans
            </div>
          </div>
          {!busy && (
            <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={onClose}>
              <I n="x" s={16} />
            </button>
          )}
        </div>

        {/* ── Step 1: get the data in ─────────────────────────────── */}
        {step === 'paste' && (
          <div style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 16 }}>
              Already have prospects in a spreadsheet? Bring them in and we'll
              measure each one's website the same way a scan does — so you get
              verified issues to open with, without spending a scan on names you
              already had.
            </p>

            <button className="btn btn-lime" style={{ width: '100%', justifyContent: 'center', padding: 12, marginBottom: 12 }}
              onClick={() => fileRef.current?.click()}>
              <I n="download" s={15} />Choose a CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }} onChange={onFile} />

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt3)', margin: '4px 0 12px' }}>
              or paste it
            </div>

            <textarea
              className="inp"
              rows={7}
              placeholder={'Business,Website,Phone\nJoe\'s Cafe,joescafe.com,0161 555 0100'}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />

            {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 9 }}>{err}</div>}

            <button className="btn btn-dark" disabled={!raw.trim()}
              style={{ width: '100%', justifyContent: 'center', padding: 11, marginTop: 12 }}
              onClick={() => loadText(raw)}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: confirm the columns ─────────────────────────── */}
        {step === 'map' && (
          <div style={{ padding: '20px 22px' }}>
            <div style={{
              padding: '9px 13px', background: 'rgba(198,241,53,.06)',
              border: '1.5px solid rgba(198,241,53,.18)', borderRadius: 9,
              fontSize: 12, color: 'var(--txt2)', marginBottom: 16,
            }}>
              Found <strong style={{ color: 'var(--lime)' }}>{parsed.rows.length} rows</strong>.
              We matched your columns automatically — change anything that looks wrong.
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
              {IMPORT_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, width: 120, color: 'var(--txt2)', flexShrink: 0 }}>
                    {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </span>
                  <select
                    className="inp"
                    style={{ fontSize: 12, padding: '7px 9px', flex: 1 }}
                    value={mapping[f.key] ?? ''}
                    onChange={e => setMapping(m => ({
                      ...m,
                      [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                    }))}
                  >
                    <option value="">— skip —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <ServicePicker
                value={svc} customValue={customSvc}
                recent={user.customServices || []}
                onChange={({ serviceId, customService }) => { setSvc(serviceId); setCustomSvc(customService) }}
              />
              <p style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
                Scoring is tuned to what you sell, so every imported lead is ranked for this service.
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span className="lbl">Country (optional)</span>
              <select className="inp" value={country} onChange={e => setCountry(e.target.value)}>
                <option value="">—</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px',
              background: 'var(--s2)', border: '1.5px solid var(--brd)', borderRadius: 9,
              cursor: 'pointer', marginBottom: 14,
            }} onClick={() => setRunAudit(v => !v)}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: '2px solid ' + (runAudit ? 'var(--lime)' : 'var(--brd2)'),
                background: runAudit ? 'var(--lime)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {runAudit && <I n="check" s={11} c="#0c0e13" />}
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--txt)' }}>
                  Measure their websites now
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                  {auditableCount(preview.leads)} of {preview.leads.length} rows have a website.
                  Without this they import unscored.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 14 }}>
              Ready to import <strong style={{ color: 'var(--lime)' }}>{preview.leads.length}</strong> leads
              {preview.skipped.length > 0 && (
                <span style={{ color: 'var(--txt3)' }}>
                  {' '}· skipping {preview.skipped.length}
                  {' '}({[...new Set(preview.skipped.map(s => s.reason))].join(', ')})
                </span>
              )}
            </div>

            {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{err}</div>}
            {busy && (
              <div style={{ fontSize: 12, color: 'var(--lime)', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 11, height: 11, border: '2px solid var(--brd2)', borderTopColor: 'var(--lime)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                {progress}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={busy}
                style={{ padding: '11px 16px' }} onClick={() => setStep('paste')}>
                Back
              </button>
              <button className="btn btn-lime" disabled={!canImport || busy}
                style={{ flex: 1, justifyContent: 'center', padding: 11 }}
                onClick={doImport}>
                {busy ? 'Working…' : `Import ${preview.leads.length} leads`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: what happened ───────────────────────────────── */}
        {step === 'done' && result && (
          <div style={{ padding: '26px 22px', textAlign: 'center' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(52,212,122,.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <I n="check" s={24} c="var(--green)" />
            </div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              {result.imported} leads imported
            </div>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 20 }}>
              {result.measured > 0
                ? <>We measured {result.measured} website{result.measured === 1 ? '' : 's'} and
                    found verified issues on {result.withIssues}. They're sorted best-first.</>
                : <>Imported without measuring. Use “Re-check site” on any lead to score it.</>}
              {result.skipped > 0 && <> {result.skipped} row{result.skipped === 1 ? ' was' : 's were'} skipped.</>}
            </p>
            <button className="btn btn-lime" style={{ padding: '11px 24px' }} onClick={onClose}>
              See my leads
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
