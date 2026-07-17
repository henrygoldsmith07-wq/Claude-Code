import { useState } from 'react';
import { Modal, Spinner } from './ui';
import { X as XIcon } from './icons';
import { validateKey } from '../lib/groq';
import { setApiKey, clearApiKey } from '../lib/storage';

// Captures + validates the Groq API key before committing it to localStorage.

export default function SettingsModal({ open, onClose, apiKey, onKeyChange, settings, onSettingsChange }) {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | ok | bad
  const [message, setMessage] = useState('');

  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    setState('checking');
    setMessage('');
    try {
      const { latency } = await validateKey(key);
      setApiKey(key);
      onKeyChange(key);
      setState('ok');
      setMessage(`Key validated in ${latency} ms`);
      setDraft('');
    } catch (e) {
      setState('bad');
      setMessage(
        /401|403/.test(e.message)
          ? 'This key was rejected by Groq — double-check it.'
          : `Could not verify the key: ${e.message}`
      );
    }
  };

  const forget = () => {
    clearApiKey();
    onKeyChange('');
    setState('idle');
    setMessage('');
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Settings</h2>
            <p className="text-xs text-ink2 mt-0.5">Everything stays in your browser — no server.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2"
          >
            <XIcon size={16} />
          </button>
        </div>

        <section className="space-y-2">
          <label htmlFor="groq-key" className="text-sm font-semibold text-ink">
            Groq API Key
          </label>
          {apiKey ? (
            <div className="flex items-center justify-between gap-3 bg-surface2 rounded-xl px-4 py-3">
              <span className="text-sm text-ink font-mono">
                ●●●●{apiKey.slice(-4)} <span className="text-ink3">connected</span>
              </span>
              <button
                onClick={forget}
                className="text-xs text-ink hover:text-ink font-medium min-h-9 px-2"
              >
                Forget key
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  id="groq-key"
                  type="password"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  placeholder="gsk_..."
                  className="flex-1 bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-ink font-mono placeholder:text-ink3 focus:outline-none focus:border-ink"
                />
                <button
                  onClick={save}
                  disabled={state === 'checking' || !draft.trim()}
                  className="btn btn-primary px-4 rounded-xl text-sm min-h-12"
                >
                  {state === 'checking' ? '…' : 'Validate'}
                </button>
              </div>
              <p className="text-[11px] text-ink3">
                Create a free key at console.groq.com — it is checked against the
                <code className="mx-1 text-ink2">/models</code> endpoint before being saved.
              </p>
            </>
          )}
          {state === 'checking' && <Spinner label="Checking the key…" />}
          {message && (
            <p className={`text-xs ${state === 'ok' ? 'text-ink' : 'text-ink'}`}>{message}</p>
          )}
        </section>

        <section className="space-y-3 pt-2 border-t border-line">
          <ToggleRow
            label="Developer panel"
            hint="Tokens, latency, raw payloads, Mock Mode"
            checked={settings.devPanel}
            onChange={(v) => onSettingsChange({ ...settings, devPanel: v })}
          />
          <ToggleRow
            label="Mock Mode (offline)"
            hint="Simulated responses — no API requests"
            checked={settings.mockMode}
            onChange={(v) => onSettingsChange({ ...settings, mockMode: v })}
          />
        </section>
      </div>
    </Modal>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer min-h-11">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-[11px] text-ink3">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-bg border border-line transition-transform ${
            checked ? 'translate-x-5.5 left-0' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}
