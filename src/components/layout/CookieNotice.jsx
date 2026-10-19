import { useEffect, useState } from 'react'

const KEY = 'zv_cookie_choice'

export function getCookieChoice() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

/**
 * Vercel Analytics does not use a cookie. Google Analytics is optional and
 * only starts after "Accept" when VITE_GA_MEASUREMENT_ID is set.
 */
export function loadOptionalAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID
  if (!id || getCookieChoice() !== 'all') return
  if (document.getElementById('zv-ga')) return
  const s = document.createElement('script')
  s.id = 'zv-ga'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', id, { anonymize_ip: true })
}

export default function CookieNotice() {
  const [choice, setChoice] = useState(() => getCookieChoice())

  useEffect(() => {
    if (choice === 'all') loadOptionalAnalytics()
  }, [choice])

  if (choice) return null

  const pick = (value) => {
    try { localStorage.setItem(KEY, value) } catch { /* private mode */ }
    setChoice(value)
  }

  return (
    <div className="cookie-bar" role="dialog" aria-label="Cookie notice">
      <p style={{ flex: 1, fontSize: 13, lineHeight: 1.45, minWidth: 220 }}>
        Zenvylo stores your cookie choice on this device. Optional Google Analytics loads only if you accept and an ID is configured. The product itself does not need analytics cookies.
        {' '}<a href="/legal/cookies.html" style={{ textDecoration: 'underline' }}>Cookie notice</a>
      </p>
      <button className="btn btn-ghost" onClick={() => pick('essential')}>Essential only</button>
      <button className="btn btn-lime" onClick={() => pick('all')}>Accept</button>
    </div>
  )
}
