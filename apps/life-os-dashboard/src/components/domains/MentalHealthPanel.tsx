"use client";

import { useState } from "react";
import { useMentalHealth } from "@/lib/domains/mentalHealth";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";

export default function MentalHealthPanel() {
  const {
    moods,
    journal,
    logMood,
    deleteMood,
    addGratitude,
    gratitude,
    addJournalEntry,
    deleteJournalEntry,
    stats,
  } = useMentalHealth();
  const [mood, setMood] = useState("3");
  const [stress, setStress] = useState("3");
  const [moodNotes, setMoodNotes] = useState("");
  const [gratitudeText, setGratitudeText] = useState("");
  const [journalText, setJournalText] = useState("");

  function handleMoodSubmit(e: React.FormEvent) {
    e.preventDefault();
    logMood(parseInt(mood, 10), parseInt(stress, 10), moodNotes.trim());
    setMoodNotes("");
  }

  function handleGratitudeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = gratitudeText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    addGratitude(items);
    setGratitudeText("");
  }

  function handleJournalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!journalText.trim()) return;
    addJournalEntry(journalText.trim());
    setJournalText("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Check in on mood and stress, practice gratitude, and journal freely.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Mood today" value={stats.todayMood ? `${stats.todayMood.mood}/5` : "not logged"} />
        <StatCard label="7-day avg mood" value={stats.avgMood7d ? stats.avgMood7d.toFixed(1) : "—"} />
        <StatCard label="Gratitude streak" value={`${stats.gratitudeStreak.current} days`} accent="good" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Daily check-in</h2>
        <form onSubmit={handleMoodSubmit} className="flex flex-wrap gap-2">
          <select value={mood} onChange={(e) => setMood(e.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>
                Mood {m}/5
              </option>
            ))}
          </select>
          <select value={stress} onChange={(e) => setStress(e.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                Stress {s}/5
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notes"
            value={moodNotes}
            onChange={(e) => setMoodNotes(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Save today
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Gratitude</h2>
        <form onSubmit={handleGratitudeSubmit} className="flex flex-col gap-2">
          <textarea
            placeholder="One thing per line you're grateful for today"
            value={gratitudeText}
            onChange={(e) => setGratitudeText(e.target.value)}
            className={`${inputClass} h-20`}
          />
          <button type="submit" className={`${buttonClass} self-start`}>
            Save
          </button>
        </form>
        {gratitude.length === 0 ? (
          <EmptyState message="No gratitude entries yet." />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...gratitude]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((g) => (
                <li key={g.id}>
                  {g.date}: {g.items.join(", ")}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Journal</h2>
        <form onSubmit={handleJournalSubmit} className="flex flex-col gap-2">
          <textarea
            placeholder="Write freely..."
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            className={`${inputClass} h-28`}
          />
          <button type="submit" className={`${buttonClass} self-start`}>
            Save entry
          </button>
        </form>
        {journal.length === 0 ? (
          <EmptyState message="No journal entries yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {[...journal]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map((j) => (
                <li key={j.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                    <span>{j.date}</span>
                    <button onClick={() => deleteJournalEntry(j.id)} className="text-zinc-400 hover:text-rose-500">
                      ✕
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap">{j.content}</p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {moods.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Recent mood log</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {[...moods]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span>
                    {m.date} · mood {m.mood}/5 · stress {m.stress}/5 {m.notes && `· ${m.notes}`}
                  </span>
                  <button onClick={() => deleteMood(m.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
