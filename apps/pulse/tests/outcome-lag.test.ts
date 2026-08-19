/**
 * Delayed outcome support (P1 #11).
 *
 * The outcome is assumed to land on the same day as the condition; a score
 * reported the following day gets paired with the wrong day by row number.
 * These tests pin `outcomeLagDays` on the design: the analysis pairs an
 * outcome observation dated X explicitly to the assignment of X - lag — never
 * by row position — across attribution, adherence, the baseline and washout
 * reports, the block means and the adaptive-duration window. The synthetic
 * benchmark user's next-morning sleep rating is the planted lag exercised at
 * the end.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import { designExperiment, type ExperimentDesign } from "../src/experiments/design.js";
import { adaptiveEndDate } from "../src/experiments/calendar.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import { addDays } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const registry = createDefaultRegistry();
const NOW = Date.parse("2025-08-20T12:00:00Z");
const clock = (): number => NOW;

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-lag",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-lag",
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

/** A 14-day crossover (two 7-day blocks) — the standard lag fixture. */
function designed(
  options: { outcomeLagDays?: number; minSamplePerCondition?: number; washoutDays?: number; baselineDays?: number } = {},
): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    minSamplePerCondition: options.minSamplePerCondition ?? 4,
    sessionsPerWeek: 4,
    outcomeLagDays: options.outcomeLagDays,
    washoutDays: options.washoutDays,
    baselineDays: options.baselineDays,
    now: clock,
  });
}

/**
 * One outcome event per assigned day, landing `lag` days later, with a value
 * that encodes the condition of the day it is *about*: aValue on A days,
 * bValue on B days, nullValue on no-condition days. Alternating jitter keeps
 * the groups non-constant without changing the between-group difference.
 */
function outcomesByCondition(
  d: ExperimentDesign,
  lag: number,
  aValue: number,
  bValue: number,
  nullValue = 0.5,
  jitter = 0.02,
): PulseEvent[] {
  const events: PulseEvent[] = [];
  const counts: Record<string, number> = {};
  for (const assignment of d.assignments) {
    const key = assignment.condition ?? "null";
    const base = assignment.condition === "A" ? aValue : assignment.condition === "B" ? bValue : nullValue;
    const n = counts[key] ?? 0;
    counts[key] = n + 1;
    const value = n % 2 === 0 ? base + jitter : base - jitter;
    events.push(
      normaliseEvent(
        {
          source: "revise",
          sourceEventId: `lag-${assignment.date}`,
          type: "revise.attempt",
          category: "study",
          occurredAt: `${addDays(assignment.date, lag)}T15:00:00Z`,
          metrics: { accuracy: value, marks_awarded: Math.round(value * 10), marks_available: 10, response_ms: 120_000 },
          attributes: { method: "practice" },
        },
        ctx,
      ),
    );
  }
  return events;
}

describe("the outcomeLagDays option", () => {
  it("defaults to zero — today's outcome, as before", () => {
    const design = designed({});
    expect(design.outcomeLagDays).toBe(0);
  });

  it("stores the requested lag", () => {
    const design = designed({ outcomeLagDays: 1 });
    expect(design.outcomeLagDays).toBe(1);
  });

  it("caps the lag at a week — beyond that the pair is meaningless", () => {
    const design = designed({ outcomeLagDays: 9 });
    expect(design.outcomeLagDays).toBe(7);
  });
});

describe("explicit pairing, never by row", () => {
  it("attributes an outcome dated X to the assignment of X - lag", () => {
    // Two 7-day blocks: A high, B low, each outcome landing the next day.
    const design = designed({ outcomeLagDays: 1 });
    const events = outcomesByCondition(design, 1, 0.9, 0.1);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    // All 14 outcomes pair to their own condition day: 7 sessions each, with
    // the expected means — the last day of block A (outcome landing on the
    // first block-B date) still counts for A.
    expect(result.adherence.conditionASessions).toBe(7);
    expect(result.adherence.conditionBSessions).toBe(7);
    expect(result.comparison).not.toBeNull();
    expect(result.verdict).toBe("supported");
  });

  it("without the lag, the same data pairs by landing date instead", () => {
    const design = designed({});
    const events = outcomesByCondition(design, 1, 0.9, 0.1);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    // The outcome of the last block-0 day lands on the first block-1 date and
    // is attributed to block 1: block 0's condition gets only 6 sessions, the
    // other 7, and the trailing outcome (date 15) falls outside the window.
    const firstBlockCondition = design.assignments[0]!.condition;
    expect(result.adherence.conditionASessions).toBe(firstBlockCondition === "A" ? 6 : 7);
    expect(result.adherence.conditionBSessions).toBe(firstBlockCondition === "A" ? 7 : 6);
    expect(result.adherence.outOfWindowSessions).toBe(1);
  });
});

describe("lagged washout and baseline", () => {
  it("keeps the outcome of the day before a washout in its block, and counts washout outcomes in the washout report", () => {
    const design = designed({ outcomeLagDays: 1, washoutDays: 2 });
    // 7 A + 2 washout + 7 B. Outcomes land the next day; the outcome of the
    // last A day lands on the first washout date but is about the A day.
    const events = outcomesByCondition(design, 1, 0.9, 0.1, 0.5);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.adherence.conditionASessions).toBe(7);
    // The two washout outcomes (for the two washout days) land after the gap
    // and are reported as the hangover, excluded from the comparison.
    expect(result.washout).not.toBeNull();
    expect(result.washout!.sessions).toBe(2);
    expect(result.washout!.mean).toBeCloseTo(0.5, 5);
    expect(result.blocks.filter((block) => block.condition === "A").every((block) => block.mean > 0.8)).toBe(true);
  });

  it("without the lag, the washout report swallows the last block outcome", () => {
    const design = designed({ washoutDays: 2 });
    const events = outcomesByCondition(design, 1, 0.9, 0.1, 0.5);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    // The outcome of the last block-0 day lands on the first washout date and
    // is attributed to the washout by landing date: the hangover readout is
    // polluted by a block outcome (mean pulled away from the true 0.5 in
    // whichever direction block 0's condition ran), and block 0's condition
    // loses the session.
    expect(result.washout).not.toBeNull();
    expect(result.washout!.sessions).toBe(2);
    expect(result.washout!.mean).not.toBeNull();
    expect(Math.abs(result.washout!.mean! - 0.5)).toBeGreaterThan(0.1);
    const firstBlockCondition = design.assignments[0]!.condition;
    expect(result.adherence.conditionASessions).toBe(firstBlockCondition === "A" ? 6 : 7);
    expect(result.adherence.conditionBSessions).toBe(firstBlockCondition === "A" ? 7 : 6);
  });

  it("attributes baseline outcomes to the baseline, not the first condition day", () => {
    const design = designed({ outcomeLagDays: 1, baselineDays: 3 });
    const events = outcomesByCondition(design, 1, 0.9, 0.1);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    // The outcomes for the three baseline days land on the first condition
    // dates but are about the baseline: they must not pollute the comparison.
    expect(result.baseline).not.toBeNull();
    expect(result.baseline!.sessions).toBe(3);
    expect(result.adherence.conditionASessions + result.adherence.conditionBSessions).toBe(14);
  });
});

describe("lagged adherence and window", () => {
  it("counts an assigned day as followed when its outcome lands the next day", () => {
    // A 4-session target (2 per condition) so 7 outcomes reach the sample and
    // the run is not silently extended past the window.
    const design = designed({ outcomeLagDays: 1, minSamplePerCondition: 2 });
    const events = outcomesByCondition(design, 1, 0.9, 0.1).filter((_, index) => index % 2 === 0);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    // Half the assigned days produced an outcome (landing a day later).
    expect(result.adherence.assignedDays).toBe(14);
    expect(result.adherence.daysWithSessions).toBe(7);
    expect(result.adherence.adherence).toBeCloseTo(0.5, 5);
  });

  it("excludes outcomes dated before the run's first assignment day", () => {
    const design = designed({ outcomeLagDays: 1 });
    const preWindow = normaliseEvent(
      {
        source: "revise",
        sourceEventId: "pre-window-0",
        type: "revise.attempt",
        category: "study",
        // Dated on the start date, so it reflects the day before the run.
        occurredAt: "2025-07-01T15:00:00Z",
        metrics: { accuracy: 0.5, marks_awarded: 5, marks_available: 10, response_ms: 120_000 },
        attributes: { method: "practice" },
      },
      ctx,
    );
    const events = [...outcomesByCondition(design, 1, 0.9, 0.1), preWindow];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.adherence.outOfWindowSessions).toBe(1);
  });

  it("feeds the adaptive-duration projection with assignment dates, not outcome dates", () => {
    const design = designed({ outcomeLagDays: 1, minSamplePerCondition: 8 });
    const events = outcomesByCondition(design, 1, 0.9, 0.1).slice(0, 14);
    // 14 sessions over a 58-assigned-day extended window is only 24%
    // adherence, so the run would be called invalid before the projection is
    // reported; lower the floor so the projection itself is what is tested.
    const result = analyseExperiment(design, events, {
      registry,
      predictedEffect: 0.45,
      now: clock,
      minAdherence: 0.2,
    });

    const adjustedDates = events.map((event) => addDays(event.localDate, -1));
    expect(result.effectiveEndDate).toBe(adaptiveEndDate(design, adjustedDates, "2025-08-20"));
    expect(result.effectiveEndDate).toBe("2025-08-28");
    // The pairing is still explicit on an extended run: the 14 sessions all
    // belong to their own condition days, so the comparison is not degenerate.
    expect(result.adherence.conditionASessions + result.adherence.conditionBSessions).toBe(14);
  });
});

describe("planted lag in the synthetic benchmark user", () => {
  it("pairs the next-morning sleep rating to the previous day's assignment", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "outcome-lag-harness" });

    // The synthetic user's sleep rating is recorded on the next morning — a
    // genuine one-day lag between behaviour and outcome. Register a hypothesis
    // on that metric and run a lagged experiment across real benchmark data.
    const sleepFinding: Finding = {
      ...finding,
      id: "f-sleep-lag",
      title: "Sleep rating is higher after early training",
      statement: "Across 300 observations, sleep rating was 0.4 points higher after early training.",
      metricIds: ["wellbeing.sleep"],
      sources: ["arise"],
      effect: { kind: "hedges_g", value: 0.3, magnitude: "small", label: "+0.30 SD" },
      evidence: [{ kind: "events", description: "300 check-ins", metricIds: ["wellbeing.sleep"], sources: ["arise"], eventCount: 300, dateRange: { from: "2025-01-01", to: "2025-06-29" } }],
    };
    const hypothesis = pulse.hypotheses.proposeFromFinding(sleepFinding)!;
    const today = pulse.calendar().today;
    const design = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
      outcomeLagDays: 1,
    });

    const result = pulse.analyseExperiment(design.id);
    expect(result.verdict).not.toBe("invalid");

    // The expected pairing, computed from the real events: each readiness
    // check-in on date X is the outcome of the assignment of X - 1.
    const readinessDates = pulse
      .events()
      .filter((event) => event.type === "arise.readiness")
      .map((event) => event.localDate);
    let expectedA = 0;
    let expectedB = 0;
    for (const assignment of design.assignments) {
      if (assignment.condition === null) continue;
      const outcomeDate = addDays(assignment.date, 1);
      const hasOutcome = readinessDates.includes(outcomeDate);
      if (assignment.condition === "A") expectedA += hasOutcome ? 1 : 0;
      else expectedB += hasOutcome ? 1 : 0;
    }

    expect(result.adherence.conditionASessions).toBe(expectedA);
    expect(result.adherence.conditionBSessions).toBe(expectedB);
    // Both conditions actually have outcomes — the pairing found the lagged
    // ratings rather than an empty run.
    expect(expectedA).toBeGreaterThan(0);
    expect(expectedB).toBeGreaterThan(0);
  });
});

