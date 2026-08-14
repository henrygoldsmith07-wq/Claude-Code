"use client";
// Where this story's sourcing actually comes from.
//
// The panel is ordered by what most changes a reader's belief, not by what is
// most flattering to show. Origin count leads, because "seven sources" and "one
// wire carried by seven outlets" are opposite claims and only one of them is
// usually true. Open questions come last but are never omitted: a story with
// nothing established and six unanswered questions must not be able to render
// as a short, tidy, complete-looking card.

import { useMemo } from "react";
import type { StoryCluster } from "@/lib/storyModel";
import { summariseSyndication, SYNDICATION_METHODOLOGY } from "@/lib/syndication";
import { independenceReport, sourcesAsArticles, INDEPENDENCE_METHODOLOGY } from "@/lib/independence";
import { summariseEpistemics, STATUS_LABEL, STATUS_MEANING, type EpistemicStatus } from "@/lib/epistemic";
import { reconstructTimeline } from "@/lib/timeline";
import { propagateCorrections, type SourceCorrection } from "@/lib/corrections";

const STATUS_STYLE: Record<EpistemicStatus, string> = {
  known: "border-success/30 bg-success/5 text-success",
  disputed: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  unverified: "border-rule bg-panel-soft text-muted",
  withdrawn: "border-red-500/30 bg-red-500/5 text-red-300",
};

export default function SourceProvenancePanel({
  story,
  corrections = [],
}: {
  story: StoryCluster;
  corrections?: SourceCorrection[];
}) {
  const view = useMemo(() => {
    const articles = sourcesAsArticles(story.sources ?? []);
    return {
      syndication: summariseSyndication(articles),
      independence: independenceReport(story.sources ?? []),
      epistemics: summariseEpistemics(story, corrections),
      timeline: reconstructTimeline(articles),
      propagation: propagateCorrections(articles, corrections),
    };
  }, [story, corrections]);

  const { syndication, independence, epistemics, timeline, propagation } = view;
  const statuses: EpistemicStatus[] = ["known", "disputed", "unverified", "withdrawn"];
  const bucket = (s: EpistemicStatus) =>
    s === "known" ? epistemics.known : s === "disputed" ? epistemics.disputed : s === "unverified" ? epistemics.unverified : epistemics.withdrawn;

  return (
    <section className="space-y-3 rounded-xl border border-rule bg-panel p-4" aria-label="Source provenance">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Where this comes from</p>
        {/* Origins first, article count second — the other order is the lie. */}
        <p className="text-sm text-foreground">{syndication.headline}</p>
        <p className="text-xs text-muted">{independence.note}</p>
      </header>

      {syndication.syndicatedChains.length > 0 && (
        <div className="rounded-lg border border-rule bg-panel-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Syndication</p>
          <ul className="mt-1.5 space-y-1 text-sm text-foreground">
            {syndication.syndicatedChains.map((c) => (
              <li key={c.origin}>
                {c.wire ? `${c.wire}'s report` : "One original report"} carried by {c.carriers} other outlet
                {c.carriers === 1 ? "" : "s"}
                {c.inferred && (
                  <span className="ml-1 text-xs text-muted">
                    (the wire&apos;s own copy is not among these sources — inferred from credit lines)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {independence.groups.length > 0 && (
        <div className="rounded-lg border border-rule bg-panel-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why these count as separate accounts</p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            {independence.groups.map((g) => (
              <li key={g.key}>
                <span className="text-foreground">{g.members.join(", ")}</span> — {g.reason}
              </li>
            ))}
          </ul>
          {independence.unverifiable.length > 0 && (
            <p className="mt-2 text-xs text-amber-300/90">
              Ownership not recorded for {independence.unverifiable.join(", ")} — counted separately, never as
              corroboration.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{epistemics.headline}</p>
        <div className="mt-2 space-y-2">
          {statuses.map((s) => {
            const items = bucket(s);
            if (items.length === 0) return null;
            return (
              <div key={s} className={`rounded-lg border p-3 ${STATUS_STYLE[s]}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{STATUS_LABEL[s]}</p>
                <p className="mt-0.5 text-xs opacity-80">{STATUS_MEANING[s]}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {items.slice(0, 4).map((a, i) => (
                    <li key={i} className="text-sm text-foreground">
                      {/* Withdrawn claims are struck through, never deleted:
                          a reader who saw it yesterday is owed the update. */}
                      <span className={s === "withdrawn" ? "line-through opacity-70" : undefined}>{a.text}</span>
                      <span className="ml-1.5 text-xs text-muted">
                        · {a.origins} origin{a.origins === 1 ? "" : "s"} from {a.citations} citation
                        {a.citations === 1 ? "" : "s"}
                      </span>
                      {a.whatWouldSettleIt && (
                        <span className="mt-0.5 block text-xs text-muted">
                          Would settle it: {a.whatWouldSettleIt}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {propagation.uncorrectedCarriers.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Uncorrected copies</p>
          <p className="mt-1 text-sm text-foreground">{propagation.summary}</p>
        </div>
      )}

      {timeline.lagNote && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Reporting lag</p>
          <p className="mt-1 text-sm text-foreground">{timeline.lagNote}</p>
        </div>
      )}

      {/* Absence needs somewhere to be rendered or it reads as completeness. */}
      {epistemics.unknowns.length > 0 && (
        <div className="rounded-lg border border-rule bg-panel-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Not established ({epistemics.unknowns.length})
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {epistemics.unknowns.slice(0, 6).map((u, i) => (
              <li key={i} className="text-sm text-foreground">
                {u.question}
                <span className="mt-0.5 block text-xs text-muted">{u.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer">How these are worked out</summary>
        <p className="mt-1.5">{SYNDICATION_METHODOLOGY}</p>
        <p className="mt-1.5">{INDEPENDENCE_METHODOLOGY}</p>
      </details>
    </section>
  );
}
