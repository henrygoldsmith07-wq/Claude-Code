import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import {
  Database, HardDrive, Send, ShieldCheck, Trash2,
} from 'lucide-react';
import { PRIVACY_DISCLOSURE } from '../data/privacy.js';
import { forgetCloudHousehold, selectedCloudHouseholdId } from '../lib/cloud.js';
import { Card } from './ui.jsx';
import HealthVaultPanel from './HealthVaultPanel.jsx';

const ICONS = {
  device: HardDrive,
  server: Database,
  transmitted: Send,
};

const defaultRequest = (...args) => fetch(...args);
const readJson = async (response) => response.json().catch(() => ({}));

export default function PrivacyPanel({
  request = defaultRequest,
  signOutUser = signOut,
} = {}) {
  const [backend, setBackend] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState('');
  const selectedId = selectedCloudHouseholdId();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const statusResponse = await request('/api/backend/status', { credentials: 'same-origin' });
        const nextBackend = await readJson(statusResponse);
        if (cancelled) return;
        setBackend(nextBackend);
        if (!nextBackend.authenticated) return;
        const householdResponse = await request('/api/households', { credentials: 'same-origin' });
        const items = await readJson(householdResponse);
        if (!cancelled) setHouseholds(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setBackend({ enabled: false, authenticated: false });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [request]);

  const target = useMemo(
    () => households.find((household) => household.id === selectedId)
      || households.find((household) => household.personal)
      || null,
    [households, selectedId],
  );
  const canDelete = backend?.authenticated && target?.role === 'owner';

  const deleteServerCopy = async () => {
    if (!canDelete || !confirming || deleting) return;
    setDeleting(true);
    setStatus('');
    try {
      const response = await request('/api/households', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-forq-household-id': target.id,
        },
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || 'The server copy could not be deleted.');
      forgetCloudHousehold();
      setHouseholds((items) => items.filter((household) => household.id !== target.id));
      setConfirming(false);
      setStatus('Server household deleted. The copy in this browser remains.');
      try {
        await signOutUser({ redirect: false });
      } catch {
        setStatus('Server household deleted. Sign out before making more changes; the copy in this browser remains.');
      }
    } catch (error) {
      setStatus(error.message || 'The server copy could not be deleted.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card className="space-y-2">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-extrabold text-[0.9375rem]">Local-first, with optional services</p>
            <p className="mt-1 text-[0.78125rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              No account is required. Signing in copies the selected household to Forq’s server so it can sync.
              Health entries are part of that household copy.
            </p>
          </div>
        </div>
      </Card>

      <HealthVaultPanel />

      {PRIVACY_DISCLOSURE.map((section) => {
        const Icon = ICONS[section.id];
        return (
          <Card key={section.id}>
            <div className="flex items-center gap-2">
              <Icon size={17} />
              <h3 className="font-extrabold text-[0.90625rem]">{section.title}</h3>
            </div>
            <p className="mt-2 text-[0.78125rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              {section.summary}
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.75rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Card>
        );
      })}

      <Card className="space-y-3" style={{ borderColor: confirming ? 'var(--danger)' : 'var(--line)' }}>
        <div>
          <p className="font-extrabold text-[0.90625rem]">Delete the server household</p>
          <p className="mt-1 text-[0.75rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
            This permanently deletes the synced household, member access, invitations, coach links, audit events, queued reminders and uploaded receipts.
            It does not erase this browser’s local copy or your sign-in-provider account.
          </p>
        </div>

        {target && (
          <p className="text-[0.75rem] font-bold">
            Selected: {target.name} · {target.role}
          </p>
        )}

        {!backend?.authenticated && (
          <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
            Sign in under Account &amp; sync before deleting a server household.
          </p>
        )}
        {backend?.authenticated && target && target.role !== 'owner' && (
          <p className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
            Only the household owner can delete data shared with every member.
          </p>
        )}

        {confirming && canDelete && (
          <p className="text-[0.75rem] font-bold" style={{ color: 'var(--danger)' }}>
            This cannot be undone for any household member. Your local copy stays here; signing in again can create a new server copy.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {confirming && (
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="press rounded-2xl border px-3 py-3 text-[0.8125rem] font-extrabold disabled:opacity-50"
              style={{ borderColor: 'var(--line)' }}
            >
              Keep server copy
            </button>
          )}
          <button
            type="button"
            onClick={() => (confirming ? deleteServerCopy() : setConfirming(true))}
            disabled={!canDelete || deleting}
            className={`press rounded-2xl border px-3 py-3 text-[0.8125rem] font-extrabold disabled:opacity-50 ${confirming ? '' : 'col-span-2'}`}
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Trash2 size={15} />
              {deleting ? 'Deleting…' : confirming ? 'Delete permanently' : 'Delete server household'}
            </span>
          </button>
        </div>

        {status && (
          <p role="status" className="text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>
            {status}
          </p>
        )}
      </Card>
    </div>
  );
}
