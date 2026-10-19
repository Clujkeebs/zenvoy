import { useState, useEffect } from 'react'
import Icon from '../../icons/Icon'
import { PLANS, PLAN_ORDER } from '../../constants/plans'
import { SITE_ORIGIN, HELLO_EMAIL, OSM_ATTRIBUTION } from '../../constants/site'
import Logo from '../brand/Logo'
import Analytics from '../../utils/analytics'
const I = Icon

const FAQ = [
  { q: 'What does Zenvylo actually do?', a: 'You pick the service you sell and a place. Zenvylo pulls real businesses from OpenStreetMap, fetches each website, and records what is there: HTTPS, mobile layout, how long the page took to answer, title, search description, tap-to-call, a contact form, online booking, analytics. The score is calculated from those checks. Claude can write the email, but only using the checks.' },
  { q: 'Why not just ask a chatbot for leads?', a: 'A chatbot can invent a plausible list and a plausible email. It cannot fetch the site, remember the measurement, tell you next month that the site went down or that booking appeared, or hand the owner a link whose verification code is a hash of those measurements. That record is the product.' },
  { q: 'Can the business owner check the report?', a: 'Yes. Each prospect can get a proof page. The link contains the measurements, and the code on the page is a hash of them. If the text is edited, the code stops matching. There is no login. The page does not include guessed traffic or revenue.' },
  { q: 'Where do the businesses come from?', a: 'OpenStreetMap. Names, addresses, phones and website fields are from that public map. Zenvylo then fetches the website itself. Map data is © OpenStreetMap contributors, under the Open Database License.' },
  { q: 'Do I need a credit card?', a: 'No. The free plan is 3 scans a month, 5 leads each. Paid plans are month to month.' },
  { q: 'Which countries can I scan?', a: 'Free and Starter stay in the country on your account. Growth and above can scan every country in the list.' },
]

export default function LandingPage({ onSignup, onLogin, onPreview }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobMenu, setMobMenu] = useState(false)
  const [faqOpen, setFaqOpen] = useState(0)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    Analytics.page('landing', 'Zenvylo — measured leads for freelancers')
  }, [])

  const go = (source) => {
    onSignup()
    try {
      Analytics.signupStarted('email')
      Analytics.track('cta_clicked', { source })
    } catch {
      /* a tracking failure must not block creating an account */
    }
  }

  const plans = PLAN_ORDER.filter(id => id !== 'enterprise').map(id => PLANS[id])

  return (
    <div className="pub">
      <a href="#main" className="skip-link" style={{ position: 'absolute', left: 12, top: -40, background: 'var(--lime)', color: '#16140f', padding: '8px 12px', borderRadius: 8, zIndex: 999 }}
        onFocus={e => { e.currentTarget.style.top = '12px' }}
        onBlur={e => { e.currentTarget.style.top = '-40px' }}>
        Skip to content
      </a>

      {mobMenu && (
        <div className="land-mob-menu open" role="dialog" aria-label="Menu">
          <button style={{ position: 'absolute', top: 18, right: 18, fontSize: 28 }} onClick={() => setMobMenu(false)} aria-label="Close menu">×</button>
          {[['How it works', 'how'], ['Pricing', 'pricing'], ['Blog', '/blog/'], ['Questions', 'faq']].map(([label, id]) => (
            <a key={id} href={id.startsWith('/') ? id : `#${id}`} onClick={() => setMobMenu(false)}>{label}</a>
          ))}
          <button className="btn btn-lime" onClick={() => { setMobMenu(false); go('mob') }}>Start free</button>
        </div>
      )}

      <nav className={'land-nav' + (scrolled ? ' land-nav-scrolled' : '')} aria-label="Main">
        <a href={SITE_ORIGIN} style={{ color: 'inherit' }}>
          <Logo variant="on-light" size={32} />
        </a>
        <div className="land-nav-links">
          <a className="land-nav-link" href="#how">How it works</a>
          <a className="land-nav-link" href="#pricing">Pricing</a>
          <a className="land-nav-link" href="/blog/">Blog</a>
          <a className="land-nav-link" href="#faq">Questions</a>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={onLogin}>Sign in</button>
          <button className="btn btn-lime" onClick={() => go('nav')}>Start free</button>
          <button className="land-hamburger" aria-label="Open menu" onClick={() => setMobMenu(true)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <main id="main">
        <section className="land-hero" style={{ alignItems: 'stretch', minHeight: 'auto', paddingTop: 120 }}>
          <div style={{ width: 'min(1120px, 100%)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 36, alignItems: 'center' }}>
            <div>
              <p className="proof-kicker" style={{ color: 'var(--signal)', marginBottom: 14 }}>For freelancers who sell to local businesses</p>
              <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', marginBottom: 16 }}>
                Send the proof.<br />Not a guess.
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--txt2)', maxWidth: 520, marginBottom: 22 }}>
                Zenvylo finds real nearby businesses, measures their websites, and keeps the result. When something changes — the site goes down, booking appears, HTTPS shows up — you see it. Give the desk a goal, like dentists in one city with no booking link, and it keeps only the sites the check confirms. Each prospect gets a page the owner can open and check.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-lime btn-xl" onClick={() => go('hero')}>Start with 3 free scans</button>
                <button className="btn btn-ghost btn-xl" onClick={onPreview}>Look at a sample desk</button>
              </div>
              <p style={{ marginTop: 14, fontSize: 13, color: 'var(--txt3)' }}>
                No credit card. No made-up ratings. Every issue quotes a measurement.
              </p>
            </div>

            <aside className="proof-sheet" aria-label="Sample of a proof page" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="proof-kicker">Proof page · sample layout</div>
                  <h2 style={{ fontSize: 28, marginTop: 6 }}>Harbour Coffee</h2>
                  <p style={{ color: 'var(--txt2)', fontSize: 14 }}>Café · measured 12 Oct 2026</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="proof-kicker">Check code</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 13, marginTop: 6 }}>4F2A-91C0-BE17</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 14 }}>
                Illustrative layout, not a customer or a live scan.
              </p>
              {[
                ['HTTPS', 'Missing — page is served over http'],
                ['Homepage response', '3.4 seconds'],
                ['Online booking', 'Not found'],
                ['Neighbours', '4 of 6 nearby cafés have booking'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '8px 0', borderTop: '1px solid var(--brd)', fontSize: 14 }}>
                  <span style={{ color: 'var(--txt3)' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <section id="how" className="land-section">
          <p className="proof-kicker" style={{ color: 'var(--signal)' }}>What a chatbot cannot keep</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', maxWidth: 640, margin: '10px 0 28px' }}>A desk that remembers the measurements.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              ['01', 'Measure', 'OpenStreetMap for the businesses. Then a fetch of each site: HTTPS, mobile, speed, title, contact, booking, analytics. The score is math on those facts, weighted for what you sell.'],
              ['02', 'Watch', 'Saved prospects can be measured again. Zenvylo diffs the two results and tells you what changed, in words you can check. Your follow-up dates sit on the same screen.'],
              ['03', 'Prove', 'Copy a proof link. The owner sees the checks and a code. The code is a hash of the page, so an edited sentence no longer matches.'],
            ].map(([n, title, body]) => (
              <article key={n} className="card" style={{ padding: 22, background: 'var(--s1)' }}>
                <div style={{ fontFamily: 'var(--fm)', color: 'var(--signal)', fontSize: 12 }}>{n}</div>
                <h3 style={{ fontSize: 28, margin: '8px 0' }}>{title}</h3>
                <p style={{ color: 'var(--txt2)', fontSize: 15, lineHeight: 1.6 }}>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="land-section" style={{ paddingTop: 10 }}>
          <div className="card" style={{ padding: '28px 26px', background: '#1b1712', color: '#f6f1e7' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', maxWidth: 680 }}>Today, not a pile of names.</h2>
            <p style={{ color: '#b7ad9e', maxWidth: 560, margin: '10px 0 18px', lineHeight: 1.6 }}>
              The home screen is a short list: sites that changed, follow-ups you dated, and the strongest leads you have not contacted. That is the reason to open it on a Tuesday.
            </p>
            <button className="btn btn-lime" onClick={onPreview}>Open the sample desk</button>
          </div>
        </section>

        <section id="pricing" className="land-section">
          <p className="proof-kicker" style={{ color: 'var(--signal)' }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', margin: '8px 0 8px' }}>Pay for scans, not for stories.</h2>
          <p style={{ color: 'var(--txt2)', marginBottom: 22 }}>Month to month. AI writing starts on Pro. Enterprise is a conversation, not a checkout.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {plans.map(p => (
              <article key={p.id} className="card" style={{ padding: 16, background: 'var(--s1)', outline: p.best ? '2px solid #1b1712' : 'none' }}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--txt3)' }}>{p.name}</div>
                <div style={{ fontFamily: 'var(--fh)', fontSize: 36, margin: '8px 0' }}>{p.price === 0 ? 'Free' : `$${p.price}`}</div>
                <ul style={{ listStyle: 'none', display: 'grid', gap: 6, fontSize: 13, color: 'var(--txt2)' }}>
                  {p.features.slice(0, 4).map(f => <li key={f}>{f}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 13, color: 'var(--txt3)' }}>
            Enterprise: email <a href={`mailto:${HELLO_EMAIL}`} style={{ textDecoration: 'underline' }}>{HELLO_EMAIL}</a>.
          </p>
        </section>

        <section id="faq" className="land-section" style={{ maxWidth: 800 }}>
          <h2 style={{ fontSize: 40, marginBottom: 8 }}>Questions</h2>
          {FAQ.map((item, i) => (
            <div key={item.q} className="faq-item">
              <button className="faq-q" aria-expanded={faqOpen === i} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <span>{item.q}</span>
                <I n={faqOpen === i ? 'up' : 'down'} s={16} />
              </button>
              {faqOpen === i && <div className="faq-a">{item.a}</div>}
            </div>
          ))}
        </section>
      </main>

      <footer style={{ padding: '28px 24px 40px', maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--txt3)' }}>
        <div>
          <Logo variant="on-light" size={24} />
          <p style={{ maxWidth: 420, marginTop: 8, lineHeight: 1.5 }}>{OSM_ATTRIBUTION}</p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <a href="/blog/">Blog</a>
          <a href="/legal/terms.html">Terms</a>
          <a href="/legal/privacy.html">Privacy</a>
          <a href="/legal/cookies.html">Cookies</a>
          <a href={`mailto:${HELLO_EMAIL}`}>{HELLO_EMAIL}</a>
        </div>
      </footer>
    </div>
  )
}
