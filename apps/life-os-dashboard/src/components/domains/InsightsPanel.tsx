"use client";

import { useSleep } from "@/lib/domains/sleep";
import { useMentalHealth } from "@/lib/domains/mentalHealth";
import { useStudy } from "@/lib/domains/study";
import { useHormesis } from "@/lib/domains/hormesis";
import { useFinance } from "@/lib/domains/finance";
import { useHabits } from "@/lib/domains/habits";
import { lastNDays } from "@/lib/date";
import { formatCents } from "@/lib/money";
import Sparkline from "@/components/shared/Sparkline";
import BarList from "@/components/shared/BarList";
import DonutChart from "@/components/shared/DonutChart";
import EmptyState from "@/components/shared/EmptyState";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export default function InsightsPanel() {
  const sleep = useSleep();
  const mentalHealth = useMentalHealth();
  const study = useStudy();
  const hormesis = useHormesis();
  const finance = useFinance();
  const habits = useHabits();

  const last14 = lastNDays(14);

  const sleepPoints = last14
    .map((date) => sleep.entries.find((e) => e.date === date))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({ label: e.date.slice(5), value: e.durationHours }));

  const moodPoints = last14
    .map((date) => mentalHealth.moods.find((m) => m.date === date))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ label: m.date.slice(5), value: m.mood }));

  // Correlation: mood on good-sleep days (>=7h) vs short-sleep days (<7h).
  const moodBySleepBucket = { good: [] as number[], short: [] as number[] };
  for (const mood of mentalHealth.moods) {
    const sleepEntry = sleep.entries.find((e) => e.date === mood.date);
    if (!sleepEntry) continue;
    (sleepEntry.durationHours >= 7 ? moodBySleepBucket.good : moodBySleepBucket.short).push(mood.mood);
  }
  const avgMoodGoodSleep = average(moodBySleepBucket.good);
  const avgMoodShortSleep = average(moodBySleepBucket.short);

  // Correlation: mood on hormesis days vs non-hormesis days.
  const hormesisDates = new Set(hormesis.entries.map((e) => e.date));
  const moodByHormesis = { active: [] as number[], rest: [] as number[] };
  for (const mood of mentalHealth.moods) {
    (hormesisDates.has(mood.date) ? moodByHormesis.active : moodByHormesis.rest).push(mood.mood);
  }
  const avgMoodActiveDays = average(moodByHormesis.active);
  const avgMoodRestDays = average(moodByHormesis.rest);

  const hasEnoughData =
    moodBySleepBucket.good.length + moodBySleepBucket.short.length >= 3 ||
    moodByHormesis.active.length + moodByHormesis.rest.length >= 3;

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Trends and correlations pulled from everything you&apos;ve logged, computed locally on your device.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Sleep duration (14 days)</h2>
        <Sparkline points={sleepPoints} formatValue={(n) => `${n}h`} color="#06b6d4" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mood trend (14 days)</h2>
        <Sparkline points={moodPoints} formatValue={(n) => `${n}/5`} color="#8b5cf6" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Study minutes by subject (7 days)</h2>
        <BarList
          bars={Object.entries(study.stats.minutesBySubject).map(([label, value]) => ({ label, value }))}
          colorClassName="bg-violet-500"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Spending by category (this month)</h2>
        <DonutChart values={finance.stats.spendByCategory} formatValue={formatCents} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Correlations</h2>
        {!hasEnoughData ? (
          <EmptyState message="Log a bit more sleep, mood, and hormesis data to unlock correlations." />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {avgMoodGoodSleep !== null && avgMoodShortSleep !== null && (
              <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                On nights with 7h+ sleep, your average mood is{" "}
                <strong>{avgMoodGoodSleep.toFixed(1)}/5</strong>, vs{" "}
                <strong>{avgMoodShortSleep.toFixed(1)}/5</strong> on shorter nights.
              </li>
            )}
            {avgMoodActiveDays !== null && avgMoodRestDays !== null && (
              <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                On days with a hormesis session, your average mood is{" "}
                <strong>{avgMoodActiveDays.toFixed(1)}/5</strong>, vs{" "}
                <strong>{avgMoodRestDays.toFixed(1)}/5</strong> on days without one.
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Weekly recap</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {habits.stats.completionRate7d.toFixed(0)}% habit completion, {study.stats.totalMinutes7d} minutes
          studied, {hormesis.stats.totalMinutes7d} minutes of hormesis, and{" "}
          {formatCents(finance.stats.monthExpenseCents)} spent so far this month.
        </p>
      </section>
    </div>
  );
}
