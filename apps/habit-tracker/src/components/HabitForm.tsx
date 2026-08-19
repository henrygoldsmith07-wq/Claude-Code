"use client";

import { useState } from "react";
import type { HabitInput } from "@/lib/supabase";

const COLOURS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

interface HabitFormProps {
  /** When set, the form edits this habit instead of creating one. */
  initial?: HabitInput;
  submitLabel?: string;
  onSubmit: (input: HabitInput) => void;
  onCancel?: () => void;
}

export function HabitForm({ initial, submitLabel = "Add habit", onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetPerWeek, setTargetPerWeek] = useState(initial?.targetPerWeek ?? 3);
  const [colour, setColour] = useState(initial?.colour ?? COLOURS[0]!);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), targetPerWeek, colour });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <p>
        <label htmlFor="habit-name" className="mb-1 block text-sm font-medium">
          Habit
        </label>
        <input
          id="habit-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Read for 20 minutes"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          required
        />
      </p>

      <div className="flex flex-wrap gap-6">
        <p>
          <label htmlFor="habit-target" className="mb-1 block text-sm font-medium">
            Days per week
          </label>
          <select
            id="habit-target"
            value={targetPerWeek}
            onChange={(event) => setTargetPerWeek(Number(event.target.value))}
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} day{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </p>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Colour</legend>
          <div className="flex gap-2">
            {COLOURS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use colour ${swatch}`}
                aria-pressed={colour === swatch}
                onClick={() => setColour(swatch)}
                className={`h-7 w-7 rounded-full transition-transform ${colour === swatch ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-onaccent transition-opacity hover:opacity-90"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-ink3 hover:text-ink"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
