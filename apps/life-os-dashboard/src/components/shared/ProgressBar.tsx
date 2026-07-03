interface Props {
  pct: number;
  colorClassName?: string;
}

export default function ProgressBar({ pct, colorClassName = "bg-emerald-500" }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className={`h-full rounded-full ${colorClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
