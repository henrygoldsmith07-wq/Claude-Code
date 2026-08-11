import { useEffect, useMemo, useState } from 'react';
import { GRAMMAR_TOPICS, getGrammarTopic, grammarTopicOfDay, grammarStatsByCefr } from '../lib/grammar';
import { getGrammarProgress, recordGrammarQuiz, bumpChallengeMetric } from '../lib/storage';
import { Drill, SentenceBuilder, Quiz } from './GrammarExercises';
import { Markdown, SpeakButton } from './ui';
import { ERROR_CATEGORIES, categoryForTopic, categoriesForErrors } from '../lib/errorTaxonomy';
import { getGrammarErrors } from '../lib/storage';
import { ChevronLeft, ChevronRight, Book, CheckCircle, Search, Target } from './icons';

// Accent- and case-insensitive haystack match, so «etre» finds «être».
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// The six CEFR bands, in learning order — the spine of the level filter.
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Grammar reference library + interactive lessons. Each topic is a small
// four-step lesson: Learn (explanation) → Drill → Build → Quiz (scored,
// best kept). A topic counts as mastered at a quiz best of 80+.

const STEPS = [
  ['learn', 'Learn'],
  ['drill', 'Drill'],
  ['build', 'Build'],
  ['quiz', 'Quiz'],
];

export default function Grammar({ focusTopicId, onFocusConsumed, onXp, onActivity }) {
  const [topicId, setTopicId] = useState(null);
  const [tick, setTick] = useState(0);
  const [level, setLevel] = useState('all');
  const [query, setQuery] = useState('');
  const progress = getGrammarProgress();
  void tick;
  const tip = useMemo(() => grammarTopicOfDay(), []);
  const byCefr = useMemo(() => grammarStatsByCefr(), []);
  const masteredCount = useMemo(
    () => GRAMMAR_TOPICS.filter((t) => (progress[t.id]?.best ?? 0) >= 80).length,
    [progress, tick],
  );

  // Only offer level chips that actually exist in the library, in CEFR order.
  const levels = useMemo(
    () => CEFR_ORDER.filter((c) => GRAMMAR_TOPICS.some((t) => t.cefr === c)),
    [],
  );
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return GRAMMAR_TOPICS.filter((t) => {
      if (level !== 'all' && t.cefr !== level) return false;
      if (q.length >= 2 && !norm(`${t.title} ${t.summary}`).includes(q)) return false;
      return true;
    });
  }, [level, query]);

  // A "grammar tip" tap in the Arena deep-links straight into a topic.
  useEffect(() => {
    if (focusTopicId && getGrammarTopic(focusTopicId)) {
      setTopicId(focusTopicId);
      onFocusConsumed?.();
    }
  }, [focusTopicId, onFocusConsumed]);

  if (topicId) {
    return (
      <TopicLesson
        topic={getGrammarTopic(topicId)}
        best={progress[topicId]?.best ?? null}
        onBack={() => setTopicId(null)}
        onQuizFinish={(score) => {
          recordGrammarQuiz(topicId, score);
          onXp(Math.max(1, Math.round(score / 10)));
          onActivity?.({ type: 'grammar', topicId, score });
          bumpChallengeMetric('grammar', 1);
          setTick((t) => t + 1);
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">Grammar</h2>
          <p className="text-xs text-ink2 mt-1">
            {GRAMMAR_TOPICS.length} interactive topics · Learn → Drill → Build → Quiz
          </p>
          <p className="text-[11px] text-ink3 mt-1 tabular-nums">
            {masteredCount}/{GRAMMAR_TOPICS.length} mastered (quiz ≥ 80%)
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-surface2 overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full bg-ink rounded-full transition-all"
              style={{ width: `${Math.round((masteredCount / Math.max(1, GRAMMAR_TOPICS.length)) * 100)}%` }}
            />
          </div>
          <ErrorTaxonomyStrip />
          <p className="text-[10px] text-ink3 mt-2 tabular-nums">
            {CEFR_ORDER.filter((c) => byCefr[c]).map((c) => `${c}: ${byCefr[c]}`).join(' · ')}
          </p>
        </div>

        {tip && (
          <button
            type="button"
            onClick={() => setTopicId(tip.id)}
            className="w-full text-left bg-surface border border-line rounded-2xl px-4 py-3.5 hover:border-ink3 transition-colors flex items-start gap-3"
          >
            <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
              <Target size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink3">Topic of the day</span>
              <span className="block text-sm font-semibold text-ink" lang="fr">{tip.title}</span>
              <span className="block text-xs text-ink2 mt-0.5">{tip.summary}</span>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{tip.cefr}</span>
            </span>
          </button>
        )}

        {/* find a topic: search by name, then narrow to your CEFR level */}
        <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3">
          <Search size={15} className="text-ink3 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics…"
            aria-label="Search grammar topics"
            className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink3 focus:outline-none py-2.5"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto snap-rail -mx-1 px-1 pb-0.5" role="tablist" aria-label="Filter by CEFR level">
          {['all', ...levels].map((lvl) => (
            <button
              key={lvl}
              role="tab"
              aria-selected={level === lvl}
              onClick={() => setLevel(lvl)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                level === lvl ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'
              }`}
            >
              {lvl === 'all' ? 'All levels' : lvl}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink3 px-1 tabular-nums">
          {filtered.length} of {GRAMMAR_TOPICS.length} topic{GRAMMAR_TOPICS.length === 1 ? '' : 's'}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-10 space-y-1">
            <p className="text-sm text-ink2">No topics match.</p>
            <button onClick={() => { setQuery(''); setLevel('all'); }} className="text-xs text-ink3 underline hover:text-ink">
              Clear filters
            </button>
          </div>
        ) : (
        <ul className="space-y-2.5">
          {filtered.map((t) => {
            const p = progress[t.id];
            const mastered = (p?.best ?? 0) >= 80;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setTopicId(t.id)}
                  className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
                >
                  <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
                    {mastered ? <CheckCircle size={18} /> : <Book size={18} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink truncate" lang="fr">{t.title}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{t.cefr}</span>
                    </span>
                    <span className="block text-xs text-ink3 truncate">{t.summary}</span>
                    {p && (
                      <span className="block text-[10px] text-ink3 mt-0.5 tabular-nums">
                        Best quiz: {p.best}% · {p.attempts} attempt{p.attempts > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className="text-ink3 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
        )}
      </div>
    </div>
  );
}

function ErrorTaxonomyStrip(){
  const cats = categoriesForErrors(getGrammarErrors()).slice(0,4);
  if(!cats.length) return null;
  return (
    <div className="mt-3 bg-surface border border-line rounded-xl p-3 space-y-1.5 text-left max-w-md mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Weakest error categories</p>
      {cats.map(c=> (
        <div key={c.id} className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink">{c.label}</span>
          <span className="text-[11px] text-ink3">{c.count} · {c.cue}</span>
        </div>
      ))}
    </div>
  );
}
function TopicLesson({ topic, best, onBack, onQuizFinish }) {
  const [step, setStep] = useState('learn');

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to grammar library" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-sm font-semibold text-ink truncate" lang="fr">{topic.title}</h2>
            <p className="text-[11px] text-ink3">
              CEFR {topic.cefr}{best != null && ` · best quiz ${best}%`}
            </p>
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>

        {/* lesson stepper */}
        <div className="flex rounded-xl border border-line overflow-hidden" role="tablist" aria-label="Lesson steps">
          {STEPS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={step === id}
              onClick={() => setStep(id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                step === id ? 'bg-accent text-onaccent' : 'bg-surface text-ink2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5">
          {step === 'learn' && (
            <div className="space-y-4">
              <Markdown className="text-sm text-ink leading-relaxed">{topic.explanation.rule}</Markdown>
              <div className="space-y-2.5">
                {topic.explanation.examples.map((ex, i) => (
                  <div key={i} className="border-l-2 border-line pl-3">
                    <p className="text-sm text-ink flex items-center gap-2" lang="fr">
                      {ex.fr} <SpeakButton text={ex.fr} label="Listen" />
                    </p>
                    <p className="text-xs text-ink3 italic">{ex.en}</p>
                  </div>
                ))}
              </div>
              <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Watch out</p>
                <p className="text-xs text-ink2 leading-relaxed">{topic.explanation.watchOut}</p>
              </div>
              <button onClick={() => setStep('drill')} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                Practice it
              </button>
            </div>
          )}
          {step === 'drill' && <Drill items={topic.drills} />}
          {step === 'build' && <SentenceBuilder items={topic.build} />}
          {step === 'quiz' && <Quiz items={topic.quiz} onFinish={onQuizFinish} />}
        </div>
      </div>
    </div>
  );
}
