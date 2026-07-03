"use client";

import { useState } from "react";
import { useMeditation } from "@/lib/domains/meditation";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";

const TYPES = ["Mindfulness", "Breathwork", "Body scan", "Loving-kindness", "Guided", "Silent"];

export default function MeditationPanel() {
  const { sessions, addSession, deleteSession, stats } = useMeditation();
  const [type, setType] = useState(TYPES[0]);
  const [durationMin, setDurationMin] = useState("10");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseInt(durationMin, 10);
    if (Number.isNaN(d) || d <= 0) return;
    addSession(type, d, notes.trim());
    setNotes("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Log meditation sessions and keep your practice consistent.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Current streak" value={`${stats.streak.current} days`} accent="good" />
        <StatCard label="Minutes (7d)" value={String(stats.totalMinutes7d)} />
        <StatCard label="Total minutes (all time)" value={String(stats.totalMinutesAllTime)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Log a session</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Minutes"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={`${inputClass} w-24`}
          />
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
        {sessions.length === 0 ? (
          <EmptyState message="No meditation sessions logged yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {[...sessions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 20)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    {s.date} · {s.type} · {s.durationMin}min {s.notes && `· ${s.notes}`}
                  </span>
                  <button onClick={() => deleteSession(s.id)} className="text-zinc-400 hover:text-rose-500">
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
