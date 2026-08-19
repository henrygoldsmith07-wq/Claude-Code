/**
 * Experiment calendar conflict handling, both tiers.
 *
 * Two live experiments can silently overlap: the calendar lists both, and the
 * user is expected to notice they are being asked to do two things at once.
 * These tests pin down the warning half — per-date detection that an
 * experiment "also assigns today" — and the hard-block half (P1 #9): a
 * same-metric experiment whose run range overlaps a live one cannot be
 * started at proposal time. Different metrics may share days; the same
 * metric cannot be measured under two conditions at once.
 */

import { describe, expect, it } from "vitest";
import { Pulse } from "../src/pulse.js";
import {
  buildCalendar,
  ExperimentConflictError,
  findSameMetricOverlaps,
  type ExperimentCalendar,
} from "../src/experiments/calendar.js";
import { buildAssignments, type ExperimentDesign } from "../src/experiments/design.js";
import { addDays } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";
import type { Hypothesis } from "../src/hypotheses/tracker.js";

const TODAY = "2025-07-15";
const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

interface DesignSeed {
  id: string;
  title?: string;
  startDate: string;
  durationDays: number;
  targetMetricId?: string;
  type?: "crossover" | "ab" | "before-after";
}

/** Deterministic design with hand-chosen dates, so overlaps are exact. */
function design(seed: DesignSeed): ExperimentDesign {
  const type = seed.type ?? "crossover";
  const durationDays = seed.durationDays;
  const assignments = buildAssignments(type, seed.startDate, durationDays, 7, seed.id);
  return {
    id: seed.id,
    hypothesisId: `hyp-${seed.id}`,
    createdAt: "2025-07-01T00:00:00.000Z",
    type,
    title: seed.title ?? seed.id,
    hypothesis: `Hypothesis for ${seed.id}`,
    conditionA: { id: "A", label: "Intervention", instruction: "Do the behaviour under test" },
    conditionB: { id: "B", label: "Control", instruction: "Do not do the behaviour under test" },
    targetMetricId: seed.targetMetricId ?? "study.accuracy",
    minSamplePerCondition: 10,
    durationDays,
    blockDays: 7,
    startDate: seed.startDate,
    endDate: addDays(seed.startDate, durationDays - 1),
    assignments,
    likelyConfounders: [],
    analysisMethod: "Paired comparison of per-block means",
    successCriteria: "CI excludes zero",
    seed: seed.id,
    invalidations: [],
  };
}

function calendar(designs: readonly ExperimentDesign[]): ExperimentCalendar {
  return buildCalendar(designs, [], TODAY);
}

describe("calendar conflict warnings", () => {
  it("reports no conflicts when live experiments do not overlap", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-01", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-08-01", durationDays: 14 }),
    ]);
    expect(cal.conflicts).toEqual([]);
    expect(cal.summary.conflicts).toBe(0);
  });

  it("flags every shared date when two experiments run at the same time", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    // Overlap runs 2025-07-14..2025-07-23, but 07-14 is already past — the
    // warning is about upcoming clashes, so only 07-15..07-23 are reported.
    expect(cal.conflicts.length).toBe(9);
    expect(cal.conflicts[0]!.date).toBe("2025-07-15");
    expect(cal.conflicts[0]!.experimentIds).toEqual(["exp-a", "exp-b"]);
    expect(cal.conflicts[0]!.titles).toEqual(["exp-a", "exp-b"]);
    expect(cal.summary.conflicts).toBe(9);
  });

  it("marks the overlap as same-metric when both target the same metric", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, targetMetricId: "study.accuracy" }),
    ]);
    expect(cal.conflicts[0]!.sameMetric).toBe(true);
    expect(cal.conflicts[0]!.metricIds).toEqual(["study.accuracy"]);
  });

  it("does not mark the overlap as same-metric when the metrics differ", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, targetMetricId: "exercise.volume" }),
    ]);
    expect(cal.conflicts[0]!.sameMetric).toBe(false);
    expect(cal.conflicts[0]!.metricIds).toEqual(["exercise.volume", "study.accuracy"]);
  });

  it("reports an overlap once per date, not once per pair", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-12", durationDays: 14 }),
      design({ id: "exp-c", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    // All three overlap 07-15..07-23; exp-b and exp-c overlap on 07-24..07-25.
    expect(cal.conflicts[0]!.experimentIds).toEqual(["exp-a", "exp-b", "exp-c"]);
    expect(cal.conflicts.length).toBe(11);
    expect(cal.conflicts[10]!.date).toBe("2025-07-25");
    expect(cal.conflicts[10]!.experimentIds).toEqual(["exp-b", "exp-c"]);
    expect(cal.summary.conflicts).toBe(11);
  });

  it("warns about upcoming overlaps in the future, not only today", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-20", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-25", durationDays: 14 }),
    ]);
    expect(cal.conflicts.length).toBe(9);
    expect(cal.conflicts[0]!.date).toBe("2025-07-25");
  });

  it("ignores experiments that have already finished", () => {
    const cal = calendar([
      design({ id: "exp-past", startDate: "2025-06-01", durationDays: 14 }),
      design({ id: "exp-now", startDate: "2025-07-10", durationDays: 14 }),
    ]);
    // exp-past's assignments are all before today, so nothing overlaps.
    expect(cal.conflicts).toEqual([]);
  });

  it("exposes the conflict dates so the schedule can mark them", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    const dates = new Set(cal.conflicts.map((conflict) => conflict.date));
    // Every assignment on a conflicting date appears in the schedule.
    const scheduleDates = new Set(cal.schedule.map((entry) => entry.date));
    expect(cal.schedule.length).toBeGreaterThan(0);
    for (const date of dates) {
      expect(scheduleDates.has(date)).toBe(true);
    }
  });
});

/** A finding whose proposal targets `study.accuracy` (the fixture's first metric). */
function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
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
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: { kind: "run-experiment", summary: "Run an experiment", rationale: "Under your control.", effortHours: 2 },
    evidence: [
      { kind: "events", description: "300 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 300, dateRange: null },
    ],
    tags: ["exposure-window"],
    ...overrides,
  };
}

describe("hard block on same-metric overlaps (P1 #9)", () => {
  describe("findSameMetricOverlaps", () => {
    it("reports an existing experiment whose run range intersects the candidate's on the same metric", () => {
      const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 14, targetMetricId: "study.accuracy" });
      const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([existing], candidate)).toEqual([
        { designId: "exp-live", title: "exp-live", startDate: "2025-07-01", endDate: "2025-07-14" },
      ]);
    });

    it("flags a candidate contained entirely inside an existing run", () => {
      const existing = design({ id: "exp-outer", startDate: "2025-07-01", durationDays: 28, targetMetricId: "study.accuracy" });
      const candidate = design({ id: "exp-inner", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([existing], candidate).map((overlap) => overlap.designId)).toEqual(["exp-outer"]);
    });

    it("blocks runs that share even a single day", () => {
      // exp-first ends on 07-14; exp-second starts on 07-14 — one shared day.
      const existing = design({ id: "exp-first", startDate: "2025-07-01", durationDays: 14, targetMetricId: "study.accuracy" });
      const candidate = design({ id: "exp-second", startDate: "2025-07-14", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([existing], candidate).length).toBe(1);
    });

    it("ignores overlapping experiments on a different metric", () => {
      const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 14, targetMetricId: "exercise.volume" });
      const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([existing], candidate)).toEqual([]);
    });

    it("ignores sequential runs on the same metric", () => {
      const existing = design({ id: "exp-first", startDate: "2025-07-01", durationDays: 14, targetMetricId: "study.accuracy" });
      const candidate = design({ id: "exp-second", startDate: "2025-07-15", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([existing], candidate)).toEqual([]);
    });

    it("flags every overlapping same-metric experiment, not just the first", () => {
      const a = design({ id: "exp-a", startDate: "2025-07-01", durationDays: 14, targetMetricId: "study.accuracy" });
      const b = design({ id: "exp-b", startDate: "2025-07-05", durationDays: 14, targetMetricId: "study.accuracy" });
      const candidate = design({ id: "exp-c", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([a, b], candidate).map((overlap) => overlap.designId)).toEqual(["exp-a", "exp-b"]);
    });

    it("never flags the candidate against itself", () => {
      const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" });
      expect(findSameMetricOverlaps([candidate], candidate)).toEqual([]);
    });
  });

  describe("Pulse.designExperiment", () => {
    function proposedPulse(): { pulse: Pulse; first: Hypothesis; second: Hypothesis } {
      const pulse = new Pulse({ now: clock });
      const first = pulse.hypotheses.proposeFromFinding(finding({ id: "f-a" }))!;
      const second = pulse.hypotheses.proposeFromFinding(finding({ id: "f-b" }))!;
      return { pulse, first, second };
    }

    it("refuses to start a same-metric experiment that overlaps a live run", () => {
      const { pulse, first, second } = proposedPulse();
      const live = pulse.designExperiment(first.id, { startDate: "2025-07-10", sessionsPerWeek: 4 });
      expect(() => pulse.designExperiment(second.id, { startDate: "2025-07-14", sessionsPerWeek: 4 })).toThrow(
        ExperimentConflictError,
      );
      expect(pulse.listDesigns().map((entry) => entry.id)).toEqual([live.id]);
    });

    it("names the blocking experiment, its range and the shared metric", () => {
      const { pulse, first, second } = proposedPulse();
      const live = pulse.designExperiment(first.id, { startDate: "2025-07-10", sessionsPerWeek: 4 });
      let error: unknown = null;
      try {
        pulse.designExperiment(second.id, { startDate: "2025-07-14", sessionsPerWeek: 4 });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ExperimentConflictError);
      const conflict = error as ExperimentConflictError;
      expect(conflict.targetMetricId).toBe("study.accuracy");
      expect(conflict.conflicts.map((overlap) => overlap.designId)).toEqual([live.id]);
      expect(conflict.conflicts[0]!.startDate).toBe("2025-07-10");
      expect(conflict.message).toMatch(/study\.accuracy/);
      expect(conflict.message).toMatch(new RegExp(live.title));
    });

    it("does not store a blocked design or move its hypothesis to testing", () => {
      const { pulse, first, second } = proposedPulse();
      const live = pulse.designExperiment(first.id, { startDate: "2025-07-10", sessionsPerWeek: 4 });
      expect(pulse.hypotheses.get(second.id)!.status).toBe("proposed");
      expect(() => pulse.designExperiment(second.id, { startDate: "2025-07-14", sessionsPerWeek: 4 })).toThrow(
        ExperimentConflictError,
      );
      expect(pulse.hypotheses.get(second.id)!.status).toBe("proposed");
      expect(pulse.hypotheses.get(second.id)!.experimentIds).toEqual([]);
      expect(pulse.listDesigns().map((entry) => entry.id)).toEqual([live.id]);
    });

    it("allows a different-metric experiment on the same dates", () => {
      const { pulse, first } = proposedPulse();
      const other = pulse.hypotheses.proposeFromFinding(
        finding({ id: "f-c", metricIds: ["exercise.volume", "study.accuracy"] }),
      )!;
      pulse.designExperiment(first.id, { startDate: "2025-07-10", sessionsPerWeek: 4 });
      const second = pulse.designExperiment(other.id, { startDate: "2025-07-10", sessionsPerWeek: 4 });
      expect(pulse.listDesigns().length).toBe(2);
      expect(second.targetMetricId).toBe("exercise.volume");
    });

    it("allows a same-metric run once the earlier run has ended", () => {
      const { pulse, first, second } = proposedPulse();
      const live = pulse.designExperiment(first.id, { startDate: "2025-07-01", sessionsPerWeek: 4 });
      const next = pulse.designExperiment(second.id, {
        startDate: addDays(live.endDate, 1),
        sessionsPerWeek: 4,
      });
      expect(next.id).not.toBe(live.id);
    });
  });
});
