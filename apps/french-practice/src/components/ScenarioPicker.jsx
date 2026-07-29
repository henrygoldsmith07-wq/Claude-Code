import { useEffect, useMemo, useRef, useState } from 'react';
import { getScenarios } from '../lib/data';
import { scenarioIcon, Check, Search, Shuffle, X } from './icons';

// Full-screen scenario chooser for the Arena. The studio ships ~40 roleplays
// per language, which a horizontal chip rail can only reveal a handful at a
// time — so they get a searchable list with each setup line visible, since
// the situation (not the title) is what people actually choose on.

// Accent-insensitive so "cafe" finds «Au café» and "marche" finds «marché».
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ScenarioPicker({ open, activeId, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    // Focus the field for keyboard users, but don't throw up the on-screen
    // keyboard on touch — there the list itself is the primary way in.
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const scenarios = getScenarios();
  const results = useMemo(() => {
    const needle = norm(query.trim());
    if (!needle) return scenarios;
    return scenarios.filter((s) => norm(`${s.title} ${s.setup}`).includes(needle));
  }, [query, scenarios]);

  if (!open) return null;

  const pick = (s) => {
    onPick(s.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Choose a scenario">
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 min-w-0 text-sm font-bold text-ink truncate">Choose a scenario</h2>
            <button
              onClick={onClose}
              aria-label="Close scenario picker"
              className="w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface2 border border-line rounded-xl px-3 focus-within:border-ink">
            <Search size={15} className="text-ink3 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — bistro, doctor, interview…"
              aria-label="Search scenarios"
              className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="text-ink3 hover:text-ink shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink3" role="status">
              {query.trim() ? `${results.length} of ${scenarios.length} roleplays` : `${scenarios.length} roleplays`}
            </p>
            <button
              onClick={() => pick(scenarios[Math.floor(Math.random() * scenarios.length)])}
              className="btn btn-secondary shrink-0 min-h-9 px-3 rounded-xl text-xs whitespace-nowrap"
            >
              <Shuffle size={13} /> Surprise me
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {results.length === 0 ? (
            <p className="text-center text-sm text-ink3 py-10">
              Nothing matches “{query.trim()}”. Try a place or a task — “post office”, “rebooking”.
            </p>
          ) : (
            <ul className="cv-list space-y-2">
              {results.map((s) => {
                const Icon = scenarioIcon(s.id);
                const active = s.id === activeId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => pick(s)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-start gap-3 text-left rounded-xl border px-3.5 py-3 transition-colors ${
                        active ? 'border-ink bg-surface2' : 'border-line bg-surface hover:border-ink3'
                      }`}
                    >
                      <span
                        className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-surface2 border border-line text-ink2"
                        aria-hidden="true"
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{s.title}</span>
                        <span className="block text-xs text-ink2 leading-snug mt-0.5">{s.setup}</span>
                      </span>
                      {active && (
                        <span className="shrink-0 text-ink mt-0.5" aria-label="Currently open">
                          <Check size={16} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
