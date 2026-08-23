// selfCalibration.ts — measure the system's own confidence against outcomes
// recorded by the user in the longitudinal loop. This is calibration WITHOUT
// external reviewers: when Reflect says 0.8 about an interpretation and the
// user later marks it unsupported, that is a calibration data point.
//
// Reuses buildCalibrationReport's band math by projecting entries into the
// same record shape the reviewer corpus uses — one definition of "band",
// one definition of "supported".

import type { Entry } from "./types";
import {
  anonymizeInterpretation,
  createReviewRecord,
  type HumanReviewRecord,
} from "./humanReview";
import { buildCalibrationReport, type CalibrationReport } from "./confidenceCalibration";

/** The system's overall confidence for an entry: its explicit
 *  overallConfidence if present, else its strongest bias-flag confidence. */
export function entryConfidence(entry: Entry): number | null {
  const explicit = entry.summary?.overallConfidence;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  const biases = entry.summary?.possibleBiases ?? [];
  const values = biases.map((b) => b.confidence).filter((c) => typeof c === "number" && Number.isFinite(c));
  return values.length ? Math.max(...values) : null;
}

function verdictToSupport(verdict: NonNullable<Entry["longitudinalReview"]>["assumptionVerdict"]): { support: HumanReviewRecord["humanSupport"]; labels: HumanReviewRecord["labels"] } | null {
  switch (verdict) {
    // Labels are required by the shared calibration filter (it counts rows,
    // not bare verdicts) — pick one whose derived support matches the verdict.
    case "supported": return { support: "supported", labels: ["useful"] };
    case "unsupported": return { support: "unsupported", labels: ["unsupported claim"] };
    case "partial": return { support: "mixed", labels: ["weak inference"] };
    // "unclear" carries no calibration signal either way
    default: return null;
  }
}

/**
 * Project reviewed entries into calibration records and report band stats.
 * Only entries with BOTH a confidence signal and a user verdict count.
 */
export function selfCalibration(entries: Entry[]): CalibrationReport & { pairedEntries: number; skippedNoConfidence: number; note: string } {
  const records: HumanReviewRecord[] = [];
  let skippedNoConfidence = 0;
  for (const e of entries) {
    const verdict = e.longitudinalReview?.assumptionVerdict;
    if (!verdict) continue;
    const mapped = verdictToSupport(verdict);
    if (!mapped) continue;
    const confidence = entryConfidence(e);
    if (confidence == null) {
      skippedNoConfidence++;
      continue;
    }
    records.push(
      createReviewRecord({
        interpretationId: e.id,
        anonymizedInterpretation: anonymizeInterpretation({
          id: `self-${e.id}`,
          coreEmotion: e.summary?.coreEmotion ?? null,
          observations: e.summary?.trace.observations ?? [],
          assumptions: e.summary?.trace.assumptions ?? [],
          confidence,
        }),
        confidence,
        labels: [...mapped.labels],
        reviewer: "longitudinal-loop",
        reviewedAt: e.longitudinalReview!.reviewedAt ?? e.createdAt,
        notes: e.longitudinalReview!.calibrationNote?.slice(0, 200) ?? null,
      }),
    );
  }

  const report = buildCalibrationReport(records);
  let note =
    report.totalReviewed === 0
      ? skippedNoConfidence > 0
        ? `${skippedNoConfidence} reviewed reflection${skippedNoConfidence === 1 ? "" : "s"} carry no confidence signal (legacy summaries) — complete newer reflections to calibrate.`
        : "Complete a follow-up review on a recent reflection to start measuring self-calibration."
      : `Self-calibration over ${report.totalReviewed} user-verdicted reflection${report.totalReviewed === 1 ? "" : "s"} — descriptive only, not clinical evidence.`;
  if (report.totalReviewed > 0 && skippedNoConfidence > 0) {
    note += ` ${skippedNoConfidence} further reviewed reflection${skippedNoConfidence === 1 ? "" : "s"} had no confidence signal and were skipped.`;
  }

  return { ...report, pairedEntries: records.length, skippedNoConfidence, note };
}
