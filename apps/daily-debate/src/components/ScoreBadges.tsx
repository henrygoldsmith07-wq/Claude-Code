import type { TurnScores } from "@/lib/types";

const LABELS: Record<keyof TurnScores, string> = {
  depth: "Depth",
  evidence: "Evidence",
  logic: "Logic",
  rebuttal: "Rebuttal",
  clarity: "Clarity",
};

export default function ScoreBadges({ scores }: { scores: TurnScores }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(LABELS) as (keyof TurnScores)[]).map((key) => (
        <span
          key={key}
          className="chip-elevated tabular rounded-full px-2 py-0.5 text-xs text-[var(--accent)]"
        >
          {LABELS[key]} {scores[key]}/10
        </span>
      ))}
    </div>
  );
}
