// Known / disputed / unknown — one status model, and absence made visible.
//
// The app had several overlapping vocabularies for how settled something is:
// `ClaimType` (confirmed/allegation/analysis/prediction), a `confidence`
// enum, a `disputed` boolean, an `uncertainty` string list and a
// `coverageGaps` string list. Each was reasonable alone; together they let the
// same statement appear as "corroborated" in one panel and "uncertain" in
// another, which teaches a reader that the labels do not mean anything.
//
// This module composes the pieces built around it — claim classification,
// syndication origins, independence, corrections — into a single status per
// statement, and derives the reasons from those inputs rather than restating
// them.
//
// The second job is harder and matters more. **Unknown has to be rendered.**
// A missing fact has no natural place in an interface: nothing arrives to lay
// out, so the space closes up and the page looks complete. That is how a story
// with one anonymous source and no local coverage ends up reading exactly like
// a story with six independent newsrooms behind it. So unknowns are computed as
// first-class objects, with the reason they are unknown and what would settle
// them, and they occupy space on the page.
//
// Pure + deterministic. No network.

import type { SourceAttribution, StoryCluster } from "./storyModel";
import { classifyClaim, supportersFor, type ClaimType } from "./claims";
import { originsForClaim, independenceReport, ownerOf } from "./independence";
import { correctionEffectOnClaim, type SourceCorrection } from "./corrections";
import { estimateEventTime } from "./timeline";
import { sourcesAsArticles } from "./independence";
import { lookupSource } from "./sourceRegistry";
import { isOfficialHost } from "./dedup";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type EpistemicStatus =
  /** Two or more independently originated accounts, uncontested and uncorrected. */
  | "known"
  /** Sources actively contradict each other. */
  | "disputed"
  /** Reported, but resting on a single origin. */
  | "unverified"
  /** Its support has been retracted or corrected away. */
  | "withdrawn";

export const STATUS_LABEL: Record<EpistemicStatus, string> = {
  known: "Known",
  disputed: "Disputed",
  unverified: "Unverified",
  withdrawn: "Withdrawn",
};

export const STATUS_MEANING: Record<EpistemicStatus, string> = {
  known: "Two or more independently originated reports agree, and none has been corrected.",
  disputed: "Sources contradict each other. Both accounts are shown; neither is adjudicated here.",
  unverified: "Reported, but everything supporting it traces back to a single original report.",
  withdrawn: "The reporting behind this has been corrected or retracted. Kept visible because it was published.",
};

export interface StatusAssessment {
  text: string;
  status: EpistemicStatus;
  /** What kind of statement it is — orthogonal to how settled it is. */
  claimType: ClaimType;
  citations: number;
  /** Distinct original reports behind those citations. */
  origins: number;
  /** Independent accounts by ownership. */
  independent: number;
  explanation: string;
  /** Concretely, what would move this to "known". */
  whatWouldSettleIt?: string;
  reasons: string[];
}

/**
 * Assess one statement.
 *
 * Precedence is withdrawn → disputed → known → unverified. A retracted claim is
 * not "disputed" (nobody is arguing for it any more), and a disputed claim is
 * never "known" however many outlets carry one side — a count of sources on the
 * loudest side is not a resolution of the disagreement.
 */
export function assessStatement(
  text: string,
  supporters: SourceAttribution[],
  options: {
    disputed?: boolean;
    corrections?: SourceCorrection[];
  } = {},
): StatusAssessment {
  const classification = classifyClaim(text, supporters, { disputed: options.disputed, ownerOf });
  // Only the sources that actually assert this statement. Passing the story's
  // whole source list would credit every claim with every source on the page,
  // which is precisely the inflation the origin count exists to prevent.
  const supporting = supportersFor(text, supporters);
  const originReport = originsForClaim(text, supporting);
  const independence = independenceReport(supporting);
  const correction = correctionEffectOnClaim(text, supporting, options.corrections ?? []);

  const origins = originReport.originCount;
  const reasons: string[] = [];

  let status: EpistemicStatus;
  if (correction.status === "withdrawn") {
    status = "withdrawn";
    reasons.push(correction.note);
  } else if (options.disputed) {
    status = "disputed";
    reasons.push("Sources give contradictory accounts of this.");
  } else if (origins >= 2 && independence.independent >= 2) {
    status = "known";
    reasons.push(`${origins} separately originated reports from ${independence.independent} independent owners.`);
  } else {
    status = "unverified";
    reasons.push(originReport.note);
  }

  if (correction.status === "weakened") reasons.push(correction.note);
  if (originReport.overstated) reasons.push("The citation count overstates the evidence — see the origin breakdown.");
  if (independence.unverifiable.length) {
    reasons.push(`Ownership unrecorded for: ${independence.unverifiable.join(", ")}.`);
  }

  const explanation =
    status === "known"
      ? `Corroborated by ${origins} independent reports.`
      : status === "disputed"
        ? "Accounts conflict; both are shown."
        : status === "withdrawn"
          ? "The reporting behind this has been withdrawn."
          : originReport.citations === 0
            ? "Nothing in this story's sources supports this statement."
            : `Rests on ${origins === 1 ? "a single original report" : `${origins} reports`}.`;

  const whatWouldSettleIt =
    status === "known"
      ? undefined
      : status === "disputed"
        ? "A primary record — an official document, court filing or dataset — that either account can be checked against."
        : status === "withdrawn"
          ? "A fresh report from an outlet that has not retracted."
          : origins <= 1
            ? "One further report originating from an outlet that is not carrying this one."
            : "Confirmation from an outlet with recorded, separate ownership.";

  return {
    text,
    status,
    claimType: classification.type,
    citations: originReport.citations,
    origins,
    independent: independence.independent,
    explanation,
    whatWouldSettleIt,
    reasons: reasons.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Unknowns
// ---------------------------------------------------------------------------

export interface Unknown {
  /** The open question, phrased as a question. */
  question: string;
  /** Why it is open. */
  why: string;
  /** Where the gap came from: computed by us, or stated by the sources. */
  origin: "computed" | "reported";
}

/**
 * Derive the things this story does not establish.
 *
 * These are computed from structure rather than read off a model's
 * `uncertainty` list, which means they cannot be omitted by a generation step
 * that produced a confident-sounding summary. A story with one wire origin and
 * no local outlet will say so whether or not anything upstream noticed.
 */
export function unknownsFor(
  story: Pick<StoryCluster, "sources" | "primarySources" | "uncertainty" | "coverageGaps" | "location">,
): Unknown[] {
  const out: Unknown[] = [];
  const sources = story.sources ?? [];
  const articles = sourcesAsArticles(sources);

  // --- Structural gaps ------------------------------------------------------
  const hasPrimary =
    (story.primarySources ?? []).length > 0 || sources.some((s) => s.isPrimary || isOfficialHost(s.url));
  if (!hasPrimary && sources.length > 0) {
    out.push({
      question: "Is there a primary record behind this?",
      why: "No official document, filing or dataset is cited — every account here is journalism about the event, not the record of it.",
      origin: "computed",
    });
  }

  const independence = independenceReport(sources);
  if (sources.length > 1 && independence.independent <= 1) {
    out.push({
      question: "Has anyone confirmed this independently?",
      why: "Every source here reduces to a single account once shared ownership and syndication are removed.",
      origin: "computed",
    });
  }

  const cc = story.location?.countryCode;
  if (cc && sources.length > 0) {
    const local = sources.some((s) => lookupSource(s.publisher ?? s.url).countryCode === cc.toUpperCase());
    if (!local) {
      out.push({
        question: `Has any outlet based in ${story.location?.label ?? cc} reported this?`,
        why: "All coverage here is from outlets based elsewhere, which is a different thing from local reporting.",
        origin: "computed",
      });
    }
  }

  if (articles.length > 0) {
    const estimate = estimateEventTime(articles);
    if (estimate.precision === "unknown") {
      out.push({
        question: "When did this actually happen?",
        why: "No source states a date; only the times at which reports were published are known.",
        origin: "computed",
      });
    }
    if (estimate.contradictions.length > 0) {
      out.push({
        question: "Which date is right?",
        why: `Sources place this at ${estimate.contradictions.length + 1} different times.`,
        origin: "computed",
      });
    }
  }

  // --- Gaps the sources themselves named ------------------------------------
  for (const u of story.uncertainty ?? []) {
    out.push({ question: u.endsWith("?") ? u : `Unresolved: ${u}`, why: "Named as unresolved by the reporting.", origin: "reported" });
  }
  for (const g of story.coverageGaps ?? []) {
    out.push({ question: `Not covered: ${g}`, why: "Identified as a gap in the available coverage.", origin: "reported" });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Story rollup
// ---------------------------------------------------------------------------

export interface EpistemicSummary {
  known: StatusAssessment[];
  disputed: StatusAssessment[];
  unverified: StatusAssessment[];
  withdrawn: StatusAssessment[];
  unknowns: Unknown[];
  /** One line for the top of the panel. */
  headline: string;
}

/**
 * Sort a story's statements into the four statuses and attach its unknowns.
 *
 * The headline deliberately reports unknowns alongside the counts. A story
 * where nothing is known and six things are open should not be able to render
 * a header that mentions only the two statements it does have.
 */
export function summariseEpistemics(
  story: Pick<StoryCluster, "keyPoints" | "widelyAgreedFacts" | "conflictingClaims" | "sources" | "primarySources" | "uncertainty" | "coverageGaps" | "location">,
  corrections: SourceCorrection[] = [],
): EpistemicSummary {
  const disputedTexts = new Set(
    (story.conflictingClaims ?? []).flatMap((c) => [c.claim, c.counterClaim]).map((t) => t.trim().toLowerCase()),
  );
  const statements = [...(story.keyPoints ?? []), ...(story.widelyAgreedFacts ?? [])];
  const seen = new Set<string>();

  const assessed = statements
    .filter((s) => {
      const k = s.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((s) =>
      assessStatement(s, story.sources ?? [], {
        disputed: disputedTexts.has(s.trim().toLowerCase()),
        corrections,
      }),
    );

  const of = (st: EpistemicStatus) => assessed.filter((a) => a.status === st);
  const known = of("known");
  const disputed = of("disputed");
  const unverified = of("unverified");
  const withdrawn = of("withdrawn");
  const unknowns = unknownsFor(story);

  const parts: string[] = [];
  if (known.length) parts.push(`${known.length} corroborated`);
  if (disputed.length) parts.push(`${disputed.length} disputed`);
  if (unverified.length) parts.push(`${unverified.length} resting on one source`);
  if (withdrawn.length) parts.push(`${withdrawn.length} withdrawn`);

  const headline =
    assessed.length === 0 && unknowns.length === 0
      ? "Nothing to assess yet."
      : parts.length === 0
        ? `Nothing established, and ${unknowns.length} open question(s).`
        : `${parts.join(", ")}${unknowns.length ? `, and ${unknowns.length} open question(s)` : ""}.`;

  return { known, disputed, unverified, withdrawn, unknowns, headline };
}

export const EPISTEMIC_METHODOLOGY =
  "Every statement gets one status. 'Known' requires two or more reports that originated separately and " +
  "come from separately owned outlets — not two mastheads running one wire. 'Disputed' outranks any " +
  "amount of corroboration on one side, because counting sources does not settle a disagreement. Open " +
  "questions are computed from the structure of the sourcing, not copied from a summary, so a story with " +
  "one origin and no local coverage says so whether or not anything upstream noticed.";
