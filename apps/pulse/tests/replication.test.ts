/**
 * Replication templates (P1 #13).
 *
 * Repeating an experiment used to mean re-deriving everything from the
 * hypothesis and losing the link between the two runs. These tests pin the
 * one-click replication: a clone of an analysed design that keeps its
 * conditions, outcomes, analysis method and structure, re-derives its sample
 * from the *observed* effect of the original, schedules with a new seed and
 * start date, and carries the link back to the original — the paper trail the
 * replication ledger's retested path runs on.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import { designExperiment, replicateDesign, type ExperimentDesign } from "../src/experiments/design.js";
import { ReplicationLedger } from "../src/discovery/replication.js";
import { addDays } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const NOW = Date.parse("2025-08-20T12:00:00Z");
const clock = (): number => NOW;

const finding: Finding = {
  id: "f-rep",
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

/** A structured crossover: baseline, washout, lag, stopping and a secondary. */
function structured(): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    sessionsPerWeek: 4,
    baselineDays: 3,
    washoutDays: 2,
    outcomeLagDays: 1,
    stopping: { futility: {} },
    outcomes: [{ metricId: "wellbeing.sleep", predictedDirection: "increase", predictedEffect: 0.3 }],
    now: clock,
  });
}

describe("replicateDesign", () => {
  it("clones the conditions, outcomes, analysis method and structure", () => {
    const original = structured();
    const clone = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.5, now: clock });

    expect(clone.type).toBe(original.type);
    expect(clone.conditionA).toEqual(original.conditionA);
    expect(clone.conditionB).toEqual(original.conditionB);
    expect(clone.outcomes).toEqual(original.outcomes);
    expect(clone.analysisMethod).toBe(original.analysisMethod);
    expect(clone.likelyConfounders).toEqual(original.likelyConfounders);
    expect(clone.invalidations).toEqual(original.invalidations);
    expect(clone.blockDays).toBe(original.blockDays);
    expect(clone.washoutDays).toBe(original.washoutDays);
    expect(clone.baselineDays).toBe(original.baselineDays);
    expect(clone.outcomeLagDays).toBe(original.outcomeLagDays);
    expect(clone.stopping).toEqual(original.stopping);
    expect(clone.targetMetricId).toBe(original.targetMetricId);
  });

  it("re-derives the sample from the observed effect, not the original prediction", () => {
    const original = structured();
    // The original was sized from the 0.45 prediction (41 sessions per
    // condition); a replication of a 0.8 observed effect needs fewer (15),
    // one of a 0.25 observed effect needs many more (128).
    expect(original.minSamplePerCondition).toBe(41);
    const strong = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.8, now: clock });
    expect(strong.minSamplePerCondition).toBe(15);
    const weak = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.25, now: clock });
    expect(weak.minSamplePerCondition).toBe(128);
  });

  it("gets a fresh id and seed, scheduled from the new start date", () => {
    const original = structured();
    const clone = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.5, now: clock });

    expect(clone.id).not.toBe(original.id);
    expect(clone.seed).not.toBe(original.seed);
    expect(clone.startDate).toBe("2025-08-01");
    // The baseline lead-in is part of the schedule: the first assignment is a
    // null-condition baseline day at the start date, the first condition day
    // sits after the lead-in.
    expect(clone.assignments[0]!.date).toBe("2025-08-01");
    expect(clone.assignments[0]!.condition).toBeNull();
    expect(clone.assignments[original.baselineDays!]!.condition).not.toBeNull();
    expect(clone.endDate > original.endDate).toBe(true);
  });

  it("is deterministic for the same inputs and carries the link back", () => {
    const original = structured();
    const a = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.5, now: clock });
    const b = replicateDesign(original, { startDate: "2025-08-01", observedEffect: 0.5, now: clock });
    expect(a).toEqual(b);
    expect(a.replicatedFromDesignId).toBe(original.id);
  });
});

describe("the replication ledger's retested path", () => {
  it("records a replication note on the paper trail", () => {
    const ledger = new ReplicationLedger(clock);
    ledger.recordExperimentResult("f-rep", "supported", "replication of exp-original");
    const record = ledger.list().find((entry) => entry.findingId === "f-rep")!;
    expect(record.status).toBe("experimentally-supported");
    expect(record.evidence).toMatch(/replication of exp-original/);

    const failed = new ReplicationLedger(clock);
    failed.recordExperimentResult("f-rep", "refuted", "replication of exp-original");
    expect(failed.list()[0]!.status).toBe("failed-to-replicate");
    expect(failed.list()[0]!.evidence).toMatch(/replication of exp-original/);
  });
});

describe("pulse.replicateExperiment", () => {
  it("refuses to replicate a run that has not been analysed", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-refuse" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const design = pulse.designExperiment(hypothesis.id, { startDate: pulse.calendar().today, sessionsPerWeek: 4 });
    expect(() => pulse.replicateExperiment(design.id)).toThrow(/analysed/i);
  });

  it("refuses to replicate a run whose analysis found no observed effect", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-invalid" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    // A run scheduled entirely after the recorded events analyses as invalid —
    // there is no effect to size a replication from, so the clone must not be made.
    const design = pulse.designExperiment(hypothesis.id, {
      startDate: pulse.calendar().today,
      sessionsPerWeek: 4,
    });
    const result = pulse.analyseExperiment(design.id);
    expect(result.verdict).toBe("invalid");
    expect(() => pulse.replicateExperiment(design.id)).toThrow(/no observed effect/);
    expect(pulse.listDesigns().length).toBe(1);
  });

  it("clones an analysed design, relinks the hypothesis to testing, and defaults the start to the day after the original ends", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-flow" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const original = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(pulse.calendar().today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
    });
    pulse.analyseExperiment(original.id);

    const clone = pulse.replicateExperiment(original.id);

    expect(clone.id).not.toBe(original.id);
    expect(clone.replicatedFromDesignId).toBe(original.id);
    expect(clone.startDate).toBe(addDays(original.endDate, 1));
    // Same hypothesis, now back under test by the replication.
    const relinked = pulse.hypotheses.get(hypothesis.id)!;
    expect(relinked.status).toBe("testing");
    expect(relinked.experimentIds).toContain(clone.id);
    expect(pulse.getDesign(clone.id)).toBe(clone);
  });

  it("lets the user pick the start date and seed", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-dates" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const original = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(pulse.calendar().today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
    });
    pulse.analyseExperiment(original.id);

    const clone = pulse.replicateExperiment(original.id, {
      startDate: "2025-08-10",
      seed: "my-second-run",
    });
    expect(clone.startDate).toBe("2025-08-10");
    expect(clone.seed).toBe("my-second-run");
  });

  it("does not block the replication on the original itself, but does block a clash with another live run", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-conflict" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const original = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(pulse.calendar().today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
    });
    pulse.analyseExperiment(original.id);

    // A second live run on the same metric that the clone would overlap.
    const hypothesis2 = pulse.hypotheses.proposeFromFinding({ ...finding, id: "f-rep-other" })!;
    const rival = pulse.designExperiment(hypothesis2.id, {
      startDate: addDays(pulse.calendar().today, -10),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
    });
    expect(() => pulse.replicateExperiment(original.id)).toThrow();
    expect(rival.id.length).toBeGreaterThan(0);
  });

  it("writes the replication link into the ledger when the clone is analysed", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-ledger" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const original = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(pulse.calendar().today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
    });
    pulse.analyseExperiment(original.id);
    const clone = pulse.replicateExperiment(original.id);

    pulse.analyseExperiment(clone.id);
    const record = pulse.replication.list().find((entry) => entry.findingId === hypothesis.originFindingId)!;
    expect(record.evidence).toMatch(new RegExp(`replication of ${original.id}`));
  });
});

