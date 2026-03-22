import Icon from '../../icons/Icon'

// Usage: <PageHeader title="Leads" onBack={() => onNav("home")} onHome={() => onNav("home")} />
// onBack is optional — if not provided, only the home button shows
export default function PageHeader({ title, subtitle, onBack, onHome }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "var(--s2)", border: "1.5px solid var(--brd)", borderRadius: 8,
            padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0, transition: "all .15s",
          }}
          aria-label="Go back"
        >
          <Icon n="up" s={14} c="var(--txt2)" style={{ transform: "rotate(-90deg)" }} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{
          fontFamily: "var(--fh)", fontWeight: 900,
          fontSize: "clamp(18px,3vw,24px)", lineHeight: 1.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {title}
        </h2>
        {subtitle && <p style={{ color: "var(--txt2)", fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {onHome && (
        <button
          onClick={onHome}
          className="btn btn-ghost"
          style={{ padding: "6px 10px", fontSize: 11, flexShrink: 0 }}
          aria-label="Go to home"
        >
          <Icon n="home" s={13} /> Home
        </button>
      )}
    </div>
  )
}
