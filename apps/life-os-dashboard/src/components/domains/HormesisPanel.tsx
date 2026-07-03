"use client";

import { useState } from "react";
import { HORMESIS_LABELS, useHormesis } from "@/lib/domains/hormesis";
import StatCard from "@/components/shared/StatCard";
import BarList from "@/components/shared/BarList";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import type { HormesisType } from "@/lib/types";

const TYPES = Object.keys(HORMESIS_LABELS) as HormesisType[];

export default function HormesisPanel() {
  const { entries, addEntry, deleteEntry, stats } = useHormesis();
  const [type, setType] = useState<HormesisType>("cold_shower");
  const [durationMin, setDurationMin] = useState("5");
  const [intensity, setIntensity] = useState("3");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseInt(durationMin, 10);
    if (Number.isNaN(d) || d <= 0) return;
    addEntry(type, d, parseInt(intensity, 10), notes.trim());
    setNotes("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Track voluntary hormetic stressors — cold, heat, fasting, and exertion — that build resilience.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Current streak" value={`${stats.streak.current} days`} accent="good" />
        <StatCard label="Sessions (7d)" value={String(stats.sessionCount7d)} />
        <StatCard label="Minutes (7d)" value={String(stats.totalMinutes7d)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Minutes by type (7d)</h2>
        <BarList bars={Object.entries(stats.minutesByType).map(([label, value]) => ({ label, value }))} colorClassName="bg-cyan-500" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Log a session</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as HormesisType)} className={inputClass}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {HORMESIS_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Minutes"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={`${inputClass} w-24`}
          />
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5].map((i) => (
              <option key={i} value={i}>
                Intensity {i}/5
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">History</h2>
        {entries.length === 0 ? (
          <EmptyState message="No hormesis sessions logged yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {[...entries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 20)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span>
                    {e.date} · {HORMESIS_LABELS[e.type]} · {e.durationMin}min · intensity {e.intensity}/5
                    {e.notes && ` · ${e.notes}`}
                  </span>
                  <button onClick={() => deleteEntry(e.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
