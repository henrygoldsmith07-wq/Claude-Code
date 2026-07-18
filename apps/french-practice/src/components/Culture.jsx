import { useMemo, useState } from 'react';
import { CULTURE_SECTIONS, getSectionEntries, CULTURE_QUIZ } from '../lib/culture';
import { SpeakButton } from './ui';
import { ChevronLeft, ChevronRight, Check, X, RefreshCw, Lightbulb, Trophy } from './icons';

// Cultural learning hub: eight themed sections of authored notes with
// spoken phrases and "did you know" tips, plus a culture quiz that pays XP.
// A read section is remembered for the session so progress feels visible.

export default function Culture({ onXp }) {
  const [view, setView] = useState({ mode: 'hub' }); // hub | section | quiz
  const [seen, setSeen] = useState(() => new Set());

  const openSection = (id) => {
    setView({ mode: 'section', sectionId: id });
    setSeen((prev) => new Set(prev).add(id));
  };

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
            The context behind the language — customs, food, history and the many Frances.
          </p>
        </div>

        <button
          onClick={() => setView({ mode: 'quiz' })}
          className="w-full flex items-center gap-3.5 bg-accent text-onaccent rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
        >
          <Trophy size={18} className="shrink-0" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Culture quiz</span>
            <span className="block text-xs opacity-70">Test what you’ve learned — earn XP</span>
          </span>
          <ChevronRight size={16} className="shrink-0" />
        </button>

        <div className="space-y-2.5">
          {CULTURE_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => openSection(s.id)}
              className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-xl" role="img" aria-hidden="true">{s.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink">{s.title}</span>
                <span className="block text-xs text-ink3">{s.blurb}</span>
              </span>
              {seen.has(s.id) && <Check size={15} className="text-ink3 shrink-0" aria-label="Read" />}
              <ChevronRight size={16} className="text-ink3 shrink-0" />
            </button>
          ))}
        </div>
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
          <span className="w-10" aria-hidden="true" />
        </div>

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
  // A fresh shuffled subset each run keeps replays interesting.
  const quiz = useMemo(() => [...CULTURE_QUIZ].sort(() => Math.random() - 0.5).slice(0, 6), []);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);

  const done = idx >= quiz.length;

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
          <span className="w-10" aria-hidden="true" />
        </div>

        {done ? (
          <div className="fade-in bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
            <p className="text-3xl font-bold text-ink tabular-nums">{score}/{quiz.length}</p>
            <p className="text-sm text-ink2">
              {score === quiz.length ? 'Sans faute — you know your France.' : 'Nicely done — the sections cover every answer.'}
            </p>
            <button onClick={onBack} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">
              <RefreshCw size={13} /> Back to sections
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 text-center">
              Question {idx + 1} of {quiz.length}
            </p>
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="text-[15px] text-ink font-medium leading-relaxed">{quiz[idx].q}</p>
            </div>
            <div className="space-y-2">
              {quiz[idx].options.map((opt, i) => {
                const isAnswer = i === quiz[idx].answer;
                const isPicked = i === picked;
                let cls = 'bg-surface border-line hover:border-ink3';
                if (picked !== null) {
                  if (isAnswer) cls = 'bg-surface2 border-ink';
                  else if (isPicked) cls = 'bg-surface border-line opacity-60';
                  else cls = 'bg-surface border-line opacity-60';
                }
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left text-sm text-ink transition-colors ${cls}`}
                  >
                    <span className="flex-1">{opt}</span>
                    {picked !== null && isAnswer && <Check size={15} className="shrink-0" />}
                    {picked !== null && isPicked && !isAnswer && <X size={15} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="fade-in space-y-3">
                <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-ink2">{quiz[idx].why}</p>
                </div>
                <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                  {idx + 1 < quiz.length ? 'Next question' : 'See score'} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
