/**
 * Washout periods (P1 #3).
 *
 * Carry-over is a listed likely confounder, but crossover blocks run
 * back-to-back with no gap, so a lingering effect bleeds into the next
 * block's baseline. These tests pin the optional `washoutDays` gap: no
 * condition applies during a washout, the schedule records the gap as
 * null-condition assignments, `derivePeriods` names it "Washout", and the
 * analysis excludes those days from the per-block means and adherence while
 * reporting them separately as the hangover readout.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import {
  buildAssignments,
  designExperiment,
  derivePeriods,
  periodForDate,
  WASHOUT_INSTRUCTION,
  type ExperimentDesign,
} from "../src/experiments/design.js";
import { analyseExperiment, type WashoutReport } from "../src/experiments/analysis.js";
import { buildCalendar } from "../src/experiments/calendar.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import { addDays } from "../src/events/time.js";
import { createRng, normalDeviate } from "../src/statistics/random.js";
import type { Finding } from "../src/discovery/finding.js";

const registry = createDefaultRegistry();
const NOW = Date.parse("2025-07-01T12:00:00Z");
const clock = (): number => NOW;

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-washout",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-washout",
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

/** Small deterministic crossover: 28 days, 4 blocks of 7, 2-day washouts. */
function crossoverWithWashout(options: { washoutDays?: number } = {}): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    minSamplePerCondition: 10,
    sessionsPerWeek: 6,
    washoutDays: options.washoutDays ?? 2,
    now: clock,
  });
}

/**
 * Builds attempt events on the given dates. When a date has no condition (a
 * washout day) and `washoutMean` is given, sessions are still recorded there
 * — the outcome is observed throughout, it just is not part of the
 * comparison.
 */
function eventsForRun(
  dates: readonly string[],
  conditionOf: (date: string) => "A" | "B" | null,
  meanByCondition: { A: number; B: number },
  options: { perDay?: number; sd?: number; seed?: string; washoutMean?: number } = {},
): PulseEvent[] {
  const rng = createRng(options.seed ?? "run");
  const perDay = options.perDay ?? 2;
  const sd = options.sd ?? 0.08;
  const events: PulseEvent[] = [];
  for (const date of dates) {
    const condition = conditionOf(date);
    const mean = condition === "A" ? meanByCondition.A : condition === "B" ? meanByCondition.B : options.washoutMean;
    if (mean === undefined) continue;
    for (let i = 0; i < perDay; i += 1) {
      const accuracy = Math.min(1, Math.max(0, normalDeviate(rng, mean, sd)));
      events.push(
        normaliseEvent(
          {
            source: "revise",
            sourceEventId: `${date}-${i}`,
            type: "revise.attempt",
            category: "study",
            occurredAt: `${date}T15:0${i}:00Z`,
            metrics: { accuracy, marks_awarded: Math.round(accuracy * 10), marks_available: 10, response_ms: 120_000 },
            attributes: { method: "practice" },
          },
          ctx,
        ),
      );
    }
  }
  return events;
}

describe("washout scheduling", () => {
  it("is off by default: no null-condition days, unchanged end date", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      now: clock,
    });
    expect(design.washoutDays).toBe(0);
    expect(design.assignments.some((assignment) => assignment.condition === null)).toBe(false);
    expect(design.endDate).toBe(addDays("2025-07-01", design.durationDays - 1));
  });

  it("inserts a null-condition gap between every pair of crossover blocks", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    expect(design.washoutDays).toBe(2);
    // 28 intervention days, 4 blocks -> 3 gaps of 2 days.
    const washout = design.assignments.filter((assignment) => assignment.condition === null);
    expect(washout.length).toBe(6);
    expect(design.assignments.length).toBe(28 + 6);
    expect(design.endDate).toBe(addDays("2025-07-01", design.durationDays - 1 + 6));
    // The gap sits between block 0 and block 1: days 8-9 of the run.
    const dates = design.assignments.map((assignment) => assignment.date);
    expect(dates[7]).toBe("2025-07-08");
    expect(dates[7 + 1]).toBe("2025-07-09");
    expect(design.assignments[7]!.condition).toBeNull();
    expect(design.assignments[8]!.condition).toBeNull();
    expect(design.assignments[6]!.condition).not.toBeNull();
    expect(design.assignments[9]!.condition).not.toBeNull();
  });

  it("caps washout at blockDays so it cannot double the run length", () => {
    const design = crossoverWithWashout({ washoutDays: 20 });
    expect(design.washoutDays).toBe(7);
    expect(design.assignments.filter((assignment) => assignment.condition === null).length).toBe(7 * 3);
  });

  it("treats a negative washout request as no washout", () => {
    const design = crossoverWithWashout({ washoutDays: -2 });
    expect(design.washoutDays).toBe(0);
    expect(design.assignments.some((assignment) => assignment.condition === null)).toBe(false);
  });

  it("refuses a washout on designs that have no blocks to separate", () => {
    const hypothesis = makeHypothesis();
    expect(() =>
      designExperiment(hypothesis, { startDate: "2025-07-01", type: "ab", washoutDays: 2, now: clock }),
    ).toThrow(/crossover/);
    expect(() =>
      designExperiment(hypothesis, { startDate: "2025-07-01", type: "before-after", washoutDays: 2, now: clock }),
    ).toThrow(/crossover/);
  });

  it("buildAssignments places the gap between blocks, not inside them", () => {
    const assignments = buildAssignments("crossover", "2025-07-01", 14, 7, "washout-seed", 2);
    expect(assignments.length).toBe(16);
    const conditions = assignments.map((assignment) => assignment.condition);
    expect(conditions.slice(0, 7).every((condition) => condition !== null)).toBe(true);
    expect(conditions[7]).toBeNull();
    expect(conditions[8]).toBeNull();
    expect(conditions.slice(9).every((condition) => condition !== null)).toBe(true);
    // Washout days belong to the block they follow.
    expect(assignments[7]!.block).toBe(0);
    expect(assignments[9]!.block).toBe(1);
  });
});

describe("washout periods", () => {
  it("derives a named Washout period for each gap", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    const periods = derivePeriods(design);
    // Which condition starts is seed-dependent; the structure is what matters
    // here — alternating blocks with a Washout gap between every pair.
    expect(periods.map((period) => period.condition)).toEqual(["B", null, "A", null, "B", null, "A"]);
    expect(periods.map((period) => period.label)).toEqual([
      "Control B",
      "Washout",
      "Intervention A",
      "Washout",
      "Control B",
      "Washout",
      "Intervention A",
    ]);
    expect(periods.map((period) => period.dayCount)).toEqual([7, 2, 7, 2, 7, 2, 7]);
  });

  it("covers every assigned date exactly once, washout included", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    const covered = new Set(
      derivePeriods(design).flatMap((period) => {
        const days: string[] = [];
        for (let day = 0; day < period.dayCount; day += 1) days.push(addDays(period.startDate, day));
        return days;
      }),
    );
    expect([...covered].sort()).toEqual(design.assignments.map((assignment) => assignment.date));
  });

  it("reports a washout day's position within the Washout period", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    const first = periodForDate(design, "2025-07-08")!;
    expect(first!.period.label).toBe("Washout");
    expect(first!.period.condition).toBeNull();
    expect(first!.dayInPeriod).toBe(1);
    expect(periodForDate(design, "2025-07-09")!.dayInPeriod).toBe(2);
    expect(periodForDate(design, "2025-07-10")!.period.condition).not.toBeNull();
  });
});

describe("washout in the calendar", () => {
  it("shows the washout period on schedule entries and marks today", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    const cal = buildCalendar([design], [], "2025-07-08");
    const active = cal.active[0]!;
    expect(active.todayCondition).toBeNull();
    expect(active.todayInstruction).toBe(WASHOUT_INSTRUCTION);
    expect(active.todayPeriod?.period.label).toBe("Washout");
    expect(active.todayPeriod?.dayInPeriod).toBe(1);

    const washoutEntries = cal.schedule.filter((assignment) => assignment.condition === null);
    expect(washoutEntries.length).toBeGreaterThan(0);
    expect(washoutEntries[0]!.period).toBe("Washout · Day 1/2");
    expect(washoutEntries[1]!.period).toBe("Washout · Day 2/2");
  });

  it("renders no washout entries when the design has no gap", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      now: clock,
    });
    const cal = buildCalendar([design], [], "2025-07-01");
    expect(cal.schedule.every((assignment) => assignment.condition !== null)).toBe(true);
    expect(cal.schedule.every((assignment) => !assignment.period.includes("Washout"))).toBe(true);
  });
});

describe("washout in the analysis", () => {
  it("excludes washout days from the comparison and adherence, and reports them separately", () => {
    const design = crossoverWithWashout({ washoutDays: 2 });
    const dates = design.assignments.map((assignment) => assignment.date);
    const events = eventsForRun(
      dates,
      (date) => design.assignments.find((assignment) => assignment.date === date)?.condition ?? null,
      { A: 0.78, B: 0.6 },
      { perDay: 2, sd: 0.08, seed: "washout-run", washoutMean: 0.9 },
    );
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).not.toBe("invalid");

    // 28 condition days x 2 sessions: 28 in each condition; no washout
    // session leaks into a condition group or a block mean.
    expect(result.adherence.conditionASessions).toBe(28);
    expect(result.adherence.conditionBSessions).toBe(28);
    expect(result.blocks.every((block) => block.n === 14)).toBe(true);

    // Adherence counts assigned (condition) days only — a washout day has no
    // assignment to follow, so it cannot be failed.
    expect(result.adherence.assignedDays).toBe(28);
    expect(result.adherence.adherence).toBe(1);

    // The hangover readout: 6 washout days, 12 sessions, mean near 0.9.
    const washout: WashoutReport = result.washout!;
    expect(washout).not.toBeNull();
    expect(washout.days).toBe(6);
    expect(washout.sessions).toBe(12);
    expect(washout.mean).not.toBeNull();
    expect(washout.mean!).toBeGreaterThan(0.85);

    expect(result.summary).toMatch(/washout/);
  });

  it("reports no washout for a run without a gap", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      now: clock,
    });
    const dates = design.assignments.map((assignment) => assignment.date);
    const events = eventsForRun(dates, (date) => design.assignments.find((a) => a.date === date)?.condition ?? null, {
      A: 0.78,
      B: 0.6,
    });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.washout).toBeNull();
    expect(result.summary).not.toMatch(/washout/);
    expect(result.adherence.assignedDays).toBe(design.assignments.length);
  });
});
