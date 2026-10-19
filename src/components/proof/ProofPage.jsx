import { useEffect, useMemo, useState } from 'react'
import { decodeProof, verifyProof } from '../../utils/proof'
import { OSM_ATTRIBUTION, SITE_ORIGIN } from '../../constants/site'

function tokenFromLocation() {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash) return hash
  return new URLSearchParams(window.location.search).get('d') || ''
}

function row(label, value) {
  if (value == null || value === '') return null
  return (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: 10, padding: '9px 0', borderTop: '1px solid #e3d5c0', fontSize: 14 }}>
      <span style={{ color: '#8a7f70' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function ProofPage() {
  const doc = useMemo(() => decodeProof(tokenFromLocation()), [])
  const [ok, setOk] = useState(null)

  useEffect(() => {
    if (!doc) return undefined
    document.title = `${doc.name} — measured by Zenvylo`
    let gone = false
    verifyProof(doc).then(result => {
      if (!gone) setOk(result.ok)
    })
    return () => { gone = true }
  }, [doc])

  return (
    <div className="pub" style={{ padding: '28px 16px 64px' }}>
      <header style={{ maxWidth: 760, margin: '0 auto 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href={SITE_ORIGIN} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
          <span className="stamp">Z</span>
          <span className="wordmark">Zenvylo</span>
        </a>
        <a href={SITE_ORIGIN} style={{ fontSize: 13 }}>Make your own</a>
      </header>

      <article className="proof-sheet" style={{ maxWidth: 760, margin: '0 auto', padding: '28px 26px 32px' }}>
        {!doc && (
          <>
            <h1 style={{ fontSize: 36 }}>This link is not a report.</h1>
            <p style={{ color: '#5c5348', marginTop: 8 }}>The address does not contain a Zenvylo proof document.</p>
          </>
        )}
        {doc && ok === null && <p>Checking this report…</p>}
        {doc && ok !== null && <Report doc={doc} ok={ok} />}
      </article>
      <p style={{ maxWidth: 760, margin: '16px auto 0', fontSize: 12, color: '#8a7f70', lineHeight: 1.5 }}>{OSM_ATTRIBUTION}</p>
    </div>
  )
}

function Report({ doc, ok }) {
  const m = doc.measurement
  const when = doc.measuredAt ? new Date(doc.measuredAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : 'Not recorded'
  return (
    <>
      {doc.sample && (
        <p className="sample-banner">Sample document. These checks were typed in as an example. They are not a live measurement of a real business.</p>
      )}
      <p className="proof-kicker">Website measurement</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>{doc.name}</h1>
          <p style={{ color: '#5c5348', marginTop: 4 }}>
            {[doc.btype, doc.city, doc.country].filter(Boolean).join(' · ') || 'Local business'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="proof-kicker">{ok ? 'Code matches' : 'Code does not match'}</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 16, marginTop: 4 }}>{doc.code}</div>
        </div>
      </div>

      <p style={{ margin: '16px 0', lineHeight: 1.6, color: '#3c342c' }}>
        {ok
          ? 'The code above is a hash of the measurements on this page. Editing the link changes the hash, so the code would stop matching.'
          : 'This page was edited after it was signed. Do not trust the lines below as the original measurement.'}
      </p>
      <p style={{ fontSize: 13, color: '#8a7f70', marginBottom: 8 }}>Measured {when}{doc.preparer ? ` · prepared by ${doc.preparer}` : ''}.</p>

      {m && (
        <section>
          <h2 style={{ fontSize: 22, margin: '18px 0 6px' }}>What was observed</h2>
          {row('Address fetched', m.url)}
          {row('Loaded', m.reachable ? `Yes${m.status ? ` (status ${m.status})` : ''}` : `No${m.error ? ` — ${m.error}` : ''}`)}
          {m.reachable && row('HTTPS', m.https == null ? null : m.https ? 'Yes' : 'No — served over http')}
          {m.reachable && row('Response time', m.responseMs != null ? `${(m.responseMs / 1000).toFixed(1)} seconds` : null)}
          {m.reachable && row('Mobile viewport', m.hasViewport == null ? null : m.hasViewport ? 'Present' : 'Not found')}
          {m.reachable && row('Page title', m.title || 'None')}
          {m.reachable && row('Search description', m.hasMetaDescription ? 'Present' : 'Not found')}
          {m.reachable && row('Tap-to-call', m.hasPhoneLink ? 'Present' : 'Not found')}
          {m.reachable && row('Contact form', m.hasContactForm ? 'Present' : 'Not found')}
          {m.reachable && row('Online booking', m.hasBookingLink ? (m.bookingProvider || 'Link found') : 'Not found')}
          {m.reachable && row('Analytics', m.hasAnalytics ? 'Detected' : 'Not detected')}
          {m.reachable && row('Structured data', m.hasStructuredData ? 'Present' : 'Not found')}
          {m.reachable && row('Social links', (m.socialLinks || []).length ? m.socialLinks.join(', ') : 'None found')}
          {m.reachable && m.copyrightYear && row('Footer year', String(m.copyrightYear))}
          {m.reachable && m.platform && row('Site builder', m.platform)}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 22, margin: '22px 0 6px' }}>Issues derived from those checks</h2>
        {(doc.findings || []).length === 0 && <p style={{ color: '#5c5348' }}>No issues were derived from this measurement.</p>}
        <ul style={{ listStyle: 'none', display: 'grid', gap: 10, marginTop: 8 }}>
          {(doc.findings || []).map(f => (
            <li key={f.id || f.label} style={{ padding: 12, background: '#f6f0e4', borderRadius: 12 }}>
              <strong>{f.label}</strong>
              <p style={{ marginTop: 4, color: '#3c342c', lineHeight: 1.5 }}>{f.evidence}</p>
            </li>
          ))}
        </ul>
      </section>

      {(doc.peerHeadlines || []).length > 0 && (
        <section>
          <h2 style={{ fontSize: 22, margin: '22px 0 6px' }}>Nearest same-category neighbours</h2>
          <p style={{ fontSize: 13, color: '#8a7f70', marginBottom: 8 }}>
            {doc.peerSample} nearby businesses were measured the same way.
          </p>
          <ul style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
            {doc.peerHeadlines.map(line => <li key={line}>{line}</li>)}
          </ul>
        </section>
      )}

      {Number.isFinite(doc.score) && (
        <p style={{ marginTop: 22, fontSize: 14 }}>
          Opportunity score for the service being sold: <strong>{doc.score}</strong> out of 100.
          The number is computed from the issues above. It is not a traffic or revenue estimate.
        </p>
      )}

      <p style={{ marginTop: 18, fontSize: 12, color: '#8a7f70', lineHeight: 1.5 }}>
        This page is a record of a public webpage at the time it was fetched. It is not legal, security, or business advice, and it is not a promise that fixing the items will bring customers.
        {doc.website ? <> Source listing website: {doc.website}.</> : null}
      </p>
    </>
  )
}
