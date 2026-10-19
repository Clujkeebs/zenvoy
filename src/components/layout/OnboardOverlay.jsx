import { useState } from 'react'
import { COUNTRIES, SERVICES } from '../../constants/services'
import Logo from '../brand/Logo'

/**
 * First run: pick a service and a place, then open a real scan.
 * The old tutorial claimed the score mixed demand and competition. It does not.
 */
export default function OnboardOverlay({ onDone }) {
  const [step, setStep] = useState(0)
  const [svc, setSvc] = useState('web')
  const [country, setCountry] = useState('United Kingdom')
  const [city, setCity] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,17,14,.72)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" role="dialog" aria-labelledby="onboard-title" style={{ maxWidth: 460, width: '100%', padding: '28px 24px' }}>
        <Logo variant="on-dark" size={32} />
        {step === 0 && (
          <>
            <h2 id="onboard-title" style={{ fontSize: 28, margin: '16px 0 8px' }}>What do you sell?</h2>
            <p style={{ color: 'var(--txt2)', fontSize: 14, lineHeight: 1.5 }}>
              The score weights the checks that matter for this service. It does not guess demand or revenue.
            </p>
            <label htmlFor="onboard-svc" className="sr-only">Service</label>
            <select id="onboard-svc" className="inp" value={svc} onChange={e => setSvc(e.target.value)} style={{ marginTop: 14, width: '100%' }}>
              {SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="btn btn-lime" type="button" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => setStep(1)}>Next</button>
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="onboard-title" style={{ fontSize: 28, margin: '16px 0 8px' }}>Where should the first scan look?</h2>
            <p style={{ color: 'var(--txt2)', fontSize: 14, lineHeight: 1.5 }}>
              One scan finds businesses on the map and measures the websites it can reach. You get a proof link for each saved lead.
            </p>
            <label htmlFor="onboard-country" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>Country</label>
            <select id="onboard-country" className="inp" value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%' }}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label htmlFor="onboard-city" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>City</label>
            <input id="onboard-city" className="inp" value={city} onChange={e => setCity(e.target.value)} placeholder="Austin" style={{ width: '100%' }} />
            <button className="btn btn-lime" type="button" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
              onClick={() => onDone({ svc, country, city: city.trim(), startScan: true })}>
              Measure this place
            </button>
            <button type="button" style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}
              onClick={() => onDone({ svc, country, city: city.trim(), startScan: false })}>
              I’ll look around first
            </button>
          </>
        )}
      </div>
    </div>
  )
}
