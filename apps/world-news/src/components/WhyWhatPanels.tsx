"use client";
import type { StoryCluster } from "@/lib/storyModel";
import { whatChangedSince } from "@/lib/provenance";

export function WhyThisMatters({ story }: { story: StoryCluster }) {
  const reasons = story.significanceReasons ?? [];
  const ctx = story.historicalContext ?? [];
  const coverage = story.methodology?.coverageScore;
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Why this matters</p>
      <p className="mt-2 text-sm text-foreground/90">{reasons.length? reasons.join(" · ") : "Editorial significance based on corroboration breadth, cross-border coverage, primary sources and recency."}</p>
      {coverage!=null && <p className="mt-1 text-xs text-muted">Coverage score {coverage}/100 · significance {story.significance ?? "—"}/100</p>}
      {ctx.length>0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted">{ctx.map((c,i)=><li key={i}>{c}</li>)}</ul>}
    </div>
  );
}

export function WhatChangedSinceLast({ prev, next }: { prev: StoryCluster | null; next: StoryCluster }) {
  const { changed, summary } = whatChangedSince(prev, next);
  if (!changed || !summary) return null;
  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">What changed since last update</p>
      <p className="mt-1 text-sm text-muted">{summary}</p>
    </div>
  );
}

export function WhatRemainsUnknown({ story }: { story: StoryCluster }) {
  if (!story.uncertainty.length && !story.coverageGaps.length) return null;
  return (
    <div className="rounded-xl border border-dashed border-rule bg-panel/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">What remains unknown</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {story.uncertainty.map((u,i)=><li key={`u-${i}`}>{u}</li>)}
        {story.coverageGaps.map((g,i)=><li key={`g-${i}`}>{g}</li>)}
      </ul>
    </div>
  );
}
