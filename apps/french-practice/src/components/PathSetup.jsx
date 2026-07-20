import { useState } from 'react';
import { Modal } from './ui';
import { GOALS, PLACEMENT_QUESTIONS, CEFR_LEVELS, createPath } from '../lib/path';
import { Plane, GraduationCap, Briefcase, MessageCircle, Check, X } from './icons';

const GOAL_ICONS = { travel: Plane, school: GraduationCap, business: Briefcase, fluency: MessageCircle };

// Wizard: pick a goal → adaptive placement test → path created at your level.
// The test is a CAT-style staircase: it starts at B1, moves up a level on a
// correct answer and down on a wrong one, drawing each question from the
// current level — 8 questions instead of a fixed 12, converging faster.

const TOTAL = 8;
const START_IDX = 2; // B1

function pickQuestion(levelIdx, askedQs) {
  // Nearest unasked question to the current level.
  for (let d = 0; d < CEFR_LEVELS.length; d += 1) {
    for (const idx of d === 0 ? [levelIdx] : [levelIdx - d, levelIdx + d]) {
      if (idx < 0 || idx >= CEFR_LEVELS.length) continue;
      const q = PLACEMENT_QUESTIONS.find((x) => x.level === CEFR_LEVELS[idx] && !askedQs.includes(x));
      if (q) return q;
    }
  }
  return null;
}

export default function PathSetup({ open, onClose, onCreated }) {
  const [step, setStep] = useState('goal'); // goal | test | result
  const [goal, setGoal] = useState(null);
  const [levelIdx, setLevelIdx] = useState(START_IDX);
  const [asked, setAsked] = useState([]); // question objects, in order
  const [count, setCount] = useState(0);
  const [nCorrect, setNCorrect] = useState(0);
  const [question, setQuestion] = useState(null);
  const [picked, setPicked] = useState(null); // currently selected option, pre-confirm
  const [level, setLevel] = useState(null);

  const reset = () => {
    setStep('goal');
    setGoal(null);
    setLevelIdx(START_IDX);
    setAsked([]);
    setCount(0);
    setNCorrect(0);
    setQuestion(null);
    setPicked(null);
    setLevel(null);
  };

  const close = () => { reset(); onClose(); };

  const finish = (cefr) => {
    const path = createPath(goal, cefr);
    onCreated(path);
    reset();
  };

  const startTest = (g) => {
    setGoal(g);
    setQuestion(pickQuestion(START_IDX, []));
    setStep('test');
  };

  const answer = () => {
    const correct = picked === question.answer;
    const nextIdx = Math.max(0, Math.min(CEFR_LEVELS.length - 1, levelIdx + (correct ? 1 : -1)));
    const nextAsked = [...asked, question];
    const done = count + 1 >= TOTAL;
    setAsked(nextAsked);
    setCount(count + 1);
    setNCorrect(nCorrect + (correct ? 1 : 0));
    setLevelIdx(nextIdx);
    setPicked(null);
    if (done) {
      setLevel(CEFR_LEVELS[nextIdx]);
      setStep('result');
    } else {
      setQuestion(pickQuestion(nextIdx, nextAsked));
    }
  };

  return (
    <Modal open={open} onClose={close}>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">
              {step === 'goal' ? 'Your learning path' : step === 'test' ? 'Placement test' : 'Your level'}
            </h2>
            <p className="text-xs text-ink2 mt-0.5">
              {step === 'goal'
                ? 'What are you learning French for?'
                : step === 'test'
                  ? `Question ${count + 1} of ${TOTAL} — it adapts to your answers`
                  : 'Based on your answers'}
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2">
            <X size={16} />
          </button>
        </div>

        {step === 'goal' && (
          <div className="space-y-2.5">
            {GOALS.map((g) => {
              const GoalIcon = GOAL_ICONS[g.id];
              return (
                <button
                  key={g.id}
                  onClick={() => startTest(g.id)}
                  className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
                >
                  <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
                    <GoalIcon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{g.title}</span>
                    <span className="block text-xs text-ink3">{g.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 'test' && question && (
          <div className="space-y-4">
            <div className="h-1 rounded-full bg-surface2 overflow-hidden" aria-hidden="true">
              <div
                className="h-full bg-ink transition-all duration-300"
                style={{ width: `${(count / TOTAL) * 100}%` }}
              />
            </div>
            <p className="text-[15px] text-ink leading-relaxed" lang="fr">{question.q}</p>
            <div className="space-y-2" role="radiogroup" aria-label="Answer options">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  role="radio"
                  aria-checked={picked === i}
                  onClick={() => setPicked(i)}
                  lang="fr"
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    picked === i
                      ? 'border-ink bg-surface2 text-ink font-semibold'
                      : 'border-line bg-surface text-ink2 hover:border-ink3'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => finish('A1')}
                className="btn btn-secondary min-h-11 px-4 rounded-xl text-xs"
              >
                Skip — start as a beginner
              </button>
              <button
                onClick={answer}
                disabled={picked == null}
                className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm"
              >
                {count + 1 < TOTAL ? 'Next' : 'See my level'}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 mx-auto grid place-items-center rounded-full border-2 border-ink text-2xl font-bold text-ink">
              {level}
            </div>
            <p className="text-sm text-ink2">
              You answered {nCorrect} of {TOTAL} correctly and the test converged on
              <span className="font-semibold text-ink"> CEFR {level}</span>.
              Your path starts calibrated to it — conversations, hints and scoring will all
              match. Checkpoints move you up as you improve.
            </p>
            <button onClick={() => finish(level)} className="btn btn-primary w-full min-h-12 rounded-xl text-sm">
              <Check size={14} /> Start my path
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
