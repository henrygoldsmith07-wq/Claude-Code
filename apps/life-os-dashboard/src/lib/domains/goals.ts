"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { todayIso } from "@/lib/date";
import type { Goal, GoalDomain, Milestone } from "@/lib/types";

export function useGoals() {
  const [goals, setGoals] = useLocalStorage<Goal[]>("goals.list", []);

  function addGoal(title: string, domain: GoalDomain, targetDate: string | null) {
    setGoals([
      ...goals,
      { id: crypto.randomUUID(), title, domain, targetDate, status: "active", milestones: [], createdAt: todayIso() },
    ]);
  }
  function deleteGoal(id: string) {
    setGoals(goals.filter((g) => g.id !== id));
  }
  function setStatus(id: string, status: Goal["status"]) {
    setGoals(goals.map((g) => (g.id === id ? { ...g, status } : g)));
  }
  function addMilestone(goalId: string, label: string) {
    setGoals(
      goals.map((g) =>
        g.id === goalId
          ? { ...g, milestones: [...g.milestones, { id: crypto.randomUUID(), label, done: false }] }
          : g,
      ),
    );
  }
  function toggleMilestone(goalId: string, milestoneId: string) {
    setGoals(
      goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              milestones: g.milestones.map((m: Milestone) =>
                m.id === milestoneId ? { ...m, done: !m.done } : m,
              ),
            }
          : g,
      ),
    );
  }

  function progressPct(goal: Goal): number {
    if (goal.status === "done") return 100;
    if (goal.milestones.length === 0) return 0;
    return (goal.milestones.filter((m) => m.done).length / goal.milestones.length) * 100;
  }

  const active = goals.filter((g) => g.status === "active");
  const today = todayIso();
  const upcoming = [...active]
    .filter((g) => g.targetDate)
    .sort((a, b) => (a.targetDate ?? "").localeCompare(b.targetDate ?? ""));
  const overdue = upcoming.filter((g) => g.targetDate && g.targetDate < today);

  return {
    goals,
    addGoal,
    deleteGoal,
    setStatus,
    addMilestone,
    toggleMilestone,
    progressPct,
    stats: { active, upcoming, overdue, doneCount: goals.filter((g) => g.status === "done").length },
  };
}
