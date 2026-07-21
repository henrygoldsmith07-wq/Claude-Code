import { useState } from 'react';
import { getStreak, getTodayXp, getLastReport, getDueCardIds, getHabits, getNotebook, getWeekXp, getReviewLog, isGettingStartedDismissed, dismissGettingStarted } from '../lib/storage';
import { encouragement } from '../lib/game';
import LearningPath from './LearningPath';
import { SCENARIOS } from '../lib/data';
import { allEntryIds, allEntries } from '../lib/vocab';
import { TrendChart } from './charts';
import { SpeakButton } from './ui';
import { Flame, Target, MessageCircle, Layers, Clock, ChevronRight, Volume, Compass, Sliders, Download, BarChart, Book, Play, SCENARIO_ICONS } from './icons';
import { getSessions } from '../lib/storage';

// Home: the daily loop. Answers "what should I do today?" — goal progress,
// streak state, yesterday's personalized focus, and recommended next steps.

function suggestScenario(sessions) {
  // Recommend the scenario practiced least recently (never-practiced first).
  const lastSeen = {};
  sessions.forEach((s, i) => { lastSeen[s.scenarioId] = i; });
  const unseen = SCENARIOS.filter((s) => !(s.id in lastSeen));
  if (unseen.length) return unseen[0];
  return [...SCENARIOS].sort((a, b) => (lastSeen[a.id] ?? -1) - (lastSeen[b.id] ?? -1))[0];
}

export default function HomeDashboard({ dailyGoal, weeklyGoal, level, path, onStartLesson, onOpenSetup, onNavigate, onOpenRealWorld, onOpenPersonalise, onOpenOffline, onOpenAnalytics, onOpenReference, onOpenFocus, onPickScenario, lastActivity, onResume }) {
  const streak = getStreak();
  const todayXp = getTodayXp();
  const last = getLastReport();
  const dueCount = getDueCardIds([...allEntryIds(), ...getNotebook().map((e) => e.id)]).length;
  const habits = getHabits().slice(0, 3);
  const sessions = getSessions();
  const suggested = suggestScenario(sessions);
  const SuggestedIcon = SCENARIO_ICONS[suggested.id];

  const goalPct = Math.min(100, Math.round((todayXp / Math.max(1, dailyGoal)) * 100));
  const goalDone = todayXp >= dailyGoal;
  const weekXp = getWeekXp();
  const cheer = encouragement({ goalPct, streak: streak.count, day: new Date().toISOString().slice(0, 10) });
  const r = 30;
  const circ = 2 * Math.PI * r;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* learning path: today's lesson + roadmap */}
        <LearningPath
          path={path}
          dueCount={dueCount}
          onStartLesson={onStartLesson}
          onOpenSetup={onOpenSetup}
        />

        {/* daily goal + streak */}
        <section className="flex items-center gap-4 bg-surface border border-line rounded-2xl p-5">
          <div className="relative shrink-0" role="img" aria-label={`Daily goal: ${todayXp} of ${dailyGoal} XP`}>
            <svg width="72" height="72">
              <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r={r} fill="none"
                stroke="var(--ink)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - goalPct / 100)}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.3, 0.8, 0.3, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <Target size={20} className={goalDone ? 'text-ink' : 'text-ink3'} />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">
              {goalDone ? 'Daily goal reached' : 'Today’s goal'}
            </h2>
            <p className="text-xs text-ink2 mt-0.5">
              <span className="font-semibold text-ink">{todayXp}</span> / {dailyGoal} XP
              {!goalDone && ' — one conversation turn earns ~8–10 XP'}
            </p>
            <p className="flex items-center gap-1 text-xs text-ink2 mt-1.5">
              <Flame size={13} className={streak.count > 0 ? 'text-ink' : 'text-ink3'} />
              <span className="font-semibold text-ink">{streak.count}</span>
              day streak · level {level}
            </p>
          </div>
        </section>

        {/* weekly goal + encouraging feedback */}
        <section className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">This week</h3>
            <span className="text-[11px] text-ink3 tabular-nums">{weekXp}/{weeklyGoal} XP</span>
          </div>
          <div className="h-2 rounded-full bg-surface2 overflow-hidden" role="img" aria-label={`Weekly goal: ${weekXp} of ${weeklyGoal} XP`}>
            <div className={`h-full rounded-full transition-all ${weekXp >= weeklyGoal ? 'bg-line' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.round((weekXp / Math.max(1, weeklyGoal)) * 100))}%` }} />
          </div>
          <p className="text-xs text-ink2 leading-relaxed">{cheer}</p>
        </section>

        {/* today's focus — personalized from the last session report */}
        <section className="bg-surface2 border border-line rounded-2xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1.5">Today’s focus</h3>
          {last ? (
            <p className="text-sm text-ink leading-relaxed">{last.report.tomorrow_focus}</p>
          ) : (
            <p className="text-sm text-ink2">
              Finish your first conversation and your coach will set a personalized focus for
              tomorrow — corrections, habits to break, and what to practice next.
            </p>
          )}
        </section>

        {/* continue where you left off — the shortest path back into flow */}
        {lastActivity && (
          <button
            onClick={() => onResume(lastActivity)}
            className="w-full flex items-center gap-3 bg-accent text-onaccent rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity elev-card"
          >
            <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-onaccent/15" aria-hidden="true"><Play size={15} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">Continue where you left off</span>
              <span className="block text-sm font-semibold truncate">{lastActivity.label}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 opacity-70" />
          </button>
        )}

        {/* surprise me: one tap into a random corner of the studio */}
        <button
          onClick={() => {
            const rolls = [
              () => { onPickScenario(SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]); onNavigate('arena'); },
              () => onNavigate('grammar'),
              () => onStartLesson({ type: 'cards' }),
              () => onNavigate('culture'),
              () => onStartLesson({ type: 'dictation' }),
              () => onStartLesson({ type: 'quickfire' }),
            ];
            rolls[Math.floor(Math.random() * rolls.length)]();
          }}
          className="w-full flex items-center gap-3 bg-surface border border-dashed border-line rounded-2xl px-4 py-3 text-left hover:border-ink3 transition-colors"
        >
          <span className="text-xl" aria-hidden="true">🎲</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Surprise me</span>
            <span className="block text-xs text-ink3">Jump into a random corner of the studio</span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        {/* getting-started checklist: live tutorial, replaces the old static tour */}
        <GettingStarted path={path} onStartLesson={onStartLesson} onOpenSetup={onOpenSetup} onNavigate={onNavigate} />

        {/* phrase of the day — deterministic by date, always fresh */}
        <PhraseOfTheDay />

        {/* recurring mistakes accumulated across sessions */}
        {habits.length > 0 && (
          <section className="bg-surface border border-line rounded-2xl p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">Recurring habits</h3>
            <ul className="space-y-2">
              {habits.map((h) => (
                <li key={h.key} className="flex items-start gap-2.5 text-[13px] text-ink leading-snug">
                  {h.count > 1 && (
                    <span className="shrink-0 mt-px px-1.5 py-0.5 rounded-md bg-surface2 text-ink2 text-[10px] font-semibold tabular-nums">
                      ×{h.count}
                    </span>
                  )}
                  <span className={h.count > 1 ? '' : 'text-ink2'}>{h.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink3 mt-2.5">
              Collected from your session reports — repeat offenders rise to the top.
            </p>
          </section>
        )}

        {/* recommended actions */}
        <section className="space-y-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Continue learning</h3>
          <ActionCard
            icon={SuggestedIcon || MessageCircle}
            title={`Practice: ${suggested.title}`}
            subtitle={sessions.length ? 'Your least-practiced scenario' : 'Start your first conversation'}
            onClick={() => { onPickScenario(suggested); onNavigate('arena'); }}
          />
          <ActionCard
            icon={Layers}
            title={dueCount > 0 ? `Review ${dueCount} word${dueCount > 1 ? 's' : ''}` : 'Browse vocabulary packs'}
            subtitle={dueCount > 0 ? 'Due now in your spaced-repetition queue' : 'Nothing due — everything is on schedule'}
            badge={dueCount > 0 ? String(dueCount) : null}
            onClick={() => onNavigate('cards')}
          />
          <ActionCard
            icon={Volume}
            title="Dictée"
            subtitle="Train your ear — type what you hear"
            onClick={() => onStartLesson({ type: 'dictation' })}
          />
          <ActionCard
            icon={Clock}
            title="Quick Fire"
            subtitle="45 seconds of improv to build fluency"
            onClick={() => onStartLesson({ type: 'quickfire' })}
          />
          <ActionCard
            icon={Compass}
            title="Real-world practice"
            subtitle="Survival phrases, roleplay and a mock exam"
            onClick={onOpenRealWorld}
          />
          <ActionCard
            icon={Sliders}
            title="Personalise"
            subtitle="Learning style, topics and a plan tuned to your weak spots"
            onClick={onOpenPersonalise}
          />
          <ActionCard
            icon={Clock}
            title="Focus & habits"
            subtitle="Pomodoro timer, focus mode, habit tracker, streak calendar"
            onClick={onOpenFocus}
          />
          <ActionCard
            icon={Book}
            title="Reference & tools"
            subtitle="Conjugations, minimal pairs, cloze tests, dictionary"
            onClick={onOpenReference}
          />
          <ActionCard
            icon={BarChart}
            title="Analytics"
            subtitle="Time studied, skill breakdown, weekly & monthly reports"
            onClick={onOpenAnalytics}
          />
          <ActionCard
            icon={Download}
            title="Offline & devices"
            subtitle="Use the app offline, save stories, back up your progress"
            onClick={onOpenOffline}
          />
        </section>

        {/* progress trend */}
        {sessions.length >= 2 && (
          <section className="bg-surface border border-line rounded-2xl p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">
              Progress (last {sessions.length} sessions)
            </h3>
            <TrendChart sessions={sessions} />
          </section>
        )}
      </div>
    </div>
  );
}

function ActionCard({ icon: CardIcon, title, subtitle, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
    >
      <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
        <CardIcon size={18} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink truncate">{title}</span>
        <span className="block text-xs text-ink3 truncate">{subtitle}</span>
      </span>
      {badge && (
        <span className="shrink-0 min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-accent text-onaccent text-xs font-semibold">
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-ink3 shrink-0" />
    </button>
  );
}

// Word of the day: a stable daily pick from the full vocabulary library.
function PhraseOfTheDay() {
  const entries = allEntries();
  const day = Math.floor(Date.now() / 86400000);
  const e = entries[day % entries.length];
  if (!e) return null;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">Word of the day</h3>
      <div className="flex items-start gap-3">
        <span className="text-2xl" role="img" aria-hidden="true">{e.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink" lang="fr">{e.fr} <span className="font-normal text-ink3">— {e.en}</span></p>
          <p className="text-xs text-ink2 mt-1" lang="fr">{e.example}</p>
          <p className="text-[11px] text-ink3 italic">{e.exampleEn}</p>
        </div>
        <SpeakButton text={e.fr} label="Listen" />
      </div>
    </section>
  );
}

// A live "first steps" checklist: each item checks off from real activity,
// and the card disappears once everything's done (or when dismissed).
function GettingStarted({ path, onStartLesson, onOpenSetup, onNavigate }) {
  const [dismissed, setDismissed] = useState(isGettingStartedDismissed);
  const reviews = Object.values(getReviewLog()).reduce((a, b) => a + b, 0);
  const items = [
    { done: getSessions().length > 0, label: 'Have your first conversation', go: () => onNavigate('arena') },
    { done: Boolean(path), label: 'Start your learning path', go: onOpenSetup },
    { done: reviews >= 5, label: 'Review 5 flashcards', go: () => onStartLesson({ type: 'cards' }) },
  ];
  const allDone = items.every((i) => i.done);
  if (dismissed || allDone) return null;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Getting started</h3>
        <button
          onClick={() => { dismissGettingStarted(); setDismissed(true); }}
          className="text-[11px] text-ink3 hover:text-ink"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <button key={it.label} onClick={it.done ? undefined : it.go} disabled={it.done}
            className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2 border transition-colors ${
              it.done ? 'border-line bg-surface2 opacity-60' : 'border-line bg-surface hover:border-ink3'
            }`}>
            <span className={`w-5 h-5 shrink-0 grid place-items-center rounded-full border ${it.done ? 'bg-accent text-onaccent border-accent' : 'border-line text-ink3'}`}>
              {it.done && <span className="text-[10px]">✓</span>}
            </span>
            <span className={`text-xs ${it.done ? 'text-ink3 line-through' : 'text-ink'}`}>{it.label}</span>
            {!it.done && <ChevronRight size={13} className="ml-auto text-ink3" />}
          </button>
        ))}
      </div>
    </section>
  );
}
