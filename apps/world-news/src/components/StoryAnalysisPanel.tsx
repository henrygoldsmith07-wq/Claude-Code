import type { PageAnalysis, StoryAnalysis } from "@/lib/storyPipeline";
import { analysisSummary } from "@/lib/storyPipeline";
import { CLAIM_TYPE_LABEL, CLAIM_METHODOLOGY, type ClaimAssessment } from "@/lib/claims";
import { RELATION_LABEL } from "@/lib/storyRelations";

const TONE: Record<string, string> = {
  confirmed: "border-success/40 bg-success/10 text-success",
  allegation: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  analysis: "border-rule bg-panel-soft text-muted",
  prediction: "border-rule bg-panel-soft text-muted",
};

function ClaimRow({ claim, kind }: { claim: ClaimAssessment; kind: string }) {
  return (
    <li className="py-1.5">
      <p className="text-sm">{claim.text}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        <span className={`mr-1.5 rounded border px-1 py-px ${TONE[kind]}`}>{CLAIM_TYPE_LABEL[claim.type]}</span>
        {claim.corroboration.note}
        {claim.attributedTo.length > 0 && ` · attributed to ${claim.attributedTo.join(", ")}`}
        {claim.hedges.length > 0 && ` · hedged: ${claim.hedges.slice(0, 2).join(", ")}`}
      </p>
    </li>
  );
}

/**
 * What we can and cannot stand behind in one story.
 *
 * Deliberately leads with corroboration rather than the summary: the number a
 * reader needs first is how many independent accounts this rests on, and that
 * number is usually smaller than the source list implies.
 */
export function StoryAnalysisCard({ analysis }: { analysis: StoryAnalysis }) {
  const { claims, corroboration, diversity, geography, relations, unknowns } = analysis;
  const single = corroboration.independent <= 1;
  const groups: [string, ClaimAssessment[]][] = [
    ["confirmed", claims.confirmed],
    ["allegation", claims.allegations],
    ["analysis", claims.analysis],
    ["prediction", claims.predictions],
  ];

  return (
    <details className="rounded-xl border border-rule bg-panel p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {analysis.headline}
        <span className={`ml-2 rounded border px-1.5 py-px text-[11px] ${single ? TONE.allegation : TONE.confirmed}`}>
          {corroboration.independent} independent account{corroboration.independent === 1 ? "" : "s"}
        </span>
      </summary>

      <p className="mt-2 text-xs text-muted">{corroboration.note}</p>
      {analysis.changeSummary && (
        <p className="mt-1.5 rounded border border-accent/30 bg-accent/5 px-2 py-1 text-xs">
          Changed: {analysis.changeSummary}
        </p>
      )}

      {groups.some(([, list]) => list.length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What is claimed</p>
          <p className="mt-0.5 text-[11px] text-muted">{claims.summary}</p>
          <ul className="mt-1 divide-y divide-rule/50">
            {groups.flatMap(([kind, list]) =>
              list.map((c, i) => <ClaimRow key={`${kind}-${i}`} claim={c} kind={kind} />),
            )}
          </ul>
        </div>
      )}

      {unknowns.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What remains unknown</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
            {unknowns.map((u, i) => (
              <li key={i}>
                {u.question} <span className="opacity-70">— {u.basis}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Where</p>
          <p className="mt-0.5 text-xs text-muted">{geography.note}</p>
          {geography.regionLabel && <p className="text-xs text-muted">Region: {geography.regionLabel}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Who is reporting</p>
          <p className="mt-0.5 text-xs text-muted">{diversity.note}</p>
          {diversity.gaps.slice(0, 2).map((g, i) => (
            <p key={i} className="text-xs text-muted opacity-80">
              {g}
            </p>
          ))}
        </div>
      </div>

      {analysis.provenance.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Original vs carried</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            {analysis.provenance.slice(0, 6).map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.publisher}</span> — {p.originality} ({p.originalityScore})
                {p.reasons[0] ? ` · ${p.reasons[0]}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {relations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Related</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            {relations.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{RELATION_LABEL[r.kind]}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

/** Page-level analysis: the numbers first, then one card per story. */
export default function StoryAnalysisPanel({ analysis }: { analysis: PageAnalysis }) {
  if (analysis.stories.length === 0) return null;
  const s = analysisSummary(analysis);

  return (
    <section className="rounded-xl border border-rule bg-panel-soft p-4" aria-label="Verification and sourcing analysis">
      <h2 className="text-sm font-semibold">Verification &amp; sourcing</h2>
      <p className="mt-1 text-xs text-muted">{analysis.note}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Corroborated", s.confirmed],
          ["Unverified", s.unverified],
          ["Interpretation", s.interpretation],
          ["Forward-looking", s.forwardLooking],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-rule bg-panel p-2 text-center">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {(s.singleAccountStories > 0 || s.unplacedStories > 0) && (
        <p className="mt-2 text-xs text-amber-300">
          {s.singleAccountStories > 0 && `${s.singleAccountStories} story/stories rest on a single independent account. `}
          {s.unplacedStories > 0 && `${s.unplacedStories} could not be placed on the map.`}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {analysis.stories.map((a) => (
          <StoryAnalysisCard key={a.storyId} analysis={a} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted">{CLAIM_METHODOLOGY}</p>
    </section>
  );
}
