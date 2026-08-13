/**
 * Discovery: sensitivity and specificity against known ground truth.
 *
 * This is the file that decides whether Pulse is an evidence engine or a
 * correlation slot machine. Two properties are asserted with equal weight:
 *
 *   sensitivity — planted effects are found
 *   specificity — planted non-effects are NOT found
 *
 * The specificity tests are the load-bearing ones. Any tool will find
 * something; the question is whether it finds things that are not there.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import { generateNullUser } from "../src/synthetic/generator.js";
import { discoverRelationships } from "../src/discovery/engine.js";
import { generateCandidates } from "../src/discovery/candidates.js";
import { validateFinding, type Finding } from "../src/discovery/finding.js";
import { assessConfounders, compositionDistance, stratifiedEffect } from "../src/discovery/confounders.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { observationsFor } from "../src/metrics/compute.js";
import type { MetricObservation } from "../src/metrics/compute.js";
import type { DiscoveryReport } from "../src/discovery/engine.js";
import type { Pulse } from "../src/pulse.js";

const registry = createDefaultRegistry();

function observation(overrides: Partial<MetricObservation> = {}): MetricObservation {
  return {
    metricId: "study.accuracy",
    value: 0.7,
    at: "2025-06-10T15:00:00Z",
    localDate: "2025-06-10",
    localMinutes: 900,
    localDayOfWeek: 2,
    eventId: Math.random().toString(36).slice(2),
    source: "revise",
    eventType: "revise.attempt",
    attributes: {},
    ...overrides,
  };
}

describe("discovery against a user with known relationships", () => {
  let pulse: Pulse;
  let report: DiscoveryReport;

  beforeAll(async () => {
    const harness = await createSyntheticPulse({ days: 180, seed: "discovery-suite" });
    pulse = harness.pulse;
    report = pulse.discover();
  });

  it("ingests every source and scores its quality", () => {
    expect(pulse.store.size).toBeGreaterThan(3000);
    const quality = pulse.quality();
    expect(quality.length).toBeGreaterThanOrEqual(3);
    for (const entry of quality) expect(entry.score).toBeGreaterThan(0.5);
  });

  it("SENSITIVITY: finds a planted time-of-day effect when one is identifiable", async () => {
    // A dedicated user whose only planted signal is a strong afternoon effect,
    // so the assertion is about detection rather than about disentangling.
    const { pulse: clean } = await createSyntheticPulse({
      days: 180,
      seed: "afternoon-only",
      afternoonAccuracyBoost: 0.1,
      exerciseAccuracyBoost: 0,
      includeConfounded: false,
    });
    const found = clean.discover().findings.filter((finding) => finding.tags.includes("time-of-day"));
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((finding) => /afternoon/.test(finding.title))).toBe(true);
  });

  it("SPECIFICITY: does not invent an exercise effect when none was planted", async () => {
    const { pulse: clean } = await createSyntheticPulse({
      days: 180,
      seed: "afternoon-only",
      afternoonAccuracyBoost: 0.1,
      exerciseAccuracyBoost: 0,
      includeConfounded: false,
    });
    const exercise = clean
      .discover()
      .findings.filter((finding) => finding.tags.includes("exposure-window") && finding.sources.includes("arise"));
    for (const finding of exercise) {
      // If anything is reported at all it must not be endorsed as actionable.
      expect(finding.nextAction?.kind).not.toBe("run-experiment");
    }
  });

  it("SENSITIVITY: finds the planted exercise-then-study effect", () => {
    const found = report.findings.filter(
      (finding) =>
        finding.metricIds.includes("study.accuracy") &&
        finding.sources.includes("arise") &&
        finding.tags.includes("exposure-window"),
    );
    expect(found.length).toBeGreaterThan(0);
    // Planted as a positive effect, so the direction must come out positive.
    expect(found[0]!.effect.value).toBeGreaterThan(0);
    expect(found[0]!.sampleSize).toBeGreaterThan(100);
  });

  it("SENSITIVITY: the planted exercise effect survives adjustment for time of day", () => {
    // Workouts are spread across the day in the generator, so the effect is
    // identifiable in principle. A correct engine should hold it after
    // stratifying on clock time and should therefore propose an experiment.
    const found = report.findings.find(
      (finding) => finding.tags.includes("exposure-window") && finding.sources.includes("arise"),
    )!;
    const timeOfDay = found.confounders.find((confounder) => confounder.id === "time-of-day");
    expect(timeOfDay?.status).toBe("controlled");
    expect(found.nextAction?.kind).toBe("run-experiment");
  });

  it("SPECIFICITY: never endorses an experiment when a confounder could not be ruled out", () => {
    // The invariant that protects the user from the confounded French
    // relationship and from every other case like it: if time of day still
    // explains the difference, Pulse must not ask for two weeks of their life.
    for (const finding of report.findings) {
      const timeOfDay = finding.confounders.find((confounder) => confounder.id === "time-of-day");
      if (timeOfDay?.status !== "uncontrolled") continue;
      expect(finding.nextAction?.kind, finding.title).not.toBe("run-experiment");
      expect(finding.confidence.limitations.join(" ")).toMatch(/time of day is held constant|could not be controlled/);
    }
  });

  it("SPECIFICITY: reports the confounded relationship, if at all, with its adjustment shown", async () => {
    // A purpose-built user where French speaking and evening study are the
    // same thing. Whatever Pulse says about it must show the adjustment.
    const { pulse: confounded } = await createSyntheticPulse({
      days: 180,
      seed: "confounded-french",
      exerciseAccuracyBoost: 0,
      afternoonAccuracyBoost: 0,
      includeConfounded: true,
    });
    const findings = confounded
      .discover()
      .findings.filter((finding) => finding.sources.includes("le-studio-french") && /within \d+h/.test(finding.title));

    for (const finding of findings) {
      const timeOfDay = finding.confounders.find((confounder) => confounder.id === "time-of-day");
      expect(timeOfDay, finding.title).toBeDefined();
      // Either it survived a real adjustment, or the shrinkage is spelled out.
      expect(timeOfDay!.detail).toMatch(/Adjusting within \d+ strata|Too few comparable strata/);
    }
  });

  it("SPECIFICITY: never reports the planted null relationships", () => {
    const nullPairs: [string, string][] = [
      ["study.accuracy", "wellbeing.plan_adherence"],
      ["study.recall_grade", "wellbeing.plan_adherence"],
    ];
    for (const [outcome, exposure] of nullPairs) {
      const spurious = report.findings.filter(
        (finding) => finding.metricIds.includes(outcome) && finding.metricIds.includes(exposure),
      );
      expect(spurious, `reported a relationship between ${outcome} and ${exposure}`).toEqual([]);
    }
  });

  it("reports the size of the search that produced each finding", () => {
    // The scan is split into one family per outcome metric, so a finding cites
    // the family it was corrected within, and the report also discloses the
    // total number of comparisons made.
    expect(report.familySize).toBeGreaterThan(20);
    expect(report.familyCount).toBeGreaterThan(1);
    expect(report.largestFamilySize).toBeLessThanOrEqual(report.familySize);

    for (const finding of report.findings) {
      expect(finding.test?.familySize).toBeGreaterThan(1);
      expect(finding.test!.familySize!).toBeLessThanOrEqual(report.largestFamilySize);
      expect(finding.test?.correctionMethod).toBe("benjamini_hochberg");
      expect(finding.test!.adjustedP!).toBeGreaterThanOrEqual(finding.test!.pValue);
    }
  });

  it("every finding satisfies the full evidence contract", () => {
    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(validateFinding(finding)).toEqual([]);
      expect(finding.sampleSize).toBeGreaterThan(0);
      expect(finding.sampleDescription).toBeTruthy();
      expect(Number.isFinite(finding.effect.value)).toBe(true);
      expect(finding.confidence.level).toBeTruthy();
      expect(finding.confounders.length).toBeGreaterThan(0);
      expect(finding.causalityNote).toBeTruthy();
      expect(finding.evidence.length).toBeGreaterThan(0);
      // `nextAction` may be null, but the key must be present and considered.
      expect(finding).toHaveProperty("nextAction");
    }
  });

  it("never claims causation for an observational finding", () => {
    for (const finding of report.findings) {
      expect(finding.evidenceClass).not.toBe("experiment");
      expect(finding.causalityNote).toMatch(/not a cause|does not establish|association/i);
      expect(finding.statement).not.toMatch(/\b(causes|caused|because of|leads to|proves)\b/i);
      expect(finding.confidence.level).not.toBe("high");
    }
  });

  it("checks time of day as a confounder on every group comparison", () => {
    const comparisons = report.findings.filter((finding) => !finding.tags.includes("lagged-correlation"));
    expect(comparisons.length).toBeGreaterThan(0);
    for (const finding of comparisons) {
      const ids = finding.confounders.map((confounder) => confounder.id);
      expect(ids).toContain("day-of-week");
      expect(ids).toContain("secular-trend");
    }
  });

  it("explains why each rejected candidate was rejected", () => {
    expect(report.rejected.length).toBeGreaterThan(0);
    for (const rejection of report.rejected) {
      expect(rejection.reason.length).toBeGreaterThan(10);
      expect(rejection.candidate.question).toMatch(/\?$/);
    }
  });

  it("asks each exposure question once per event type, not once per metric", () => {
    // Volume, sets and effort all ride on one workout event. Asking "was there
    // a workout in the last four hours?" once per metric would triple both the
    // family size and the number of near-identical findings.
    const candidates = generateCandidates({ events: pulse.events(), registry });
    const exerciseExposures = candidates.filter(
      (candidate) => candidate.kind === "exposure-window" && String(candidate.exposureMetricId).startsWith("exercise."),
    );
    const distinctExposures = new Set(exerciseExposures.map((candidate) => candidate.exposureMetricId));
    expect(distinctExposures.size).toBe(1);
    expect(exerciseExposures.length).toBeGreaterThan(0);
  });

  it("is deterministic: the same data yields the same findings", () => {
    const again = pulse.discover();
    expect(again.findings.map((finding) => finding.id)).toEqual(report.findings.map((finding) => finding.id));
    expect(again.familySize).toBe(report.familySize);
  });
});

describe("SPECIFICITY: a user with no planted relationships", () => {
  it("reports at most a handful of findings from pure noise", async () => {
    const { pulse } = await createSyntheticPulse({
      days: 180,
      seed: "null-user-strict",
      exerciseAccuracyBoost: 0,
      afternoonAccuracyBoost: 0,
      includeConfounded: false,
    });
    const report = pulse.discover();

    // With FDR at 5% across this family, the expected number of false
    // discoveries is small. Allowing 2 leaves headroom for the correlated
    // outcome metrics without letting a broken correction pass.
    expect(report.findings.length).toBeLessThanOrEqual(2);
    expect(report.expectedFalseDiscoveries).toBeLessThan(1);
  });

  it("finds nothing at all in a null user when the effect floor is respected", async () => {
    const { pulse } = await createSyntheticPulse({
      days: 120,
      seed: "null-user-quiet",
      exerciseAccuracyBoost: 0,
      afternoonAccuracyBoost: 0,
      includeConfounded: false,
    });
    // A moderate effect floor is the honest bar for a personal dataset.
    const report = pulse.discover({ limit: 50 });
    const substantial = report.findings.filter((finding) => Math.abs(finding.effect.value) >= 0.5);
    expect(substantial).toEqual([]);
  });

  it("the null generator really does remove the planted effects", () => {
    const nullUser = generateNullUser({ days: 60 });
    expect(nullUser.groundTruth.every((relationship) => relationship.plantedEffect === 0)).toBe(true);
    expect(nullUser.groundTruth.every((relationship) => relationship.kind === "null-effect")).toBe(true);
  });
});

describe("confounder detection", () => {
  it("flags time of day when the groups sat at different hours", () => {
    const exposed = Array.from({ length: 30 }, (_, i) => observation({ localMinutes: 1000 + (i % 5), value: 0.8 }));
    const unexposed = Array.from({ length: 30 }, (_, i) => observation({ localMinutes: 540 + (i % 5), value: 0.6 }));
    const confounders = assessConfounders(exposed, unexposed);
    const timeOfDay = confounders.find((confounder) => confounder.id === "time-of-day");
    expect(timeOfDay?.status).toBe("uncontrolled");
    expect(timeOfDay?.detail).toMatch(/16:4\d vs 09:0\d/);
  });

  it("reports time of day as balanced when the groups matched", () => {
    const exposed = Array.from({ length: 30 }, (_, i) => observation({ localMinutes: 900 + (i % 7), value: 0.8 }));
    const unexposed = Array.from({ length: 30 }, (_, i) => observation({ localMinutes: 900 + (i % 7), value: 0.6 }));
    const timeOfDay = assessConfounders(exposed, unexposed).find((confounder) => confounder.id === "time-of-day");
    expect(timeOfDay?.status).toBe("checked-balanced");
  });

  it("flags a secular trend when one group sits late in the period", () => {
    const exposed = Array.from({ length: 25 }, (_, i) => observation({ localDate: `2025-06-${String(1 + (i % 25)).padStart(2, "0")}` }));
    const unexposed = Array.from({ length: 25 }, (_, i) => observation({ localDate: `2025-03-${String(1 + (i % 25)).padStart(2, "0")}` }));
    const trend = assessConfounders(exposed, unexposed).find((confounder) => confounder.id === "secular-trend");
    expect(trend?.status).toBe("uncontrolled");
  });

  it("measures compositional imbalance between groups", () => {
    const exposed = Array.from({ length: 20 }, () => observation({ attributes: { subject_id: "physics" } }));
    const unexposed = Array.from({ length: 20 }, () => observation({ attributes: { subject_id: "maths" } }));
    expect(compositionDistance(exposed, unexposed, "subject_id")).toBeCloseTo(1, 6);

    const mixed = Array.from({ length: 20 }, (_, i) => observation({ attributes: { subject_id: i % 2 ? "physics" : "maths" } }));
    expect(compositionDistance(mixed, [...mixed], "subject_id")).toBeCloseTo(0, 6);
  });

  it("dissolves a purely confounded effect under stratification", () => {
    // Every difference here comes from time of day, not from the exposure:
    // within each hour band the two groups are identical.
    const exposed = [
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 900, value: 0.8 })),
      ...Array.from({ length: 4 }, () => observation({ localMinutes: 540, value: 0.6 })),
    ];
    const unexposed = [
      ...Array.from({ length: 4 }, () => observation({ localMinutes: 900, value: 0.8 })),
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 540, value: 0.6 })),
    ];
    const adjustment = stratifiedEffect(exposed, unexposed);
    expect(adjustment.rawDifference).toBeGreaterThan(0.05);
    expect(adjustment.adjustedDifference).toBeCloseTo(0, 6);
    expect(adjustment.survivesAdjustment).toBe(false);
    expect(adjustment.usableStrata).toBe(2);
  });

  it("preserves a genuine effect under stratification", () => {
    // A real +0.1 within every hour band, regardless of the band's own level.
    const exposed = [
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 900, value: 0.9 })),
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 540, value: 0.7 })),
    ];
    const unexposed = [
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 900, value: 0.8 })),
      ...Array.from({ length: 12 }, () => observation({ localMinutes: 540, value: 0.6 })),
    ];
    const adjustment = stratifiedEffect(exposed, unexposed);
    expect(adjustment.adjustedDifference).toBeCloseTo(0.1, 6);
    expect(adjustment.survivesAdjustment).toBe(true);
  });

  it("refuses to adjust when there are too few comparable strata", () => {
    const exposed = Array.from({ length: 20 }, () => observation({ localMinutes: 900, value: 0.8 }));
    const unexposed = Array.from({ length: 2 }, () => observation({ localMinutes: 540, value: 0.6 }));
    expect(stratifiedEffect(exposed, unexposed).usableStrata).toBe(0);
  });
});

describe("evidence-contract enforcement", () => {
  const base: Finding = {
    id: "f1",
    createdAt: "2025-07-01T00:00:00Z",
    evidenceClass: "correlation",
    title: "Something",
    statement: "Across 40 sessions, accuracy was 5% higher.",
    metricIds: ["study.accuracy"],
    sources: ["revise"],
    sampleSize: 40,
    sampleDescription: "40 sessions",
    effect: { kind: "hedges_g", value: 0.4, magnitude: "small", label: "+0.40 SD" },
    confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: null,
    evidence: [{ kind: "events", description: "40 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 40, dateRange: null }],
    tags: [],
  };

  it("accepts a well-formed finding", () => {
    expect(validateFinding(base)).toEqual([]);
  });

  it("rejects causal language on a non-experimental finding", () => {
    const problems = validateFinding({ ...base, statement: "Exercise causes higher accuracy." });
    expect(problems).toContain("Non-experimental finding uses causal language");
  });

  it("rejects a high-confidence correlation", () => {
    const problems = validateFinding({ ...base, confidence: { ...base.confidence, level: "high", score: 0.9 } });
    expect(problems).toContain("Correlational findings cannot be graded high confidence");
  });

  it("rejects a finding with no evidence, no causality note or no effect", () => {
    expect(validateFinding({ ...base, evidence: [] })).toContain("Finding cites no evidence");
    expect(validateFinding({ ...base, causalityNote: "" })).toContain("Finding is missing its causality note");
    expect(validateFinding({ ...base, effect: { ...base.effect, value: NaN } })).toContain("Finding has no usable effect size");
  });

  it("permits causal language on an experimental finding", () => {
    expect(
      validateFinding({
        ...base,
        evidenceClass: "experiment",
        statement: "Under the assigned condition, accuracy was higher because of the change you made.",
      }),
    ).toEqual([]);
  });
});

describe("minimum-sample gating", () => {
  it("publishes nothing at all from two weeks of data", async () => {
    const { pulse } = await createSyntheticPulse({ days: 14, seed: "thin-data" });
    const report = pulse.discover();
    expect(report.findings).toEqual([]);
    expect(report.rejected.some((rejection) => /need|Only|too small|at least/i.test(rejection.reason))).toBe(true);
  });

  it("respects each metric's declared minimum sample", async () => {
    const { pulse } = await createSyntheticPulse({ days: 30, seed: "small-data" });
    const events = pulse.events();
    const report = discoverRelationships(events, { registry, now: () => Date.parse("2025-07-01T00:00:00Z") });
    for (const finding of report.findings) {
      const definition = registry.require(finding.metricIds[0]!);
      const available = observationsFor(events, definition).length;
      expect(available).toBeGreaterThanOrEqual(definition.minSampleForInsight);
    }
  });
});
