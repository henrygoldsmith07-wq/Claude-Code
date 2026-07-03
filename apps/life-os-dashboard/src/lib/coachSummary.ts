import type { useFinance } from "./domains/finance";
import type { useHabits } from "./domains/habits";
import type { useRoutines } from "./domains/routines";
import type { useHealth } from "./domains/health";
import type { useSleep } from "./domains/sleep";
import type { useHormesis } from "./domains/hormesis";
import type { useGoals } from "./domains/goals";
import type { useMeditation } from "./domains/meditation";
import type { useStudy } from "./domains/study";
import type { useRelationships } from "./domains/relationships";
import type { useSelfImprovement } from "./domains/selfImprovement";
import type { useMentalHealth } from "./domains/mentalHealth";
import { formatCents } from "./money";

interface CoachSummaryInputs {
  finance: ReturnType<typeof useFinance>;
  habits: ReturnType<typeof useHabits>;
  routines: ReturnType<typeof useRoutines>;
  health: ReturnType<typeof useHealth>;
  sleep: ReturnType<typeof useSleep>;
  hormesis: ReturnType<typeof useHormesis>;
  goals: ReturnType<typeof useGoals>;
  meditation: ReturnType<typeof useMeditation>;
  study: ReturnType<typeof useStudy>;
  relationships: ReturnType<typeof useRelationships>;
  selfImprovement: ReturnType<typeof useSelfImprovement>;
  mentalHealth: ReturnType<typeof useMentalHealth>;
}

export function buildCoachSummary(d: CoachSummaryInputs): string {
  const lines: string[] = [];

  lines.push(
    `Finance: ${formatCents(d.finance.stats.monthIncomeCents)} income, ${formatCents(
      d.finance.stats.monthExpenseCents,
    )} spent this month, savings rate ${d.finance.stats.savingsRatePct.toFixed(0)}%.`,
  );

  lines.push(
    `Habits: ${d.habits.stats.totalActive} active, ${d.habits.stats.doneTodayCount} done today, ${d.habits.stats.completionRate7d.toFixed(0)}% completion rate over the last 7 days.`,
  );

  lines.push(`Routines: ${d.routines.routines.length} routines set up.`);

  lines.push(
    `Health: ${d.health.stats.todayCalories} calories and ${d.health.stats.todayProtein}g protein logged today, ${d.health.stats.todayWaterMl}ml water. Latest weight: ${
      d.health.stats.latestWeight ? `${d.health.stats.latestWeight.weightKg}kg` : "not logged"
    }.`,
  );

  lines.push(
    `Sleep: last night ${
      d.sleep.stats.lastNight ? `${d.sleep.stats.lastNight.durationHours}h, quality ${d.sleep.stats.lastNight.quality}/5` : "not logged"
    }, 7-day average ${d.sleep.stats.avgDurationHours7d.toFixed(1)}h, sleep debt ${d.sleep.stats.sleepDebtHours7d.toFixed(1)}h.`,
  );

  lines.push(
    `Hormesis: current streak ${d.hormesis.stats.streak.current} days, ${d.hormesis.stats.totalMinutes7d} minutes over the last 7 days.`,
  );

  lines.push(
    `Goals: ${d.goals.stats.active.length} active, ${d.goals.stats.overdue.length} overdue, ${d.goals.stats.doneCount} completed all-time.`,
  );

  lines.push(
    `Meditation: current streak ${d.meditation.stats.streak.current} days, ${d.meditation.stats.totalMinutes7d} minutes over the last 7 days.`,
  );

  lines.push(
    `Study: ${d.study.stats.totalMinutes7d} minutes over the last 7 days, average focus ${d.study.stats.avgFocus7d.toFixed(1)}/5, streak ${d.study.stats.streak.current} days.`,
  );

  lines.push(
    `Relationships: ${d.relationships.contacts.length} contacts tracked, ${d.relationships.stats.dueToReachOut.length} overdue to reach out to.`,
  );

  lines.push(
    `Self-improvement: ${d.selfImprovement.stats.inProgress.length} items in progress, ${d.selfImprovement.stats.done.length} completed.`,
  );

  lines.push(
    `Mental health: ${
      d.mentalHealth.stats.todayMood ? `mood ${d.mentalHealth.stats.todayMood.mood}/5 today` : "no mood check-in today"
    }, 7-day average mood ${d.mentalHealth.stats.avgMood7d.toFixed(1)}/5, average stress ${d.mentalHealth.stats.avgStress7d.toFixed(1)}/5, gratitude streak ${d.mentalHealth.stats.gratitudeStreak.current} days.`,
  );

  return lines.join("\n");
}
