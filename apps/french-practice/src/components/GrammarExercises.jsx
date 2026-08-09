import { useMemo, useState } from 'react';
import { Check, X, RefreshCw } from './icons';

// Interactive grammar exercises: MCQ drills with instant feedback + a why,
// tap-to-order sentence building, and a scored quiz. All local.

export function Drill({ items }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);

  const item = items[index];
  const answered = picked != null;
  const correct = picked === item.answer;

  const next = () => {
    setPicked(null);
    setIndex((i) => (i + 1) % items.length);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink3 tabular-nums">Drill {index + 1}/{items.length}</p>
      <p className="text-[15px] text-ink leading-relaxed" lang="fr">{item.q}</p>
      <div className="space-y-2" role="radiogroup" aria-label="Answer options">
        {item.options.map((opt, i) => {
          let cls = 'border-line bg-surface text-ink2 hover:border-ink3';
          if (answered && i === item.answer) cls = 'border-ink bg-surface2 text-ink font-semibold';
          else if (answered && i === picked) cls = 'border-line bg-surface text-ink3 line-through';
          return (
            <button
              key={i}
              role="radio"
              aria-checked={picked === i}
              disabled={answered}
              onClick={() => setPicked(i)}
              lang="fr"
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="fade-in bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink">
          <span className="inline-flex items-baseline gap-1.5">
            {correct ? <Check size={13} className="self-center" /> : <X size={13} className="self-center" />}
            <span>{item.why}</span>
          </span>
        </div>
      )}
      {answered && (
        <button onClick={next} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
          Next drill
        </button>
      )}
    </div>
  );
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function SentenceBuilder({ items }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState([]); // indexes into the tile array
  const [checked, setChecked] = useState(null); // true/false once verified

  const item = items[index];
  const target = useMemo(() => item.fr.split(/\s+/), [item]);
  const tiles = useMemo(() => {
    // Reshuffle until the order differs from the answer (for short sentences).
    let t = shuffle(target.map((word, i) => ({ word, i })));
    if (t.map((x) => x.word).join(' ') === item.fr) t = [...t].reverse();
    return t;
  }, [item, target]);

  const remaining = tiles.filter((t) => !chosen.includes(t.i));
  const sentence = chosen.map((i) => target[i]).join(' ');

  const check = () => setChecked(sentence === item.fr);

  const next = () => {
    setChosen([]);
    setChecked(null);
    setIndex((i) => (i + 1) % items.length);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink3 tabular-nums">Sentence {index + 1}/{items.length}</p>
      <p className="text-sm text-ink2">Build: <span className="text-ink font-medium">“{item.en}”</span></p>

      {/* the sentence under construction */}
      <div
        className="min-h-14 bg-surface border border-line rounded-xl px-3 py-2.5 flex flex-wrap gap-1.5 items-center"
        aria-label="Your sentence"
        lang="fr"
      >
        {chosen.length === 0 && <span className="text-xs text-ink3">Tap the words below in order…</span>}
        {chosen.map((ti, pos) => (
          <button
            key={pos}
            onClick={() => !checked && setChosen((c) => c.filter((x) => x !== ti))}
            className="px-2.5 py-1.5 rounded-lg bg-accent text-onaccent text-sm"
          >
            {target[ti]}
          </button>
        ))}
      </div>

      {/* word tiles */}
      <div className="flex flex-wrap gap-1.5">
        {remaining.map((t) => (
          <button
            key={t.i}
            onClick={() => checked == null && setChosen((c) => [...c, t.i])}
            lang="fr"
            className="px-2.5 py-1.5 rounded-lg bg-surface2 border border-line text-ink text-sm hover:border-ink3"
          >
            {t.word}
          </button>
        ))}
      </div>

      {checked == null ? (
        <button
          onClick={check}
          disabled={chosen.length !== target.length}
          className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
        >
          Check sentence
        </button>
      ) : (
        <div className="space-y-2 fade-in">
          <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink">
            <span className="inline-flex items-baseline gap-1.5">
              {checked ? <Check size={13} className="self-center" /> : <X size={13} className="self-center" />}
              <span>{checked ? 'Exactly right.' : <>Not quite — it's <span lang="fr" className="font-semibold">« {item.fr} »</span></>}</span>
            </span>
          </div>
          <button onClick={next} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
            <RefreshCw size={13} /> Next sentence
          </button>
        </div>
      )}
    </div>
  );
}

export function Quiz({ items, onFinish }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const item = items[index];
  const answered = picked != null;

  const next = () => {
    const gained = picked === item.answer ? 1 : 0;
    const total = correctCount + gained;
    setCorrectCount(total);
    setPicked(null);
    if (index + 1 < items.length) {
      setIndex(index + 1);
    } else {
      const score = Math.round((total / items.length) * 100);
      setDone(true);
      onFinish(score);
    }
  };

  if (done) {
    const score = Math.round((correctCount / items.length) * 100);
    return (
      <div className="text-center space-y-3 fade-in">
        <div className="w-20 h-20 mx-auto grid place-items-center rounded-full border-2 border-ink text-xl font-bold text-ink tabular-nums">
          {score}%
        </div>
        <p className="text-sm text-ink2">
          {correctCount}/{items.length} correct.{' '}
          {score >= 80 ? 'Topic mastered — it counts toward your reference badges.' : 'Reread the explanation and try again.'}
        </p>
        <button
          onClick={() => { setIndex(0); setCorrectCount(0); setDone(false); }}
          className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm"
        >
          <RefreshCw size={13} /> Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-1 rounded-full bg-surface2 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-ink transition-all duration-300" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <p className="text-[11px] text-ink3 tabular-nums">Question {index + 1}/{items.length}</p>
      <p className="text-[15px] text-ink leading-relaxed" lang="fr">{item.q}</p>
      <div className="space-y-2" role="radiogroup" aria-label="Answer options">
        {item.options.map((opt, i) => {
          let cls = 'border-line bg-surface text-ink2 hover:border-ink3';
          if (answered && i === item.answer) cls = 'border-ink bg-surface2 text-ink font-semibold';
          else if (answered && i === picked) cls = 'border-line bg-surface text-ink3 line-through';
          else if (picked === i) cls = 'border-ink bg-surface2 text-ink font-semibold';
          return (
            <button
              key={i}
              role="radio"
              aria-checked={picked === i}
              disabled={answered}
              onClick={() => setPicked(i)}
              lang="fr"
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="fade-in bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink2">
          {item.why}
        </div>
      )}
      {answered && (
        <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
          {index + 1 < items.length ? 'Next question' : 'See my score'}
        </button>
      )}
    </div>
  );
}
