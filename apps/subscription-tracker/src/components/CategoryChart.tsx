"use client";

import { formatCents } from "@/lib/money";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#84cc16",
];

interface Props {
  spendByCategory: Record<string, number>;
  countByCategory?: Record<string, number>;
  onSelectCategory?: (category: string) => void;
}

export default function CategoryChart({ spendByCategory, countByCategory, onSelectCategory }: Props) {
  const entries = Object.entries(spendByCategory).filter(([, cents]) => cents > 0);
  const total = entries.reduce((sum, [, cents]) => sum + cents, 0);

  if (total === 0) {
    return <p className="text-sm text-ink3">No active spend to chart yet.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg width={160} height={160} viewBox="0 0 160 160" className="-rotate-90">
        {entries.map(([category, cents], i) => {
          const fraction = cents / total;
          const dash = fraction * circumference;
          const segment = (
            <circle
              key={category}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={22}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              onClick={() => onSelectCategory?.(category)}
              className={onSelectCategory ? "cursor-pointer" : undefined}
            >
              <title>{category}</title>
            </circle>
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {entries.map(([category, cents], i) => (
          <li key={category} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {onSelectCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(category)}
                className="hover:underline"
              >
                {category}
              </button>
            ) : (
              <span>{category}</span>
            )}
            <span className="text-ink3">
              {formatCents(cents)} ({((cents / total) * 100).toFixed(0)}%)
              {countByCategory && ` · ${countByCategory[category] ?? 0} sub(s)`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
