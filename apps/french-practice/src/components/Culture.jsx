import { useMemo, useState, useEffect } from 'react';
import {
  CULTURE_SECTIONS,
  getSectionEntries,
  CULTURE_QUIZ,
  cultureSectionStats,
  cultureTipOfDay,
  searchCulture,
  cultureEntryCount,
} from '../lib/culture';
import { bumpChallengeMetric } from '../lib/storage';
import { SpeakButton } from './ui';
import { ChevronLeft, ChevronRight, Check, X, RefreshCw, Lightbulb, Trophy, Search } from './icons';

const SEEN_KEY = 'fp.cultureSeen';

function loadSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// Cultural learning hub: themed sections with spoken phrases, daily tip,
// search, persistent progress, and an XP quiz.

export default function Culture({ onXp }) {
  const [view, setView] = useState({ mode: 'hub' }); // hub | section | quiz | search
  const [seen, setSeen] = useState(loadSeen);
  const [query, setQuery] = useState('');
  const stats = useMemo(() => cultureSectionStats(), []);
  const tip = useMemo(() => cultureTipOfDay(), []);
  const totalEntries = cultureEntryCount();
  const sectionsRead = CULTURE_SECTIONS.filter((s) => seen.has(s.id)).length;

  useEffect(() => {
    saveSeen(seen);
  }, [seen]);

  const openSection = (id) => {
    setView({ mode: 'section', sectionId: id });
    setSeen((prev) => new Set(prev).add(id));
  };

  const searchHits = useMemo(() => (query.trim() ? searchCulture(query) : []), [query]);

  if (view.mode === 'quiz') {
    return <CultureQuiz onXp={onXp} onBack={() => setView({ mode: 'hub' })} />;
  }

  if (view.mode === 'section') {
    const section = CULTURE_SECTIONS.find((s) => s.id === view.sectionId);
    return <SectionView section={section} onBack={() => setView({ mode: 'hub' })} />;
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">Culture</h2>
          <p className="text-xs text-ink2 mt-1">
            Context behind the language — {totalEntries} notes across {CULTURE_SECTIONS.length} themes.
          </p>
          <p className="text-[11px] text-ink3 mt-1 tabular-nums">
            {sectionsRead}/{CULTURE_SECTIONS.length} sections opened
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-surface2 overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full bg-ink rounded-full transition-all"
              style={{ width: `${Math.round((sectionsRead / CULTURE_SECTIONS.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Daily culture tip — Duolingo/Babbel-style daily bite */}
        {tip && (
          <button
            type="button"
            onClick={() => openSection(tip.section)}
            className="w-full text-left bg-surface border border-line rounded-2xl px-4 py-3.5 hover:border-ink3 transition-colors space-y-1"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Culture tip of the day</p>
            <p className="text-sm font-semibold text-ink flex items-center gap-2">
              <span aria-hidden="true">{tip.emoji}</span>
              <span lang="fr">{tip.title}</span>
            </p>
            <p className="text-xs text-ink2 line-clamp-2 leading-relaxed">{tip.body}</p>
          </button>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search culture notes…"
            aria-label="Search culture notes"
            className="w-full rounded-2xl border border-line bg-surface pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink3"
          />
        </div>

        {query.trim() ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">
              {searchHits.length} result{searchHits.length === 1 ? '' : 's'}
            </p>
            {searchHits.length === 0 && (
              <p className="text-sm text-ink3">No notes match that search.</p>
            )}
            {searchHits.map((entry) => {
              const section = CULTURE_SECTIONS.find((s) => s.id === entry.section);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openSection(entry.section)}
                  className="w-full text-left bg-surface border border-line rounded-2xl px-4 py-3 hover:border-ink3 transition-colors"
                >
                  <p className="text-[11px] text-ink3 font-semibold">{section?.title}</p>
                  <p className="text-sm font-semibold text-ink" lang="fr">{entry.title}</p>
                  <p className="text-xs text-ink2 line-clamp-2 mt-0.5">{entry.body}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <button
              onClick={() => setView({ mode: 'quiz' })}
              className="w-full flex items-center gap-3.5 bg-accent text-onaccent rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
            >
              <Trophy size={18} className="shrink-0" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Culture quiz</span>
                <span className="block text-xs opacity-70">
                  {CULTURE_QUIZ.length} questions in the bank · 8 per run · earn XP
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0" />
            </button>

            <div className="space-y-2.5">
              {stats.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSection(s.id)}
                  className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
                >
                  <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-xl" role="img" aria-hidden="true">{s.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ink">{s.title}</span>
                    <span className="block text-xs text-ink3">{s.blurb}</span>
                    <span className="block text-[11px] text-ink3 mt-0.5 tabular-nums">{s.count} notes</span>
                  </span>
                  {seen.has(s.id) && <Check size={15} className="text-ink3 shrink-0" aria-label="Opened" />}
                  <ChevronRight size={16} className="text-ink3 shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionView({ section, onBack }) {
  const entries = getSectionEntries(section.id);
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to culture" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink flex items-center justify-center gap-1.5">
            <span role="img" aria-hidden="true">{section.emoji}</span> {section.title}
          </h2>
          <span className="w-10 text-[11px] text-ink3 tabular-nums text-right" aria-label={`${entries.length} notes`}>
            {entries.length}
          </span>
        </div>

        <p className="text-center text-xs text-ink3">{section.blurb}</p>

        {entries.map((entry) => (
          <article key={entry.id} className="bg-surface border border-line rounded-2xl p-5 space-y-2.5 fade-in">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="text-lg" role="img" aria-hidden="true">{entry.emoji}</span>
              <span lang="fr">{entry.title}</span>
            </h3>
            <p className="text-[13px] text-ink2 leading-relaxed">{entry.body}</p>

            {entry.phrase && (
              <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink font-medium" lang="fr">{entry.phrase.fr}</p>
                  <p className="text-[11px] text-ink3 italic">{entry.phrase.en}</p>
                </div>
                <SpeakButton text={entry.phrase.fr} label="Listen" />
              </div>
            )}

            <p className="flex items-start gap-2 text-[11px] text-ink3">
              <Lightbulb size={13} className="shrink-0 mt-px" />
              <span>{entry.tip}</span>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function CultureQuiz({ onXp, onBack }) {
  const quiz = useMemo(() => [...CULTURE_QUIZ].sort(() => Math.random() - 0.5).slice(0, 8), []);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [logged, setLogged] = useState(false);

  const done = idx >= quiz.length;

  useEffect(() => {
    if (done && !logged) {
      setLogged(true);
      bumpChallengeMetric('culture', 1);
    }
  }, [done, logged]);

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === quiz[idx].answer) {
      setScore((s) => s + 1);
      onXp(4);
    }
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to culture" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink">Culture quiz</h2>
          <span className="w-10 text-[11px] text-ink3 tabular-nums text-right">
            {done ? '' : `${idx + 1}/${quiz.length}`}
          </span>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-8">
            <Trophy size={36} className="mx-auto text-ink" />
            <p className="text-2xl font-bold text-ink tabular-nums">{score}/{quiz.length}</p>
            <p className="text-sm text-ink2">
              {score === quiz.length
                ? 'Sans faute — you know your France.'
                : score >= quiz.length * 0.75
                  ? 'Nicely done — a few sections more and you’ll be fluent in context.'
                  : 'Good start — open the themes you missed and try again.'}
            </p>
            <button onClick={onBack} className="btn btn-primary min-h-11 px-6 rounded-xl text-sm inline-flex items-center gap-2">
              <RefreshCw size={13} /> Back to sections
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-1 rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full bg-ink transition-all"
                style={{ width: `${(idx / quiz.length) * 100}%` }}
              />
            </div>
            <p className="text-[15px] text-ink font-medium leading-relaxed">{quiz[idx].q}</p>
            <div className="space-y-2" role="radiogroup">
              {quiz[idx].options.map((opt, i) => {
                const show = picked !== null;
                const correct = i === quiz[idx].answer;
                const chosen = picked === i;
                let cls = 'border-line bg-surface text-ink2 hover:border-ink3';
                if (show && correct) cls = 'border-ink bg-surface2 text-ink font-semibold';
                else if (show && chosen) cls = 'border-line bg-surface text-ink3 line-through';
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={show}
                    onClick={() => pick(i)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-2 ${cls}`}
                  >
                    {show && correct && <Check size={14} className="shrink-0" />}
                    {show && chosen && !correct && <X size={14} className="shrink-0" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="space-y-3">
                <p className="text-xs text-ink3 flex items-start gap-2">
                  <Lightbulb size={13} className="shrink-0 mt-px" />
                  {quiz[idx].why}
                </p>
                <button type="button" onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                  {idx + 1 < quiz.length ? 'Next' : 'See score'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
