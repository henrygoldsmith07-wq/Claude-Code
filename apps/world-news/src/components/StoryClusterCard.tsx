"use client";

import type { StoryCluster } from "@/lib/storyModel";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PerspectiveBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    left: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    "center-left": "bg-sky-500/10 text-sky-300 border-sky-500/20",
    center: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    "center-right": "bg-amber-500/10 text-amber-300 border-amber-500/20",
    right: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    unknown: "bg-panel-soft text-muted border-rule",
  };
  const cls = map[p] ?? map.unknown;
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {p}
    </span>
  );
}

export default function StoryClusterCard({ story }: { story: StoryCluster }) {
  const mix = story.sourceMix;
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight tracking-tight">{story.headline}</h2>
        <span className="shrink-0 rounded-full border border-rule bg-panel-soft px-2 py-0.5 text-[11px] font-medium text-muted">
          {story.topic}
        </span>
      </div>

      {story.location?.label && (
        <p className="mt-1 text-xs text-muted">
          📍 {story.location.label}
          {story.location.countryCode ? ` · ${story.location.countryCode}` : ""}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{story.summary}</p>

      {story.keyPoints.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {story.keyPoints.map((k, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted">
              <span aria-hidden className="mt-1.5 h-1 w-1 flex-none rounded-full bg-accent" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Who is reporting it */}
      <div className="mt-4 rounded-lg border border-rule bg-panel-soft p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Who is reporting it</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {mix.byCountry.length > 0 ? (
            mix.byCountry.map((c) => (
              <span key={c.code} className="rounded-full border border-rule bg-panel px-2 py-0.5 text-muted">
                {c.label} · {c.count}
              </span>
            ))
          ) : (
            <span className="text-muted">No country mix yet</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mix.byPerspective.length > 0 ? (
            mix.byPerspective.map((x) => (
              <span key={x.perspective} className="inline-flex items-center gap-1 text-xs text-muted">
                <PerspectiveBadge p={x.perspective} />
                <span>×{x.count}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">Perspective mix unavailable</span>
          )}
        </div>
        {mix.primaryCount > 0 && (
          <p className="mt-2 text-xs text-success">Includes {mix.primaryCount} primary source{mix.primaryCount === 1 ? "" : "s"} (official docs/statements).</p>
        )}
        <p className="mt-1 text-[11px] text-muted">{mix.total} source{mix.total === 1 ? "" : "s"} in this cluster</p>
      </div>

      {/* Sources */}
      {story.sources.length > 0 && (
        <div className="mt-3 rounded-lg border border-rule bg-background/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
          <ul className="mt-2 space-y-1.5">
            {story.sources.slice(0, 8).map((s) => (
              <li key={s.url} className="flex flex-wrap items-center gap-2 text-sm">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                  {s.title}
                </a>
                <span className="text-xs text-muted">{domainOf(s.url)}</span>
                {s.countryCode && <span className="rounded bg-panel-soft px-1 py-0.5 text-[10px] text-muted">{s.countryCode}</span>}
                {s.perspective && s.perspective !== "unknown" && <PerspectiveBadge p={s.perspective} />}
                {s.isPrimary && <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">primary</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {story.primarySources.length > 0 && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">Primary sources</p>
          <ul className="mt-2 space-y-1">
            {story.primarySources.slice(0, 6).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                  {s.title}
                </a>
                <span className="ml-2 text-xs text-muted">{domainOf(s.url)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {story.timeline.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Timeline</p>
          <ol className="mt-2 space-y-1.5 border-l border-rule pl-3">
            {story.timeline.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-foreground">{e.date}</span>
                <span className="text-muted"> — {e.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {story.conflictingClaims.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Where accounts differ</p>
          <div className="mt-2 space-y-3">
            {story.conflictingClaims.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-rule bg-panel p-2.5">
                  <p className="text-xs font-medium text-muted">Claim · {c.attributedTo.join(", ") || "—"}</p>
                  <p className="mt-1 text-sm text-foreground">{c.claim}</p>
                </div>
                <div className="rounded-lg border border-rule bg-panel p-2.5">
                  <p className="text-xs font-medium text-muted">Counter · {c.counterAttributedTo.join(", ") || "—"}</p>
                  <p className="mt-1 text-sm text-foreground">{c.counterClaim}</p>
                </div>
                {c.context && <p className="sm:col-span-2 text-xs text-muted">{c.context}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {story.widelyAgreedFacts.length > 0 && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">Widely agreed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {story.widelyAgreedFacts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {story.uncertainty.length > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-700 bg-panel-soft p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Uncertainty</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {story.uncertainty.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {story.corrections.length > 0 && (
        <div className="mt-3 rounded-lg border border-rule bg-panel p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Correction history</p>
          <ul className="mt-2 space-y-1">
            {story.corrections.map((c, i) => (
              <li key={i} className="text-sm text-muted">
                <span className="font-medium text-foreground">{c.date}</span> — {c.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {story.coverageGaps.length > 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-rule bg-panel-soft p-2.5 text-xs text-muted">
          <span className="font-medium text-muted">Coverage gaps:</span> {story.coverageGaps.join(" · ")}
        </p>
      )}
    </section>
  );
}
