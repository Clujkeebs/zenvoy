import { useMemo } from 'react'
import Icon from '../../icons/Icon'
import { fmtDate } from '../../utils/helpers'
const I = Icon

/**
 * A clean, printable web-presence report for one lead.
 *
 * This is the artefact that closes deals. A freelancer can't credibly say
 * "your site is slow" in an email and expect a meeting — but handing over a
 * one-page report that says "we measured 6.2s on 12 March, here's what it
 * costs you and here's the fix" is a different conversation entirely.
 *
 * Everything on this page is a measurement. No estimated revenue loss, no
 * invented competitor benchmarks — the prospect can verify every line, which
 * is exactly why it works.
 */
export default function AuditReport({ lead, user, onClose }) {
  const findings = lead.findings || []
  const m = lead.siteMeasurement

  const grouped = useMemo(() => {
    const high = findings.filter(f => f.weight >= 22)
    const med = findings.filter(f => f.weight >= 12 && f.weight < 22)
    const low = findings.filter(f => f.weight < 12)
    return { high, med, low }
  }, [findings])

  const measured = [
    m?.https !== undefined && { label: 'Secure connection (HTTPS)', ok: m.https,
      detail: m.https ? 'Valid' : 'Missing — browsers warn visitors' },
    m?.hasViewport !== undefined && { label: 'Mobile ready', ok: m.hasViewport,
      detail: m.hasViewport ? 'Responsive layout present' : 'No mobile viewport tag' },
    m?.responseMs != null && { label: 'Homepage response time', ok: m.responseMs < 2000,
      detail: `${(m.responseMs / 1000).toFixed(1)} seconds` },
    m?.title !== undefined && { label: 'Page title', ok: !!m.title && m.title.length >= 15,
      detail: m.title ? `"${m.title}"` : 'Missing' },
    m?.hasMetaDescription !== undefined && { label: 'Search description', ok: m.hasMetaDescription,
      detail: m.hasMetaDescription ? 'Present' : 'Missing — Google writes its own' },
    m?.hasStructuredData !== undefined && { label: 'Business listing data', ok: m.hasStructuredData,
      detail: m.hasStructuredData ? 'LocalBusiness schema found' : 'Not published' },
    m?.hasPhoneLink !== undefined && { label: 'Tap-to-call', ok: m.hasPhoneLink,
      detail: m.hasPhoneLink ? 'Clickable phone number' : 'No clickable number' },
    m?.hasContactForm !== undefined && { label: 'Contact form', ok: m.hasContactForm,
      detail: m.hasContactForm ? 'Present' : 'None found' },
    m?.hasBookingLink !== undefined && { label: 'Online booking', ok: m.hasBookingLink,
      detail: m.bookingProvider ? `Via ${m.bookingProvider}` : 'No booking link found' },
    m?.hasAnalytics !== undefined && { label: 'Analytics installed', ok: m.hasAnalytics,
      detail: m.hasAnalytics ? 'Tracking active' : 'No analytics detected' },
    Array.isArray(m?.socialLinks) && { label: 'Social profiles linked', ok: m.socialLinks.length > 0,
      detail: m.socialLinks.length ? m.socialLinks.join(', ') : 'None linked from the site' },
  ].filter(Boolean)

  return (
    <div className="modal-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal report-modal" style={{ maxWidth: 780, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Toolbar — hidden when printing */}
        <div className="report-toolbar" style={{
          padding: '14px 22px', borderBottom: '1.5px solid var(--brd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          position: 'sticky', top: 0, background: 'var(--s1)', zIndex: 2,
        }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 15 }}>
            Client-ready report
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn btn-lime" style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={() => window.print()}>
              <I n="download" s={13} />Save as PDF
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 10px' }} onClick={onClose}>
              <I n="x" s={13} />
            </button>
          </div>
        </div>

        {/* The report itself */}
        <div className="report-sheet" style={{ padding: '32px 38px', background: '#fff', color: '#111' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em',
                textTransform: 'uppercase', color: '#666' }}>
                Web Presence Report
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: '6px 0 0', lineHeight: 1.2 }}>
                {lead.name}
              </h1>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                {lead.btype}{lead.city ? ` · ${lead.city}` : ''}{lead.country ? `, ${lead.country}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#666' }}>Prepared by</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{user?.name || 'Your name'}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                {lead.auditedAt ? fmtDate(lead.auditedAt) : fmtDate(Date.now())}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13.5, lineHeight: 1.75, color: '#333', marginBottom: 22 }}>
            This report is based on an automated inspection of{' '}
            <strong>{lead.website ? hostOf(lead.website) : 'your online presence'}</strong>
            {lead.auditedAt ? ` carried out on ${fmtDate(lead.auditedAt)}` : ''}.
            Every item below was directly observed — you can verify any of it yourself.
          </p>

          {/* Headline */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 26 }}>
            <div style={{ flex: 1, border: '1.5px solid #ddd', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>
                Issues found
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
                {findings.length}
              </div>
            </div>
            <div style={{ flex: 1, border: '1.5px solid #ddd', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>
                Needing urgent attention
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
                {grouped.high.length}
              </div>
            </div>
            <div style={{ flex: 1, border: '1.5px solid #ddd', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>
                Checks performed
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
                {measured.length}
              </div>
            </div>
          </div>

          {/* Findings by severity */}
          {[
            ['Needs urgent attention', grouped.high, '#c0392b'],
            ['Worth fixing soon', grouped.med, '#c87f0a'],
            ['Minor improvements', grouped.low, '#555'],
          ].filter(([, list]) => list.length > 0).map(([title, list, colour]) => (
            <section key={title} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '.06em', color: colour, marginBottom: 10 }}>
                {title}
              </h2>
              {list.map(f => (
                <div key={f.id} style={{ borderLeft: `3px solid ${colour}`, paddingLeft: 13, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: '#444', lineHeight: 1.65, marginTop: 2 }}>
                    {f.evidence}
                  </div>
                  {f.fix && (
                    <div style={{ fontSize: 13, color: '#111', marginTop: 5 }}>
                      <strong>Recommended fix:</strong> {f.fix}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}

          {findings.length === 0 && (
            <div style={{ padding: 18, background: '#f4f7f2', borderRadius: 10, marginBottom: 24,
              fontSize: 13.5, lineHeight: 1.7, color: '#333' }}>
              We found no significant issues with your web presence — the fundamentals
              are in good shape. The checklist below shows everything we tested.
            </div>
          )}

          {/* Full checklist */}
          <section style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '.06em', color: '#111', marginBottom: 10 }}>
              Full checklist
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {measured.map(c => (
                  <tr key={c.label} style={{ borderTop: '1px solid #e5e5e5' }}>
                    <td style={{ padding: '8px 0', width: 22, verticalAlign: 'top' }}>
                      <span style={{ color: c.ok ? '#2c8c4a' : '#c0392b', fontWeight: 800 }}>
                        {c.ok ? '✓' : '✕'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', fontWeight: 600, width: '42%' }}>{c.label}</td>
                    <td style={{ padding: '8px 0', color: '#555' }}>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div style={{ borderTop: '2px solid #111', paddingTop: 14, fontSize: 12, color: '#666',
            display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>
              Prepared by {user?.name || ''}{user?.email ? ` · ${user.email}` : ''}
            </span>
            <span>
              Measurements taken {lead.auditedAt ? fmtDate(lead.auditedAt) : 'recently'} and may change.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
