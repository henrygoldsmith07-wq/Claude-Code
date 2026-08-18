"use client";

import type { HabitView } from "@/lib/supabase";

function weekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(month ?? 1) - 1]} ${day}`;
}

export function HistoryTable({ views }: { views: readonly HabitView[] }) {
  const weeks = views[0]?.weeks ?? [];
  const active = views.filter((view) => !view.archived);

  if (active.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-6 text-ink2">No habits to show.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">Weekly check-in history by habit</caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink3">
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Habit
            </th>
            {weeks.map((week) => (
              <th key={week.weekStart} scope="col" className="px-3 py-3 text-right font-medium">
                {weekLabel(week.weekStart)}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Best
            </th>
          </tr>
        </thead>
        <tbody>
          {active.map((view) => (
            <tr key={view.id} className="border-b border-line last:border-0">
              <th scope="row" className="flex items-center gap-2 px-4 py-3 text-left font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: view.colour }} aria-hidden="true" />
                <span className="truncate">{view.name}</span>
              </th>
              {view.weeks.map((week) => {
                const met = week.count >= view.targetPerWeek;
                return (
                  <td key={week.weekStart} className="px-3 py-3 text-right tabular-nums">
                    <span className={met ? "font-semibold text-success" : "text-ink2"}>
                      {week.count}/{view.targetPerWeek}
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right tabular-nums text-ink2">{view.best}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
