import { useMemo, useState } from 'react';
import { rateCard } from '../lib/storage';
import { speak, ttsSupported } from '../lib/tts';
import { langName } from '../lib/i18n';
import { ChevronLeft, Check, X, Volume, RefreshCw } from './icons';

// Active-recall quiz over a review deck. Cycles three question shapes so the
// same words get tested from different angles — recognise the meaning, produce
// the word, and catch it by ear — instead of only flipping a card. A correct
// answer feeds the SRS a "good" grade, a wrong one an "again", so the quiz and
// the flashcards share one memory model.

// Loose match: accent-insensitive, article-stripped, punctuation-free.
const strip = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(le |la |les |l'|un |une |der |die |das |el |los |las )/g, '')
    .replace(/[.,!¿?¡;:"«»]/g, '')
    .trim();

// Pick 3 wrong English meanings from the wider library for a choice question.
function distractors(entry, pool) {
  const seen = new Set([entry.en]);
  const out = [];
  const bag = pool.filter((e) => e.en !== entry.en);
  for (let i = bag.length - 1; i > 0 && out.length < 3; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
    if (!seen.has(bag[i].en)) { seen.add(bag[i].en); out.push(bag[i].en); }
  }
  return out;
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const MODES = ['choice', 'produce', 'listen'];

export default function VocabQuiz({ deck, library, title, onRate, onXp, onActivity, onBack, cardMode='receptive' }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null); // null | 'right' | 'wrong'
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [round, setRound] = useState(0); // bump to reshuffle a replay

  const entry = deck[index];
  // Question shape rotates by position; a listen question needs TTS support.
  const rawMode = MODES[index % MODES.length];
  const mode = rawMode === 'listen' && !ttsSupported() ? 'choice' : rawMode;

  const options = useMemo(() => {
    if (mode !== 'choice' || !entry) return [];
    return shuffle([entry.en, ...distractors(entry, library)]);
  }, [entry?.id, mode, round]);

  if (!deck.length) {
    return (
      <div className="h-full grid place-items-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-ink2">Nothing to quiz right now — nice work.</p>
          <button onClick={onBack} className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm">Back</button>
        </div>
      </div>
    );
  }

  // End screen once every card has been answered once.
  if (index >= deck.length) {
    const pct = Math.round((score.right / score.total) * 100);
    return (
      <div className="h-full grid place-items-center px-4">
        <div className="max-w-xs w-full text-center space-y-5">
          <div>
            <p className="text-5xl font-bold text-ink tabular-nums">{pct}%</p>
            <p className="text-sm text-ink2 mt-1">{score.right}/{score.total} correct</p>
          </div>
          <p className="text-xs text-ink3">
            {pct >= 80 ? 'Sharp recall — these are sticking.' : pct >= 50 ? 'Solid — the misses come back sooner.' : 'The tricky ones are queued to return soon.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setIndex(0); setScore({ right: 0, total: 0 }); setResult(null); setAnswer(''); setRound((r) => r + 1); }}
              className="btn btn-secondary flex-1 min-h-11 rounded-xl text-sm inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={15} /> Again
            </button>
            <button onClick={onBack} className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm">Done</button>
          </div>
        </div>
      </div>
    );
  }

  const grade = (correct) => {
    if (result) return; // already answered
    setResult(correct ? 'right' : 'wrong');
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    rateCard(entry.id, correct ? 'good' : 'again', {
      mode: cardMode,
      skill: 'vocabulary',
      itemLabel: entry.fr,
      source: 'vocab-quiz',
    });
    onRate?.();
    onActivity?.({ type: 'cards', rating: correct ? 'good' : 'again', itemId: entry.id, itemLabel: entry.fr, mode: cardMode });
    if (correct) onXp?.(5);
  };

  const submitTyped = () => {
    if (result || !answer.trim()) return;
    grade(strip(answer) === strip(entry.fr));
  };

  const next = () => {
    setResult(null);
    setAnswer('');
    setIndex((i) => i + 1);
  };

  const progress = Math.round((index / deck.length) * 100);

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Exit quiz" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-sm font-semibold text-ink truncate">{title} · Quiz</h2>
            <p className="text-[11px] text-ink3 tabular-nums">{index + 1}/{deck.length}</p>
          </div>
          <span className="w-10 text-right text-xs font-semibold text-ink3 tabular-nums">{score.right}</span>
        </div>

        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div className="h-full rounded-full bg-ink bar-anim" style={{ width: `${progress}%` }} />
        </div>

        {/* prompt */}
        <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
          {mode === 'choice' && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">What does this mean?</p>
              <p className="text-2xl font-bold text-ink" lang="fr">{entry.fr}</p>
            </>
          )}
          {mode === 'produce' && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Type it in {langName()}</p>
              <p className="text-2xl font-bold text-ink">{entry.en}</p>
              {entry.emoji && <p className="text-3xl">{entry.emoji}</p>}
            </>
          )}
          {mode === 'listen' && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Type what you hear</p>
              <button
                onClick={() => speak(entry.fr)}
                aria-label="Play the word"
                className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-ink text-bg hover:opacity-90"
              >
                <Volume size={26} />
              </button>
            </>
          )}
        </div>

        {/* answer surface */}
        {mode === 'choice' ? (
          <div className="grid gap-2">
            {options.map((opt) => {
              const isRight = opt === entry.en;
              const picked = result && (isRight || (result === 'wrong' && opt === answer));
              const tone = !result
                ? 'bg-surface border-line hover:border-ink3 text-ink'
                : isRight
                  ? 'bg-successsoft border-success text-ink'
                  : opt === answer
                    ? 'bg-surface2 border-ink3 text-ink3 line-through'
                    : 'bg-surface border-line text-ink3 opacity-60';
              return (
                <button
                  key={opt}
                  disabled={!!result}
                  onClick={() => { setAnswer(opt); grade(isRight); }}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${tone}`}
                >
                  <span>{opt}</span>
                  {picked && isRight && <Check size={16} className="text-success shrink-0" />}
                  {result === 'wrong' && opt === answer && !isRight && <X size={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (result ? next() : submitTyped())}
              disabled={!!result}
              placeholder="Type your answer…"
              lang="fr"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Your answer"
              className={`w-full bg-surface border rounded-xl px-4 py-3 text-base text-ink placeholder:text-ink3 focus:outline-none text-center ${
                result === 'right' ? 'border-success' : result === 'wrong' ? 'border-line' : 'border-line focus:border-ink'
              }`}
            />
            {!result && (
              <button onClick={submitTyped} disabled={!answer.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">Check</button>
            )}
          </div>
        )}

        {/* feedback + advance */}
        {result && (
          <div className="space-y-3">
            <div className={`rounded-xl px-4 py-3 text-sm ${result === 'right' ? 'bg-successsoft text-ink' : 'bg-surface2 text-ink'}`}>
              <p className="font-semibold inline-flex items-center gap-1.5">
                {result === 'right' ? <><Check size={15} className="text-success" /> Correct</> : <><X size={15} /> The answer is</>}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-ink" lang="fr">{entry.fr}</span>
                <span className="text-ink2"> — {entry.en}</span>
              </p>
              {entry.example && <p className="text-[12px] text-ink3 mt-1.5 italic" lang="fr">{entry.example}</p>}
            </div>
            <button onClick={next} autoFocus className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
              {index + 1 >= deck.length ? 'See results' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
