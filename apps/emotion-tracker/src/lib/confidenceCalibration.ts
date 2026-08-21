// confidenceCalibration.ts — store confidence and later human support, report calibration.
// High confidence should have highest confirmation; low should be lowest.

import type { HumanReviewRecord } from "./humanReview";

export type ConfidenceBand = "high" | "moderate" | "low";

export interface BandStats {
  band: ConfidenceBand;
  n: number;
  supported: number;
  supportedRate: number | null; // 0..1
  avgConfidence: number | null; // 0..1
  calibrationError: number | null; // |avgConfidence - supportedRate|
}

export interface CalibrationReport {
  totalReviewed: number;
  bands: BandStats[];
  // ECE-like: weighted mean absolute calibration error across bands
  weightedCalibrationError: number | null;
  // Ordering check: high > moderate > low when n sufficient
  ordering: "correct" | "inverted" | "insufficient data";
  note: string;
}

function bandFor(confidence: number | null): ConfidenceBand | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.45) return "moderate";
  return "low";
}

export function buildCalibrationReport(records: HumanReviewRecord[]): CalibrationReport {
  const reviewed = records.filter((r) => r.reviewedAt && r.labels.length > 0 && r.humanSupport !== "pending" && r.humanSupport !== "insufficient");
  const totalReviewed = reviewed.length;

  const buckets: Record<ConfidenceBand, HumanReviewRecord[]> = { high: [], moderate: [], low: [] };
  for (const r of reviewed) {
    const b = bandFor(r.confidence);
    if (b) buckets[b].push(r);
  }

  function bandStats(band: ConfidenceBand, items: HumanReviewRecord[]): BandStats {
    const n = items.length;
    if (n === 0) return { band, n: 0, supported: 0, supportedRate: null, avgConfidence: null, calibrationError: null };
    const supported = items.filter((r) => r.humanSupport === "supported").length;
    const supportedRate = supported / n;
    const avgConfidence = items.reduce((s, r) => s + (r.confidence ?? 0), 0) / n;
    const calibrationError = Math.abs(avgConfidence - supportedRate);
    return { band, n, supported, supportedRate, avgConfidence, calibrationError };
  }

  const bands: BandStats[] = [
    bandStats("high", buckets.high),
    bandStats("moderate", buckets.moderate),
    bandStats("low", buckets.low),
  ];

  const weightedCalibrationError =
    totalReviewed === 0
      ? null
      : bands.reduce((s, b) => s + (b.calibrationError ?? 0) * b.n, 0) / totalReviewed;

  // ordering: need at least 5 per band to judge, otherwise insufficient
  const minN = 5;
  const high = bands.find((b) => b.band === "high")!;
  const moderate = bands.find((b) => b.band === "moderate")!;
  const low = bands.find((b) => b.band === "low")!;
  let ordering: CalibrationReport["ordering"] = "insufficient data";
  if (high.n >= minN && moderate.n >= minN && low.n >= minN) {
    if (high.supportedRate != null && moderate.supportedRate != null && low.supportedRate != null) {
      ordering = high.supportedRate > moderate.supportedRate && moderate.supportedRate > low.supportedRate ? "correct" : "inverted";
    }
  } else if (high.n >= 1 && low.n >= 1 && high.supportedRate != null && low.supportedRate != null) {
    // weaker check with just high vs low
    if (high.supportedRate > low.supportedRate) ordering = "correct";
    else if (high.supportedRate < low.supportedRate) ordering = "inverted";
  }

  let note: string;
  if (totalReviewed === 0) note = "No reviewed interpretations yet — calibration cannot be measured.";
  else if (totalReviewed < 10) note = `Only ${totalReviewed} reviewed — bands are too thin to judge calibration.`;
  else if (ordering === "correct") note = "High-confidence interpretations have the highest confirmation — calibration ordering is correct.";
  else if (ordering === "inverted") note = "Calibration is inverted: higher confidence did not yield higher confirmation — model is miscalibrated.";
  else note = `Reviewed ${totalReviewed} · weighted calibration error ${weightedCalibrationError != null ? (weightedCalibrationError * 100).toFixed(1) + "%" : "—"}.`;

  return { totalReviewed, bands, weightedCalibrationError, ordering, note };
}

export function calibrationSampleSizeWarning(report: CalibrationReport): string | null {
  if (report.totalReviewed === 0) return "No reviewed interpretations — add human reviews to calibrate.";
  if (report.totalReviewed < 10) return `Only ${report.totalReviewed} reviewed — interpret bands cautiously.`;
  const thin = report.bands.filter((b) => b.n > 0 && b.n < 5).map((b) => `${b.band} (n=${b.n})`);
  if (thin.length) return `Thin bands: ${thin.join(", ")} — collect more reviews.`;
  return null;
}
