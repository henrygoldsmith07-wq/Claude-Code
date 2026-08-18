import { useMemo } from 'react';
import {
  getMetrics, getSessions, getGrammarProgress, getSrs, getNotebook,
  getTimeLog, getXpLog, getReviewLog, getXp, getSettings,
  getLearnerErrors, getLearnerErrorSummary,
} from '../lib/storage';
import { allEntries } from '../lib/vocab';
import { getGrammarErrors } from '../lib/storage';
import { getGrammarTopic } from '../lib/grammar';
import { getWeaknessMemory, getWeaknessSummary } from '../lib/storage';
import { levelFromXp } from '../lib/game';
import { errorNotebookStats } from '../lib/errorNotebook';
import { retentionPredictionVsActual, speakingImprovement } from '../lib/learnerValidation';
import { benchmarkExaminer, validateAgainstResults } from '../lib/examBenchmark';
import { getExaminerScripts, getRealExamResults } from '../lib/storage';
import { allEntries as vocabAllEntries } from '../lib/vocab';
import { notebookAsEntries, heatmapWeeks, totalReviews } from '../lib/memory';
import {
  skillBreakdown, skillScore, retentionRate, wordsLearned, periodReport, fmtDuration,
  xpInRange, dailyPace, weeklyXp, vocabGrowth, yearRecap,
} from '../lib/analytics';
import { WeeklyXPChart, GrowthChart, TrendChart } from './charts';
import { X, Clock, Layers, Book, Mic, Volume, BarChart, TrendingUp } from './icons';

// Analytics (full-screen): headline metrics, a skill breakdown, weekly and
// monthly reports, and activity heatmaps — all from locally-recorded data.

export default function Analytics({ open, onClose }) {
  const d = useMemo(() => {
    if (!open) return null;
    const metrics = getMetrics();
    const sessions = getSessions();
    const grammar = getGrammarProgress();
    const srs = getSrs();
    const entries = [...allEntries(), ...notebookAsEntries(getNotebook())];
    const timeLog = getTimeLog();
    const xpLog = getXpLog();
    const reviewLog = getReviewLog();
    const breakdown = skillBreakdown(metrics, sessions, grammar);
    return {
      breakdown,
      recap: yearRecap({ xpLog, timeLog, sessions, metrics, reviewLog, srs, weakness: getWeaknessSummary() }),
      totalSeconds: Object.values(timeLog).reduce((a, b) => a + b, 0),
      weekSeconds: periodReport(7, { xpLog, timeLog, metrics, sessions }).seconds,
      wordsLearned: wordsLearned(srs),
      grammarMastered: Object.values(grammar).filter((g) => g.best >= 80).length,
      retention: retentionRate(entries, srs),
      speaking: skillScore(breakdown, 'speaking'),
      pronunciation: skillScore(breakdown, 'pronunciation'),
      listening: skillScore(breakdown, 'listening'),
      reviews: totalReviews(getReviewLog()),
      week: periodReport(7, { xpLog, timeLog, metrics, sessions }),
      month: periodReport(30, { xpLog, timeLog, metrics, sessions }),
      xpLog,
      sessions,
      weeklyXp: weeklyXp(xpLog, 8),
      vocabGrowth: vocabGrowth(srs, 8),
      xp: getXp(),
      level: levelFromXp(getXp()),
      pace: dailyPace(xpLog, 14),
      thisWeekXp: xpInRange(xpLog, 6, 0),
      lastWeekXp: xpInRange(xpLog, 13, 7),
      weeklyGoal: getSettings().weeklyGoal,
      learnerErrors: getLearnerErrors({ limit: 8 }),
      learnerErrorSummary: getLearnerErrorSummary(),
    };
  }, [open]);

  if (!open) return null;

  const cell = (v) => (v == null ? '—' : v);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Analytics">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Analytics</h2>
        <button onClick={onClose} aria-label="Close analytics" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto space-y-6">
          {d.recap && <YearRecap r={d.recap} />}

          {/* headline metrics */}
          <section className="grid grid-cols-2 gap-2.5">
            <Metric icon={Clock} label="Time studied" value={fmtDuration(d.totalSeconds)} sub={`${fmtDuration(d.weekSeconds)} this week`} />
            <Metric icon={Layers} label="Words learned" value={d.wordsLearned} sub={`${d.reviews} reviews`} />
            <Metric icon={Book} label="Grammar mastered" value={d.grammarMastered} sub="topics at 80%+" />
            <Metric icon={BarChart} label="Retention rate" value={d.retention == null ? '—' : `${d.retention}%`} sub="predicted recall" />
            <Metric icon={Mic} label="Speaking accuracy" value={d.speaking == null ? '—' : `${d.speaking}%`} sub="conversation + drills" />
            <Metric icon={Mic} label="Pronunciation" value={d.pronunciation == null ? '—' : `${d.pronunciation}%`} sub="read-aloud clarity" />
            <Metric icon={Volume} label="Listening score" value={d.listening == null ? '—' : `${d.listening}%`} sub="quizzes + dictée" />
            <Metric icon={Clock} label="Active days" value={d.month.activeDays} sub="last 30 days" />
          </section>

          {/* week-over-week trend + forward projections */}
          <Trend thisWeek={d.thisWeekXp} lastWeek={d.lastWeekXp} />
          <Projections xp={d.xp} level={d.level} pace={d.pace} weeklyGoal={d.weeklyGoal} thisWeekXp={d.thisWeekXp} />

          {/* charts over time */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Progress over time</h3>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-ink">Weekly XP</h4>
                <span className="text-[11px] text-ink3">last 8 weeks</span>
              </div>
              <WeeklyXPChart weeks={d.weeklyXp} />
            </div>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-ink">Vocabulary growth</h4>
                <span className="text-[11px] text-ink3">words learned</span>
              </div>
              <GrowthChart weeks={d.vocabGrowth} />
            </div>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-ink">Speaking scores</h4>
                <span className="text-[11px] text-ink3">per conversation</span>
              </div>
              <TrendChart sessions={d.sessions} />
            </div>
          </section>

          {/* skill breakdown */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Skill breakdown</h3>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
              {d.breakdown.map((s) => (
                <div key={s.id}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-ink">{s.label}</span>
                    <span className="text-xs text-ink3 tabular-nums">{s.score == null ? 'no data' : `${s.score}%`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${s.score || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <LearnerValidation />
          <ErrorNotebookStats />
          <LearnerErrorModel entries={d.learnerErrors} summary={d.learnerErrorSummary} />
          <SessionHistory sessions={d.sessions} />
          <ExamBenchmark />
          {/* period reports */}
          <WeaknessMemory />
          <ErrorCategories />


          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Reports</h3>
            <Report title="This week" r={d.week} />
            <Report title="This month" r={d.month} />
          </section>

          {/* XP heatmap */}
          <section className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Activity heatmap</h3>
              <span className="text-[11px] text-ink3">XP per day · 15 weeks</span>
            </div>
            <Heatmap log={d.xpLog} />
          </section>
        </div>
      </div>
    </div>
  );
}

// Persistent weakness memory: error → repair → deliberate retest → recurrence.
function WeaknessMemory() {
  const summary = getWeaknessSummary();
  const items = getWeaknessMemory().slice(0, 6);
  if (!items.length) return null;
  const pct = summary.recurrenceRate == null ? '—' : `${Math.round(summary.recurrenceRate * 100)}%`;
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Weakness memory & retests</h3>
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><p className="text-base font-bold text-ink tabular-nums">{summary.byStatus.active}</p><p className="text-[9px] font-bold uppercase tracking-wider text-ink3">Active</p></div>
          <div><p className="text-base font-bold text-ink tabular-nums">{summary.byStatus.recovering}</p><p className="text-[9px] font-bold uppercase tracking-wider text-ink3">Recovering</p></div>
          <div><p className="text-base font-bold text-ink tabular-nums">{summary.byStatus.resolved}</p><p className="text-[9px] font-bold uppercase tracking-wider text-ink3">Resolved</p></div>
          <div><p className="text-base font-bold text-ink tabular-nums">{pct}</p><p className="text-[9px] font-bold uppercase tracking-wider text-ink3">Recurrence</p></div>
        </div>
        <p className="text-[11px] text-ink3">{summary.retests} retests · {summary.recurrences} recurrences{summary.due ? ` · ${summary.due} due now` : ''} — lower recurrence means fixes are sticking.</p>
        <div className="space-y-2">
          {items.map((e) => {
            const topic = getGrammarTopic(e.topicId);
            const label = topic ? topic.title : e.topicId;
            const badge = e.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : e.status === 'recovering' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-surface2 text-ink3 border-line';
            return (
              <div key={e.topicId} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-ink truncate" lang="fr">{label}</span>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${badge}`}>{e.status}</span>
                <span className="shrink-0 text-[11px] text-ink3 tabular-nums">{e.errorCount}×</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Year in review: a celebratory recap of the calendar year's headline
// numbers, inked as a dark card so it reads as a milestone, not a metric.
function YearRecap({ r }) {
  const stats = [
    ['XP earned', r.totalXp.toLocaleString('en-GB')],
    ['Active days', r.activeDays],
    ['Words learned', r.wordsLearned],
    ['Best streak', `${r.longestStreak}d`],
    ['Conversations', r.sessions],
    ['Reviews', r.reviews],
  ];
  return (
    <section className="rounded-2xl bg-ink text-bg p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Your year in review</h3>
        <span className="text-sm font-bold tabular-nums">{r.year}</span>
      </div>
      <div className="grid grid-cols-3 gap-y-4 gap-x-2">
        {stats.map(([label, v]) => (
          <div key={label}>
            <p className="text-xl font-bold tabular-nums leading-none">{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-80 leading-relaxed border-t border-bg/20 pt-3">
        {r.busiestMonth ? <>Your strongest month was <span className="font-semibold">{r.busiestMonth}</span>. </> : null}
        {r.topSkill ? <>Sharpest skill: <span className="font-semibold">{r.topSkill.label}</span> at {r.topSkill.score}%. </> : null}
        {r.weakness && r.weakness.retests ? <> Weakness memory: <span className="font-semibold">{r.weakness.retests} retest{r.weakness.retests===1?'':'s'}</span>, recurrence <span className="font-semibold">{r.weakness.recurrenceRate==null?'—':Math.round(r.weakness.recurrenceRate*100)+'%'} </span>— lower is stickier. </> : null}
        {fmtDuration(r.seconds) !== '—' ? <>That's <span className="font-semibold">{fmtDuration(r.seconds)}</span> of practice — félicitations.</> : 'Keep the momentum going.'}
      </p>
    </section>
  );
}

// Week-over-week XP trend: this Mon-anchored 7-day window vs the one before.
function Trend({ thisWeek, lastWeek }) {
  const delta = thisWeek - lastWeek;
  const pct = lastWeek > 0 ? Math.round((delta / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
  const up = delta >= 0;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><TrendingUp size={12} /> Weekly trend</h3>
        {(thisWeek > 0 || lastWeek > 0) && (
          <span className={`text-xs font-semibold tabular-nums inline-flex items-center gap-0.5 ${up ? 'text-ink' : 'text-ink3'}`}>
            {up ? '▲' : '▼'} {Math.abs(pct)}%
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-4">
        <div>
          <p className="text-2xl font-bold text-ink tabular-nums leading-none">{thisWeek}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 mt-1">XP this week</p>
        </div>
        <div className="pb-0.5">
          <p className="text-sm text-ink3 tabular-nums leading-none">{lastWeek}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 mt-1">last week</p>
        </div>
      </div>
      <p className="text-[11px] text-ink3 mt-3">
        {lastWeek === 0 && thisWeek === 0
          ? 'Earn XP this week to start your trend.'
          : up
            ? `You're ${pct}% ahead of last week — momentum is building.`
            : `Down ${Math.abs(pct)}% from last week — a short session gets you back on pace.`}
      </p>
    </section>
  );
}

// Forward projections from recent pace: when the next level and the weekly
// goal land if the learner keeps their current rate. Honest and clearly
// framed as an estimate.
function Projections({ xp, level, pace, weeklyGoal, thisWeekXp }) {
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (pace <= 0) {
    return (
      <section className="bg-surface2 border border-line rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Projections</h3>
        <p className="text-sm text-ink2 mt-2">Practise a few days and a trajectory to your next level and weekly goal will appear here.</p>
      </section>
    );
  }
  const now = new Date();
  const xpToNext = level.needed - level.intoLevel;
  const daysToLevel = Math.max(1, Math.ceil(xpToNext / pace));
  const levelDate = new Date(now.getTime() + daysToLevel * 86400000);
  const daysLeftInWeek = 6 - ((now.getDay() + 6) % 7); // Mon=0 … Sun=6
  const projectedWeek = Math.round(thisWeekXp + pace * daysLeftInWeek);
  const goalHit = projectedWeek >= weeklyGoal;

  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Projections</h3>
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
        <p className="text-[11px] text-ink3">At your recent pace of <span className="font-semibold text-ink2 tabular-nums">~{Math.round(pace)} XP/day</span>:</p>
        <Projection
          label={`Niveau ${level.level + 1}`}
          value={daysToLevel <= 1 ? 'tomorrow' : `~${daysToLevel} days`}
          sub={`around ${fmtDate(levelDate)} · ${xpToNext} XP to go`}
        />
        <Projection
          label="This week's goal"
          value={goalHit ? 'on track' : `${weeklyGoal - projectedWeek} XP short`}
          sub={`projected ${projectedWeek} / ${weeklyGoal} XP`}
        />
      </div>
      <p className="text-[11px] text-ink3 px-1">Estimates from your last 14 days — practise more and they pull in.</p>
    </section>
  );
}

function Projection({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{label}</p>
        <p className="text-[11px] text-ink3 truncate">{sub}</p>
      </div>
      <span className="shrink-0 text-sm font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-ink3 mb-1.5"><Icon size={13} /><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-xl font-bold text-ink tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-ink3 mt-1">{sub}</p>
    </div>
  );
}

function Report({ title, r }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-5">
      <h4 className="text-sm font-semibold text-ink mb-3">{title}</h4>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['Time', fmtDuration(r.seconds)],
          ['XP', r.xp],
          ['Activities', r.activities],
          ['Avg score', r.avgScore == null ? '—' : `${r.avgScore}%`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-base font-bold text-ink tabular-nums">{v}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink3">{k}</p>
          </div>
        ))}
      </div>
      {r.bestDay && (
        <p className="text-[11px] text-ink3 mt-3">
          Best day: {new Date(r.bestDay).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ({r.bestXp} XP)
        </p>
      )}
    </div>
  );
}

function Heatmap({ log }) {
  const grid = useMemo(() => heatmapWeeks(log, 15), [log]);
  const shades = ['bg-surface2', 'bg-line', 'bg-ink3', 'bg-ink2', 'bg-ink'];
  return (
    <div className="flex gap-1 justify-between" role="img" aria-label="Daily XP for the last 15 weeks">
      {grid.map((week, w) => (
        <div key={w} className="flex flex-col gap-1 flex-1">
          {week.map((day) => (
            <span
              key={day.day}
              title={`${day.day}: ${day.count} XP`}
              className={`aspect-square w-full rounded-[3px] ${shades[day.level]}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LearnerValidation(){
  const srs = (()=>{ try{ return getSrs(); }catch{ return {}; } })();
  const entries = (()=>{ try{ return vocabAllEntries(); }catch{ return []; } })();
  const retention = retentionPredictionVsActual(srs, entries.slice(0,40));
  const speaking = (()=>{ try{ return speakingImprovement([]); }catch{ return { slope:null }; } })();
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Learner validation</h3>
      <p className="text-xs text-ink2">Retention prediction: {retention.accuracy==null ? '—' : `${Math.round(retention.accuracy*100)}%`} (n={retention.n}) · Speaking slope: {speaking.slope==null ? '—' : `${speaking.slope}/day`}</p>
      <p className="text-[11px] text-ink3">Predicted vs actual recall on due cards; slope from recent speaking scores.</p>
    </section>
  );
}
function ErrorNotebookStats(){
  const st = (()=>{ try{ return errorNotebookStats(); }catch{ return { total:0, pending:0, recurrences:0 }; } })();
  if(!st.total) return null;
  return (
    <section className="bg-surface border border-line rounded-2xl p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Error notebook</h3>
      <p className="text-xs text-ink2">{st.total} corrections · {st.pending} pending retype · {st.recurrences} recurrences</p>
    </section>
  );
}

function LearnerErrorModel({ entries, summary }) {
  const labels = { grammar: 'Grammar', vocabulary: 'Vocabulary', listening: 'Listening', pronunciation: 'Pronunciation' };
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Persistent learner error model</h3>
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(labels).map(([key, label]) => (
            <div key={key}>
              <p className="text-base font-bold text-ink tabular-nums">{summary.byCategory[key].entries}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink3">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink3">{summary.active} active · {summary.recovering} recovering · {summary.resolved} resolved · {summary.recurrences} recurrences. Gaps persist across the mode where they first appeared.</p>
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded border border-line bg-surface2 text-[9px] font-bold uppercase tracking-wider text-ink3">{entry.category}</span>
                <span className="flex-1 min-w-0 text-xs text-ink truncate">{entry.label}</span>
                <span className="shrink-0 text-[10px] text-ink3 tabular-nums">{entry.errorCount}×</span>
              </div>
            ))}
          </div>
        )}
        {!entries.length && <p className="text-xs text-ink3">No persistent gaps yet. Every low-scoring drill will feed this model.</p>}
      </div>
    </section>
  );
}

function SessionHistory({ sessions }) {
  const recent = sessions.slice().reverse().slice(0, 8);
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Full session history</h3>
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <p className="text-xs text-ink2">{sessions.length} completed session{sessions.length === 1 ? '' : 's'} stored locally. New sessions are no longer limited to the old last-10 window.</p>
        {recent.length > 0 && (
          <div className="space-y-2">
            {recent.map((session) => {
              const score = session.report?.average_scores?.overall;
              return (
                <div key={session.id} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-ink3 tabular-nums">{session.date ? new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                  <span className="flex-1 min-w-0 truncate text-ink">{session.scenarioId || 'Conversation'}</span>
                  <span className="shrink-0 text-ink3 tabular-nums">{score == null ? '—' : `${score}%`}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// Says how far the exam marks have actually been checked against a human
// examiner. With no marked attempts on file that is "not at all", and saying
// so is the entire point of the panel — a confident-looking agreement figure
// computed from nothing is worse than no panel.
function ExamBenchmark(){
  const b = benchmarkExaminer(getExaminerScripts());
  const results = validateAgainstResults(getRealExamResults());
  return (
    <section className="bg-surface border border-line rounded-2xl p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Examiner benchmark</h3>
      <p className="text-sm font-semibold mt-1">{b.label}</p>
      <p className="text-xs text-ink2 mt-1">{b.message}</p>
      {b.n > 0 && (
        <p className="text-xs text-ink2 mt-1">
          Within 5pp: {Math.round(b.agreement * 100)}% · MAE {b.meanAbsoluteError}pp
          {b.kappa == null ? '' : ` · κ ${b.kappa}`} (n={b.n})
        </p>
      )}
      {results.n > 0 && <p className="text-xs text-ink2 mt-1">Real results: {results.message}</p>}
    </section>
  );
}
// Which grammar areas trip you up in real conversation — counted from the
// Arena's per-turn mistake classification.
function ErrorCategories() {
  const errors = Object.entries(getGrammarErrors()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!errors.length) return null;
  const max = errors[0][1];
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Errors by grammar area</h3>
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2.5">
        {errors.map(([topicId, count]) => {
          const topic = getGrammarTopic(topicId);
          return (
            <div key={topicId} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-ink truncate" lang="fr">{topic ? topic.title : topicId}</span>
              <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                <div className="h-full bg-ink rounded-full" style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-[11px] text-ink3 tabular-nums">{count}</span>
            </div>
          );
        })}
        <p className="text-[11px] text-ink3">Counted every time the Arena classifies a conversation mistake.</p>
      </div>
    </section>
  );
}
