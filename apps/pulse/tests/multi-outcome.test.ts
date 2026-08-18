/**
 * Multi-outcome experiments (P1 #12).
 *
 * An experiment used to measure one outcome; asking a useful question with
 * several outcomes meant running one experiment per outcome, multiplying the
 * false-positive rate across the family. These tests pin the outcomes array
 * (primary + secondaries, each with its own predicted direction and size),
 * the within-family Benjamini-Hochberg correction over all outcomes, and the
 * rule that the success criterion stays on the primary — secondaries are
 * reported, never allowed to flip the verdict.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import { designExperiment, outcomeMetricIds, type ExperimentDesign } from "../src/experiments/design.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
import { findSameMetricOverlaps } from "../src/experiments/calendar.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import type { Finding } from "../src/discovery/finding.js";

const registry = createDefaultRegistry();
const NOW = Date.parse("2025-08-20T12:00:00Z");
const clock = (): number => NOW;

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-multi",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-multi",
  createdAt: "2025-06-30T00:00:00Z",
  evidenceClass: "correlation",
  title: "Question accuracy is higher within 4h of training",
  statement: "Across 300 observations, question accuracy within 4h of training was 8.7% higher.",
  metricIds: ["study.accuracy", "exercise.volume"],
  sources: ["revise", "arise"],
  sampleSize: 300,
  sampleDescription: "120 within window vs 180 outside",
  effect: { kind: "hedges_g", value: 0.45, magnitude: "small", label: "+0.45 SD" },
  confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
  confounders: [{ id: "secular-trend", name: "Improvement over time", description: "", status: "uncontrolled", detail: "" }],
  causalityNote: "This is an association, not a cause.",
  nextAction: {
    kind: "run-experiment",
    summary: "Run a crossover experiment to test whether within 4h of training changes the outcome",
    rationale: "The behaviour is under your control.",
    effortHours: 2,
    experimentDesignId: "crossover:x",
  },
  evidence: [{ kind: "events", description: "300 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 300, dateRange: { from: "2025-01-01", to: "2025-06-29" } }],
  tags: ["exposure-window"],
};

function makeHypothesis(): Hypothesis {
  const tracker = new HypothesisTracker(clock);
  return tracker.proposeFromFinding(finding)!;
}

/** A 14-day crossover (two 7-day blocks). */
function designed(secondaries: { metricId: string; predictedDirection: "increase" | "decrease"; predictedEffect: number }[] = []): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    minSamplePerCondition: 4,
    sessionsPerWeek: 4,
    outcomes: secondaries,
    now: clock,
  });
}

/**
 * One same-day event per assigned condition day with a per-condition value
 * (alternating jitter for variance). Two streams: the primary via revise
 * attempts, a secondary via arise readiness sleep ratings.
 */
function primaryEvents(d: ExperimentDesign, aValue: number, bValue: number, jitter = 0.02): PulseEvent[] {
  const events: PulseEvent[] = [];
  const counts: Record<string, number> = {};
  for (const assignment of d.assignments) {
    if (assignment.condition === null) continue;
    const key = assignment.condition;
    const base = assignment.condition === "A" ? aValue : bValue;
    const n = counts[key] ?? 0;
    counts[key] = n + 1;
    const value = n % 2 === 0 ? base + jitter : base - jitter;
    events.push(
      normaliseEvent(
        {
          source: "revise",
          sourceEventId: `multi-p-${assignment.date}`,
          type: "revise.attempt",
          category: "study",
          occurredAt: `${assignment.date}T15:00:00Z`,
          metrics: { accuracy: value, marks_awarded: Math.round(value * 10), marks_available: 10, response_ms: 120_000 },
          attributes: { method: "practice" },
        },
        ctx,
      ),
    );
  }
  return events;
}

function sleepEvents(d: ExperimentDesign, aValue: number, bValue: number, jitter = 0.02, onCondition: (condition: "A" | "B") => boolean = () => true): PulseEvent[] {
  const events: PulseEvent[] = [];
  const counts: Record<string, number> = {};
  for (const assignment of d.assignments) {
    if (assignment.condition === null) continue;
    if (!onCondition(assignment.condition)) continue;
    const key = assignment.condition;
    const base = assignment.condition === "A" ? aValue : bValue;
    const n = counts[key] ?? 0;
    counts[key] = n + 1;
    const value = n % 2 === 0 ? base + jitter : base - jitter;
    events.push(
      normaliseEvent(
        {
          source: "arise",
          sourceEventId: `multi-s-${assignment.date}`,
          type: "arise.readiness",
          category: "wellbeing",
          occurredAt: `${assignment.date}T07:40:00Z`,
          metrics: { readiness_score: 60, sleep_score: value },
          attributes: {},
        },
        ctx,
      ),
    );
  }
  return events;
}

describe("the outcomes array on the design", () => {
  it("derives a single primary outcome from the hypothesis by default", () => {
    const design = designed();
    expect(design.outcomes).toEqual([
      { metricId: "study.accuracy", predictedDirection: "increase", predictedEffect: 0.45, role: "primary" },
    ]);
    expect(design.targetMetricId).toBe("study.accuracy");
    expect(outcomeMetricIds(design)).toEqual(["study.accuracy"]);
  });

  it("registers secondaries alongside the primary, each with its own prediction", () => {
    const design = designed([
      { metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 },
      { metricId: "exercise.volume", predictedDirection: "decrease", predictedEffect: 0.5 },
    ]);
    expect(design.outcomes).toHaveLength(3);
    expect(design.outcomes![0]!.role).toBe("primary");
    expect(design.outcomes![0]!.metricId).toBe("study.accuracy");
    expect(design.outcomes![1]).toEqual({
      metricId: "wellbeing.sleep",
      predictedDirection: "increase",
      predictedEffect: 0.3,
      role: "secondary",
    });
    expect(design.outcomes![2]).toEqual({
      metricId: "exercise.volume",
      predictedDirection: "decrease",
      predictedEffect: 0.5,
      role: "secondary",
    });
    expect(design.targetMetricId).toBe("study.accuracy");
    expect(outcomeMetricIds(design)).toEqual(["study.accuracy", "wellbeing.sleep", "exercise.volume"]);
  });

  it("refuses a secondary that duplicates another outcome metric", () => {
    expect(() =>
      designed([
        { metricId: "study.accuracy", predictedDirection: "increase", predictedEffect: 0.3 },
      ]),
    ).toThrow();
  });

  it("caps the family at five outcomes", () => {
    const many = ["a", "b", "c", "d", "e"].map((metricId) => ({
      metricId: `wellbeing.${metricId}`,
      predictedDirection: "increase" as const,
      predictedEffect: 0.3,
    }));
    expect(() => designed(many)).toThrow();
  });
});

describe("the primary verdict", () => {
  it("is unchanged for a single outcome — the correction is a no-op at family size one", () => {
    const design = designed();
    const events = primaryEvents(design, 0.9, 0.1);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).toBe("supported");
    expect(result.secondaryOutcomes).toEqual([]);
    expect(result.family).toBeNull();
  });

  it("stays driven by the primary when secondaries are present and the primary clearly wins", () => {
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    const events = [...primaryEvents(design, 0.9, 0.1), ...sleepEvents(design, 0.8, 0.2)];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).toBe("supported");
    expect(result.family).not.toBeNull();
    expect(result.family!.size).toBe(2);
    expect(result.family!.primaryAdjustedP).not.toBeNull();
    expect(result.family!.primaryAdjustedP!).toBeLessThanOrEqual(0.05);
  });
});

describe("family correction", () => {
  it("corrects a borderline primary away when the family cannot single it out", () => {
    // The primary's effect is real but borderline (raw p 0.045, just below
    // 0.05); a noisier secondary with a larger p means the primary pays the
    // family price (adjusted p ~0.09) and no longer clears the bar. Without
    // the secondary the same data is supported.
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    const events = [...primaryEvents(design, 0.75, 0.43, 0.25), ...sleepEvents(design, 0.75, 0.5, 0.25)];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    const alone = analyseExperiment(design, primaryEvents(design, 0.75, 0.43, 0.25), {
      registry,
      predictedEffect: 0.45,
      now: clock,
    });

    // Alone: raw p < 0.05 and the CI excludes zero -> supported.
    expect(alone.verdict).toBe("supported");
    // With the family: the primary's adjusted p crosses 0.05 and the verdict
    // becomes inconclusive, with the correction named in the reasons.
    expect(result.family).not.toBeNull();
    expect(result.family!.primaryAdjustedP!).toBeGreaterThan(0.05);
    expect(result.verdict).toBe("inconclusive");
    expect(result.reasons.join(" ")).toMatch(/benjamini|hochberg/i);
    // The secondary is still reported.
    expect(result.secondaryOutcomes).toHaveLength(1);
    expect(result.secondaryOutcomes[0]!.metricId).toBe("wellbeing.sleep");
  });
});

describe("secondaries are reported, never decisive", () => {
  it("reports each secondary with its comparison, effect and adjusted p", () => {
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    const events = [...primaryEvents(design, 0.9, 0.1), ...sleepEvents(design, 0.8, 0.2)];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    const secondary = result.secondaryOutcomes[0]!;
    expect(secondary.metricId).toBe("wellbeing.sleep");
    expect(secondary.comparison).not.toBeNull();
    expect(secondary.observedEffect).toBeGreaterThan(0);
    expect(secondary.pValue).toBeLessThan(0.05);
    expect(secondary.adjustedP).toBeGreaterThan(0);
    expect(secondary.note).toMatch(/reported, not decisive/i);
  });

  it("does not let a strongly supported secondary flip a refuted primary", () => {
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    // Primary: effect in the OPPOSITE direction to the prediction (refuted).
    // Secondary: strongly in its predicted direction.
    const events = [...primaryEvents(design, 0.1, 0.9), ...sleepEvents(design, 0.8, 0.2)];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).toBe("refuted");
    expect(result.secondaryOutcomes[0]!.observedEffect).toBeGreaterThan(0);
  });

  it("excludes an under-sampled secondary from the family and reports it as insufficient", () => {
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    // The secondary only has sessions under one condition: nothing to compare.
    const events = [...primaryEvents(design, 0.9, 0.1), ...sleepEvents(design, 0.8, 0.2, 0.02, (condition) => condition === "A")];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).toBe("supported");
    expect(result.secondaryOutcomes[0]!.comparison.insufficient).toBeTruthy();
    // Only the primary's p is in the corrected family.
    expect(result.family!.size).toBe(1);
    expect(result.secondaryOutcomes[0]!.adjustedP).toBeNaN();
  });

  it("does not rescue a run whose primary has no sessions at all", () => {
    const design = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    const result = analyseExperiment(design, sleepEvents(design, 0.8, 0.2), {
      registry,
      predictedEffect: 0.45,
      now: clock,
    });

    expect(result.verdict).toBe("invalid");
    expect(result.secondaryOutcomes).toHaveLength(0);
  });
});

describe("calendar conflicts consider every outcome", () => {
  it("blocks a proposal that shares only a secondary metric with a live run", () => {
    const live = designed([{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }]);
    const candidate = designExperiment(makeHypothesis(), {
      startDate: "2025-07-05",
      blockDays: 7,
      minSamplePerCondition: 4,
      sessionsPerWeek: 4,
      outcomes: [{ metricId: "exercise.volume", predictedDirection: "increase", predictedEffect: 0.3 }],
      now: clock,
    });
    const overlaps = findSameMetricOverlaps([live], candidate);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.designId).toBe(live.id);
  });
});

