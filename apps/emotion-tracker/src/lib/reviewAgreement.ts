// reviewAgreement.ts — inter-rater reliability for the human-review corpus.
// Double review only means something if we measure whether reviewers agree.
// All numbers here are descriptive over labels real reviewers produced; thin
// samples are reported as insufficient rather than dressed up.

import { groupByInterpretation, type HumanReviewLabel, type HumanReviewRecord } from "./humanReview";

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ReliabilityPair {
  interpretationId: string;
  reviewers: string[]; // distinct non-null reviewer ids compared
  labelJaccard: number; // |A∩B| / |A∪B| over raw label sets
  exactLabels: boolean;
  supportAgrees: boolean; // same humanSupport pole
  conflicting: boolean; // supported vs unsupported opposition
}

export interface ReliabilityReport {
  /** interpretations labelled by ≥2 distinct reviewers */
  doubleReviewed: number;
  pairsCompared: number;
  exactLabelAgreement: number | null;
  supportAgreementRate: number | null;
  conflicts: number; // supported-vs-unsupported oppositions
  meanLabelJaccard: number | null;
  reliabilityTier: "high" | "moderate" | "low" | "insufficient data";
  /** conflicted interpretations with no adjudicator record yet */
  needsAdjudication: string[];
  note: string;
}

const MAX_REVIEWERS_PER_GROUP = 4; // cap pair explosion on adversarial corpora

export function interRaterReliability(records: HumanReviewRecord[]): ReliabilityReport {
  const needsAdjudication: string[] = [];
  const pairs: ReliabilityPair[] = [];

  for (const [interpretationId, group] of groupByInterpretation(records)) {
    const hasAdjudicator = group.some((r) => r.role === "adjudicator");
    // distinct reviewers, latest review per reviewer — adjudicator rows are
    // resolutions, not independent raters, so they never enter the pairs
    const byReviewer = new Map<string, HumanReviewRecord>();
    for (const r of group) {
      if (r.role === "adjudicator") continue;
      const key = r.reviewer ?? `anon:${r.id}`;
      byReviewer.set(key, r);
    }
    if (byReviewer.size < 2) continue;
    const reviewers = [...byReviewer.keys()].slice(0, MAX_REVIEWERS_PER_GROUP);
    for (let i = 0; i < reviewers.length; i++) {
      for (let k = i + 1; k < reviewers.length; k++) {
        const a = byReviewer.get(reviewers[i])!;
        const b = byReviewer.get(reviewers[k])!;
        const setA = new Set<string>(a.labels);
        const setB = new Set<string>(b.labels);
        const overlap = jaccardSets(setA, setB);
        const supportAgrees = a.humanSupport === b.humanSupport;
        const conflicting =
          (a.humanSupport === "supported" && b.humanSupport === "unsupported") ||
          (a.humanSupport === "unsupported" && b.humanSupport === "supported");
        pairs.push({
          interpretationId,
          reviewers: [reviewers[i], reviewers[k]],
          labelJaccard: overlap,
          exactLabels: setA.size === setB.size && overlap === 1,
          supportAgrees,
          conflicting,
        });
      }
    }
    if (pairs.some((p) => p.interpretationId === interpretationId && p.conflicting) && !hasAdjudicator) {
      needsAdjudication.push(interpretationId);
    }
  }

  const n = pairs.length;
  const exact = pairs.filter((p) => p.exactLabels).length;
  const agreeSupport = pairs.filter((p) => p.supportAgrees).length;
  const conflicts = pairs.filter((p) => p.conflicting).length;
  const meanJaccard = n ? pairs.reduce((s, p) => s + p.labelJaccard, 0) / n : null;

  let reliabilityTier: ReliabilityReport["reliabilityTier"] = "insufficient data";
  if (n >= 5 && meanJaccard != null) {
    reliabilityTier = meanJaccard >= 0.8 ? "high" : meanJaccard >= 0.6 ? "moderate" : "low";
  }

  const parts: string[] = [];
  if (n === 0) {
    parts.push("No interpretations have been labelled by two or more reviewers yet.");
    parts.push("Double-review a few interpretations to measure agreement before trusting precision numbers.");
  } else {
    parts.push(`${exact}/${n} reviewer pairs chose identical labels · support poles agreed ${agreeSupport}/${n}.`);
    if (conflicts > 0) parts.push(`${conflicts} conflict${conflicts === 1 ? "" : "s"} need${conflicts === 1 ? "s" : ""} adjudication.`);
    if (reliabilityTier === "insufficient data") parts.push("Fewer than five pairs so far — tier withheld.");
  }

  return {
    doubleReviewed: new Set(pairs.map((p) => p.interpretationId)).size,
    pairsCompared: n,
    exactLabelAgreement: n ? exact / n : null,
    supportAgreementRate: n ? agreeSupport / n : null,
    conflicts,
    meanLabelJaccard: meanJaccard,
    reliabilityTier,
    needsAdjudication,
    note: parts.join(" "),
  };
}

/** Jaccard over one reviewer's labels against another's — exported for tests
 *  and for UI tooltips explaining what the agreement number means. */
export function labelSetAgreement(a: HumanReviewLabel[], b: HumanReviewLabel[]): number {
  return jaccardSets(new Set(a), new Set(b));
}
