/**
 * Adaptive experiment duration (P1 #4).
 *
 * Duration is fixed at design time from an assumed sessions-per-week; if the
 * real rate differs, the run ends with too few or too many days, silently.
 * These tests pin the rule that recomputes the end date from the observed
 * rate: extend when the sample will not be reached by the original end, never
 * end early, never extend past the 84-day cap. Extension days continue the
 * design's condition pattern so sessions recorded there count, and the
 * analysis window follows the effective end.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import {
  buildAssignments,
  designExperiment,
  extendedAssignments,
  type ExperimentDesign,
  type ExperimentType,
} from "../src/experiments/design.js";
import { adaptiveEndDate, buildCalendar, MAX_RUN_DAYS } from "../src/experiments/calendar.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
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
  syncId: "sync-adaptive",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-adaptive",
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

function design(options: {
  id: string;
  startDate: string;
  endDate: string;
  minSamplePerCondition: number;
  type?: ExperimentType;
  blockDays?: number;
  washoutDays?: number;
  baselineDays?: number;
}): ExperimentDesign {
  const type = options.type ?? "crossover";
  const blockDays = options.blockDays ?? 7;
  const washoutDays = options.washoutDays ?? 0;
  const baselineDays = options.baselineDays ?? 0;
  const durationDays = daysBetween(options.startDate, options.endDate) + 1;
  const assignments = buildAssignments(type, options.startDate, durationDays, blockDays, options.id, washoutDays, baselineDays);
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
    washoutDays,
    baselineDays,
    assumedSessionsPerWeek: 4,
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
        sourceEventId: `adaptive-${date}-${index}`,
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
describe("adaptiveEndDate", () => {
  it("extends the run when the observed rate will not reach the sample by the original end", () => {
    // 8 sessions in the first 14 days = 4/week; 12 still needed -> 3 more weeks.
    const observed = days("2025-07-01", 8);
    expect(adaptiveEndDate(run, observed, "2025-07-14")).toBe("2025-08-04");
  });

  it("keeps the original end date when the projection would finish sooner (extend-only)", () => {
    // 14 sessions in 7 days = 14/week; the rest of the sample fits well before 07-28.
    const observed = days("2025-07-01", 14);
    expect(adaptiveEndDate(run, observed, "2025-07-07")).toBe("2025-07-28");
  });

  it("ends at the day the planned sample was reached when that is past the original end", () => {
    // The 20th session lands on 08-03, after the original 07-28 end.
    const observed = [...days("2025-07-01", 14), ...days("2025-07-29", 6)];
    expect(adaptiveEndDate(run, observed, "2025-08-10")).toBe("2025-08-03");
  });

  it("never moves the end earlier once the sample was reached inside the original window", () => {
    const observed = days("2025-07-01", 20);
    expect(adaptiveEndDate(run, observed, "2025-07-20")).toBe("2025-07-28");
  });

  it("leaves the end date alone with no sessions observed", () => {
    expect(adaptiveEndDate(run, [], "2025-07-14")).toBe("2025-07-28");
  });

  it("caps the extension at 84 days from the start", () => {
    // 2 sessions in 14 days = 1/week; the projection would run far past the cap.
    const observed = days("2025-07-01", 2);
    const capped = adaptiveEndDate(run, observed, "2025-07-14");
    expect(capped).toBe(addDays("2025-07-01", MAX_RUN_DAYS - 1));
    expect(daysBetween("2025-07-01", capped) + 1).toBe(MAX_RUN_DAYS);
  });

  it("is deterministic for the same inputs", () => {
    const observed = days("2025-07-01", 8);
    expect(adaptiveEndDate(run, observed, "2025-07-14")).toBe(adaptiveEndDate(run, observed, "2025-07-14"));
  });
});

describe("extendedAssignments", () => {
  it("continues the crossover block alternation past the stored schedule", () => {
    const d = design({ id: "x", startDate: "2025-07-01", endDate: "2025-07-14", minSamplePerCondition: 10, blockDays: 7 });
    const extended = extendedAssignments(d, "2025-07-21");
    expect(extended.length).toBe(21);
    // Stored days unchanged.
    expect(extended.slice(0, d.assignments.length)).toEqual(d.assignments);
    // Block 2 continues with the block-0 condition.
    expect(extended[14]!.block).toBe(2);
    expect(extended[14]!.condition).toBe(d.assignments[0]!.condition);
    expect(extended[20]!.condition).toBe(d.assignments[0]!.condition);
  });

  it("inserts washout gaps in the extension for crossover designs with a washout", () => {
    const d = design({
      id: "wx",
      startDate: "2025-07-01",
      endDate: "2025-07-16",
      minSamplePerCondition: 10,
      blockDays: 7,
      washoutDays: 2,
    });
    const extended = extendedAssignments(d, "2025-07-28");
    // Stored days unchanged.
    expect(extended.slice(0, d.assignments.length)).toEqual(d.assignments);
    // The washout gap repeats after the stored blocks.
    expect(extended[16]!.condition).toBeNull();
    expect(extended[17]!.condition).toBeNull();
    expect(extended[18]!.condition).not.toBeNull();
    expect(extended[18]!.condition).toBe(d.assignments[0]!.condition);
  });

  it("continues strict alternation for A/B designs, preserving the stored days", () => {
    const d = design({ id: "ab", type: "ab", startDate: "2025-07-01", endDate: "2025-07-14", minSamplePerCondition: 10, blockDays: 1 });
    const extended = extendedAssignments(d, "2025-07-17");
    expect(extended.slice(0, d.assignments.length)).toEqual(d.assignments);
    expect(extended[14]!.condition).not.toBe(extended[13]!.condition);
    expect(extended[15]!.condition).not.toBe(extended[14]!.condition);
  });

  it("continues the after condition for before/after designs", () => {
    const d = design({ id: "ba", type: "before-after", startDate: "2025-07-01", endDate: "2025-07-14", minSamplePerCondition: 10, blockDays: 1 });
    const extended = extendedAssignments(d, "2025-07-17");
    expect(extended.slice(0, d.assignments.length)).toEqual(d.assignments);
    expect(extended.slice(14).every((assignment) => assignment.condition === "A")).toBe(true);
  });

  it("returns the stored assignments unchanged when the end date has not moved", () => {
    expect(extendedAssignments(run, "2025-07-20")).toBe(run.assignments);
  });
});

describe("design record", () => {
  it("records the assumed sessions-per-week used at design time", () => {
    const assumed = designExperiment(makeHypothesis(), { startDate: "2025-07-01", sessionsPerWeek: 6, now: clock });
    expect(assumed.assumedSessionsPerWeek).toBe(6);
    const byDefault = designExperiment(makeHypothesis(), { startDate: "2025-07-01", now: clock });
    expect(byDefault.assumedSessionsPerWeek).toBe(4);
  });
});
describe("calendar with projected ends", () => {
  it("keeps a run active past its original end and reports the effective end date", () => {
    const projected = new Map([["run", "2025-08-04"]]);
    const cal = buildCalendar([run], [], "2025-07-30", projected);
    const entry = cal.entries[0]!;
    expect(entry.bucket).toBe("active");
    expect(entry.endDate).toBe("2025-08-04");
    expect(entry.daysRemaining).toBe(5);
    expect(cal.nextAnalysisDate).toBe("2025-08-04");
    // The today row still works on an extension day.
    expect(entry.todayPeriod).not.toBeNull();
    expect(entry.todayCondition).not.toBeNull();
  });

  it("shows extension days in the schedule with period labels", () => {
    const projected = new Map([["run", "2025-08-04"]]);
    const cal = buildCalendar([run], [], "2025-07-30", projected);
    const extensionRows = cal.schedule.filter((assignment) => assignment.date > "2025-07-28");
    expect(extensionRows.length).toBeGreaterThan(0);
    expect(extensionRows[0]!.period).toMatch(/· Day \d+\/\d+$/);
  });

  it("falls back to the design end date without a projection map", () => {
    const cal = buildCalendar([run], [], "2025-07-30");
    const entry = cal.entries[0]!;
    expect(entry.endDate).toBe("2025-07-28");
    expect(entry.bucket).toBe("completed");
    expect(cal.schedule.every((assignment) => assignment.date <= "2025-07-28")).toBe(true);
  });
});

describe("analysis with an adaptive window", () => {
  it("counts sessions recorded during an extension and records the effective end date", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 8,
      sessionsPerWeek: 4,
      now: clock,
    });
    expect(design.endDate).toBe("2025-07-28");
    // 14 sessions in the original window (below the 16 target), then the user
    // keeps recording through the extension every day — the 16th session
    // lands on 07-30, so the run ends there.
    const events = eventsOnDates([...days("2025-07-01", 14), ...days("2025-07-29", 16)]);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.effectiveEndDate).toBe("2025-07-30");
    expect(result.adherence.conditionASessions + result.adherence.conditionBSessions).toBe(16);
    expect(result.adherence.assignedDays).toBe(30); // 28 original + 2 extension days to 07-30
    expect(result.adherence.outOfWindowSessions).toBe(14); // recorded after the run ended on 07-30
    expect(result.verdict).not.toBe("invalid");
    expect(result.reasons.join(" ")).toMatch(/extend/i);
  });

  it("does not extend a run whose sample was reached within the original window", () => {
    const design = designExperiment(makeHypothesis(), {
      startDate: "2025-07-01",
      blockDays: 7,
      minSamplePerCondition: 8,
      sessionsPerWeek: 4,
      now: clock,
    });
    // Sample reached mid-run; anything recorded after the original end is out of window.
    const events = eventsOnDates([...days("2025-07-01", 28), ...days("2025-08-01", 5)]);
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });

    expect(result.effectiveEndDate).toBe(design.endDate);
    expect(result.adherence.conditionASessions + result.adherence.conditionBSessions).toBe(28);
    expect(result.adherence.outOfWindowSessions).toBe(5);
    expect(result.reasons.join(" ")).not.toMatch(/extend/i);
  });
});
