import { useState } from 'react';
import { Check, X, ArrowRight } from './icons';

// Multiple-choice quiz runner over normalised exercises ({ q, options, answer,
// why }). Shared by the AI exercise generator, the mistake-bank lesson and the
// post-conversation quiz. `footer` renders on the results screen.
export default function Quiz({ exercises, onXp, footer }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const done = idx >= exercises.length;

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === exercises[idx].answer) {
      setScore((s) => s + 1);
      onXp(3);
    }
  };

  if (done) {
    return (
      <div className="fade-in bg-surface border border-line rounded-2xl p-5 text-center space-y-3">
        <p className="text-2xl font-bold text-ink tabular-nums">{score}/{exercises.length}</p>
        <p className="text-xs text-ink2">{score === exercises.length ? 'Perfect round.' : 'Review the explanations and go again.'}</p>
        {footer}
      </div>
    );
  }

  const ex = exercises[idx];
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 text-center">
        Question {idx + 1} of {exercises.length}
      </p>
      <div className="bg-surface border border-line rounded-2xl p-5">
        <p className="text-[15px] text-ink font-medium leading-relaxed" lang="fr">{ex.q}</p>
      </div>
      <div className="space-y-2">
        {ex.options.map((opt, i) => {
          const isAnswer = i === ex.answer;
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
              <span className="flex-1" lang="fr">{opt}</span>
              {picked !== null && isAnswer && <Check size={15} className="shrink-0" />}
              {picked !== null && isPicked && !isAnswer && <X size={15} className="shrink-0" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="fade-in space-y-3">
          {ex.why && (
            <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
              <p className="text-xs text-ink2">{ex.why}</p>
            </div>
          )}
          <button onClick={() => { setIdx(idx + 1); setPicked(null); }} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            {idx + 1 < exercises.length ? 'Next question' : 'Finish'} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
