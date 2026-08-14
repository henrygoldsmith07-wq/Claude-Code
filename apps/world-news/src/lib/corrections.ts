// Correction propagation: a correction travels the way the story did.
//
// The existing model attached corrections to a story as `{ date, note }` — a
// footnote. That misses the thing corrections are actually for. When a wire
// corrects a casualty figure, the correction has a *scope*: every masthead that
// carried the original is now publishing a number the originator has withdrawn,
// and every claim resting on that report is now resting on nothing.
//
// The gap between "the wire corrected it" and "the forty outlets carrying it
// corrected it" is where most bad numbers live, and it is invisible unless
// something walks the syndication graph and says so. That is this module.
//
// Two things it deliberately does not do:
//   - It does not decide a correction is right. A correction is a claim by a
//     publisher about its own earlier work, recorded as such.
//   - It does not silently delete corrected content. A retracted claim is shown
//     as retracted, because a reader who saw it yesterday needs to learn it was
//     withdrawn, and quietly removing it denies them that.
//
// Pure + deterministic. No network.

import type { ArticleLike } from "./clustering";
import type { SourceAttribution } from "./storyModel";
import { lookupSource } from "./sourceRegistry";
import { reconstructSyndication, VIRTUAL_ORIGIN_PREFIX, type SyndicationGraph } from "./syndication";
import { sourcesAsArticles } from "./independence";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type CorrectionKind =
  /** The report is withdrawn in full. */
  | "retraction"
  /** A stated fact was wrong and has been changed. */
  | "factual"
  /** The claim was real but attributed to the wrong party. */
  | "attribution"
  /** Wording was ambiguous; the substance stands. */
  | "clarification"
  /** Superseded by later information rather than wrong when published. */
  | "update";

/** How much weight a correction removes from what it touches. */
const SEVERITY: Record<CorrectionKind, number> = {
  retraction: 3,
  factual: 2,
  attribution: 2,
  clarification: 1,
  update: 1,
};

export interface SourceCorrection {
  /** Article id (or URL) of the report being corrected. */
  targetId: string;
  /** Who issued it — normally the outlet correcting its own work. */
  issuedBy: string;
  /** ISO timestamp. */
  at: string;
  kind: CorrectionKind;
  note: string;
  /** The specific statement withdrawn or amended, when the correction names one. */
  affectsClaim?: string;
}

export type CorrectionRelation =
  /** This article is the one that was corrected. */
  | "direct"
  /** This article carries a report that has since been corrected. */
  | "inherited";

export interface PropagatedCorrection {
  articleId: string;
  publisher?: string;
  relation: CorrectionRelation;
  correction: SourceCorrection;
  /**
   * True when this outlet is carrying corrected material and has not issued a
   * correction of its own. This is the number that matters.
   */
  stillUncorrected: boolean;
  explanation: string;
}

export interface CorrectionPropagation {
  affected: PropagatedCorrection[];
  /** Outlets carrying corrected material with no correction of their own. */
  uncorrectedCarriers: string[];
  /** Origins whose reports were retracted outright. */
  retractedOrigins: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Propagation
// ---------------------------------------------------------------------------

function outletName(a: { publisher?: string; url: string }): string {
  return lookupSource(a.publisher ?? a.url).name;
}

/**
 * Walk a correction down the derivation graph.
 *
 * A correction issued on an origin reaches everything rooted at that origin.
 * Carriers that have issued their own correction are recorded as corrected;
 * the rest are listed as still carrying withdrawn material, which is the
 * finding this whole module exists to produce.
 *
 * Corrections issued *before* a carrier published are not propagated to it:
 * that carrier had the corrected version available and either used it or
 * introduced its own error, and either way the upstream correction is not
 * evidence about it.
 */
export function propagateCorrections(
  articles: ArticleLike[],
  corrections: SourceCorrection[],
  graph?: SyndicationGraph,
): CorrectionPropagation {
  const g = graph ?? reconstructSyndication(articles);
  const byId = new Map(articles.map((a) => [a.id, a]));
  const correctedDirectly = new Set(corrections.map((c) => c.targetId));

  const affected: PropagatedCorrection[] = [];
  const uncorrected = new Set<string>();
  const retractedOrigins = new Set<string>();

  for (const correction of corrections) {
    if (correction.kind === "retraction") retractedOrigins.add(correction.targetId);
    const correctedAt = Date.parse(correction.at);

    for (const article of articles) {
      const origin = g.originOf.get(article.id) ?? article.id;
      const isDirect = article.id === correction.targetId;
      const inherits = !isDirect && (origin === correction.targetId || article.id === correction.targetId);

      if (!isDirect && !inherits) continue;

      if (inherits) {
        // Only meaningful if this carrier published before the correction landed.
        const published = article.publishedAt ? Date.parse(article.publishedAt) : Number.NaN;
        if (!Number.isNaN(published) && !Number.isNaN(correctedAt) && published > correctedAt) continue;
      }

      const name = outletName(article);
      const hasOwn = correctedDirectly.has(article.id) && !isDirect;
      const stillUncorrected = inherits && !hasOwn;
      if (stillUncorrected) uncorrected.add(name);

      const explanation = isDirect
        ? `${name} ${correction.kind === "retraction" ? "withdrew" : "corrected"} this report: ${correction.note}`
        : stillUncorrected
          ? `${name} is carrying a report that ${correction.issuedBy} has since ${
              correction.kind === "retraction" ? "withdrawn" : "corrected"
            }, and has not published a correction of its own.`
          : `${name} carried the corrected report and has issued its own correction.`;

      affected.push({
        articleId: article.id,
        publisher: article.publisher,
        relation: isDirect ? "direct" : "inherited",
        correction,
        stillUncorrected,
        explanation,
      });
    }

    // A correction can target an origin we never saw a copy of — a virtual wire
    // node. Its carriers still inherit, and they are the whole point.
    if (correction.targetId.startsWith(VIRTUAL_ORIGIN_PREFIX)) {
      for (const article of articles) {
        if (g.originOf.get(article.id) !== correction.targetId) continue;
        if (affected.some((a) => a.articleId === article.id && a.correction === correction)) continue;
        const name = outletName(article);
        uncorrected.add(name);
        affected.push({
          articleId: article.id,
          publisher: article.publisher,
          relation: "inherited",
          correction,
          stillUncorrected: true,
          explanation: `${name} is carrying ${correction.issuedBy}'s report, which has since been ${
            correction.kind === "retraction" ? "withdrawn" : "corrected"
          }.`,
        });
      }
    }
  }

  const uncorrectedCarriers = [...uncorrected].sort();
  const carriers = affected.filter((a) => a.relation === "inherited").length;
  const summary =
    corrections.length === 0
      ? "No corrections recorded."
      : uncorrectedCarriers.length === 0
        ? `${corrections.length} correction(s); every outlet carrying the affected report has also corrected it.`
        : `${corrections.length} correction(s) affecting ${carriers} downstream report(s). ${
            uncorrectedCarriers.length
          } outlet(s) are still carrying uncorrected material: ${uncorrectedCarriers.join(", ")}.`;

  void byId;
  return { affected, uncorrectedCarriers, retractedOrigins: [...retractedOrigins], summary };
}

// ---------------------------------------------------------------------------
// Claim-level effect
// ---------------------------------------------------------------------------

export type ClaimCorrectionStatus =
  /** Nothing supporting it has been corrected. */
  | "standing"
  /** Every report supporting it has been withdrawn. */
  | "withdrawn"
  /** Some supporting reports were corrected; others stand. */
  | "weakened";

export interface ClaimCorrectionEffect {
  claim: string;
  status: ClaimCorrectionStatus;
  /** Corrections that touch this claim's supporting reports. */
  corrections: SourceCorrection[];
  /** Supporting reports left untouched by any correction. */
  remainingSupport: number;
  note: string;
}

/**
 * What a set of corrections does to one claim.
 *
 * The important case is `withdrawn`: a claim whose entire support has been
 * retracted. It is not deleted — it is shown with its support struck out, so a
 * reader who encountered it earlier finds out what happened to it rather than
 * finding an empty space.
 */
export function correctionEffectOnClaim(
  claim: string,
  supporters: SourceAttribution[],
  corrections: SourceCorrection[],
): ClaimCorrectionEffect {
  const articles = sourcesAsArticles(supporters);
  const graph = reconstructSyndication(articles);
  const propagation = propagateCorrections(articles, corrections, graph);

  const touched = new Map<string, SourceCorrection[]>();
  for (const a of propagation.affected) {
    // A correction naming a different claim does not touch this one.
    if (a.correction.affectsClaim && a.correction.affectsClaim.trim().toLowerCase() !== claim.trim().toLowerCase()) {
      continue;
    }
    const list = touched.get(a.articleId);
    if (list) list.push(a.correction);
    else touched.set(a.articleId, [a.correction]);
  }

  const relevant = [...new Set([...touched.values()].flat())];
  const remainingSupport = articles.filter((a) => !touched.has(a.id)).length;

  const retractedAll =
    articles.length > 0 &&
    remainingSupport === 0 &&
    [...touched.values()].every((cs) => cs.some((c) => SEVERITY[c.kind] >= 2));

  const status: ClaimCorrectionStatus =
    relevant.length === 0 ? "standing" : retractedAll ? "withdrawn" : "weakened";

  const note =
    status === "standing"
      ? articles.length === 0
        ? "No supporting reports."
        : "No correction affects the reports supporting this."
      : status === "withdrawn"
        ? `Every report supporting this has been corrected or withdrawn. Shown struck through rather than removed, because it was published and readers may have seen it.`
        : `${relevant.length} correction(s) affect part of the support for this; ${remainingSupport} report(s) stand uncorrected.`;

  return { claim, status, corrections: relevant, remainingSupport, note };
}

export const CORRECTION_METHODOLOGY =
  "A correction is recorded as a publisher's statement about its own earlier work, never adjudicated. " +
  "Corrections propagate along the derivation graph: when an originating report is corrected, every " +
  "outlet carrying it inherits that correction, and those that have not published one of their own are " +
  "named. Corrected claims are struck through rather than deleted — a reader who saw the original is " +
  "entitled to learn it was withdrawn.";
