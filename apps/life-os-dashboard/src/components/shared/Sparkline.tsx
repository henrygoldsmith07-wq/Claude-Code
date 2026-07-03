"use client";

interface Props {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}

export default function Sparkline({
  points,
  color = "#14b8a6",
  height = 100,
  formatValue = (n) => n.toFixed(1),
}: Props) {
  if (points.length === 0) {
    return <p className="text-sm text-zinc-500">No data yet.</p>;
  }

  const width = Math.max(points.length * 32, 160);
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : i * stepX;
    const y = height - ((p.value - min) / range) * (height - 16) - 8;
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height + 24} className="min-w-full">
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={3} fill={color}>
            <title>
              {c.label}: {formatValue(c.value)}
            </title>
          </circle>
        ))}
        {coords.map((c, i) =>
          i % Math.max(Math.ceil(coords.length / 8), 1) === 0 ? (
            <text
              key={`${c.label}-label`}
              x={c.x}
              y={height + 18}
              fontSize={10}
              textAnchor="middle"
              className="fill-zinc-500"
            >
              {c.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
