import { useEffect, useMemo, useRef, useState } from 'react';
import { allEntries } from '../lib/vocab';
import { SCENARIOS } from '../lib/data';
import { GRAMMAR_TOPICS } from '../lib/grammar';
import { READING_TEXTS } from '../lib/reading';
import { LISTENING_TRACKS } from '../lib/listening';
import { saveToNotebook, getNotebook } from '../lib/storage';
import { SpeakButton } from './ui';
import { Search, X, MessageCircle, Book, BookOpen, Volume, Check } from './icons';

// Global search: one box over the whole studio — words, scenarios, grammar
// topics, readings and listening tracks — with deep links into each.

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function GlobalSearch({ open, onClose, onGo }) {
  const [q, setQ] = useState('');
  const [savedIds, setSavedIds] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSavedIds([]);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const results = useMemo(() => {
    const query = norm(q.trim());
    if (query.length < 2) return null;
    const hit = (...fields) => fields.some((f) => f && norm(f).includes(query));
    return {
      words: allEntries().filter((e) => hit(e.fr, e.en)).slice(0, 6),
      scenarios: SCENARIOS.filter((s) => hit(s.title, s.setup)).slice(0, 4),
      grammar: GRAMMAR_TOPICS.filter((t) => hit(t.title, t.summary)).slice(0, 4),
      reading: READING_TEXTS.filter((t) => hit(t.title, t.description)).slice(0, 3),
      listening: LISTENING_TRACKS.filter((t) => hit(t.title, t.description)).slice(0, 3),
    };
  }, [q]);

  if (!open) return null;

  const total = results
    ? results.words.length + results.scenarios.length + results.grammar.length + results.reading.length + results.listening.length
    : 0;

  const save = (e) => {
    if (getNotebook().some((n) => n.fr === e.fr)) { setSavedIds((ids) => [...ids, e.id]); return; }
    saveToNotebook({ id: `nb-search-${Date.now()}`, fr: e.fr, en: e.en });
    setSavedIds((ids) => [...ids, e.id]);
  };

  const Row = ({ icon: RowIcon, title, sub, badge, onClick, trailing }) => (
    <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-3.5 py-2.5">
      <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-surface2 text-ink"><RowIcon size={14} /></span>
      <button onClick={onClick} disabled={!onClick} className="flex-1 min-w-0 text-left">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink truncate" lang="fr">{title}</span>
          {badge && <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{badge}</span>}
        </span>
        {sub && <span className="block text-xs text-ink3 truncate">{sub}</span>}
      </button>
      {trailing}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Search">
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <Search size={16} className="text-ink3 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search words, scenarios, grammar, texts…"
            aria-label="Search the whole studio"
            className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink3 focus:outline-none py-2"
          />
          <button onClick={onClose} aria-label="Close search" className="w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink shrink-0">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-4">
        <div className="max-w-md mx-auto space-y-4">
          {!results && (
            <p className="text-xs text-ink3 text-center py-10">
              Type at least two letters — accents optional, French or English.
            </p>
          )}
          {results && total === 0 && (
            <div className="text-center py-10 space-y-2">
              <p className="text-3xl" aria-hidden="true">🔍</p>
              <p className="text-sm text-ink2">Nothing for «{q.trim()}»</p>
              <p className="text-xs text-ink3">Try a shorter word, or search in English.</p>
            </div>
          )}
          {results && results.words.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Words</h3>
              {results.words.map((e) => (
                <Row key={e.id} icon={BookOpen} title={e.fr} sub={e.en}
                  trailing={
                    <span className="flex items-center gap-1 shrink-0">
                      <SpeakButton text={e.fr} label="Listen" />
                      <button onClick={() => save(e)} disabled={savedIds.includes(e.id)}
                        className="btn btn-secondary min-h-8 px-2.5 rounded-lg text-[11px] disabled:opacity-50">
                        {savedIds.includes(e.id) ? <Check size={12} /> : 'Save'}
                      </button>
                    </span>
                  }
                />
              ))}
            </section>
          )}
          {results && results.scenarios.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Conversations</h3>
              {results.scenarios.map((s) => (
                <Row key={s.id} icon={MessageCircle} title={s.title} sub={s.setup} onClick={() => onGo({ type: 'scenario', id: s.id })} />
              ))}
            </section>
          )}
          {results && results.grammar.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Grammar</h3>
              {results.grammar.map((t) => (
                <Row key={t.id} icon={Book} title={t.title} sub={t.summary} badge={t.cefr} onClick={() => onGo({ type: 'grammar', id: t.id })} />
              ))}
            </section>
          )}
          {results && results.reading.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Reading</h3>
              {results.reading.map((t) => (
                <Row key={t.id} icon={BookOpen} title={t.title} sub={t.description} badge={t.cefr} onClick={() => onGo({ type: 'reading', id: t.id })} />
              ))}
            </section>
          )}
          {results && results.listening.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Listening</h3>
              {results.listening.map((t) => (
                <Row key={t.id} icon={Volume} title={t.title} sub={t.description} badge={t.cefr} onClick={() => onGo({ type: 'listening', id: t.id })} />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
