/**
 * Early stopping rules (P1 #5-8).
 *
 * Verdicts used to be computed once, at the end: a run that was already
 * doomed burned its full length and returned an answer mixing early and late
 * data. These tests pin the pre-registered rules that look at a live run
 * mid-run and decide continue or stop — futility (conditional power below a
 * pre-registered floor), low adherence (projection that cannot recover), and
 * data quality (a collapsed source). Only rules pre-registered on the design
 * may stop a run; the reason is recorded and the final verdict integrates it.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import {
  buildAssignments,
  designExperiment,
  type ExperimentDesign,
  type ExperimentType,
} from "../src/experiments/design.js";
import { buildCalendar } from "../src/experiments/calendar.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
import { evaluateStopping, type StopDecision } from "../src/experiments/stopping.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import { addDays, daysBetween } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";

const registry = createDefaultRegistry();
const NOW = Date.parse("2025-08-20T12:00:00Z");
const clock = (): number => NOW;

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-stopping",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-stopping",
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

/** A 28-day crossover with a 16-session target — the standard stopping fixture. */
function designed(stopping: Parameters<typeof designExperiment>[1]["stopping"]): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    minSamplePerCondition: 8,
    sessionsPerWeek: 4,
    stopping,
    now: clock,
  });
}

function design(options: {
  id: string;
  startDate: string;
  endDate: string;
  minSamplePerCondition: number;
  type?: ExperimentType;
  blockDays?: number;
}): ExperimentDesign {
  const type = options.type ?? "crossover";
  const blockDays = options.blockDays ?? 7;
  const durationDays = daysBetween(options.startDate, options.endDate) + 1;
  const assignments = buildAssignments(type, options.startDate, durationDays, blockDays, options.id);
  return {
    id: options.id,
    hypothesisId: `hyp-${options.id}`,
    createdAt: "2025-07-01T00:00:00.000Z",
    type,
    title: `${type} test`,
    hypothesis: `Hypothesis for ${options.id}`,
    conditionA: { id: "A", label: "Intervention", instruction: "Do the behaviour under test" },
    conditionB: { id: "B", label: "Control", instruction: "Do not do the behaviour under test" },
    targetMetricId: "study.accuracy",
    minSamplePerCondition: options.minSamplePerCondition,
    durationDays,
    blockDays,
    startDate: options.startDate,
    endDate: options.endDate,
    assignments,
    likelyConfounders: [],
    analysisMethod: "Paired comparison of per-block means",
    successCriteria: "CI excludes zero",
    seed: options.id,
    invalidations: [],
  };
}

const run = design({ id: "run", startDate: "2025-07-01", endDate: "2025-07-28", minSamplePerCondition: 10 });

/** One exact-valued session per listed date, so counts are deterministic. */
function eventsOnDates(dates: readonly string[], value = 0.7): PulseEvent[] {
  return dates.map((date, index) =>
    normaliseEvent(
      {
        source: "revise",
        sourceEventId: `stopping-${date}-${index}`,
        type: "revise.attempt",
        category: "study",
        occurredAt: `${date}T15:00:00Z`,
        metrics: { accuracy: value, marks_awarded: Math.round(value * 10), marks_available: 10, response_ms: 120_000 },
        attributes: { method: "practice" },
      },
      ctx,
    ),
  );
}

function days(start: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(addDays(start, i));
  return out;
}

/**
 * Sessions on the first `count` assigned days of the design, with a value per
 * condition: aValue on A days, bValue on B days, alternating jitter so the
 * groups have variance but the between-group difference stays exactly as set.
 */
function sessionsOnFirstAssignedDays(
  d: ExperimentDesign,
  count: number,
  aValue: number,
  bValue: number,
  jitter = 0.02,
): PulseEvent[] {
  const events: PulseEvent[] = [];
  const counts = { A: 0, B: 0 };
  for (const assignment of d.assignments) {
    if (assignment.condition === null) continue;
    if (counts.A + counts.B >= count) break;
    const value = assignment.condition === "A" ? aValue : bValue;
    const n = assignment.condition === "A" ? counts.A++ : counts.B++;
    const jittered = n % 2 === 0 ? value + jitter : value - jitter;
    events.push(
      normaliseEvent(
        {
          source: "revise",
          sourceEventId: `stopping-${assignment.date}`,
          type: "revise.attempt",
          category: "study",
          occurredAt: `${assignment.date}T15:00:00Z`,
          metrics: { accuracy: jittered, marks_awarded: Math.round(jittered * 10), marks_available: 10, response_ms: 120_000 },
          attributes: { method: "practice" },
        },
        ctx,
      ),
    );
  }
  return events;
}

describe("pre-registration on the design", () => {
  it("stores no rules when stopping is not requested", () => {
    const design = designed(undefined);
    expect(design.stopping).toEqual({});
  });

  it("resolves defaults for a pre-registered futility rule", () => {
    const design = designed({ futility: {} });
    expect(design.stopping?.futility).toEqual({ conditionalPowerFloor: 0.2, minSampleFraction: 0.5 });
    expect(design.stopping?.adherence).toBeUndefined();
    expect(design.stopping?.quality).toBeUndefined();
  });

  it("stores overrides and keeps unregistered rules out", () => {
    const design = designed({ adherence: { minAdherence: 0.6 }, quality: { minQuality: 0.5 } });
    expect(design.stopping?.adherence?.minAdherence).toBe(0.6);
    expect(design.stopping?.quality?.minQuality).toBe(0.5);
    expect(design.stopping?.futility).toBeUndefined();
  });
});

describe("futility stopping", () => {
  it("stops when the observed effect cannot reach significance at the planned sample", () => {
    const design = designed({ futility: {} });
    const events = sessionsOnFirstAssignedDays(design, 14, 0.5, 0.5);
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-14", timezone: "UTC" });
    expect(stop).not.toBeNull();
    expect(stop!.rule).toBe("futility");
    expect(stop!.decidedOn).toBe("2025-07-14");
    expect(stop!.reason).toMatch(/conditional power/i);
    expect(stop!.reason).toMatch(/20%/);
    expect(stop!.reason).toMatch(/inconclusive, not refuted/i);
  });

  it("continues when the observed effect still has real power at the planned sample", () => {
    const design = designed({ futility: {} });
    const events = sessionsOnFirstAssignedDays(design, 14, 0.9, 0.1, 0.1);
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-14", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not stop on early noise — the sample fraction gate", () => {
    const design = designed({ futility: {} });
    // Only 3 of the planned 16 sessions observed: far below the 50% gate.
    const events = sessionsOnFirstAssignedDays(design, 3, 0.5, 0.5);
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-03", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not stop when a condition has no sessions — no effect to estimate", () => {
    const design = designed({ futility: {} });
    const events = design.assignments
      .filter((assignment) => assignment.condition === "A")
      .slice(0, 10)
      .map((assignment, index) =>
        normaliseEvent(
          {
            source: "revise",
            sourceEventId: `a-only-${index}`,
            type: "revise.attempt",
            category: "study",
            occurredAt: `${assignment.date}T15:00:00Z`,
            metrics: { accuracy: 0.5, marks_awarded: 5, marks_available: 10, response_ms: 120_000 },
            attributes: { method: "practice" },
          },
          ctx,
        ),
      );
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-14", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("analysis integrates a futility stop as inconclusive — never refuted — and still reports the comparison", () => {
    const design = designed({ futility: {} });
    const events = sessionsOnFirstAssignedDays(design, 14, 0.5, 0.5);
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-14", timezone: "UTC" });
    const result = analyseExperiment(design, events, {
      registry,
      predictedEffect: 0.45,
      now: clock,
      stopping: stop,
    });
    expect(result.verdict).toBe("inconclusive");
    expect(result.comparison).not.toBeNull();
    expect(result.reasons.join(" ")).toMatch(/futil/i);
    expect(result.stopping?.rule).toBe("futility");
  });
});

describe("low-adherence stopping", () => {
  it("stops when even perfect recovery cannot reach the adherence floor", () => {
    const design = designed({ adherence: {} });
    // Zero sessions in the first 21 assigned days: with no observed rate there
    // is no extension, so only 7 assigned days remain — 25% projected.
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-21", timezone: "UTC" });
    expect(stop).not.toBeNull();
    expect(stop!.rule).toBe("adherence");
    expect(stop!.reason).toMatch(/25%/);
    expect(stop!.reason).toMatch(/40%/);
    expect(stop!.reason).toMatch(/21 of 21/);
  });

  it("continues when the run can still recover under the adaptive window", () => {
    const design = designed({ adherence: {} });
    const events = eventsOnDates(days("2025-07-01", 10));
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-21", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not stop before enough assigned days have elapsed", () => {
    const design = designed({ adherence: {} });
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-06", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("honours a pre-registered stricter floor", () => {
    const design = designed({ adherence: { minAdherence: 0.7 } });
    // 10 sessions in the first 21 days extends the run, but even perfect
    // recovery lands around 69% — below the pre-registered 70% floor.
    const events = eventsOnDates(days("2025-07-01", 10));
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-21", timezone: "UTC" });
    expect(stop).not.toBeNull();
    expect(stop!.rule).toBe("adherence");
  });

  it("analysis integrates an adherence stop as invalid, naming the missed days", () => {
    const design = designed({ adherence: {} });
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-21", timezone: "UTC" });
    const result = analyseExperiment(design, [], { registry, predictedEffect: 0.45, now: clock, stopping: stop });
    expect(result.verdict).toBe("invalid");
    expect(result.reasons.join(" ")).toMatch(/adherence/i);
    expect(result.stopping?.rule).toBe("adherence");
  });
});

describe("data-quality stopping", () => {
  it("stops when the source collapses mid-run, even with healthy adherence so far", () => {
    const design = designed({ quality: {} });
    // Sessions on the first 10 days, nothing for the next 15: the source is
    // 15 days stale, which caps the quality score below the 0.45 floor, while
    // adherence can still project above its floor.
    const events = eventsOnDates(days("2025-07-01", 10));
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-25", timezone: "UTC" });
    expect(stop).not.toBeNull();
    expect(stop!.rule).toBe("quality");
    expect(stop!.reason).toMatch(/stale|quality/i);
    expect(stop!.reason).toMatch(/study\.accuracy/);
  });

  it("continues while the source is current", () => {
    const design = designed({ quality: {} });
    const events = eventsOnDates(days("2025-07-01", 25));
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-25", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not stop on a quiet first week — the elapsed-days gate", () => {
    const design = designed({ quality: {} });
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-03", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not stop when the quality rule is not pre-registered", () => {
    const design = designed({});
    const events = eventsOnDates(days("2025-07-01", 10));
    const stop = evaluateStopping(design, events, { registry, today: "2025-07-25", timezone: "UTC" });
    expect(stop).toBeNull();
  });
});

describe("rule ordering and timing", () => {
  it("an adherence stop wins over a quality stop when both would fire", () => {
    const design = designed({ adherence: {}, quality: {} });
    // No data at all by day 25: adherence projects below the floor and fires first.
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-25", timezone: "UTC" });
    expect(stop).not.toBeNull();
    expect(stop!.rule).toBe("adherence");
  });

  it("does not evaluate a run that has not started", () => {
    const design = designed({ futility: {}, adherence: {}, quality: {} });
    const stop = evaluateStopping(design, [], { registry, today: "2025-06-20", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("does not evaluate a run whose window has ended — the final verdict is analysis's job", () => {
    const design = designed({ futility: {}, adherence: {}, quality: {} });
    const stop = evaluateStopping(design, [], { registry, today: "2025-08-01", timezone: "UTC" });
    expect(stop).toBeNull();
  });

  it("returns null without any pre-registered rules, whatever the data", () => {
    const design = designed({});
    const stop = evaluateStopping(design, [], { registry, today: "2025-07-21", timezone: "UTC" });
    expect(stop).toBeNull();
  });
});

describe("calendar hook", () => {
  it("carries the stop decision on the live entry when one is supplied", () => {
    const stop: StopDecision = {
      rule: "futility",
      decidedOn: "2025-07-14",
      reason: "Conditional power of 5% is below the floor — stopping early.",
      details: { observedEffect: 0.01, conditionalPower: 0.05, plannedNPerGroup: 8, floor: 0.2 },
    };
    const cal = buildCalendar([run], [], "2025-07-14", undefined, new Map([["run", stop]]));
    const entry = cal.entries[0]!;
    expect(entry.stopping).toEqual(stop);
    // A stopped run is still live in the calendar — flagged, not hidden.
    expect(entry.bucket).toBe("active");
    expect(entry.todayCondition).not.toBeNull();
  });

  it("leaves stopping null without a decision map", () => {
    const cal = buildCalendar([run], [], "2025-07-14");
    expect(cal.entries[0]!.stopping).toBeNull();
  });
});
