"use client";

import { todayISO } from "@/lib/date";
import type { HabitView } from "@/lib/supabase";

interface TodayListProps {
  views: readonly HabitView[];
  toggle: (habitId: string, day: string, completed: boolean) => Promise<void>;
}

export function TodayList({ views, toggle }: TodayListProps) {
  if (views.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-ink2">
        No habits yet. Add the first one in <strong>Manage</strong> — start with
        something small enough to do on a bad day.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {views.map((view) => {
        const pct = Math.min(100, Math.round((view.weekCount / view.targetPerWeek) * 100));
        return (
          <li key={view.id} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
            <button
              type="button"
              aria-pressed={view.doneToday}
              aria-label={`${view.doneToday ? "Undo" : "Mark done"} today: ${view.name}`}
              onClick={() => void toggle(view.id, todayISO(), !view.doneToday)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold transition-colors ${
                view.doneToday
                  ? "border-success bg-success text-onaccent"
                  : "border-line bg-bg text-ink3 hover:border-success"
              }`}
            >
              {view.doneToday ? "✓" : ""}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: view.colour }} aria-hidden="true" />
                <span className="truncate font-medium">{view.name}</span>
                {view.streak > 0 ? (
                  <span className="rounded-full bg-successsoft px-2 py-0.5 text-xs font-medium text-success">
                    {view.streak} day{view.streak === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-ink3">
                  <span>
                    {view.weekCount}/{view.targetPerWeek} this week
                  </span>
                  <span>{Math.round(view.rate7 * 100)}% last 7 days · best {view.best}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Weekly progress for ${view.name}`}>
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
