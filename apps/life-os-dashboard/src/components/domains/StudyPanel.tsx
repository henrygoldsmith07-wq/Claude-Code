"use client";

import { useState } from "react";
import { useStudy } from "@/lib/domains/study";
import StatCard from "@/components/shared/StatCard";
import BarList from "@/components/shared/BarList";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";

export default function StudyPanel() {
  const { sessions, addSession, deleteSession, stats } = useStudy();
  const [subject, setSubject] = useState("");
  const [durationMin, setDurationMin] = useState("25");
  const [focusRating, setFocusRating] = useState("3");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = parseInt(durationMin, 10);
    if (!subject.trim() || Number.isNaN(d) || d <= 0) return;
    addSession(subject.trim(), d, parseInt(focusRating, 10), notes.trim());
    setNotes("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Track focused study sessions by subject and keep your streak going.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Current streak" value={`${stats.streak.current} days`} accent="good" />
        <StatCard label="Minutes (7d)" value={String(stats.totalMinutes7d)} />
        <StatCard label="Avg focus (7d)" value={`${stats.avgFocus7d.toFixed(1)}/5`} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Minutes by subject (7d)</h2>
        <BarList bars={Object.entries(stats.minutesBySubject).map(([label, value]) => ({ label, value }))} colorClassName="bg-violet-500" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Log a session</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="number"
            placeholder="Minutes"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={`${inputClass} w-24`}
          />
          <select value={focusRating} onChange={(e) => setFocusRating(e.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5].map((f) => (
              <option key={f} value={f}>
                Focus {f}/5
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
        {sessions.length === 0 ? (
          <EmptyState message="No study sessions logged yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {[...sessions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 20)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>
                    {s.date} · {s.subject} · {s.durationMin}min · focus {s.focusRating}/5
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
