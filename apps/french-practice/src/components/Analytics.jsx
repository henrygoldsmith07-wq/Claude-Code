import { useMemo } from 'react';
import {
  getMetrics, getSessions, getGrammarProgress, getSrs, getNotebook,
  getTimeLog, getXpLog, getReviewLog,
} from '../lib/storage';
import { allEntries } from '../lib/vocab';
import { getGrammarErrors } from '../lib/storage';
import { getGrammarTopic } from '../lib/grammar';
import { notebookAsEntries, heatmapWeeks, totalReviews } from '../lib/memory';
import {
  skillBreakdown, skillScore, retentionRate, wordsLearned, periodReport, fmtDuration,
} from '../lib/analytics';
import { X, Clock, Layers, Book, Mic, Volume, BarChart } from './icons';

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
    const breakdown = skillBreakdown(metrics, sessions, grammar);
    return {
      breakdown,
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

          {/* period reports */}
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
