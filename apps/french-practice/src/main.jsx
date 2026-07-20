import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Last-resort error boundary: a crash shows a friendly recovery screen
// instead of a blank page (progress lives in localStorage, so reloading
// is always safe).
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'Inter, system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 40 }}>😵‍💫</p>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Oups — something broke</h1>
        <p style={{ fontSize: 13, opacity: 0.65, maxWidth: 380 }}>
          Your progress is safe on this device. Reloading fixes almost everything.
        </p>
        <button onClick={() => location.reload()} style={{ marginTop: 6, padding: '10px 22px', borderRadius: 12, border: 'none', background: '#111', color: '#fafafa', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Reload the app
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register the service worker so the app works offline (production build only;
// the dev server serves modules that shouldn't be cached).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support unavailable — the app still runs online */
    });
  });
}
