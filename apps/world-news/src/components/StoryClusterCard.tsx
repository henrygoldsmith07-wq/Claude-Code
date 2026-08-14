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

function KindBadge({ kind }: { kind?: string }) {
  if (!kind || kind === "reported") return null;
  const cls =
    kind === "correction"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return <span className={`ml-1 rounded border px-1 py-0.5 text-[10px] font-medium ${cls}`}>{kind}</span>;
}

function SourceKindBadge({ kind }: { kind?: string }) {
  if (!kind || kind === "unknown") return null;
  const map: Record<string, string> = {
    wire: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    official: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    document: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    expert: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    newsroom: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  };
  return <span className={`rounded border px-1 py-0.5 text-[10px] ${map[kind] ?? "border-rule bg-panel-soft text-muted"}`}>{kind}</span>;
}

import ClaimProvenance from "./ClaimProvenance";
import SourceProvenancePanel from "./SourceProvenancePanel";
import { WhyThisMatters, WhatRemainsUnknown } from "./WhyWhatPanels";

export default function StoryClusterCard({ story }: { story: StoryCluster }) {
  const mix = story.sourceMix;
  const significance = typeof story.significance === "number" ? story.significance : null;
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight tracking-tight">{story.headline}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {significance !== null && (
            <span
              title={(story.significanceReasons ?? []).join(" · ")}
              className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
            >
              significance {significance}
            </span>
          )}
          <span className="shrink-0 rounded-full border border-rule bg-panel-soft px-2 py-0.5 text-[11px] font-medium text-muted">
            {story.topic}
          </span>
        </div>
      </div>
      {significance !== null && story.significanceReasons && story.significanceReasons.length > 0 && (
        <p className="mt-1 text-[11px] text-muted">Why it matters: {story.significanceReasons.join(" · ")}</p>
      )}

      {story.location?.label && (
        <p className="mt-1 text-xs text-muted">
          📍 {story.location.label}
          {story.location.countryCode ? ` · ${story.location.countryCode}` : ""}
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{story.summary}</p>
      {story.methodology?.provenanceNote && (
        <p className="mt-2 text-xs italic text-muted/80">Provenance: {story.methodology.provenanceNote}</p>
      )}

      {story.keyPoints.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {story.keyPoints.map((k, i) => {
            const src = story.sources[i] ?? story.sources[0];
            return (
              <li key={i} className="flex gap-2 text-sm text-muted">
                <span aria-hidden className="mt-1.5 h-1 w-1 flex-none rounded-full bg-accent" />
                <span className="flex-1">
                  {k}{" "}
                  {src && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-accent hover:underline" title={src.title}>
                      [source]
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {story.historicalContext && story.historicalContext.length > 0 && (
        <div className="mt-3 rounded-lg border border-rule bg-panel-soft p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Related earlier events</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-muted">
            {story.historicalContext.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted/70">Historical context — prior developments linked to this event.</p>
        </div>
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

      {/* Sources — live-linked, with kind + confidence */}
      {story.sources.length > 0 && (
        <div className="mt-3 rounded-lg border border-rule bg-background/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources — live links</p>
          <ul className="mt-2 space-y-1.5">
            {story.sources.slice(0, 8).map((s) => (
              <li key={s.url} className="flex flex-wrap items-center gap-2 text-sm">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                  {s.title}
                </a>
                <span className="text-xs text-muted">{domainOf(s.url)}</span>
                {s.countryCode && <span className="rounded bg-panel-soft px-1 py-0.5 text-[10px] text-muted">{s.countryCode}</span>}
                {s.perspective && s.perspective !== "unknown" && <PerspectiveBadge p={s.perspective} />}
                <SourceKindBadge kind={s.sourceKind} />
                {s.confidence && <span className="rounded border border-rule bg-panel-soft px-1 py-0.5 text-[10px] text-muted">{s.confidence} conf.</span>}
                {s.isPrimary && <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">primary</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Follow links to verify each claim. Source kind and confidence help gauge provenance.</p>
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Timeline — observed sequence (not causal)</p>
          <ol className="mt-2 space-y-1.5 border-l border-rule pl-3">
            {story.timeline.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-foreground">{e.date}</span>
                <span className="text-muted"> — {e.label}</span>
                <KindBadge kind={e.kind} />
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] text-muted">Timeline shows when things were reported, not why — causation only when an official source states it.</p>
        </div>
      )}

      {story.conflictingClaims.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Where accounts differ</p>
          <div className="mt-2 space-y-3">
            {story.conflictingClaims.map((c, i) => (
              <div key={i} className="space-y-1">
                {c.disagreementDimension && (
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300/80">Dimension: {c.disagreementDimension}</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-rule bg-panel p-2.5">
                    <p className="text-xs font-medium text-muted">Claim · {c.attributedTo.join(", ") || "—"}</p>
                    <p className="mt-1 text-sm text-foreground">{c.claim}</p>
                  </div>
                  <div className="rounded-lg border border-rule bg-panel p-2.5">
                    <p className="text-xs font-medium text-muted">Counter · {c.counterAttributedTo.join(", ") || "—"}</p>
                    <p className="mt-1 text-sm text-foreground">{c.counterClaim}</p>
                  </div>
                </div>
                {c.context && <p className="text-xs text-muted">{c.context}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {story.widelyAgreedFacts.length > 0 && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-success">Widely agreed — reported facts (attributed)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {story.widelyAgreedFacts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {story.uncertainty.length > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-700 bg-panel-soft p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Uncertainty — still unknown or disputed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {story.uncertainty.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      {story.methodology?.coverageScore !== undefined && (
        <p className="mt-2 text-[11px] text-muted">Coverage score {story.methodology.coverageScore}/100 — density, geography, perspective and kind diversity.</p>
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

      <div className="mt-3 space-y-3">
        <WhyThisMatters story={story} />
        <SourceProvenancePanel story={story} />
        <ClaimProvenance story={story} />
        <WhatRemainsUnknown story={story} />
      </div>

      {story.coverageGaps.length > 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-rule bg-panel-soft p-2.5 text-xs text-muted">
          <span className="font-medium text-muted">Coverage gaps:</span> {story.coverageGaps.join(" · ")}
        </p>
      )}
    </section>
  );
}
