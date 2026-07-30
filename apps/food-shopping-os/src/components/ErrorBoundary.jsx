import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10">
        <section className="card w-full space-y-4 p-5" role="alert">
          <AlertTriangle size={24} style={{ color: 'var(--danger)' }} />
          <div>
            <h1 className="text-xl font-extrabold">Forq hit a problem</h1>
            <p className="mt-1 text-[0.8125rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              Your saved data is still on this device. Reload the app first; if the problem returns, export your data from Profile after recovery.
            </p>
          </div>
          <button
            className="press rounded-2xl px-4 py-3 text-[0.8125rem] font-extrabold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            onClick={() => window.location.reload()}
          >
            Reload Forq
          </button>
        </section>
      </main>
    );
  }
}
