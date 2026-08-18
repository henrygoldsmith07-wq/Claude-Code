/**
 * Baseline periods (P1 #1).
 *
 * A crossover alternates conditions from day one, with no pre-run observation,
 * so "before" is never measured — the starting level and any drift before the
 * intervention are invisible. These tests pin the optional `baselineDays`
 * lead-in: no condition applies during it, the schedule records it as
 * null-condition days before the first assignment, `derivePeriods` names it
 * "Baseline", and the analysis excludes it from the comparison and adherence
 * while reporting the baseline mean and per-day drift alongside the result.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import {
  buildAssignments,
  designExperiment,
  derivePeriods,
  periodForDate,
  BASELINE_INSTRUCTION,
  type ExperimentDesign,
} from "../src/experiments/design.js";
import { analyseExperiment, type BaselineReport } from "../src/experiments/analysis.js";
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
  syncId: "sync-baseline",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-baseline",
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

/** Small deterministic crossover: 28 intervention days, 4 blocks of 7. */
function crossoverWithBaseline(options: { baselineDays?: number; washoutDays?: number } = {}): ExperimentDesign {
  return designExperiment(makeHypothesis(), {
    startDate: "2025-07-01",
    blockDays: 7,
    minSamplePerCondition: 10,
    sessionsPerWeek: 6,
    baselineDays: options.baselineDays ?? 4,
    washoutDays: options.washoutDays ?? 0,
    now: clock,
  });
}

/**
 * Builds attempt events on the given dates. Null-condition dates (baseline or
 * washout) are recorded too when `noConditionMean` is given — the outcome is
 * observed throughout the run.
 */
function eventsForRun(
  dates: readonly string[],
  conditionOf: (date: string) => "A" | "B" | null,
  meanByCondition: { A: number; B: number },
  options: { perDay?: number; sd?: number; seed?: string; noConditionMean?: number } = {},
): PulseEvent[] {
  const rng = createRng(options.seed ?? "run");
  const perDay = options.perDay ?? 2;
  const sd = options.sd ?? 0.08;
  const events: PulseEvent[] = [];
  for (const date of dates) {
    const condition = conditionOf(date);
    const mean = condition === "A" ? meanByCondition.A : condition === "B" ? meanByCondition.B : options.noConditionMean;
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

/** Exact-valued baseline sessions (no noise) so the drift is precisely known. */
function exactBaselineEvents(design: ExperimentDesign, baselineValues: readonly number[]): PulseEvent[] {
  const baselineDates = design.assignments.filter((assignment) => assignment.condition === null).map((a) => a.date);
  return baselineDates.map((date, index) =>
    normaliseEvent(
      {
        source: "revise",
        sourceEventId: `baseline-${date}`,
        type: "revise.attempt",
        category: "study",
        occurredAt: `${date}T15:00:00Z`,
        metrics: {
          accuracy: baselineValues[index]!,
          marks_awarded: Math.round(baselineValues[index]! * 10),
          marks_available: 10,
          response_ms: 120_000,
        },
        attributes: { method: "practice" },
      },
      ctx,
    ),
  );
}
describe("baseline scheduling", () => {
  it("is off by default: no null-condition lead-in, unchanged end date", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      now: clock,
    });
    expect(design.baselineDays).toBe(0);
    expect(design.assignments[0]!.condition).not.toBeNull();
    expect(design.endDate).toBe(addDays("2025-07-01", design.durationDays - 1));
  });

  it("prepends a null-condition phase before the first assignment", () => {
    const design = crossoverWithBaseline({ baselineDays: 4 });
    expect(design.baselineDays).toBe(4);
    expect(design.assignments.length).toBe(4 + 28);
    expect(design.assignments.slice(0, 4).every((assignment) => assignment.condition === null)).toBe(true);
    expect(design.assignments[4]!.condition).not.toBeNull();
    // The run starts with the baseline and ends after the last block.
    expect(design.assignments[0]!.date).toBe("2025-07-01");
    expect(design.endDate).toBe(addDays("2025-07-01", 4 + design.durationDays - 1));
  });

  it("caps baseline at 7 days and treats negatives as off", () => {
    const capped = crossoverWithBaseline({ baselineDays: 20 });
    expect(capped.baselineDays).toBe(7);
    expect(capped.assignments.filter((assignment) => assignment.condition === null).length).toBe(7);

    const off = crossoverWithBaseline({ baselineDays: -3 });
    expect(off.baselineDays).toBe(0);
    expect(off.assignments[0]!.condition).not.toBeNull();
  });

  it("applies to A/B and before-after too, not just crossover", () => {
    const ab = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      type: "ab",
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      baselineDays: 3,
      now: clock,
    });
    expect(ab.assignments.slice(0, 3).every((assignment) => assignment.condition === null)).toBe(true);

    const ba = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      type: "before-after",
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      baselineDays: 3,
      now: clock,
    });
    expect(ba.assignments.slice(0, 3).every((assignment) => assignment.condition === null)).toBe(true);
  });

  it("buildAssignments places the baseline before every block", () => {
    const assignments = buildAssignments("crossover", "2025-07-01", 14, 7, "baseline-seed", 2, 3);
    expect(assignments.length).toBe(3 + 14 + 2);
    expect(assignments.slice(0, 3).every((assignment) => assignment.condition === null)).toBe(true);
    expect(assignments[3]!.block).toBe(0);
    expect(assignments[3]!.condition).not.toBeNull();
  });
});

describe("baseline periods", () => {
  it("derives the lead-in as a named Baseline period before the blocks", () => {
    const design = crossoverWithBaseline({ baselineDays: 4 });
    const periods = derivePeriods(design);
    expect(periods[0]!.kind).toBe("baseline");
    expect(periods[0]!.label).toBe("Baseline");
    expect(periods[0]!.condition).toBeNull();
    expect(periods[0]!.dayCount).toBe(4);
    expect(periods.slice(1).every((period) => period.kind === "intervention")).toBe(true);
    // Which condition starts is seed-dependent; the structure is the point.
    expect(periods.slice(1).map((period) => period.condition)).toEqual(["B", "A", "B", "A"]);
  });

  it("keeps a washout period distinct from the baseline", () => {
    const design = crossoverWithBaseline({ baselineDays: 4, washoutDays: 2 });
    const periods = derivePeriods(design);
    const kinds = periods.map((period) => period.kind);
    expect(kinds).toEqual(["baseline", "intervention", "washout", "intervention", "washout", "intervention", "washout", "intervention"]);
  });

  it("covers every assigned date exactly once, baseline included", () => {
    const design = crossoverWithBaseline({ baselineDays: 4 });
    const covered = new Set(
      derivePeriods(design).flatMap((period) => {
        const days: string[] = [];
        for (let day = 0; day < period.dayCount; day += 1) days.push(addDays(period.startDate, day));
        return days;
      }),
    );
    expect([...covered].sort()).toEqual(design.assignments.map((assignment) => assignment.date));
  });

  it("reports a baseline day's position within the Baseline period", () => {
    const design = crossoverWithBaseline({ baselineDays: 4 });
    expect(periodForDate(design, "2025-07-01")!.period.label).toBe("Baseline");
    expect(periodForDate(design, "2025-07-01")!.dayInPeriod).toBe(1);
    expect(periodForDate(design, "2025-07-04")!.dayInPeriod).toBe(4);
    expect(periodForDate(design, "2025-07-05")!.period.kind).toBe("intervention");
  });
});
describe("baseline in the calendar", () => {
  it("shows the baseline period on schedule entries and marks today", () => {
    const design = crossoverWithBaseline({ baselineDays: 4 });
    const cal = buildCalendar([design], [], "2025-07-02");
    const active = cal.active[0]!;
    expect(active.todayCondition).toBeNull();
    expect(active.todayInstruction).toBe(BASELINE_INSTRUCTION);
    expect(active.todayPeriod?.period.label).toBe("Baseline");
    expect(active.todayPeriod?.dayInPeriod).toBe(2);

    // The schedule starts at today (day 2 of the 4-day baseline).
    const baselineEntries = cal.schedule.filter((assignment) => assignment.condition === null);
    expect(baselineEntries.length).toBeGreaterThan(0);
    expect(baselineEntries[0]!.period).toBe("Baseline · Day 2/4");
    expect(baselineEntries[1]!.period).toBe("Baseline · Day 3/4");
    expect(baselineEntries[0]!.instruction).toBe(BASELINE_INSTRUCTION);
  });

  it("renders no baseline entries when the design has no lead-in", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 10,
      sessionsPerWeek: 6,
      now: clock,
    });
    const cal = buildCalendar([design], [], "2025-07-01");
    expect(cal.schedule.every((assignment) => !assignment.period.includes("Baseline"))).toBe(true);
  });
});

describe("baseline in the analysis", () => {
  it("excludes baseline days from the comparison and adherence, and reports mean and drift", () => {
    const design = crossoverWithBaseline({ baselineDays: 4, washoutDays: 2 });
    const dates = design.assignments.map((assignment) => assignment.date);
    const events = eventsForRun(
      dates,
      (date) => design.assignments.find((assignment) => assignment.date === date)?.condition ?? null,
      { A: 0.78, B: 0.6 },
      { perDay: 2, sd: 0.08, seed: "baseline-run", noConditionMean: 0.62 },
    );
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.verdict).not.toBe("invalid");

    // Condition groups and block means never see a baseline session.
    expect(result.adherence.conditionASessions).toBe(28);
    expect(result.adherence.conditionBSessions).toBe(28);
    expect(result.blocks.every((block) => block.n === 14)).toBe(true);

    // Adherence counts assigned (condition) days only.
    expect(result.adherence.assignedDays).toBe(28);
    expect(result.adherence.adherence).toBe(1);

    // 4 baseline days, 8 sessions, mean near 0.62.
    const baseline: BaselineReport = result.baseline!;
    expect(baseline).not.toBeNull();
    expect(baseline.days).toBe(4);
    expect(baseline.sessions).toBe(8);
    expect(baseline.mean).not.toBeNull();
    expect(baseline.mean!).toBeGreaterThan(0.58);

    // The washout report counts only the between-block gap, never the
    // baseline lead-in (6 washout days here).
    expect(result.washout!.days).toBe(6);
    expect(result.washout!.sessions).toBe(12);

    expect(result.summary).toMatch(/baseline/);
  });

  it("measures the baseline drift per day", () => {
    const design = crossoverWithBaseline({ baselineDays: 5 });
    const events = [
      ...exactBaselineEvents(design, [0.5, 0.52, 0.54, 0.56, 0.58]),
      ...eventsForRun(
        design.assignments.filter((assignment) => assignment.condition !== null).map((a) => a.date),
        (date) => design.assignments.find((a) => a.date === date)?.condition ?? null,
        { A: 0.78, B: 0.6 },
        { perDay: 2, seed: "drift-conditions" },
      ),
    ];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.baseline!.days).toBe(5);
    expect(result.baseline!.sessions).toBe(5);
    expect(result.baseline!.mean).toBeCloseTo(0.54, 5);
    expect(result.baseline!.trendPerDay).toBeCloseTo(0.02, 5);
    expect(result.summary).toMatch(/drift/);
  });

  it("reports no drift when the baseline is flat", () => {
    const design = crossoverWithBaseline({ baselineDays: 5 });
    const events = [
      ...exactBaselineEvents(design, [0.6, 0.6, 0.6, 0.6, 0.6]),
      ...eventsForRun(
        design.assignments.filter((assignment) => assignment.condition !== null).map((a) => a.date),
        (date) => design.assignments.find((a) => a.date === date)?.condition ?? null,
        { A: 0.78, B: 0.6 },
        { perDay: 2, seed: "flat-conditions" },
      ),
    ];
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.baseline!.trendPerDay).toBeNull();
    expect(result.summary).not.toMatch(/drift/);
  });

  it("reports no baseline for a run without a lead-in", () => {
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
    expect(result.baseline).toBeNull();
    expect(result.summary).not.toMatch(/baseline/);
  });
});
