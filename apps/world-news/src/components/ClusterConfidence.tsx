"use client";
import type { Cluster } from "@/lib/clustering";

export default function ClusterConfidence({ cluster }: { cluster: Cluster }) {
  const pct = Math.round(cluster.confidence * 100);
  const tone =
    pct >= 70
      ? "border-success/40 bg-success/10 text-success"
      : pct >= 45
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-rule bg-panel-soft text-muted";
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">
        Clustering confidence · {pct}%
        <span className="ml-2 font-normal normal-case tracking-normal opacity-80">
          {pct >= 70 ? "corroborated" : pct >= 45 ? "needs scrutiny" : "single source"}
        </span>
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs opacity-90">
        {cluster.confidenceReasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] opacity-70">
        {cluster.memberIds.length} article{cluster.memberIds.length === 1 ? "" : "s"} ·{" "}
        {cluster.countries.length ? cluster.countries.join(", ") : "no country tag"} · threshold
        0.42 · score = title + tags + proximity + topic + diversity
      </p>
    </div>
  );
}
