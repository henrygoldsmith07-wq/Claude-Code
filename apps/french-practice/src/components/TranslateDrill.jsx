import { useMemo, useRef, useState } from 'react';
import { langName } from '../lib/i18n';
import { allEntries } from '../lib/vocab';
import { recordSkillScore } from '../lib/storage';
import { SpeakButton } from './ui';
import { Play, RefreshCw, Check, X } from './icons';

// Bidirectional translation drill: EN→FR and FR→EN sentence rounds drawn
// from the vocabulary library's example sentences, so every sentence uses
// words the packs teach. Checking is accent- and punctuation-tolerant.

const ROUNDS = 8;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/’/g, "'").replace(/[.,!?;:«»"]/g, '').replace(/\s+/g, ' ').trim();

// Word-level overlap score: quotient of shared words over target words.
const similarity = (a, b) => {
  const ta = new Set(norm(a).split(' '));
  const tb = norm(b).split(' ');
  const hit = tb.filter((w) => ta.has(w)).length;
  return tb.length ? hit / tb.length : 0;
};

export default function TranslateDrill({ onXp }) {
  const pool = useMemo(
    () => allEntries().filter((e) => e.example && e.exampleEn && e.example.split(' ').length <= 10),
    [],
  );
  const [game, setGame] = useState(null);
  const inputRef = useRef(null);

  const draw = (used) => {
    let i;
    do { i = Math.floor(Math.random() * pool.length); } while (used.includes(i));
    return i;
  };

  const start = () => {
    const first = draw([]);
    setGame({ n: 1, idx: first, used: [first], toFr: true, input: '', checked: false, correct: 0 });
  };

  const check = () => {
    const e = pool[game.idx];
    const target = game.toFr ? e.example : e.exampleEn;
    const sim = similarity(game.input, target);
    const ok = sim >= 0.6;
    setGame({ ...game, checked: true, lastOk: ok, sim, correct: game.correct + (ok ? 1 : 0) });
  };

  const next = () => {
    if (game.n >= ROUNDS) {
      const score = Math.round((game.correct / ROUNDS) * 100);
      recordSkillScore('writing', score);
      onXp(Math.max(1, game.correct * 3));
      setGame({ ...game, done: true, score });
      return;
    }
    const idx = draw(game.used);
    setGame({ n: game.n + 1, idx, used: [...game.used, idx], toFr: !game.toFr, input: '', checked: false, correct: game.correct });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!game) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-ink2">
          Eight sentences, alternating directions: English → ${langName()}, then ${langName()} → English.
          Close paraphrases count — accents and punctuation are forgiven.
        </p>
        <button onClick={start} className="btn btn-primary min-h-11 px-6 rounded-xl text-sm"><Play size={14} /> Start</button>
      </div>
    );
  }

  if (game.done) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3 fade-in">
        <p className="text-3xl font-bold text-ink tabular-nums">{game.correct}/{ROUNDS}</p>
        <p className="text-xs text-ink2">{game.score >= 75 ? 'Traduction solide dans les deux sens !' : 'Both directions — that is how it sticks.'}</p>
        <button onClick={start} className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs"><RefreshCw size={12} /> Again</button>
      </div>
    );
  }

  const e = pool[game.idx];
  const source = game.toFr ? e.exampleEn : e.example;
  const target = game.toFr ? e.example : e.exampleEn;

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between text-[11px] text-ink3 tabular-nums">
        <span>Sentence {game.n}/{ROUNDS}</span>
        <span className="font-semibold">{game.toFr ? 'EN → FR' : 'FR → EN'}</span>
        <span>{game.correct} ✓</span>
      </div>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[15px] text-ink leading-relaxed" lang={game.toFr ? 'en' : 'fr'}>{source}</p>
        {!game.toFr && <SpeakButton text={source} label="Listen" />}
      </div>
      <textarea
        ref={inputRef}
        value={game.input}
        onChange={(ev) => setGame({ ...game, input: ev.target.value })}
        disabled={game.checked}
        rows={2}
        lang={game.toFr ? 'fr' : 'en'}
        placeholder={game.toFr ? 'Écris-le en français…' : 'Write it in English…'}
        aria-label="Your translation"
        className="w-full bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
      />
      {game.checked ? (
        <div className="space-y-2 fade-in">
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${game.lastOk ? 'text-ink' : 'text-ink2'}`}>
            {game.lastOk ? <Check size={14} /> : <X size={14} />}
            {game.lastOk ? 'Ça passe !' : 'Not quite —'}
          </p>
          <p className="text-sm text-ink bg-surface2 rounded-xl px-3 py-2" lang={game.toFr ? 'fr' : 'en'}>{target}</p>
          <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            {game.n >= ROUNDS ? 'See my score' : 'Next'}
          </button>
        </div>
      ) : (
        <button onClick={check} disabled={!game.input.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm disabled:opacity-50">Check</button>
      )}
    </div>
  );
}
