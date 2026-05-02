import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './global.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0e13', flexDirection: 'column', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>Something went wrong</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#f54242', background: 'rgba(245,66,66,.1)', border: '1px solid rgba(245,66,66,.2)', borderRadius: 8, padding: '12px 16px', maxWidth: 600, wordBreak: 'break-word' }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 22px', background: '#c6f135', color: '#0c0e13', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
