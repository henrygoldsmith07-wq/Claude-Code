import { useState } from 'react';
import { Modal } from './ui';
import { GOALS, createPath, getPath, retakePlacement } from '../lib/path';
import { startPlacement, selectItem, answerItem, placementResultFrom } from '../lib/placement';
import { saveLastPlacement } from '../lib/storage';
import { Plane, GraduationCap, Briefcase, MessageCircle, Check, X } from './icons';

const GOAL_ICONS = { travel: Plane, school: GraduationCap, business: Briefcase, fluency: MessageCircle };

// Wizard: pick a goal → adaptive placement test → path created at your level.
//
// The test is the real computer-adaptive engine from lib/placement.js (Rasch
// IRT): every answer moves a maximum-likelihood ability estimate, the next
// item is chosen where it is most informative, and the test stops on a
// standard-error rule — usually 8–18 items. The result reports an honest
// ±1 SE range rather than a single false point, and is stored locally so a
// teacher can later pair it against an independently known level
// (recordPlacementValidation) to measure placement accuracy.

export default function PathSetup({ open, onClose, onCreated }) {
  const [step, setStep] = useState('goal'); // goal | test | result
  const [goal, setGoal] = useState(null);
  const [testState, setTestState] = useState(null);
  const [question, setQuestion] = useState(null);
  const [picked, setPicked] = useState(null); // currently selected option, pre-confirm
  const [result, setResult] = useState(null);
  const [level, setLevel] = useState(null);

  const reset = () => {
    setStep('goal');
    setGoal(null);
    setTestState(null);
    setQuestion(null);
    setPicked(null);
    setResult(null);
    setLevel(null);
  };

  const close = () => { reset(); onClose(); };

  const finish = (cefr) => {
    if (result) saveLastPlacement(result);
    const existing = getPath();
    const path = existing
      ? retakePlacement(goal, cefr, existing)
      : createPath(goal, cefr);
    onCreated(path);
    reset();
  };

  const startTest = (g) => {
    const s = startPlacement();
    setGoal(g);
    setTestState(s);
    setQuestion(selectItem(s));
    setStep('test');
  };

  const answer = () => {
    if (!question || picked == null) return;
    const next = answerItem(testState, question, picked);
    setTestState(next);
    setPicked(null);
    if (next.done) {
      const r = placementResultFrom(next);
      setResult(r);
      setLevel(r.level);
      setStep('result');
    } else {
      setQuestion(selectItem(next));
    }
  };

  const answered = testState ? testState.asked.length : 0;
  const maxItems = testState ? Math.min(testState.config.maxItems, 43) : 18;

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
                  ? `Question ${answered + 1} — it adapts and stops once it is confident`
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
            <div>
              <div className="h-1 rounded-full bg-surface2 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-ink transition-all duration-300"
                  style={{ width: `${Math.min(100, (answered / maxItems) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-ink3 mt-1">{answered} answered — ends early once your level is pinned down</p>
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
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 mx-auto grid place-items-center rounded-full border-2 border-ink text-2xl font-bold text-ink">
              {level}
            </div>
            <p className="text-sm text-ink2">
              After {result.itemsAsked} adaptive questions you are placed at
              <span className="font-semibold text-ink"> CEFR {result.level}</span>
              {result.range && result.range !== result.level ? (
                <> — honest range <span className="font-semibold text-ink">{result.range}</span></>
              ) : null}
              {' '}({Math.round(result.confidence * 100)}% confidence). Your path starts calibrated to it —
              conversations, hints and scoring will all match. Checkpoints move you up as you improve.
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
