import type { Item } from "@/lib/types";
import { isSameWeek } from "@/lib/date";

type PersonStats = {
  name: string;
  color: string;
  noticed: number;
  resolved: number;
};

function buildStats(items: Item[]): PersonStats[] {
  const now = new Date();
  const byName = new Map<string, PersonStats>();

  function ensure(name: string, color: string): PersonStats {
    const existing = byName.get(name);
    if (existing) return existing;
    const created: PersonStats = { name, color, noticed: 0, resolved: 0 };
    byName.set(name, created);
    return created;
  }

  for (const item of items) {
    if (isSameWeek(new Date(item.created_at), now)) {
      ensure(item.noticed_by, item.noticed_by_color).noticed += 1;
    }
    if (item.resolved && item.resolved_at && isSameWeek(new Date(item.resolved_at), now)) {
      ensure(item.resolved_by ?? item.noticed_by, item.noticed_by_color).resolved += 1;
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function WeeklyDigest({ items }: { items: Item[] }) {
  const stats = buildStats(items);

  if (stats.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        This week
      </h2>
      <div className="flex flex-wrap gap-6">
        {stats.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium">{s.name}</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                noticed {s.noticed} &middot; resolved {s.resolved}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        No score, no leaderboard — just what showed up this week.
      </p>
    </div>
  );
}
