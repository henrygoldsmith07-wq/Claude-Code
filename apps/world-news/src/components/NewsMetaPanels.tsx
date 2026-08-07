import type { CountryNews } from "@/lib/gemini";
import { coverageGapsHeuristic } from "@/lib/storyAnalysis";

export function WhatChangedPanel({ news }: { news: CountryNews }) {
  const msg = news.meta?.whatChangedSinceYesterday;
  if (!msg) return null;
  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">What changed since yesterday</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{msg}</p>
    </section>
  );
}

export function AgreedFactsPanel({ news }: { news: CountryNews }) {
  const facts = news.meta?.widelyAgreedFacts ?? [];
  if (facts.length === 0) return null;
  return (
    <section className="rounded-xl border border-success/30 bg-success/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-success">Widely agreed</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {facts.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </section>
  );
}

export function UncertaintyPanel({ news }: { news: CountryNews }) {
  const items = news.meta?.uncertainty ?? [];
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-rule bg-panel-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Uncertainty</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {items.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>
    </section>
  );
}

export function CoverageGapsPanel({ news }: { news: CountryNews }) {
  const gaps = coverageGapsHeuristic(news);
  if (gaps.length === 0) return null;
  return (
    <section className="rounded-xl border border-dashed border-rule bg-panel/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Coverage gaps</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {gaps.map((g, i) => (
          <li key={i}>{g}</li>
        ))}
      </ul>
    </section>
  );
}

export function CorrectionsPanel({ news }: { news: CountryNews }) {
  const items = news.meta?.corrections ?? [];
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Correction history</p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {items.map((c, i) => (
          <li key={i}>
            <span className="font-medium text-foreground">{c.date}</span> — {c.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
