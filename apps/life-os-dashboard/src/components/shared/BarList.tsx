import ProgressBar from "./ProgressBar";

interface Props {
  bars: { label: string; value: number }[];
  formatValue?: (n: number) => string;
  colorClassName?: string;
}

export default function BarList({ bars, formatValue = String, colorClassName }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  if (bars.length === 0) {
    return <p className="text-sm text-zinc-500">No data yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {bars.map((b) => (
        <li key={b.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate">{b.label}</span>
          <div className="flex-1">
            <ProgressBar pct={(b.value / max) * 100} colorClassName={colorClassName} />
          </div>
          <span className="w-16 shrink-0 text-right text-zinc-500">{formatValue(b.value)}</span>
        </li>
      ))}
    </ul>
  );
}
