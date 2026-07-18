import { useEffect, useMemo, useState } from 'react';
import { SITUATIONS, getSituation, EXAM, examBand } from '../lib/realworld';
import { SpeakButton } from './ui';
import { X, ChevronLeft, ChevronRight, Check, MessageCircle, FileText, Trophy } from './icons';

// Real-world practice hub (full-screen): a survival phrasebook by situation,
// a jump into the matching Arena roleplay, and a timed-feel mock exam.

export default function RealWorld({ open, onClose, onRoleplay, onXp }) {
  const [view, setView] = useState({ mode: 'hub' }); // hub | situation | exam

  // Always reopen on the hub — the component stays mounted while hidden.
  useEffect(() => {
    if (open) setView({ mode: 'hub' });
  }, [open]);

  if (!open) return null;

  const body = () => {
    if (view.mode === 'exam') return <Exam onXp={onXp} onBack={() => setView({ mode: 'hub' })} />;
    if (view.mode === 'situation') {
      return (
        <Situation
          situation={getSituation(view.id)}
          onBack={() => setView({ mode: 'hub' })}
          onRoleplay={onRoleplay}
        />
      );
    }
    return <Hub onOpen={(id) => setView({ mode: 'situation', id })} onExam={() => setView({ mode: 'exam' })} />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Real-world practice">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Real-world practice</h2>
        <button onClick={onClose} aria-label="Close real-world practice" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0">{body()}</div>
    </div>
  );
}

function Hub({ onOpen, onExam }) {
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-lg mx-auto space-y-4">
        <p className="text-xs text-ink2 text-center">
          Survival phrases for the situations that count — then rehearse them live or test yourself.
        </p>

        <button
          onClick={onExam}
          className="w-full flex items-center gap-3.5 bg-accent text-onaccent rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
        >
          <FileText size={18} className="shrink-0" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Mock exam</span>
            <span className="block text-xs opacity-70">{EXAM.questions.length} questions → a CEFR band</span>
          </span>
          <ChevronRight size={16} className="shrink-0" />
        </button>

        <div className="space-y-2.5">
          {SITUATIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-xl" role="img" aria-hidden="true">{s.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink">{s.title}</span>
                <span className="block text-xs text-ink3">{s.blurb}</span>
              </span>
              {s.scenarioId && <MessageCircle size={14} className="text-ink3 shrink-0" aria-label="Has a live roleplay" />}
              <ChevronRight size={16} className="text-ink3 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Situation({ situation, onBack, onRoleplay }) {
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to situations" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink flex items-center justify-center gap-1.5">
            <span role="img" aria-hidden="true">{situation.emoji}</span> {situation.title}
          </h2>
          <span className="w-10" aria-hidden="true" />
        </div>

        <ul className="space-y-2">
          {situation.phrases.map((p, i) => (
            <li key={i} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-ink font-medium leading-snug" lang="fr">{p.fr}</p>
                <p className="text-xs text-ink3 italic mt-0.5">{p.en}</p>
              </div>
              <SpeakButton text={p.fr} label="Listen" />
            </li>
          ))}
        </ul>

        {situation.scenarioId && (
          <button
            onClick={() => onRoleplay(situation.scenarioId)}
            className="w-full flex items-center gap-3 bg-surface2 border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
          >
            <MessageCircle size={18} className="text-ink shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">Rehearse this live</span>
              <span className="block text-xs text-ink3">Open the matching Arena roleplay</span>
            </span>
            <ChevronRight size={16} className="text-ink3 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}

function Exam({ onXp, onBack }) {
  const questions = EXAM.questions;
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [awarded, setAwarded] = useState(false);
  const done = idx >= questions.length;

  const result = useMemo(() => {
    if (!done) return null;
    const pct = Math.round((score / questions.length) * 100);
    return { pct, ...examBand(pct) };
  }, [done, score, questions.length]);

  // Award XP once, when the exam completes (scaled by score).
  if (done && !awarded) {
    setAwarded(true);
    onXp(Math.max(5, score * 3));
  }

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === questions[idx].answer) setScore((s) => s + 1);
  };
  const next = () => { setPicked(null); setIdx((i) => i + 1); };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to real-world practice" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink">{EXAM.title}</h2>
          <span className="w-10" aria-hidden="true" />
        </div>

        {done ? (
          <div className="fade-in bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
            <Trophy size={28} className="mx-auto text-ink" />
            <p className="text-3xl font-bold text-ink tabular-nums">{score}/{questions.length}</p>
            <p className="text-sm text-ink2">
              Estimated level <span className="font-bold text-ink">{result.band}</span> — {result.note}
            </p>
            <button onClick={onBack} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">Back to situations</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink3">
                Question {idx + 1} of {questions.length}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink3">{questions[idx].skill}</span>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="text-[15px] text-ink font-medium leading-relaxed" lang="fr">{questions[idx].q}</p>
            </div>
            <div className="space-y-2">
              {questions[idx].options.map((opt, i) => {
                const isAnswer = i === questions[idx].answer;
                const isPicked = i === picked;
                let cls = 'bg-surface border-line hover:border-ink3';
                if (picked !== null) {
                  if (isAnswer) cls = 'bg-surface2 border-ink';
                  else cls = 'bg-surface border-line opacity-60';
                }
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left text-sm text-ink transition-colors ${cls}`}
                  >
                    <span className="flex-1" lang="fr">{opt}</span>
                    {picked !== null && isAnswer && <Check size={15} className="shrink-0" />}
                    {picked !== null && isPicked && !isAnswer && <X size={15} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="fade-in space-y-3">
                <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
                  <p className="text-xs text-ink2">{questions[idx].why}</p>
                </div>
                <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                  {idx + 1 < questions.length ? 'Next question' : 'See result'} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
