"use client";

import { useState } from "react";
import { useSelfImprovement } from "@/lib/domains/selfImprovement";
import StatCard from "@/components/shared/StatCard";
import ProgressBar from "@/components/shared/ProgressBar";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import type { LearningType } from "@/lib/types";

const TYPES: LearningType[] = ["book", "course", "skill", "article"];

export default function SelfImprovementPanel() {
  const { items, addItem, deleteItem, updateProgress, stats } = useSelfImprovement();
  const [type, setType] = useState<LearningType>("book");
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addItem(type, title.trim());
    setTitle("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Track the books, courses, and skills you&apos;re investing in.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="In progress" value={String(stats.inProgress.length)} accent="good" />
        <StatCard label="Planned" value={String(stats.planned.length)} />
        <StatCard label="Completed" value={String(stats.done.length)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Add item</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as LearningType)} className={inputClass}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} flex-1`}
            required
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Everything</h2>
        {items.length === 0 ? (
          <EmptyState message="Nothing added yet. Track a book, course, or skill above." />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {item.title} <span className="text-xs text-zinc-500">({item.type})</span>
                  </span>
                  <button onClick={() => deleteItem(item.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </div>
                <ProgressBar pct={item.progressPct} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={item.progressPct}
                  onChange={(e) => updateProgress(item.id, parseInt(e.target.value, 10))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
