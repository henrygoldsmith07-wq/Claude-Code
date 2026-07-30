import { useState } from 'react';
import { getStreak, getTodayXp, getLastReport, getSrs, getHabits, getNotebook, getWeekXp, getReviewLog, getGrammarProgress, getMetrics, getSettings, isGettingStartedDismissed, dismissGettingStarted, getTimeLog, getCoins, getChallengeState, getAchievements, getXp, getRepairableStreak, canFreeRepairThisWeek, repairStreak, reviewHabit } from '../lib/storage';
import { wordOfDay } from '../lib/wordOfDay';
import { encouragement, dailyChallenges, leagueTier, weeklyLeague, ACHIEVEMENTS, levelFromXp } from '../lib/game';
import { wordsLearned, fmtDuration } from '../lib/analytics';
import { getPhrasebook } from '../lib/phrasebook';
import { dueEntries, notebookAsEntries } from '../lib/memory';
import LearningPath from './LearningPath';
import { getScenarios } from '../lib/data';
import { allEntries } from '../lib/vocab';
import { TrendChart } from './charts';
import { SpeakButton } from './ui';
import { Flame, Target, MessageCircle, Layers, Clock, ChevronRight, Volume, Play, Check, Coins, Trophy, SCENARIO_ICONS } from './icons';
import { getSessions } from '../lib/storage';

// Home: the daily loop. Answers "what should I do today?" — goal progress,
// streak state, yesterday's personalized focus, and recommended next steps.

function suggestScenario(sessions) {
  // Recommend the scenario practiced least recently (never-practiced first).
  const lastSeen = {};
  sessions.forEach((s, i) => { lastSeen[s.scenarioId] = i; });
  const unseen = getScenarios().filter((s) => !(s.id in lastSeen));
  if (unseen.length) return unseen[0];
  return [...getScenarios()].sort((a, b) => (lastSeen[a.id] ?? -1) - (lastSeen[b.id] ?? -1))[0];
}

export default function HomeDashboard({ dailyGoal, weeklyGoal, level, path, onStartLesson, onOpenSetup, onNavigate, onOpenRealWorld, onOpenPersonalise, onOpenOffline, onOpenAnalytics, onOpenReference, onOpenFocus, onOpenProfile, onPickScenario, lastActivity, onResume }) {
  const [homeTick, setHomeTick] = useState(0);
  void homeTick;
  const streak = getStreak();
  const todayXp = getTodayXp();
  const last = getLastReport();
  const dueCount = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], getSrs()).length;
  const habits = getHabits().slice(0, 3);
  const sessions = getSessions();
  const suggested = suggestScenario(sessions);
  const SuggestedIcon = SCENARIO_ICONS[suggested.id];

  const goalPct = Math.min(100, Math.round((todayXp / Math.max(1, dailyGoal)) * 100));
  const goalDone = todayXp >= dailyGoal;
  const weekXp = getWeekXp();
  const today = new Date().toISOString().slice(0, 10);
  const cheer = encouragement({ goalPct, streak: streak.count, day: today });
  const r = 30;
  const circ = 2 * Math.PI * r;

  // Greeting + a concrete "today's plan": four tasks, each ticking off from
  // real activity, so the most important things are visible the instant the
  // app opens.
  const name = (getSettings().name || '').trim();
  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}${name ? `, ${name}` : ''}`;
  const isToday = (ts) => String(ts || '').slice(0, 10) === today;
  const plan = [
    { key: 'review', tone: 'review', label: dueCount > 0 ? `Review ${dueCount} word${dueCount > 1 ? 's' : ''}` : 'Review your words',
      done: (getReviewLog()[today] || 0) > 0, onClick: () => onNavigate('cards') },
    { key: 'grammar', tone: 'accent', label: 'Complete a grammar lesson',
      done: Object.values(getGrammarProgress()).some((g) => isToday(g.lastAt)), onClick: () => onNavigate('grammar') },
    { key: 'roleplay', tone: 'speak', label: `Finish the ${suggested.title} roleplay`,
      done: sessions.some((s) => isToday(s.date)), onClick: () => { onPickScenario(suggested); onNavigate('arena'); } },
    { key: 'story', tone: 'accent', label: 'Read or listen to a story',
      done: getMetrics().some((m) => (m.skill === 'reading' || m.skill === 'listening') && isToday(m.at)), onClick: () => onNavigate('skills') },
  ];
  const planDone = plan.filter((t) => t.done).length;
  const dotTone = { review: 'text-review', speak: 'text-speak', accent: 'text-ink3' };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Daily brief: primary speaking CTA + session length presets */}
        <section className="bg-accent text-onaccent rounded-2xl px-4 py-4 space-y-3 elev-card">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-onaccent/15" aria-hidden="true"><MessageCircle size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Today’s speaking</p>
              <p className="text-sm font-semibold leading-snug mt-0.5">
                {last?.report?.tomorrow_focus
                  ? last.report.tomorrow_focus
                  : dueCount > 0
                    ? `${dueCount} card${dueCount === 1 ? '' : 's'} due — then a short roleplay.`
                    : `Try “${suggested.title}” for a focused session.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Session length">
            {[5, 10, 15].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem('fp.sessionMins', String(mins)); } catch { /* ignore */ }
                  onPickScenario(suggested);
                  onNavigate('arena');
                }}
                className="rounded-xl bg-onaccent/15 hover:bg-onaccent/25 px-3 py-2 text-xs font-bold transition-colors"
              >
                {mins} min
              </button>
            ))}
            <button
              type="button"
              onClick={() => { onPickScenario(suggested); onNavigate('arena'); }}
              className="rounded-xl bg-onaccent text-accent px-3 py-2 text-xs font-bold ml-auto"
            >
              Start roleplay
            </button>
          </div>
        </section>

        {getRepairableStreak() != null && canFreeRepairThisWeek() && (
          <button
            type="button"
            onClick={() => {
              if (repairStreak({ free: true }) != null) setHomeTick((t) => t + 1);
            }}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left text-sm font-semibold text-ink hover:border-ink3 transition-colors"
          >
            Free streak repair this week — restore {getRepairableStreak()} days (one free repair / week)
          </button>
        )}

        {/* Word of the day — Memrise / Duolingo daily vocab bite */}
        {(() => {
          const w = wordOfDay();
          if (!w) return null;
          return (
            <section className="bg-surface border border-line rounded-2xl px-4 py-3.5 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Word of the day</p>
              <p className="text-lg font-bold text-ink" lang="fr">{w.fr}</p>
              <p className="text-sm text-ink2">{w.en}</p>
              {w.example && (
                <p className="text-xs text-ink3 leading-relaxed" lang="fr">
                  {w.example}
                  {w.exampleEn ? <span className="block text-ink3/80 not-italic" lang="en">{w.exampleEn}</span> : null}
                </p>
              )}
            </section>
          );
        })()}

        {/* Mistake review — Duolingo practice mistakes bank */}
        {getHabits().filter((h) => (h.count || 0) > 0).length > 0 && (
          <section className="bg-surface border border-line rounded-2xl px-4 py-3.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Practice mistakes</p>
              <span className="text-[11px] text-ink3 tabular-nums">
                {getHabits().filter((h) => (h.count || 0) > 0).length} open
              </span>
            </div>
            {getHabits().filter((h) => (h.count || 0) > 0).slice(0, 3).map((h) => (
              <div key={h.key} className="flex items-center gap-2 rounded-xl bg-surface2 border border-line px-3 py-2">
                <p className="flex-1 text-sm text-ink min-w-0 truncate" title={h.text}>{h.text}</p>
                <button
                  type="button"
                  className="text-[11px] font-bold text-ink shrink-0 px-2 py-1 rounded-lg border border-line hover:bg-surface"
                  onClick={() => { reviewHabit(h.key, true); setHomeTick((t) => t + 1); }}
                >
                  Got it
                </button>
              </div>
            ))}
          </section>
        )}

        {/* resume in-progress activity */}
        {lastActivity && (
          <button
            onClick={() => onResume(lastActivity)}
            className="w-full flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors elev-card"
          >
            <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface2" aria-hidden="true"><Play size={15} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink3">Pick up where you left off</span>
              <span className="block text-sm font-semibold truncate text-ink">{lastActivity.label}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ink3" />
          </button>
        )}

        {/* learning path: today's lesson + roadmap */}
        <LearningPath
          path={path}
          dueCount={dueCount}
          onStartLesson={onStartLesson}
          onOpenSetup={onOpenSetup}
        />

        {/* greeting + today's plan — everything important, up front */}
        <section className="bg-surface border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" role="img" aria-label={`Daily goal: ${todayXp} of ${dailyGoal} XP`}>
              <svg width="72" height="72">
                <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r={r} fill="none"
                  stroke={goalDone ? 'var(--success)' : 'var(--ink)'} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - goalPct / 100)}
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.3, 0.8, 0.3, 1), stroke 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                {goalDone ? <Check size={22} className="text-success" /> : <Target size={20} className="text-ink3" />}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-ink truncate">{greeting}</h2>
              <p className="text-xs text-ink2 mt-0.5">
                <span className="font-semibold text-ink tabular-nums">{todayXp}</span>/{dailyGoal} XP today
              </p>
              <p className="flex items-center gap-1.5 text-xs text-ink2 mt-1">
                <Flame size={13} className={streak.count > 0 ? 'text-review' : 'text-ink3'} />
                <span className="font-semibold text-ink tabular-nums">{streak.count}</span> day streak
                <span className="text-ink3">· level {level}</span>
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Today’s focus</h3>
              <span className="text-[11px] text-ink3 tabular-nums">{planDone}/{plan.length} done</span>
            </div>
            <div className="space-y-1.5">
              {plan.map((t) => (
                <button
                  key={t.key}
                  onClick={t.onClick}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border text-left transition-colors ${
                    t.done ? 'bg-successsoft border-line' : 'bg-surface2 border-line hover:border-ink3'
                  }`}
                >
                  <span className={`w-5 h-5 shrink-0 grid place-items-center rounded-full border ${
                    t.done ? 'bg-success border-success text-white' : `border-line ${dotTone[t.tone]}`
                  }`}>
                    {t.done ? <Check size={12} /> : <span className={`w-1.5 h-1.5 rounded-full ${t.tone === 'review' ? 'bg-review' : t.tone === 'speak' ? 'bg-speak' : 'bg-ink3'}`} />}
                  </span>
                  <span className={`flex-1 text-sm ${t.done ? 'text-ink3 line-through' : 'text-ink'}`}>{t.label}</span>
                  {!t.done && <ChevronRight size={14} className="text-ink3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* getting-started checklist for new users (auto-hides once done) */}
        <GettingStarted path={path} onStartLesson={onStartLesson} onOpenSetup={onOpenSetup} onNavigate={onNavigate} />

        {/* ── your progress today ── */}
        {/* today at a glance — daily stats strip */}
        <GlanceStats srs={getSrs()} sessions={sessions} />

        {/* weekly goal + encouraging feedback */}
        <section className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">This week</h3>
            <span className="text-[11px] text-ink3 tabular-nums">{weekXp}/{weeklyGoal} XP</span>
          </div>
          <div className="h-2 rounded-full bg-surface2 overflow-hidden" role="img" aria-label={`Weekly goal: ${weekXp} of ${weeklyGoal} XP`}>
            <div className={`h-full rounded-full bar-anim ${weekXp >= weeklyGoal ? 'bg-success' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.round((weekXp / Math.max(1, weeklyGoal)) * 100))}%` }} />
          </div>
          <p className="text-xs text-ink2 leading-relaxed">{cheer}</p>
        </section>

        {/* daily challenge — surfaced from the profile's challenge set */}
        <DailyChallengeCard onOpenProfile={onOpenProfile} />

        {/* coach's note — personalized from the last session report */}
        <section className="bg-surface2 border border-line rounded-2xl p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1.5">From your coach</h3>
          {last ? (
            <p className="text-sm text-ink leading-relaxed">{last.report.tomorrow_focus}</p>
          ) : (
            <p className="text-sm text-ink2">
              Finish your first conversation and your coach will set a personalized focus for
              tomorrow — corrections, habits to break, and what to practice next.
            </p>
          )}
        </section>

        {/* more ways to practise — only the practice modes; everything else
           (Reference, Analytics, Focus, Personalise, Offline, Real-world)
           lives in the More sheet, so Home stays focused on doing. */}
        <section className="space-y-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">More ways to practise</h3>
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
          <button
            onClick={() => {
              const rolls = [
                () => { onPickScenario(getScenarios()[Math.floor(Math.random() * getScenarios().length)]); onNavigate('arena'); },
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
        </section>

        {/* ── discover: ambient, non-urgent ── */}
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink3 pt-1 -mb-1">Discover</h3>

        {/* league standing + achievements, at a glance */}
        <GamePreview onOpenProfile={onOpenProfile} />

        {/* word + phrase of the day — deterministic by date, always fresh */}
        <WordOfTheDay />
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
function WordOfTheDay() {
  // Prefer cards that carry an example sentence, so the daily pick is rich
  // rather than a bare frequency-list word pair.
  const entries = allEntries().filter((x) => x.example && x.emoji);
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

// Phrase of the day: a full, usable sentence from the situational phrasebook,
// offset a few days from the word pick so the two never coincide.
function PhraseOfTheDay() {
  const all = getPhrasebook().flatMap((g) => g.phrases);
  if (!all.length) return null;
  const day = Math.floor(Date.now() / 86400000) + 3;
  const p = all[day % all.length];
  return (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">Phrase of the day</h3>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink" lang="fr">{p.fr}</p>
          <p className="text-xs text-ink3 mt-0.5">{p.en}</p>
        </div>
        <SpeakButton text={p.fr} label="Listen" />
      </div>
    </section>
  );
}

// Today at a glance: the four numbers a learner checks daily.
function GlanceStats({ srs, sessions }) {
  const today = new Date().toISOString().slice(0, 10);
  const tiles = [
    { icon: Clock, label: 'Time today', value: fmtDuration(getTimeLog()[today] || 0) },
    { icon: Layers, label: 'Words learned', value: wordsLearned(srs) },
    { icon: MessageCircle, label: 'Conversations', value: sessions.length },
    { icon: Coins, label: 'Coins', value: getCoins() },
  ];
  return (
    <section className="grid grid-cols-4 gap-2" aria-label="Today at a glance">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface border border-line rounded-2xl px-2 py-3 text-center">
          <t.icon size={14} className="mx-auto text-ink3" />
          <p className="text-base font-bold text-ink tabular-nums leading-none mt-1.5">{t.value}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink3 mt-1 leading-tight">{t.label}</p>
        </div>
      ))}
    </section>
  );
}

// Daily challenge preview: today's top open challenge with its progress, and a
// count of how many of the three are done. Tapping opens the profile to claim.
function DailyChallengeCard({ onOpenProfile }) {
  const state = getChallengeState();
  const todays = dailyChallenges(state.day);
  const progressOf = (c) => (c.metric === 'xp' ? getTodayXp() : (state.counts[c.metric] || 0));
  const done = todays.filter((c) => progressOf(c) >= c.target).length;
  const active = todays.find((c) => progressOf(c) < c.target) || todays[0];
  const prog = Math.min(active.target, progressOf(active));
  const complete = prog >= active.target;
  return (
    <button
      onClick={onOpenProfile}
      className="w-full bg-surface border border-line rounded-2xl p-5 text-left space-y-2.5 hover:border-ink3 transition-colors"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><Target size={12} /> Daily challenge</h3>
        <span className="text-[11px] text-ink3 tabular-nums">{done}/{todays.length} done</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm text-ink" lang="fr">{active.title}</p>
        <span className="shrink-0 text-[11px] font-semibold text-ink2 tabular-nums inline-flex items-center gap-1">
          +{active.coins} <Coins size={11} /> {complete ? '· claim' : `· ${prog}/${active.target}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
        <div className={`h-full rounded-full bar-anim ${complete ? 'bg-success' : 'bg-accent'}`} style={{ width: `${Math.round((prog / active.target) * 100)}%` }} />
      </div>
    </button>
  );
}

// League + achievements at a glance, both tapping through to the profile.
function GamePreview({ onOpenProfile }) {
  const lvl = levelFromXp(getXp()).level;
  const tier = leagueTier(lvl);
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const weekProgress = (dow * 86400 + now.getHours() * 3600 + now.getMinutes() * 60) / (7 * 86400);
  const weekKey = new Date(now.getTime() - dow * 86400000).toISOString().slice(0, 10);
  const settings = getSettings();
  const league = weeklyLeague(weekKey, getWeekXp(), weekProgress, tier.index, { name: settings.name || 'You', avatar: '🙂' });
  const badges = Object.keys(getAchievements()).length;
  const next = ACHIEVEMENTS.find((a) => !getAchievements()[a.id]);
  return (
    <section className="grid grid-cols-2 gap-2.5">
      <button onClick={onOpenProfile} className="bg-surface border border-line rounded-2xl p-4 text-left hover:border-ink3 transition-colors">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink3 inline-flex items-center gap-1">{tier.emoji} {tier.name} league</h3>
        <p className="text-lg font-bold text-ink tabular-nums leading-none mt-1.5">#{league.rank} <span className="text-xs font-normal text-ink3">of {league.count}</span></p>
        <p className="text-[11px] text-ink3 mt-1">{league.rank === 1 ? 'Top of the league' : `${league.ahead ? `${league.ahead.xp - getWeekXp()} XP to climb` : 'Earn XP to climb'}`}</p>
      </button>
      <button onClick={onOpenProfile} className="bg-surface border border-line rounded-2xl p-4 text-left hover:border-ink3 transition-colors">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink3 inline-flex items-center gap-1"><Trophy size={11} /> Achievements</h3>
        <p className="text-lg font-bold text-ink tabular-nums leading-none mt-1.5">{badges} <span className="text-xs font-normal text-ink3">/ {ACHIEVEMENTS.length}</span></p>
        <p className="text-[11px] text-ink3 mt-1 truncate">{next ? `Next: ${next.title}` : 'All unlocked — bravo'}</p>
      </button>
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
