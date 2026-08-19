/**
 * The mutually-exclusive-behaviour tier of P1 #9.
 *
 * Two experiments can target *different* metrics and still collide: if their
 * conditions occupy the same behaviour slot (a morning routine, caffeine, a
 * sleep window), the user is asked to do two things that cannot both be
 * followed on the same day. Same-metric overlap is already a hard block; this
 * tier blocks the same-slot clash even when the metrics differ, and flags the
 * clash in the calendar warnings.
 *
 * The slot is asserted by the experiment author (`conditionA.behaviour` /
 * `conditionB.behaviour`) — nothing is inferred from free-text instructions.
 * A condition without a slot cannot be proven exclusive, so no clash is
 * claimed.
 */

import { describe, expect, it } from "vitest";
import { Pulse } from "../src/pulse.js";
import {
  buildCalendar,
  findMutuallyExclusiveOverlaps,
  MutuallyExclusiveConflictError,
  type ExperimentCalendar,
  type MutuallyExclusiveOverlap,
} from "../src/experiments/calendar.js";
import { buildAssignments, type ExperimentDesign } from "../src/experiments/design.js";
import { addDays } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";
import type { Hypothesis } from "../src/hypotheses/tracker.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const TODAY = "2025-07-15";
const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

interface DesignSeed {
  id: string;
  title?: string;
  startDate: string;
  durationDays: number;
  targetMetricId?: string;
  type?: "crossover" | "ab" | "before-after";
  /** Behaviour slot for condition A. */
  slotA?: string;
  /** Behaviour slot for condition B. */
  slotB?: string;
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
    conditionA: {
      id: "A",
      label: "Intervention",
      instruction: "Do the behaviour under test",
      ...(seed.slotA ? { behaviour: seed.slotA } : {}),
    },
    conditionB: {
      id: "B",
      label: "Control",
      instruction: "Do not do the behaviour under test",
      ...(seed.slotB ? { behaviour: seed.slotB } : {}),
    },
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

describe("findMutuallyExclusiveOverlaps", () => {
  it("flags an existing experiment assigning the same behaviour slot on a shared day", () => {
    const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" });
    const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    const overlaps = findMutuallyExclusiveOverlaps([existing], candidate);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.designId).toBe("exp-live");
    expect(overlaps[0]!.slot).toBe("morning");
    // The first shared assigned day: candidate starts 07-10, both assign A then.
    expect(overlaps[0]!.date).toBe("2025-07-10");
  });

  it("ignores overlapping experiments whose behaviour slots differ", () => {
    const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" });
    const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, slotA: "evening", slotB: "evening", targetMetricId: "study.accuracy" });
    expect(findMutuallyExclusiveOverlaps([existing], candidate)).toEqual([]);
  });

  it("ignores experiments without behaviour slots — nothing is inferred from instructions", () => {
    const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 14, targetMetricId: "exercise.volume" });
    const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    expect(findMutuallyExclusiveOverlaps([existing], candidate)).toEqual([]);
  });

  it("ignores sequential runs in the same slot", () => {
    const existing = design({ id: "exp-first", startDate: "2025-07-01", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" });
    const candidate = design({ id: "exp-second", startDate: "2025-07-15", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    expect(findMutuallyExclusiveOverlaps([existing], candidate)).toEqual([]);
  });

  it("reports one overlap per experiment, not per shared day", () => {
    const existing = design({ id: "exp-live", startDate: "2025-07-01", durationDays: 28, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" });
    const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    expect(findMutuallyExclusiveOverlaps([existing], candidate)).toHaveLength(1);
  });

  it("flags every overlapping same-slot experiment, not just the first", () => {
    const a = design({ id: "exp-a", startDate: "2025-07-01", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" });
    const b = design({ id: "exp-b", startDate: "2025-07-05", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.steps" });
    const candidate = design({ id: "exp-c", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    const overlaps: MutuallyExclusiveOverlap[] = findMutuallyExclusiveOverlaps([a, b], candidate);
    expect(overlaps.map((overlap) => overlap.designId)).toEqual(["exp-a", "exp-b"]);
  });

  it("never flags the candidate against itself", () => {
    const candidate = design({ id: "exp-new", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" });
    expect(findMutuallyExclusiveOverlaps([candidate], candidate)).toEqual([]);
  });
});

/** A finding whose proposal targets `study.accuracy`. */
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

describe("Pulse.designExperiment — mutually-exclusive hard block", () => {
  function proposedPulse(): { pulse: Pulse; first: Hypothesis; second: Hypothesis } {
    const pulse = new Pulse({ now: clock });
    const first = pulse.hypotheses.proposeFromFinding(finding({ id: "f-a" }))!;
    const second = pulse.hypotheses.proposeFromFinding(finding({ id: "f-b", metricIds: ["exercise.volume", "study.accuracy"] }))!;
    return { pulse, first, second };
  }

  it("refuses a same-slot proposal even when the metrics differ", () => {
    const { pulse, first, second } = proposedPulse();
    const live = pulse.designExperiment(first.id, {
      startDate: "2025-07-10",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    expect(live.targetMetricId).toBe("study.accuracy");
    expect(() =>
      pulse.designExperiment(second.id, {
        startDate: "2025-07-14",
        sessionsPerWeek: 4,
        conditionA: { behaviour: "morning" },
        conditionB: { behaviour: "morning" },
      }),
    ).toThrow(MutuallyExclusiveConflictError);
    expect(pulse.listDesigns().map((entry) => entry.id)).toEqual([live.id]);
  });

  it("does not store a blocked design or move its hypothesis to testing", () => {
    const { pulse, first, second } = proposedPulse();
    const live = pulse.designExperiment(first.id, {
      startDate: "2025-07-10",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    expect(pulse.hypotheses.get(second.id)!.status).toBe("proposed");
    expect(() =>
      pulse.designExperiment(second.id, {
        startDate: "2025-07-14",
        sessionsPerWeek: 4,
        conditionA: { behaviour: "morning" },
        conditionB: { behaviour: "morning" },
      }),
    ).toThrow(MutuallyExclusiveConflictError);
    expect(pulse.hypotheses.get(second.id)!.status).toBe("proposed");
    expect(pulse.hypotheses.get(second.id)!.experimentIds).toEqual([]);
    expect(pulse.listDesigns().map((entry) => entry.id)).toEqual([live.id]);
  });

  it("names the blocking experiment, the slot and the shared day", () => {
    const { pulse, first, second } = proposedPulse();
    const live = pulse.designExperiment(first.id, {
      startDate: "2025-07-10",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    let error: unknown = null;
    try {
      pulse.designExperiment(second.id, {
        startDate: "2025-07-14",
        sessionsPerWeek: 4,
        conditionA: { behaviour: "morning" },
        conditionB: { behaviour: "morning" },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(MutuallyExclusiveConflictError);
    const conflict = error as MutuallyExclusiveConflictError;
    expect(conflict.slot).toBe("morning");
    expect(conflict.conflicts.map((overlap) => overlap.designId)).toEqual([live.id]);
    expect(conflict.message).toMatch(/morning/);
    expect(conflict.message).toMatch(new RegExp(live.title));
  });

  it("allows the same slot once the earlier run has ended", () => {
    const { pulse, first, second } = proposedPulse();
    const live = pulse.designExperiment(first.id, {
      startDate: "2025-07-01",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    const next = pulse.designExperiment(second.id, {
      startDate: addDays(live.endDate, 1),
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    expect(next.id).not.toBe(live.id);
  });

  it("still allows overlapping runs whose slots differ", () => {
    const { pulse, first, second } = proposedPulse();
    const live = pulse.designExperiment(first.id, {
      startDate: "2025-07-10",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    const next = pulse.designExperiment(second.id, {
      startDate: "2025-07-14",
      sessionsPerWeek: 4,
      conditionA: { behaviour: "evening" },
      conditionB: { behaviour: "evening" },
    });
    expect(pulse.listDesigns().length).toBe(2);
    expect(next.id).not.toBe(live.id);
  });

  it("a replication inherits the same-slot conflict check", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "replication-slot-conflict" });
    pulse.discover();
    const hypothesis = pulse.proposeHypotheses()[0]!;
    const original = pulse.designExperiment(hypothesis.id, {
      startDate: addDays(pulse.calendar().today, -40),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    const analysed = pulse.analyseExperiment(original.id);
    expect(analysed.verdict).not.toBe("invalid");

    // A second live run on a *different* metric that occupies the same slot.
    const rivalMetric = original.targetMetricId === "study.accuracy" ? "exercise.volume" : "study.accuracy";
    const second = pulse.hypotheses.proposeFromFinding(
      finding({ id: "f-b", metricIds: [rivalMetric, original.targetMetricId] }),
    )!;
    const rival = pulse.designExperiment(second.id, {
      startDate: addDays(pulse.calendar().today, -10),
      sessionsPerWeek: 7,
      minSamplePerCondition: 8,
      conditionA: { behaviour: "morning" },
      conditionB: { behaviour: "morning" },
    });
    // The clone inherits the original's slot and defaults to starting the day
    // after the original ends — inside the rival's live run. Even on different
    // metrics, the same-slot clash must refuse the replication.
    expect(() => pulse.replicateExperiment(original.id)).toThrow(MutuallyExclusiveConflictError);
    expect(rival.id.length).toBeGreaterThan(0);
    expect(pulse.listDesigns().length).toBe(2);
  });
});

describe("calendar warnings — mutually-exclusive flag", () => {
  it("marks shared dates as mutually exclusive when the assigned conditions share a slot", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "exercise.volume" }),
    ]);
    expect(cal.conflicts.length).toBeGreaterThan(0);
    for (const conflict of cal.conflicts) {
      expect(conflict.mutuallyExclusive).toBe(true);
      expect(conflict.behaviourSlots).toEqual(["morning"]);
    }
  });

  it("leaves the flag off when the overlapping conditions use different slots", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, slotA: "morning", slotB: "morning", targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, slotA: "evening", slotB: "evening", targetMetricId: "exercise.volume" }),
    ]);
    expect(cal.conflicts.length).toBeGreaterThan(0);
    for (const conflict of cal.conflicts) {
      expect(conflict.mutuallyExclusive).toBe(false);
      expect(conflict.behaviourSlots).toEqual([]);
    }
  });

  it("leaves the flag off when the experiments do not declare slots", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, targetMetricId: "exercise.volume" }),
    ]);
    expect(cal.conflicts.length).toBeGreaterThan(0);
    for (const conflict of cal.conflicts) {
      expect(conflict.mutuallyExclusive).toBe(false);
    }
  });
});

