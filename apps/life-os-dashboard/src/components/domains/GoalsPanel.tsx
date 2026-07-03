"use client";

import { useState } from "react";
import { useGoals } from "@/lib/domains/goals";
import StatCard from "@/components/shared/StatCard";
import ProgressBar from "@/components/shared/ProgressBar";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/shared/formClasses";
import type { GoalDomain } from "@/lib/types";

const DOMAINS: GoalDomain[] = ["finance", "health", "career", "relationships", "personal", "other"];

export default function GoalsPanel() {
  const { addGoal, deleteGoal, setStatus, addMilestone, toggleMilestone, progressPct, stats } = useGoals();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<GoalDomain>("personal");
  const [targetDate, setTargetDate] = useState("");
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addGoal(title.trim(), domain, targetDate || null);
    setTitle("");
    setTargetDate("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Set goals across every domain, break them into milestones, and track progress.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active goals" value={String(stats.active.length)} />
        <StatCard label="Completed" value={String(stats.doneCount)} accent="good" />
        <StatCard label="Overdue" value={String(stats.overdue.length)} accent={stats.overdue.length > 0 ? "bad" : "default"} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">New goal</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} flex-1`}
            required
          />
          <select value={domain} onChange={(e) => setDomain(e.target.value as GoalDomain)} className={inputClass}>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Add goal
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">All goals</h2>
        {stats.active.length === 0 ? (
          <EmptyState message="No active goals yet." />
        ) : (
          stats.active.map((goal) => (
            <div key={goal.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{goal.title}</div>
                  <div className="text-xs text-zinc-500">
                    {goal.domain} {goal.targetDate && `· due ${goal.targetDate}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStatus(goal.id, "done")} className={ghostButtonClass}>
                    Mark done
                  </button>
                  <button onClick={() => deleteGoal(goal.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </div>
              </div>
              <ProgressBar pct={progressPct(goal)} />
              <ul className="flex flex-col gap-1">
                {goal.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => toggleMilestone(goal.id, m.id)}
                      className={`h-5 w-5 shrink-0 rounded border text-xs ${
                        m.done ? "border-teal-600 bg-teal-600 text-white" : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {m.done ? "✓" : ""}
                    </button>
                    <span className={m.done ? "text-zinc-400 line-through" : ""}>{m.label}</span>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const label = (milestoneDrafts[goal.id] ?? "").trim();
                  if (!label) return;
                  addMilestone(goal.id, label);
                  setMilestoneDrafts({ ...milestoneDrafts, [goal.id]: "" });
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Add milestone"
                  value={milestoneDrafts[goal.id] ?? ""}
                  onChange={(e) => setMilestoneDrafts({ ...milestoneDrafts, [goal.id]: e.target.value })}
                  className={`${inputClass} flex-1`}
                />
                <button type="submit" className={ghostButtonClass}>
                  Add
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
