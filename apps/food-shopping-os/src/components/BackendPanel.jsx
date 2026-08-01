import { useEffect, useState } from 'react';
import {
  SessionProvider, signIn, signOut, useSession,
} from 'next-auth/react';
import {
  CheckCircle2, CircleAlert, Cloud, CloudOff, LogIn, LogOut,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { selectCloudHousehold } from '../lib/cloud.js';
import { Card, Section } from './ui.jsx';

function IntegrationStatus({ integrations = {} }) {
  const entries = Object.entries(integrations);
  if (!entries.length) return null;
  return (
    <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--line)' }}>
      <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
        Connected services
      </p>
      <div className="mt-2 grid gap-2">
        {entries.map(([key, integration]) => (
          <div key={key} className="flex items-start gap-2 text-[0.75rem]">
            {integration.ready
              ? <CheckCircle2 size={15} aria-hidden="true" style={{ color: 'var(--accent)' }} />
              : <CircleAlert size={15} aria-hidden="true" style={{ color: 'var(--muted)' }} />}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{integration.label}</p>
              <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--muted)' }}>
                {integration.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackendPanelContent({ backend }) {
  const app = useApp();
  const { data: session } = useSession();
  const [households, setHouseholds] = useState([]);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/households')
      .then((response) => response.json())
      .then((items) => setHouseholds(Array.isArray(items) ? items : []))
      .catch(() => setHouseholds([]));
  }, [session?.user]);

  const synced = app.cloudStatus.kind === 'ready';

  return (
    <Section title="Account & sync">
      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          {synced ? <Cloud size={20} /> : <CloudOff size={20} />}
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-extrabold">
              {session?.user ? session.user.email || session.user.name : 'Local-only mode'}
            </p>
            <p role="status" className="mt-1 text-[0.75rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              {app.cloudStatus.message}
            </p>
          </div>
        </div>

        <IntegrationStatus integrations={backend.integrations} />

        {!session?.user && backend?.enabled && (
          <div className="grid gap-2">
            {backend.providers?.google && (
              <button
                className="press rounded-2xl px-4 py-3 text-[0.8125rem] font-extrabold"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                onClick={() => signIn('google', { callbackUrl: '/' })}
              >
                <span className="inline-flex items-center gap-2"><LogIn size={15} /> Continue with Google</span>
              </button>
            )}
            {backend.providers?.apple && (
              <button
                className="press rounded-2xl border px-4 py-3 text-[0.8125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => signIn('apple', { callbackUrl: '/' })}
              >
                Continue with Apple
              </button>
            )}
            {backend.providers?.microsoft && (
              <button
                className="press rounded-2xl border px-4 py-3 text-[0.8125rem] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
              >
                Continue with Microsoft
              </button>
            )}
          </div>
        )}

        {session?.user && (
          <>
            {households.length > 1 && (
              <label className="grid gap-1 text-[0.75rem] font-bold">
                Household
                <select
                  className="rounded-xl border bg-transparent px-3 py-2"
                  style={{ borderColor: 'var(--line)' }}
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    selectCloudHousehold(event.target.value);
                    window.location.reload();
                  }}
                >
                  <option value="" disabled>Choose household</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>{household.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="press rounded-2xl border px-4 py-3 text-[0.8125rem] font-extrabold"
              style={{ borderColor: 'var(--line)' }}
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <span className="inline-flex items-center gap-2"><LogOut size={15} /> Sign out</span>
            </button>
          </>
        )}

        {!backend?.enabled && backend && (
          <p className="text-[0.6875rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
            The backend is not configured on this deployment. Your on-device data still works normally.
          </p>
        )}
      </Card>
    </Section>
  );
}

function BackendPanelRuntime() {
  const [backend, setBackend] = useState(null);
  useEffect(() => {
    fetch('/api/backend/status')
      .then((response) => response.json())
      .then(setBackend)
      .catch(() => setBackend({ enabled: false, providers: {}, capabilities: {}, integrations: {} }));
  }, []);
  if (!backend?.enabled) {
    return (
      <Section title="Account & sync">
        <Card>
          <p className="text-[0.75rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
            {backend ? 'Backend credentials are not configured. Your on-device data still works normally.' : 'Checking backend…'}
          </p>
          <IntegrationStatus integrations={backend?.integrations} />
        </Card>
      </Section>
    );
  }
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <BackendPanelContent backend={backend} />
    </SessionProvider>
  );
}

export default function BackendPanel() {
  return process.env.NODE_ENV === 'test' ? null : <BackendPanelRuntime />;
}
