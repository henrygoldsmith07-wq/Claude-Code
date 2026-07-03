interface Props {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "good" | "warn" | "bad";
}

const ACCENT_CLASSES: Record<NonNullable<Props["accent"]>, string> = {
  default: "border-zinc-200 dark:border-zinc-800",
  good: "border-emerald-300 dark:border-emerald-800",
  warn: "border-amber-300 dark:border-amber-800",
  bad: "border-rose-300 dark:border-rose-800",
};

export default function StatCard({ label, value, sublabel, accent = "default" }: Props) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${ACCENT_CLASSES[accent]}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sublabel && <div className="mt-0.5 text-xs text-zinc-500">{sublabel}</div>}
    </div>
  );
}
