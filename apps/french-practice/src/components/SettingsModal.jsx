import { useState } from 'react';
import { Modal, Spinner } from './ui';
import { Check, X as XIcon } from './icons';
import { validateKey } from '../lib/groq';
import { setApiKey, clearApiKey } from '../lib/storage';
import { LANGUAGE_LIST, getLanguage, normaliseLanguages } from '../lib/languages';

// Captures + validates the Groq API key before committing it to localStorage.

export default function SettingsModal({ open, onClose, apiKey, onKeyChange, settings, onSettingsChange, onReplayOnboarding }) {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | ok | bad
  const [message, setMessage] = useState('');

  // Settings saved before multi-language existed carry only `language`.
  const { languages: learning, language: active } = normaliseLanguages(settings.languages, settings.language || 'fr');

  // Dropping the language being studied hands that role to the next one, so
  // the studio is never pointed at a language the learner has left.
  const toggleLearning = (id) => {
    const wanted = learning.includes(id) ? learning.filter((x) => x !== id) : [...learning, id];
    if (!wanted.length) return; // one language is the floor — never zero
    onSettingsChange({ ...settings, ...normaliseLanguages(wanted, active) });
  };

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
          <div>
            <span className="block text-sm text-ink mb-2">Languages I'm learning</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Languages I'm learning">
              {LANGUAGE_LIST.map((l) => {
                const on = learning.includes(l.id);
                return (
                  <button
                    key={l.id}
                    aria-pressed={on}
                    onClick={() => toggleLearning(l.id)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                      on ? 'bg-surface2 border-ink' : 'bg-surface border-line hover:border-ink3'
                    }`}
                  >
                    {on && <Check size={13} className="absolute top-1.5 right-1.5 text-ink" aria-hidden="true" />}
                    <span className="text-2xl" aria-hidden="true">{l.flag}</span>
                    <span className={`text-xs font-semibold ${on ? 'text-ink' : 'text-ink2'}`}>{l.nativeName}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink3 mt-1.5">
              Sign up for as many as you like — you study one at a time, and dropping one keeps its progress.
            </p>
          </div>
          {learning.length > 1 && (
            <div>
              <span className="block text-sm text-ink mb-2">Studying right now</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Language being studied">
                {learning.map((id) => {
                  const l = getLanguage(id);
                  const on = active === id;
                  return (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => onSettingsChange({ ...settings, language: id })}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border transition-colors ${
                        on ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'
                      }`}
                    >
                      <span aria-hidden="true">{l.flag}</span> {l.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink3 mt-1.5">Switches the whole studio — conversations, flashcards, speech and the AI tutor.</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 min-h-11">
            <span>
              <span className="block text-sm text-ink">My level (CEFR)</span>
              <span className="block text-[11px] text-ink3">Calibrates the AI's complexity and scoring</span>
            </span>
            <div className="flex rounded-xl border border-line overflow-hidden" role="radiogroup" aria-label="CEFR level">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                <button
                  key={lvl}
                  role="radio"
                  aria-checked={settings.level === lvl}
                  onClick={() => onSettingsChange({ ...settings, level: lvl })}
                  className={`px-2 py-2 text-xs font-semibold transition-colors ${
                    settings.level === lvl ? 'bg-accent text-onaccent' : 'bg-surface text-ink2 hover:text-ink'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 min-h-11">
            <span>
              <span className="block text-sm text-ink">Daily goal</span>
              <span className="block text-[11px] text-ink3">XP target that fills the ring on Home</span>
            </span>
            <div className="flex rounded-xl border border-line overflow-hidden" role="radiogroup" aria-label="Daily XP goal">
              {[15, 30, 50].map((goal) => (
                <button
                  key={goal}
                  role="radio"
                  aria-checked={settings.dailyGoal === goal}
                  onClick={() => onSettingsChange({ ...settings, dailyGoal: goal })}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    settings.dailyGoal === goal ? 'bg-accent text-onaccent' : 'bg-surface text-ink2 hover:text-ink'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 min-h-11">
            <span>
              <span className="block text-sm text-ink">Weekly goal</span>
              <span className="block text-[11px] text-ink3">XP target for the Monday–Sunday bar</span>
            </span>
            <div className="flex rounded-xl border border-line overflow-hidden" role="radiogroup" aria-label="Weekly XP goal">
              {[100, 150, 250].map((goal) => (
                <button
                  key={goal}
                  role="radio"
                  aria-checked={settings.weeklyGoal === goal}
                  onClick={() => onSettingsChange({ ...settings, weeklyGoal: goal })}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    settings.weeklyGoal === goal ? 'bg-accent text-onaccent' : 'bg-surface text-ink2 hover:text-ink'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow
            label="Daily reminders"
            hint="One nudge a day when reviews pile up or your streak is at risk, plus a due-count badge on the app icon"
            checked={settings.smartReminders}
            onChange={(v) => {
              if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission();
              }
              onSettingsChange({ ...settings, smartReminders: v });
            }}
          />
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
          {onReplayOnboarding && (
            <button
              onClick={onReplayOnboarding}
              className="w-full text-left min-h-11 flex items-center justify-between gap-4 text-sm text-ink2 hover:text-ink"
            >
              <span>
                <span className="block text-sm text-ink">Replay onboarding</span>
                <span className="block text-[11px] text-ink3">Walk through the setup wizard again</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <section className="space-y-2 pt-2 border-t border-line">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Accessibility</h3>
          <ToggleRow
            label="Larger text"
            hint="Increases the base text size across the app"
            checked={settings.largeText}
            onChange={(v) => onSettingsChange({ ...settings, largeText: v })}
          />
          <ToggleRow
            label="Dyslexia-friendly font"
            hint="A more legible typeface with looser letter and line spacing"
            checked={settings.dyslexiaFont}
            onChange={(v) => onSettingsChange({ ...settings, dyslexiaFont: v })}
          />
          <ToggleRow
            label="High contrast"
            hint="Pure black-on-white (or white-on-black) with stronger borders"
            checked={settings.highContrast}
            onChange={(v) => onSettingsChange({ ...settings, highContrast: v })}
          />
          <ToggleRow
            label="Reduce motion"
            hint="Turns off animations and transitions"
            checked={settings.reduceMotion}
            onChange={(v) => onSettingsChange({ ...settings, reduceMotion: v })}
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
