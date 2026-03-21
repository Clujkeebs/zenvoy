import Icon from '../../icons/Icon'

export default function EnterprisePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px", textAlign: "center", minHeight: "60vh" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(245,166,35,.1)", border: "2px solid rgba(245,166,35,.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Icon n="briefcase" s={32} c="var(--amber)" />
      </div>
      <h1 style={{ fontFamily: "var(--fh)", fontWeight: 900, fontSize: 28, marginBottom: 12 }}>Enterprise Access</h1>
      <p style={{ color: "var(--txt2)", fontSize: 15, lineHeight: 1.8, maxWidth: 440, marginBottom: 28 }}>
        Need custom scan limits, dedicated support, team management, or SLA guarantees?
        Our enterprise plan is tailored to your needs.
      </p>
      <div style={{ background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 12, padding: "20px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "var(--txt3)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Get in touch</div>
        <a href="mailto:support@zenvoy.com" style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)", textDecoration: "none" }}>
          support@zenvoy.com
        </a>
      </div>
      <p style={{ fontSize: 12, color: "var(--txt3)" }}>We typically respond within 24 hours.</p>
    </div>
  )
}
