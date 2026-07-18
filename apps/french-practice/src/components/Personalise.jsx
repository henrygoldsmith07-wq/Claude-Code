import { useMemo } from 'react';
import {
  getHabits, getGrammarProgress, getSessions, getSrs, getNotebook,
  getDueCardIds,
} from '../lib/storage';
import { allEntries, allEntryIds } from '../lib/vocab';
import { weakEntries, notebookAsEntries } from '../lib/memory';
import {
  LEARNING_STYLES, LESSON_LENGTHS, TOPICS,
  weaknessAnalysis, dailyRecommendations, adaptiveLevel, learningStyle,
} from '../lib/personalise';
import { SCENARIOS } from '../lib/data';
import { X, Check, ChevronRight, Target } from './icons';

// Personalisation (full-screen): choose a learning style, lesson length and
// favourite topics, toggle adaptive difficulty, read a weakness analysis of
// your own data, and get a tailored set of daily recommendations.

function suggestScenario(sessions, favouriteTopics) {
  // Prefer a favourite-topic scenario; else the least-recently practised.
  const favScenarioIds = TOPICS.filter((t) => favouriteTopics.includes(t.id) && t.scenarioId).map((t) => t.scenarioId);
  const lastSeen = {};
  sessions.forEach((s, i) => { lastSeen[s.scenarioId] = i; });
  const fav = SCENARIOS.filter((s) => favScenarioIds.includes(s.id));
  const pool = fav.length ? fav : SCENARIOS;
  const unseen = pool.filter((s) => !(s.id in lastSeen));
  if (unseen.length) return unseen[0];
  return [...pool].sort((a, b) => (lastSeen[a.id] ?? -1) - (lastSeen[b.id] ?? -1))[0];
}

export default function Personalise({ open, onClose, prefs, onPrefsChange, baseLevel, onRun }) {
  const data = useMemo(() => {
    if (!open) return null;
    const srs = getSrs();
    const library = [...allEntries(), ...notebookAsEntries(getNotebook())];
    const sessions = getSessions();
    const dueCount = getDueCardIds([...allEntryIds(), ...getNotebook().map((e) => e.id)]).length;
    const weaknesses = weaknessAnalysis({
      habits: getHabits(),
      grammarProgress: getGrammarProgress(),
      sessions,
      weakWordCount: weakEntries(library, srs).length,
      dueCount,
    });
    const adaptive = adaptiveLevel(baseLevel, sessions, prefs.adaptiveDifficulty);
    const recs = dailyRecommendations({
      prefs,
      weaknesses,
      dueCount,
      suggestedScenario: suggestScenario(sessions, prefs.favouriteTopics),
    });
    return { weaknesses, adaptive, recs };
  }, [open, prefs, baseLevel]);

  if (!open) return null;

  const toggleTopic = (id) => {
    const set = new Set(prefs.favouriteTopics);
    if (set.has(id)) set.delete(id); else set.add(id);
    onPrefsChange({ favouriteTopics: [...set] });
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Personalise">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Personalise</h2>
        <button onClick={onClose} aria-label="Close personalise" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto space-y-6">
          {/* recommended for you */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Recommended for you today</h3>
            <p className="text-[11px] text-ink3 -mt-1">
              Tuned to your {learningStyle(prefs.learningStyle).title.toLowerCase()} style and where you’re weakest.
            </p>
            {data.recs.map((rec) => (
              <button
                key={rec.type}
                onClick={() => onRun(rec.type)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{rec.title}</span>
                  <span className="block text-xs text-ink3">{rec.subtitle}</span>
                </span>
                {rec.badge && (
                  <span className="shrink-0 min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-surface2 text-ink2 text-xs font-semibold tabular-nums">{rec.badge}</span>
                )}
                <ChevronRight size={16} className="text-ink3 shrink-0" />
              </button>
            ))}
          </section>

          {/* weakness analysis */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Weakness analysis</h3>
            {data.weaknesses.length === 0 ? (
              <p className="text-xs text-ink3">No clear weak spots yet — keep practising and this will sharpen.</p>
            ) : (
              data.weaknesses.map((w) => (
                <div key={w.id} className="bg-surface border border-line rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{w.label}</span>
                    <button onClick={() => onRun(w.action.type)} className="text-[11px] font-semibold text-ink2 hover:text-ink shrink-0">
                      {w.action.label} →
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden" role="img" aria-label={`Severity ${Math.round(w.severity * 100)}%`}>
                    <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(8, Math.round(w.severity * 100))}%` }} />
                  </div>
                  <p className="text-[11px] text-ink3">{w.detail}</p>
                </div>
              ))
            )}
          </section>

          {/* learning style */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Learning style</h3>
            <div className="space-y-2">
              {LEARNING_STYLES.map((s) => {
                const on = prefs.learningStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onPrefsChange({ learningStyle: s.id })}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left border transition-colors ${on ? 'bg-surface2 border-ink' : 'bg-surface border-line hover:border-ink3'}`}
                  >
                    <span className="text-xl" role="img" aria-hidden="true">{s.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink">{s.title}</span>
                      <span className="block text-xs text-ink3">{s.desc}</span>
                    </span>
                    {on && <Check size={16} className="text-ink shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* lesson length */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Lesson length</h3>
            <div className="flex gap-2">
              {LESSON_LENGTHS.map((l) => {
                const on = prefs.lessonLength === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => onPrefsChange({ lessonLength: l.id })}
                    aria-pressed={on}
                    className={`flex-1 rounded-xl px-2 py-3 text-center border transition-colors ${on ? 'bg-surface2 border-ink' : 'bg-surface border-line hover:border-ink3'}`}
                  >
                    <span className="block text-sm font-semibold text-ink">{l.title}</span>
                    <span className="block text-[11px] text-ink3">{l.minutes}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink3">
              Sets how many activities your daily recommendations include ({LESSON_LENGTHS.find((l) => l.id === prefs.lessonLength).items}).
            </p>
          </section>

          {/* favourite topics */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Favourite topics</h3>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => {
                const on = prefs.favouriteTopics.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTopic(t.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border transition-colors ${on ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'}`}
                  >
                    <span role="img" aria-hidden="true">{t.emoji}</span> {t.title}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink3">Favourites steer which conversation scenarios get suggested first.</p>
          </section>

          {/* adaptive difficulty */}
          <section className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold text-ink">Adaptive difficulty</span>
                <span className="block text-[11px] text-ink3">Nudge the AI’s level from your recent scores</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.adaptiveDifficulty}
                aria-label="Adaptive difficulty"
                onClick={() => onPrefsChange({ adaptiveDifficulty: !prefs.adaptiveDifficulty })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${prefs.adaptiveDifficulty ? 'bg-accent' : 'bg-line'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-bg border border-line transition-transform ${prefs.adaptiveDifficulty ? 'translate-x-5.5 left-0' : 'left-0.5'}`} />
              </button>
            </label>
            <div className="flex items-center gap-2 text-xs text-ink2 border-t border-line pt-3">
              <Target size={13} className="shrink-0" />
              <span>
                Base level <span className="font-semibold text-ink">{baseLevel}</span>
                {' · '}practising at{' '}
                <span className="font-semibold text-ink">{data.adaptive.level}</span>
                {data.adaptive.shift > 0 && ' (raised — you’re on a strong run)'}
                {data.adaptive.shift < 0 && ' (eased — building back up)'}
                {data.adaptive.shift === 0 && prefs.adaptiveDifficulty && ' (right where you should be)'}
                {!prefs.adaptiveDifficulty && ' (fixed)'}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
