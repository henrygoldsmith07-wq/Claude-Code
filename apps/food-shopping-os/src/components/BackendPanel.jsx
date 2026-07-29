import { useEffect, useState } from 'react';
import {
  SessionProvider, signIn, signOut, useSession,
} from 'next-auth/react';
import { Cloud, CloudOff, LogIn, LogOut } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { selectCloudHousehold } from '../lib/cloud.js';
import { Card, Section } from './ui.jsx';

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
            <p className="text-[13px] font-extrabold">
              {session?.user ? session.user.email || session.user.name : 'Local-only mode'}
            </p>
            <p role="status" className="mt-1 text-[12px] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              {app.cloudStatus.message}
            </p>
          </div>
        </div>

        {!session?.user && backend?.enabled && (
          <div className="grid gap-2">
            {backend.providers?.google && (
              <button
                className="press rounded-2xl px-4 py-3 text-[13px] font-extrabold"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                onClick={() => signIn('google', { callbackUrl: '/' })}
              >
                <span className="inline-flex items-center gap-2"><LogIn size={15} /> Continue with Google</span>
              </button>
            )}
            {backend.providers?.apple && (
              <button
                className="press rounded-2xl border px-4 py-3 text-[13px] font-extrabold"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => signIn('apple', { callbackUrl: '/' })}
              >
                Continue with Apple
              </button>
            )}
            {backend.providers?.microsoft && (
              <button
                className="press rounded-2xl border px-4 py-3 text-[13px] font-extrabold"
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
              <label className="grid gap-1 text-[12px] font-bold">
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
              className="press rounded-2xl border px-4 py-3 text-[13px] font-extrabold"
              style={{ borderColor: 'var(--line)' }}
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <span className="inline-flex items-center gap-2"><LogOut size={15} /> Sign out</span>
            </button>
          </>
        )}

        {!backend?.enabled && backend && (
          <p className="text-[11px] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
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
      .catch(() => setBackend({ enabled: false, providers: {}, capabilities: {} }));
  }, []);
  if (!backend?.enabled) {
    return (
      <Section title="Account & sync">
        <Card>
          <p className="text-[12px] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
            {backend ? 'Backend credentials are not configured. Your on-device data still works normally.' : 'Checking backend…'}
          </p>
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
