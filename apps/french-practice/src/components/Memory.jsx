import { useMemo, useState } from 'react';
import { allEntries } from '../lib/vocab';
import {
  getSrs, getHabits, reviewHabit, getNotebook, getReviewLog,
  getLearnerErrors, recordLearnerSuccess,
} from '../lib/storage';
import {
  memoryBuckets, weakEntries, curvePoints, heatmapWeeks, totalReviews,
  reviewOutlook, notebookAsEntries,
} from '../lib/memory';
import { ChevronLeft, ChevronRight, Check, X, Layers, Target, Book } from './icons';

// Memory & revision dashboard: retention buckets from the forgetting curve,
// weak-word and mistake drills, custom-flashcard study, and the review
// heatmap. Reviewing a card resets its curve; this page shows the decay.

export default function Memory({ onBack, onOpenDeck, onXp }) {
  const [habitTick, setHabitTick] = useState(0);
  const [errorTick, setErrorTick] = useState(0);
  const habits = useMemo(() => getHabits(), [habitTick]);
  const learnerErrors = useMemo(() => getLearnerErrors({ limit: 8 }), [errorTick]);

  const { entries, buckets, weak, outlook, log } = useMemo(() => {
    const srsMap = getSrs();
    const all = [...allEntries(), ...notebookAsEntries(getNotebook())];
    return {
      entries: all,
      buckets: memoryBuckets(all, srsMap),
      weak: weakEntries(all, srsMap),
      outlook: reviewOutlook(all, srsMap),
      log: getReviewLog(),
    };
  }, []);

  const tracked = entries.length - buckets.fresh.length;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to packs" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-sm font-semibold text-ink">Memory & revision</h2>
            <p className="text-[11px] text-ink3">{tracked} of {entries.length} cards tracked</p>
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>

        {/* today's outlook — the smart-reminder logic, visible */}
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <p className="text-sm text-ink">
            {outlook.dueNow > 0
              ? <><span className="font-semibold">{outlook.dueNow} card{outlook.dueNow > 1 ? 's' : ''} due now.</span>{outlook.slippingSoon > 0 && ` ${outlook.slippingSoon} more slip below 80% recall by tomorrow.`}</>
              : outlook.slippingSoon > 0
                ? `Nothing due yet, but ${outlook.slippingSoon} card${outlook.slippingSoon > 1 ? 's' : ''} will slip below 80% recall by tomorrow — a quick pass now keeps them fresh.`
                : 'All caught up — your queue is clear and nothing is slipping today.'}
          </p>
          {(outlook.dueNow > 0 || outlook.slippingSoon > 0) && (
            <button onClick={() => onOpenDeck('review')} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
              <Layers size={14} /> Start today's review
            </button>
          )}
        </div>

        {/* retention buckets */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Strong', buckets.strong.length, '≥80% recall'],
            ['Fading', buckets.fading.length, '50–80%'],
            ['At risk', buckets.atRisk.length, '<50%'],
            ['New', buckets.fresh.length, 'not seen'],
          ].map(([label, n, hint]) => (
            <div key={label} className="bg-surface border border-line rounded-2xl py-3 px-1">
              <p className="text-xl font-bold text-ink tabular-nums">{n}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink2">{label}</p>
              <p className="text-[9px] text-ink3">{hint}</p>
            </div>
          ))}
        </div>

        {/* forgetting curve */}
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">The forgetting curve</h3>
          <svg viewBox="0 0 100 60" className="w-full" role="img" aria-label="Forgetting curves for new, learning and mastered cards over two weeks">
            <line x1="0" y1="12" x2="100" y2="12" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" className="text-ink3" />
            <text x="1" y="10" fontSize="4.5" className="fill-ink3">80% — review here</text>
            {[
              [1, 'text-ink3'],
              [7, 'text-ink2'],
              [21, 'text-ink'],
            ].map(([s, cls]) => (
              <polyline key={s} points={curvePoints(s, 14, 100, 60)} fill="none" stroke="currentColor" strokeWidth="1.2" className={cls} />
            ))}
          </svg>
          <div className="flex justify-between text-[10px] text-ink3">
            <span>today</span><span>2 weeks</span>
          </div>
          <p className="text-[11px] text-ink3 leading-snug">
            Recall decays fast for new cards (light) and slowly for mastered ones (dark).
            Every successful review resets the curve and flattens it — that's why the
            queue calls a card back just as it nears 80%.
          </p>
        </div>

        {/* drills */}
        <div className="space-y-2.5">
          <DrillCard
            icon={Target}
            title="Weak words"
            subtitle={weak.length ? `${weak.length} word${weak.length > 1 ? 's' : ''} you keep missing — drill them` : 'No stumblers yet — misses land here'}
            badge={weak.length || null}
            disabled={!weak.length}
            onClick={() => onOpenDeck('weak')}
          />
          <DrillCard
            icon={Book}
            title="My flashcards"
            subtitle="Study the custom cards from your notebook"
            onClick={() => onOpenDeck('notebook')}
          />
        </div>

        {/* mistake review */}
        <MistakeReview habits={habits} onChange={() => setHabitTick((t) => t + 1)} onXp={onXp} />
        <LearnerMistakeReview
          errors={learnerErrors}
          onChange={() => setErrorTick((t) => t + 1)}
          onXp={onXp}
        />

        {/* heatmap */}
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Review heatmap</h3>
            <span className="text-[11px] text-ink3 tabular-nums">{totalReviews(log)} reviews · 15 weeks</span>
          </div>
          <Heatmap log={log} />
        </div>

        <FsrsLegend />
        {/* the learning science behind it all */}
        <TheScience />
      </div>
    </div>
  );
}

// Makes the evidence-based method transparent — the five findings the whole
// review system is built on, so learners trust (and lean into) the approach.
function TheScience() {
  const points = [
    ['Spaced repetition (FSRS 4.5)', 'Evidence-based scheduler (Stability, Difficulty, Retrievability) — now with separate receptive/productive queues; falls back to SM-2 for legacy cards.'],
    ['Retrieval practice', 'You recall before you check. Effortful retrieval — not re-reading — is what builds durable memory (the “testing effect”).'],
    ['Desirable difficulty', 'The queue serves each card just as it nears the forgetting threshold, where one review does the most work.'],
    ['Interleaving', 'Due words are mixed across packs rather than blocked by topic, which improves discrimination and transfer.'],
    ['Frequency first', 'Ties favour the most common words — the ~1,000 that cover most of everyday speech — so effort compounds fastest.'],
  ];
  return (
    <details className="bg-surface2 border border-line rounded-2xl px-5 py-4">
      <summary className="text-[11px] font-bold uppercase tracking-wider text-ink2 cursor-pointer">The science behind this</summary>
      <ul className="mt-3 space-y-2.5">
        {points.map(([t, d]) => (
          <li key={t}>
            <p className="text-[13px] font-semibold text-ink">{t}</p>
            <p className="text-[11px] text-ink3 leading-snug">{d}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DrillCard({ icon: DrillIcon, title, subtitle, badge, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors disabled:opacity-50 disabled:hover:border-line"
    >
      <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><DrillIcon size={18} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink3">{subtitle}</span>
      </span>
      {badge != null && (
        <span className="shrink-0 min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-surface2 text-ink2 text-xs font-semibold tabular-nums">{badge}</span>
      )}
      <ChevronRight size={16} className="text-ink3 shrink-0" />
    </button>
  );
}

// Flip through the recurring-mistake bank: "got it" burns the mistake down
// (removed once its count hits zero), "still shaky" keeps it in rotation.
function MistakeReview({ habits, onChange, onXp }) {
  const [idx, setIdx] = useState(0);
  const habit = habits[idx % Math.max(1, habits.length)];

  const answer = (gotIt) => {
    reviewHabit(habit.key, gotIt);
    if (gotIt) onXp(2);
    onChange();
    setIdx((i) => i + 1);
  };

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Mistake review</h3>
        {habits.length > 0 && <span className="text-[11px] text-ink3 tabular-nums">{habits.length} in the bank</span>}
      </div>
      {!habits.length ? (
        <p className="text-xs text-ink3">
          Your mistake bank is empty. Finish Arena sessions and recurring slip-ups
          collect here for targeted revision.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink leading-relaxed">{habit.text}</p>
          <p className="text-[11px] text-ink3">
            Seen ×{habit.count} — can you catch and correct this one now?
          </p>
          <div className="flex gap-2">
            <button onClick={() => answer(false)} className="btn btn-secondary flex-1 min-h-11 rounded-xl text-xs">
              <X size={13} /> Still shaky
            </button>
            <button onClick={() => answer(true)} className="btn btn-primary flex-1 min-h-11 rounded-xl text-xs">
              <Check size={13} /> Got it now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LearnerMistakeReview({ errors, onChange, onXp }) {
  const [idx, setIdx] = useState(0);
  const error = errors[idx % Math.max(1, errors.length)];

  const answer = (gotIt) => {
    if (gotIt && error) {
      recordLearnerSuccess({
        category: error.category,
        key: error.key,
        label: error.label,
        mode: 'mistake-review',
        score: 100,
        source: 'cross-mode-recycle',
      });
      onXp(2);
    }
    onChange();
    setIdx((i) => i + 1);
  };

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Cross-mode mistake recycling</h3>
        {errors.length > 0 && <span className="text-[11px] text-ink3 tabular-nums">{errors.length} gaps</span>}
      </div>
      {!error ? (
        <p className="text-xs text-ink3">Grammar, vocabulary, listening and pronunciation gaps will collect here and follow you between modes.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0 px-2 py-1 rounded-full border border-line bg-surface2 text-[10px] font-bold uppercase tracking-wider text-ink3">{error.category}</span>
            <p className="text-sm text-ink leading-relaxed">{error.label}</p>
          </div>
          <p className="text-[11px] text-ink3">
            Missed ×{error.errorCount} · seen in {error.modes.length ? error.modes.join(', ') : 'more than one mode'} · {error.status}
          </p>
          <div className="flex gap-2">
            <button onClick={() => answer(false)} className="btn btn-secondary flex-1 min-h-11 rounded-xl text-xs">
              <X size={13} /> Still shaky
            </button>
            <button onClick={() => answer(true)} className="btn btn-primary flex-1 min-h-11 rounded-xl text-xs">
              <Check size={13} /> Got it twice
            </button>
          </div>
          <p className="text-[10px] text-ink3">Two clean passes move a gap to resolved; the same error returns if it recurs.</p>
        </div>
      )}
    </div>
  );
}

function FsrsLegend(){ return (<div className="bg-surface border border-line rounded-2xl p-4 space-y-2"><h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">FSRS recall</h3><p className="text-[11px] text-ink3 leading-snug">FSRS predicts <em>R = e^(ln 0.9 · t / S)</em> recall from Stability S. Productive (EN→FR) unlocks after 2 good receptive reviews so production is tested once recognition is stable. Old SM-2 cards migrate on next rating.</p></div>); }
function Heatmap({ log }) {
  const grid = useMemo(() => heatmapWeeks(log, 15), [log]);
  const shades = [
    'bg-surface2',
    'bg-line',
    'bg-ink3',
    'bg-ink2',
    'bg-ink',
  ];
  return (
    <div className="space-y-2">
      <div className="flex gap-1 justify-between" role="img" aria-label="Daily review activity for the last 15 weeks">
        {grid.map((week, w) => (
          <div key={w} className="flex flex-col gap-1 flex-1">
            {week.map((d) => (
              <span
                key={d.day}
                title={`${d.day}: ${d.count} review${d.count !== 1 ? 's' : ''}`}
                className={`aspect-square w-full rounded-[3px] ${shades[d.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-ink3">
        Less
        {shades.map((s, i) => <span key={i} className={`w-2.5 h-2.5 rounded-[3px] ${s}`} />)}
        More
      </div>
    </div>
  );
}
