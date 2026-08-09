import { useRef, useState } from 'react';
import { recordSkillScore } from '../lib/storage';
import { RefreshCw, Check, X, Play } from './icons';

// Accent typing trainer: the word appears stripped of its accents — retype
// it correctly. On-screen accent keys mean no OS keyboard gymnastics, and
// the muscle memory transfers to every writing exercise in the app.

const WORDS = [
  ['déjà', 'already'], ['été', 'summer'], ['français', 'French'], ['où', 'where'],
  ['hôtel', 'hotel'], ['forêt', 'forest'], ['âge', 'age'], ['père', 'father'],
  ['élève', 'pupil'], ['ça', 'that'], ['garçon', 'boy'], ['leçon', 'lesson'],
  ['très', 'very'], ['après', 'after'], ['première', 'first'], ['théâtre', 'theatre'],
  ['fenêtre', 'window'], ['Noël', 'Christmas'], ['naïve', 'naive'], ['goût', 'taste'],
  ['coûter', 'to cost'], ['bientôt', 'soon'], ['plutôt', 'rather'], ['dîner', 'dinner'],
  ['s’il vous plaît', 'please'], ['peut-être', 'maybe'], ['préférée', 'favourite (f)'], ['déçu', 'disappointed'],
  ['cœur', 'heart'], ['sœur', 'sister'], ['œuf', 'egg'], ['numéro', 'number'],
];

const ACCENT_KEYS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'œ', '’'];
const ROUNDS = 10;

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/’/g, "'");

export default function AccentDrill({ onXp }) {
  const [game, setGame] = useState(null);
  const inputRef = useRef(null);

  const draw = (used) => {
    let i;
    do { i = Math.floor(Math.random() * WORDS.length); } while (used.includes(i));
    return i;
  };

  const start = () => {
    const first = draw([]);
    setGame({ n: 1, wordIdx: first, used: [first], input: '', checked: false, correct: 0 });
  };

  const insert = (ch) => {
    if (!game || game.checked) return;
    setGame({ ...game, input: game.input + ch });
    inputRef.current?.focus();
  };

  const check = () => {
    const target = WORDS[game.wordIdx][0];
    const ok = game.input.trim().replace(/'/g, '’') === target;
    setGame({ ...game, checked: true, lastOk: ok, correct: game.correct + (ok ? 1 : 0) });
  };

  const next = () => {
    if (game.n >= ROUNDS) {
      const score = Math.round((game.correct / ROUNDS) * 100);
      recordSkillScore('writing', score);
      onXp(Math.max(1, game.correct * 2));
      setGame({ ...game, done: true, score });
      return;
    }
    const idx = draw(game.used);
    setGame({ n: game.n + 1, wordIdx: idx, used: [...game.used, idx], input: '', checked: false, correct: game.correct });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!game) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-ink2">
          The word appears without its accents — retype it with every é, è, ç and œ in place.
          Use the accent keys below the input.
        </p>
        <button onClick={start} className="btn btn-primary min-h-11 px-6 rounded-xl text-sm"><Play size={14} /> Start</button>
      </div>
    );
  }

  if (game.done) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3 fade-in">
        <p className="text-3xl font-bold text-ink tabular-nums">{game.correct}/{ROUNDS}</p>
        <p className="text-xs text-ink2">{game.score >= 80 ? 'Accents impeccables !' : 'è vs é trips everyone — one more round.'}</p>
        <button onClick={start} className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs"><RefreshCw size={12} /> Again</button>
      </div>
    );
  }

  const [word, meaning] = WORDS[game.wordIdx];

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between text-[11px] text-ink3 tabular-nums">
        <span>Word {game.n}/{ROUNDS}</span>
        <span>{game.correct} ✓</span>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-ink tracking-wide">{strip(word)}</p>
        <p className="text-xs text-ink3 mt-1">{meaning}</p>
      </div>
      <input
        ref={inputRef}
        value={game.input}
        onChange={(e) => setGame({ ...game, input: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') (game.checked ? next() : check()); }}
        disabled={game.checked}
        lang="fr"
        autoCapitalize="none"
        placeholder="Retype it with the accents…"
        aria-label="Type the word with correct accents"
        className="w-full bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-ink text-center placeholder:text-ink3 focus:outline-none focus:border-ink"
      />
      <div className="flex flex-wrap justify-center gap-1.5">
        {ACCENT_KEYS.map((ch) => (
          <button key={ch} onClick={() => insert(ch)} disabled={game.checked}
            className="w-9 h-9 rounded-lg bg-surface2 border border-line text-sm text-ink hover:border-ink3 disabled:opacity-40">
            {ch}
          </button>
        ))}
      </div>
      {game.checked ? (
        <div className="space-y-2 fade-in">
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${game.lastOk ? 'text-ink' : 'text-ink2'}`}>
            {game.lastOk ? <Check size={14} /> : <X size={14} />}
            {game.lastOk ? 'Parfait !' : <>It's written: <span lang="fr" className="font-bold">{word}</span></>}
          </p>
          <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            {game.n >= ROUNDS ? 'See my score' : 'Next word'}
          </button>
        </div>
      ) : (
        <button onClick={check} disabled={!game.input.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm disabled:opacity-50">Check</button>
      )}
    </div>
  );
}
