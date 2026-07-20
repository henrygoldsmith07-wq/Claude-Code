import { useMemo } from 'react';
import { getSrs, getGrammarProgress, getReviewLog } from '../lib/storage';
import { getRoadmap } from '../lib/path';
import { TrendingUp } from './icons';

// Knowledge stats: a gamified view of how much the learner knows and how
// fast it's growing. The score is a weighted sum of durable knowledge
// (words in the SRS, grammar topics, lessons and checkpoints); the growth
// chart rebuilds weekly gains from the dated records the app already keeps
// (lesson/checkpoint dates, the review log, grammar quiz timestamps).

const POINTS = { word: 2, grammarTried: 10, grammarMastered: 15, lesson: 15, checkpoint: 40, review: 1 };

const weekStart = (d) => {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // back to Monday
  return t.getTime();
};

export default function KnowledgeStats({ path }) {
  const stats = useMemo(() => {
    const srs = getSrs();
    const grammar = getGrammarProgress();
    const reviewLog = getReviewLog();

    const wordsKnown = Object.values(srs).filter((e) => (e?.reps || 0) > 0).length;
    const grammarEntries = Object.values(grammar);
    const grammarTried = grammarEntries.length;
    const grammarMastered = grammarEntries.filter((g) => g.best >= 80).length;
    const lessonsDone = Object.keys(path.completed).length;
    const passed = path.checkpoints.filter((c) => c.passed);
    const avgCheckpoint = passed.length
      ? Math.round(passed.reduce((s, c) => s + c.score, 0) / passed.length)
      : null;
    const totalLessons = getRoadmap(path.goal).reduce((s, u) => s + u.lessons.length, 0);

    const score =
      wordsKnown * POINTS.word +
      grammarTried * POINTS.grammarTried +
      grammarMastered * POINTS.grammarMastered +
      lessonsDone * POINTS.lesson +
      passed.length * POINTS.checkpoint;

    // Weekly gains, last 8 weeks (oldest → newest).
    const thisWeek = weekStart(Date.now());
    const WEEK = 7 * 24 * 3600 * 1000;
    const weeks = Array.from({ length: 8 }, (_, i) => thisWeek - (7 - i) * WEEK);
    const gains = new Array(8).fill(0);
    const add = (dateish, pts) => {
      const t = new Date(dateish).getTime();
      if (Number.isNaN(t)) return;
      const idx = weeks.findIndex((w) => t >= w && t < w + WEEK);
      if (idx >= 0) gains[idx] += pts;
    };
    Object.values(path.completed).forEach((c) => add(c.date, POINTS.lesson));
    passed.forEach((c) => add(c.date, POINTS.checkpoint));
    grammarEntries.forEach((g) => g.lastAt && add(g.lastAt, POINTS.grammarTried));
    Object.entries(reviewLog).forEach(([day, count]) => add(day, count * POINTS.review));

    return {
      score, wordsKnown, grammarMastered, grammarTried, lessonsDone, totalLessons,
      unitsPassed: passed.length, avgCheckpoint, gains, gainedThisWeek: gains[7],
    };
  }, [path]);

  const maxGain = Math.max(1, ...stats.gains);

  return (
    <div className="border-t border-line px-5 py-4 space-y-4 fade-in">
      {/* headline score */}
      <div className="flex items-baseline gap-2.5">
        <span className="text-3xl font-bold text-ink tabular-nums">{stats.score.toLocaleString('en-GB')}</span>
        <span className="text-xs text-ink3">knowledge points</span>
        {stats.gainedThisWeek > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink">
            <TrendingUp size={13} /> +{stats.gainedThisWeek} this week
          </span>
        )}
      </div>

      {/* 8-week growth chart */}
      <div>
        <div className="flex items-end gap-1.5 h-16" role="img"
          aria-label={`Knowledge gained per week over the last 8 weeks: ${stats.gains.join(', ')} points`}>
          {stats.gains.map((g, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <div
                className={`rounded-sm ${i === 7 ? 'bg-ink' : 'bg-line'} transition-all`}
                style={{ height: `${Math.max(g > 0 ? 8 : 2, (g / maxGain) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-ink3">8 weeks ago</span>
          <span className="text-[10px] text-ink3">this week</span>
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <Tile value={stats.wordsKnown} label="words known" />
        <Tile value={`${stats.grammarMastered}/${stats.grammarTried || 0}`} label="grammar mastered" />
        <Tile value={`${stats.lessonsDone}/${stats.totalLessons}`} label="lessons done" />
        <Tile value={stats.unitsPassed} label="units passed" />
        <Tile value={stats.avgCheckpoint != null ? `${stats.avgCheckpoint}%` : '—'} label="avg checkpoint" />
        <Tile value={path.cefr} label="CEFR level" />
      </div>
    </div>
  );
}

function Tile({ value, label }) {
  return (
    <div className="bg-surface2 rounded-xl px-2.5 py-2.5 text-center">
      <p className="text-base font-bold text-ink tabular-nums">{value}</p>
      <p className="text-[10px] text-ink3 mt-0.5">{label}</p>
    </div>
  );
}
