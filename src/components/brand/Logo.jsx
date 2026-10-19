import { markColors } from './mark'

export function Mark({ size = 32, variant = 'on-light', title = 'Zenvylo', decorative = false }) {
  const c = markColors(variant)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="7" fill={c.tile} />
      <path fill={c.page} d="M6 7h12l6 6v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path fill={c.fold} d="M18 7v5h6z" />
      <path stroke={c.line} strokeWidth="1.6" strokeLinecap="round" d="M10 16h8M10 19.5h6" />
      <circle cx="22" cy="22" r="7" fill={c.seal} />
      <path d="M18.4 22.1l2.1 2.1 4.4-4.6" fill="none" stroke={c.check} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ variant = 'on-light', wordmark = true, size = 28 }) {
  return (
    <span className="logo-lockup" style={{ color: variant === 'on-dark' ? '#f3ecdf' : '#12110e' }}>
      <Mark size={size} variant={variant} decorative={wordmark} />
      {wordmark && <span className="wordmark">Zenvylo</span>}
    </span>
  )
}
