import { useEffect, useState } from 'react';
import { GRAMMAR_TOPICS, getGrammarTopic } from '../lib/grammar';
import { getGrammarProgress, recordGrammarQuiz } from '../lib/storage';
import { Drill, SentenceBuilder, Quiz } from './GrammarExercises';
import { Markdown, SpeakButton } from './ui';
import { ChevronLeft, ChevronRight, Book, CheckCircle } from './icons';

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
  const progress = getGrammarProgress();
  void tick;

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
            Reference library and interactive lessons — mastered at a quiz score of 80+.
          </p>
        </div>
        <ul className="space-y-2.5">
          {GRAMMAR_TOPICS.map((t) => {
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
      </div>
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
