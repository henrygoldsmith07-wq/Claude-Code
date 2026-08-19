import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking } from '../lib/tts';
import { recordSkillScore } from '../lib/storage';
import { Play, RefreshCw, Check, X } from './icons';

// Numbers rapid-fire: hear a number, price, time or year in French, type the
// digits. The 70/80/90 system and fast liaisons are exactly what learners
// miss in the wild — this drills them in isolation.

const ROUNDS = 10;

// Each generator returns { say, answer, label } — `answer` is digits-only.
const GENERATORS = [
  () => { const n = 1 + Math.floor(Math.random() * 69); return { say: String(n), answer: String(n), label: 'Number' }; },
  () => { const n = 70 + Math.floor(Math.random() * 30); return { say: String(n), answer: String(n), label: 'Number (the hard range)' }; },
  () => {
    const e = 2 + Math.floor(Math.random() * 98); const c = [0, 50][Math.floor(Math.random() * 2)];
    return { say: c ? `${e} euros ${c}` : `${e} euros`, answer: c ? `${e}.${c}` : String(e), label: 'Price (euros, use . for cents)' };
  },
  () => {
    const h = 8 + Math.floor(Math.random() * 13); const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    const words = m === 0 ? `${h} heures` : `${h} heures ${m}`;
    return { say: words, answer: `${h}:${String(m).padStart(2, '0')}`, label: 'Time (hh:mm)' };
  },
  () => { const y = 1950 + Math.floor(Math.random() * 76); return { say: String(y), answer: String(y), label: 'Year' }; },
];

const normalise = (s) => s.replace(/[^\d.:]/g, '').replace(',', '.');

export default function NumberDash({ ttsRate, onXp, onActivity }) {
  const [round, setRound] = useState(null); // { i, item, input, checked, correct, score }
  const inputRef = useRef(null);

  useEffect(() => () => stopSpeaking(), []);

  const nextItem = () => GENERATORS[Math.floor(Math.random() * GENERATORS.length)]();

  const start = () => {
    const item = nextItem();
    setRound({ i: 1, item, input: '', checked: false, correct: 0 });
    speak(item.say, { rate: ttsRate });
  };

  const replay = () => round && speak(round.item.say, { rate: Math.min(ttsRate, 0.8) });

  const check = () => {
    const ok = normalise(round.input) === round.item.answer;
    setRound({ ...round, checked: true, lastOk: ok, correct: round.correct + (ok ? 1 : 0) });
  };

  const next = () => {
    if (round.i >= ROUNDS) {
      const score = Math.round((round.correct / ROUNDS) * 100);
      recordSkillScore('listening', score);
      onXp(Math.max(1, round.correct * 2));
      onActivity?.({ type: 'listening', trackId: 'numbers', score, label: 'Les nombres', mode: 'numbers' });
      setRound({ ...round, done: true, score });
      return;
    }
    const item = nextItem();
    setRound({ i: round.i + 1, item, input: '', checked: false, correct: round.correct });
    speak(item.say, { rate: ttsRate });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!round) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-ink2">
          Ten rounds: hear a number, price, time or year — type the digits.
          Soixante-quinze, quatre-vingt-douze… no mercy.
        </p>
        <button onClick={start} className="btn btn-primary min-h-11 px-6 rounded-xl text-sm"><Play size={14} /> Start</button>
      </div>
    );
  }

  if (round.done) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3 fade-in">
        <p className="text-3xl font-bold text-ink tabular-nums">{round.correct}/{ROUNDS}</p>
        <p className="text-xs text-ink2">{round.score >= 80 ? 'Vos oreilles sont prêtes pour le marché !' : 'The 70–99 range takes everyone a while — again!'}</p>
        <button onClick={start} className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs"><RefreshCw size={12} /> Again</button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between text-[11px] text-ink3 tabular-nums">
        <span>Round {round.i}/{ROUNDS}</span>
        <span>{round.item.label}</span>
        <span>{round.correct} ✓</span>
      </div>
      <div className="flex gap-2">
        <button onClick={replay} className="btn btn-secondary min-h-11 px-4 rounded-xl text-xs shrink-0">🔉 Replay slow</button>
        <input
          ref={inputRef}
          value={round.input}
          onChange={(e) => setRound({ ...round, input: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') (round.checked ? next() : check()); }}
          disabled={round.checked}
          inputMode="decimal"
          placeholder="Type the digits…"
          aria-label="Your answer in digits"
          className="flex-1 min-w-0 bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
        />
      </div>
      {round.checked ? (
        <div className="space-y-2 fade-in">
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${round.lastOk ? 'text-ink' : 'text-ink2'}`}>
            {round.lastOk ? <Check size={14} /> : <X size={14} />}
            {round.lastOk ? 'Exact !' : `It was: ${round.item.answer} («${round.item.say}»)`}
          </p>
          <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            {round.i >= ROUNDS ? 'See my score' : 'Next'}
          </button>
        </div>
      ) : (
        <button onClick={check} disabled={!round.input.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm disabled:opacity-50">Check</button>
      )}
    </div>
  );
}
