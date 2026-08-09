import { useEffect, useMemo, useState } from 'react';
import { SITUATIONS } from '../lib/realworld';
import { buildDrillPool, scoreGuess, drillXp } from '../lib/drills';
import { getStarredLines, toggleStarredLine, bumpChallengeMetric, recordSkillScore } from '../lib/storage';
import { speak, stopSpeaking } from '../lib/tts';
import { SpeakButton } from './ui';
import {
  ChevronLeft, ChevronRight, Check, X, Volume, Pencil, Layers, Bookmark, BookmarkFilled, Trophy, Mic,
} from './icons';

// Offline phrase drills: shadowing, EN→FR type-it, and flip cards.
// Pools real-world situations, the phrasebook, and the learner's starred lines.

const MODES = [
  { id: 'shadow', title: 'Shadowing', blurb: 'Listen, then speak along from memory', icon: Mic },
  { id: 'translate', title: 'Say it in French', blurb: 'See English — type the French line', icon: Pencil },
  { id: 'flash', title: 'Flip cards', blurb: 'Reveal French, self-mark', icon: Layers },
];

export default function PhraseDrills({ onXp, initialPool = 'all', onBack }) {
  const [screen, setScreen] = useState({ mode: 'hub' }); // hub | run
  const [poolMode, setPoolMode] = useState(initialPool);
  const [starred, setStarred] = useState(getStarredLines);

  useEffect(() => () => stopSpeaking(), []);

  if (screen.mode === 'run') {
    return (
      <DrillRun
        kind={screen.kind}
        poolMode={poolMode}
        starred={starred}
        onXp={onXp}
        onStarChange={setStarred}
        onBack={() => { stopSpeaking(); setScreen({ mode: 'hub' }); }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-lg mx-auto space-y-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-ink2 hover:text-ink"
          >
            <ChevronLeft size={14} /> Tools
          </button>
        )}

        <div className="text-center space-y-1">
          <p className="text-xs text-ink2">
            Drill real lines offline — shadow, type, or flip. Star phrases in Real-world to build a personal deck.
          </p>
          {starred.length > 0 && (
            <p className="text-[11px] text-ink3 tabular-nums">{starred.length} starred line{starred.length === 1 ? '' : 's'}</p>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink3">Phrase pool</span>
          <select
            value={poolMode}
            onChange={(e) => setPoolMode(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink3"
          >
            <option value="all">All real-world situations</option>
            <option value="starred" disabled={!starred.length}>
              My starred lines{starred.length ? ` (${starred.length})` : ' (empty)'}
            </option>
            {SITUATIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.emoji} {s.title}</option>
            ))}
          </select>
        </label>

        <div className="space-y-2.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={poolMode === 'starred' && !starred.length}
              onClick={() => setScreen({ mode: 'run', kind: m.id })}
              className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors disabled:opacity-40"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
                <m.icon size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink">{m.title}</span>
                <span className="block text-xs text-ink3">{m.blurb}</span>
              </span>
              <ChevronRight size={16} className="text-ink3 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrillRun({ kind, poolMode, starred, onXp, onStarChange, onBack }) {
  const seed = useMemo(() => Date.now(), []);
  const queue = useMemo(
    () => buildDrillPool({ mode: poolMode, starred, limit: 10, seed }),
    [poolMode, starred, seed],
  );
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState(null); // { ok, reveal }
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [awarded, setAwarded] = useState(false);

  const item = queue[idx];
  const total = queue.length;

  useEffect(() => {
    if (done && !awarded) {
      setAwarded(true);
      const xp = drillXp(correct, total);
      onXp?.(xp);
      bumpChallengeMetric('drill', 1);
      recordSkillScore('drill', total ? Math.round((correct / total) * 100) : 0);
    }
  }, [done, awarded, correct, total, onXp]);

  if (!total) {
    return (
      <div className="h-full grid place-items-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-ink2">No phrases in this pool yet.</p>
          <button type="button" onClick={onBack} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">Back</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto space-y-4 text-center">
          <Trophy size={28} className="mx-auto text-ink" />
          <p className="text-3xl font-bold text-ink tabular-nums">{correct}/{total}</p>
          <p className="text-sm text-ink2">
            {correct === total ? 'Perfect run.' : correct >= total * 0.7 ? 'Strong — star the tricky ones.' : 'Keep drilling the same pool.'}
          </p>
          <button type="button" onClick={onBack} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            Back to drills
          </button>
        </div>
      </div>
    );
  }

  const advance = (wasCorrect) => {
    if (wasCorrect) setCorrect((c) => c + 1);
    setGuess('');
    setFeedback(null);
    setRevealed(false);
    stopSpeaking();
    if (idx + 1 >= total) setDone(true);
    else setIdx((i) => i + 1);
  };

  const checkTranslate = () => {
    if (feedback) return;
    const r = scoreGuess(guess, item.fr);
    setFeedback({ ok: r.ok, reveal: item.fr });
  };

  const star = () => {
    const res = toggleStarredLine({
      id: item.id,
      fr: item.fr,
      en: item.en,
      source: item.source,
    });
    onStarChange(res.list);
  };

  const isStarred = starred.some((s) => s.id === item.id);

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">
              {kind === 'shadow' ? 'Shadowing' : kind === 'translate' ? 'Say it in French' : 'Flip cards'}
              {' · '}{idx + 1}/{total}
            </p>
            <p className="text-[11px] text-ink3 truncate">{item.source}</p>
          </div>
          <button
            type="button"
            onClick={star}
            aria-label={isStarred ? 'Unstar phrase' : 'Star phrase'}
            className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2"
          >
            {isStarred ? <BookmarkFilled size={16} className="text-ink" /> : <Bookmark size={16} />}
          </button>
        </div>

        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${Math.round((idx / total) * 100)}%` }} />
        </div>

        {kind === 'shadow' && (
          <div className="space-y-3">
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-3 text-center">
              <p className="text-xs text-ink3">Listen, then say it aloud without looking.</p>
              <button
                type="button"
                onClick={() => speak(item.fr)}
                className="mx-auto flex items-center gap-2 rounded-xl bg-accent text-onaccent px-4 py-3 text-sm font-semibold"
              >
                <Volume size={16} /> Play line
              </button>
              {revealed ? (
                <div className="space-y-1 pt-2 border-t border-line">
                  <p className="text-[15px] font-medium text-ink" lang="fr">{item.fr}</p>
                  <p className="text-xs text-ink3 italic">{item.en}</p>
                </div>
              ) : (
                <button type="button" onClick={() => setRevealed(true)} className="text-xs font-semibold text-ink2 underline">
                  Show text
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => advance(false)} className="flex-1 min-h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-ink2">
                Again
              </button>
              <button type="button" onClick={() => advance(true)} className="flex-1 min-h-11 rounded-xl bg-accent text-onaccent text-sm font-semibold">
                Got it
              </button>
            </div>
          </div>
        )}

        {kind === 'translate' && (
          <div className="space-y-3">
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3 mb-2">English</p>
              <p className="text-[15px] text-ink font-medium leading-relaxed">{item.en}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink3">Your French</span>
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') checkTranslate(); }}
                disabled={feedback != null}
                lang="fr"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type the French…"
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink3"
              />
            </label>
            {feedback == null ? (
              <button type="button" onClick={checkTranslate} disabled={!guess.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm disabled:opacity-40">
                Check
              </button>
            ) : (
              <div className="fade-in space-y-3">
                <div className={`rounded-2xl border px-4 py-3 ${feedback.ok ? 'bg-surface2 border-ink' : 'bg-surface border-line'}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink3 flex items-center gap-1.5">
                    {feedback.ok ? <Check size={12} /> : <X size={12} />}
                    {feedback.ok ? 'Correct' : 'Not quite'}
                  </p>
                  <p className="text-sm text-ink mt-1" lang="fr">{feedback.reveal}</p>
                </div>
                <button type="button" onClick={() => advance(feedback.ok)} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                  {idx + 1 < total ? 'Next' : 'See result'} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {kind === 'flash' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="w-full bg-surface border border-line rounded-2xl p-6 text-center min-h-[140px] hover:border-ink3 transition-colors"
            >
              {!revealed ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink3 mb-2">English — tap to flip</p>
                  <p className="text-[15px] text-ink font-medium leading-relaxed">{item.en}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink3 mb-2">French</p>
                  <p className="text-[15px] text-ink font-medium leading-relaxed" lang="fr">{item.fr}</p>
                  <div className="mt-3 flex justify-center">
                    <SpeakButton text={item.fr} label="Listen" />
                  </div>
                </>
              )}
            </button>
            {revealed && (
              <div className="flex gap-2 fade-in">
                <button type="button" onClick={() => advance(false)} className="flex-1 min-h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-ink2">
                  Hard
                </button>
                <button type="button" onClick={() => advance(true)} className="flex-1 min-h-11 rounded-xl bg-accent text-onaccent text-sm font-semibold">
                  Easy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
