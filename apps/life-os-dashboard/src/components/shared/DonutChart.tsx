"use client";

const COLORS = [
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#22c55e",
  "#ef4444",
  "#84cc16",
];

interface Props {
  values: Record<string, number>;
  formatValue?: (n: number) => string;
  onSelect?: (key: string) => void;
}

export default function DonutChart({ values, formatValue = String, onSelect }: Props) {
  const entries = Object.entries(values).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  if (total === 0) {
    return <p className="text-sm text-zinc-500">Nothing to chart yet.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg width={160} height={160} viewBox="0 0 160 160" className="-rotate-90">
        {entries.map(([key, n], i) => {
          const fraction = n / total;
          const dash = fraction * circumference;
          const segment = (
            <circle
              key={key}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={22}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              onClick={() => onSelect?.(key)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <title>{key}</title>
            </circle>
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {entries.map(([key, n], i) => (
          <li key={key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {onSelect ? (
              <button type="button" onClick={() => onSelect(key)} className="hover:underline">
                {key}
              </button>
            ) : (
              <span>{key}</span>
            )}
            <span className="text-zinc-500">
              {formatValue(n)} ({((n / total) * 100).toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
