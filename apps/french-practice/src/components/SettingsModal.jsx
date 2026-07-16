import { useState } from 'react';
import { Modal, Spinner } from './ui';
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
      setMessage(`Clé validée en ${latency} ms ✓`);
      setDraft('');
    } catch (e) {
      setState('bad');
      setMessage(
        /401|403/.test(e.message)
          ? "Cette clé a été refusée par Groq — vérifiez qu'elle est correcte."
          : `Impossible de vérifier la clé : ${e.message}`
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
            <h2 className="text-lg font-bold text-slate-100">Réglages</h2>
            <p className="text-xs text-slate-400 mt-0.5">Tout reste dans votre navigateur — aucun serveur.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <section className="space-y-2">
          <label htmlFor="groq-key" className="text-sm font-semibold text-slate-200">
            Clé API Groq
          </label>
          {apiKey ? (
            <div className="flex items-center justify-between gap-3 bg-slate-800/70 rounded-xl px-4 py-3">
              <span className="text-sm text-emerald-400 font-mono">
                ●●●●{apiKey.slice(-4)} <span className="text-emerald-500/70">connectée</span>
              </span>
              <button
                onClick={forget}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium min-h-9 px-2"
              >
                Oublier la clé
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
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={save}
                  disabled={state === 'checking' || !draft.trim()}
                  className="px-4 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold disabled:opacity-40 hover:bg-emerald-400 active:scale-95 transition min-h-12"
                >
                  {state === 'checking' ? '…' : 'Valider'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Créez une clé gratuite sur console.groq.com — elle est vérifiée via l'endpoint
                <code className="mx-1 text-slate-400">/models</code> avant d'être enregistrée.
              </p>
            </>
          )}
          {state === 'checking' && <Spinner label="Vérification de la clé…" />}
          {message && (
            <p className={`text-xs ${state === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{message}</p>
          )}
        </section>

        <section className="space-y-3 pt-2 border-t border-slate-800">
          <ToggleRow
            label="Panneau développeur"
            hint="Tokens, latence, payloads bruts, Mock Mode"
            checked={settings.devPanel}
            onChange={(v) => onSettingsChange({ ...settings, devPanel: v })}
          />
          <ToggleRow
            label="Mock Mode (hors-ligne)"
            hint="Réponses simulées — aucune requête API"
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
        <span className="block text-sm text-slate-200">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5.5 left-0' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}
