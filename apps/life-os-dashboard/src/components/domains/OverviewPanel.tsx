"use client";

import Link from "next/link";
import { useFinance } from "@/lib/domains/finance";
import { useHabits } from "@/lib/domains/habits";
import { useRoutines } from "@/lib/domains/routines";
import { useHealth } from "@/lib/domains/health";
import { useSleep } from "@/lib/domains/sleep";
import { useHormesis } from "@/lib/domains/hormesis";
import { useGoals } from "@/lib/domains/goals";
import { useMeditation } from "@/lib/domains/meditation";
import { useStudy } from "@/lib/domains/study";
import { useRelationships } from "@/lib/domains/relationships";
import { useSelfImprovement } from "@/lib/domains/selfImprovement";
import { useMentalHealth } from "@/lib/domains/mentalHealth";
import { formatCents } from "@/lib/money";
import StatCard from "@/components/shared/StatCard";

const GREETING_HOUR_LABELS: [number, string][] = [
  [5, "Good morning"],
  [12, "Good afternoon"],
  [17, "Good evening"],
  [24, "Good night"],
];

function greeting(): string {
  const hour = new Date().getHours();
  return GREETING_HOUR_LABELS.find(([h]) => hour < h)?.[1] ?? "Hello";
}

export default function OverviewPanel() {
  const finance = useFinance();
  const habits = useHabits();
  const routines = useRoutines();
  const health = useHealth();
  const sleep = useSleep();
  const hormesis = useHormesis();
  const goals = useGoals();
  const meditation = useMeditation();
  const study = useStudy();
  const relationships = useRelationships();
  const selfImprovement = useSelfImprovement();
  const mentalHealth = useMentalHealth();

  const nextGoal = goals.stats.upcoming[0];
  const routineAvgPct =
    routines.stats.perRoutine.length > 0
      ? routines.stats.perRoutine.reduce((s, r) => s + r.pct, 0) / routines.stats.perRoutine.length
      : null;

  const cards = [
    {
      href: "/finance",
      label: "Finance",
      value: `${finance.stats.savingsRatePct.toFixed(0)}% saved`,
      sub: `${formatCents(finance.stats.monthExpenseCents)} spent this month`,
    },
    {
      href: "/habits",
      label: "Habits",
      value: `${habits.stats.doneTodayCount}/${habits.stats.totalActive} today`,
      sub: `${habits.stats.completionRate7d.toFixed(0)}% this week`,
    },
    {
      href: "/routines",
      label: "Routines",
      value: routineAvgPct !== null ? `${routineAvgPct.toFixed(0)}% done today` : "No routines yet",
      sub: `${routines.routines.length} routine(s)`,
    },
    {
      href: "/health",
      label: "Health & Nutrition",
      value: `${health.stats.todayCalories} cal today`,
      sub: `${health.stats.todayWaterMl}ml water`,
    },
    {
      href: "/sleep",
      label: "Sleep",
      value: sleep.stats.lastNight ? `${sleep.stats.lastNight.durationHours}h last night` : "Not logged",
      sub: `${sleep.stats.avgDurationHours7d.toFixed(1)}h avg (7d)`,
    },
    {
      href: "/hormesis",
      label: "Hormesis",
      value: `${hormesis.stats.streak.current}d streak`,
      sub: `${hormesis.stats.totalMinutes7d}min this week`,
    },
    {
      href: "/goals",
      label: "Goals",
      value: `${goals.stats.active.length} active`,
      sub: nextGoal ? `Next: ${nextGoal.title} (${nextGoal.targetDate})` : "No deadlines set",
    },
    {
      href: "/meditation",
      label: "Meditation",
      value: `${meditation.stats.streak.current}d streak`,
      sub: `${meditation.stats.totalMinutes7d}min this week`,
    },
    {
      href: "/study",
      label: "Study",
      value: `${study.stats.totalMinutes7d}min this week`,
      sub: `${study.stats.streak.current}d streak`,
    },
    {
      href: "/relationships",
      label: "Relationships",
      value: `${relationships.stats.dueToReachOut.length} due to reach out`,
      sub: `${relationships.contacts.length} contacts tracked`,
    },
    {
      href: "/self-improvement",
      label: "Self-Improvement",
      value: `${selfImprovement.stats.inProgress.length} in progress`,
      sub: `${selfImprovement.stats.done.length} completed`,
    },
    {
      href: "/mental-health",
      label: "Mental Health",
      value: mentalHealth.stats.todayMood ? `Mood ${mentalHealth.stats.todayMood.mood}/5` : "Not checked in",
      sub: `Gratitude streak ${mentalHealth.stats.gratitudeStreak.current}d`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{greeting()}.</h2>
        <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Your whole life, one dashboard. Here&apos;s where things stand today.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Habits done today" value={`${habits.stats.doneTodayCount}/${habits.stats.totalActive}`} accent="good" />
        <StatCard label="Mood today" value={mentalHealth.stats.todayMood ? `${mentalHealth.stats.todayMood.mood}/5` : "—"} />
        <StatCard label="Sleep last night" value={sleep.stats.lastNight ? `${sleep.stats.lastNight.durationHours}h` : "—"} />
      </section>

      <Link
        href="/coach"
        className="flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm dark:border-teal-800 dark:bg-teal-950"
      >
        <span>
          <strong>Ask your AI coach</strong> — get a daily briefing pulling insight from every domain.
        </span>
        <span aria-hidden>→</span>
      </Link>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 transition hover:border-teal-400 dark:border-zinc-800 dark:hover:border-teal-700"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.label}</span>
            <span className="text-lg font-semibold">{c.value}</span>
            <span className="text-xs text-zinc-500">{c.sub}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
