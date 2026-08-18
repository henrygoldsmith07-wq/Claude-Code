/**
 * Hypothesis tracking and experiment design/analysis.
 *
 * The verdict logic is the point of these tests. A tool that can only conclude
 * "it worked" is a tool that will conclude "it worked" — so most of what is
 * asserted here is that Pulse reaches `inconclusive`, `refuted` or `invalid`
 * when it should.
 */

import { describe, expect, it } from "vitest";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import { buildAssignments, conditionForDate, designExperiment } from "../src/experiments/design.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
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
  syncId: "sync-exp",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

const finding: Finding = {
  id: "f-exercise",
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

/**
 * Builds attempt events on the given dates, with a mean that depends on which
 * condition the design assigns to that day.
 */
function eventsForRun(
  dates: readonly string[],
  conditionOf: (date: string) => "A" | "B" | null,
  meanByCondition: { A: number; B: number },
  options: { perDay?: number; sd?: number; seed?: string } = {},
): PulseEvent[] {
  const rng = createRng(options.seed ?? "run");
  const perDay = options.perDay ?? 2;
  const sd = options.sd ?? 0.1;
  const events: PulseEvent[] = [];
  for (const date of dates) {
    const condition = conditionOf(date);
    if (!condition) continue;
    for (let i = 0; i < perDay; i += 1) {
      const accuracy = Math.min(1, Math.max(0, normalDeviate(rng, meanByCondition[condition], sd)));
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

describe("hypothesis tracking", () => {
  it("proposes a hypothesis only from a finding that justifies an experiment", () => {
    const tracker = new HypothesisTracker(clock);
    expect(tracker.proposeFromFinding(finding)).not.toBeNull();
    expect(tracker.proposeFromFinding({ ...finding, id: "f2", nextAction: null })).toBeNull();
    expect(
      tracker.proposeFromFinding({
        ...finding,
        id: "f3",
        nextAction: { kind: "observe", summary: "Watch", rationale: "", effortHours: 0 },
      }),
    ).toBeNull();
  });

  it("registers the predicted direction and size before any test is run", () => {
    const hypothesis = makeHypothesis();
    expect(hypothesis.predictedDirection).toBe("increase");
    expect(hypothesis.predictedEffect).toBeCloseTo(0.45, 6);
    expect(hypothesis.status).toBe("proposed");
    expect(hypothesis.knownConfounders).toContain("Improvement over time");
  });

  it("enforces the status machine", () => {
    const tracker = new HypothesisTracker(clock);
    const hypothesis = tracker.proposeFromFinding(finding)!;
    // Cannot jump straight from proposed to supported.
    expect(() => tracker.transition(hypothesis.id, "supported", "wishful")).toThrow(/Cannot move/);
    tracker.transition(hypothesis.id, "testing", "designed");
    tracker.transition(hypothesis.id, "inconclusive", "not enough data");
    expect(tracker.get(hypothesis.id)!.status).toBe("inconclusive");
    // An inconclusive hypothesis can be retested, but not abandoned twice.
    tracker.transition(hypothesis.id, "abandoned", "moving on");
    expect(() => tracker.transition(hypothesis.id, "testing", "changed my mind")).toThrow(/Cannot move/);
  });

  it("treats inconclusive as a terminal state, not a failure to record", () => {
    const tracker = new HypothesisTracker(clock);
    const hypothesis = tracker.proposeFromFinding(finding)!;
    tracker.transition(hypothesis.id, "testing", "designed");
    tracker.transition(hypothesis.id, "inconclusive", "underpowered");
    expect(tracker.list("inconclusive")).toHaveLength(1);
    expect(tracker.get(hypothesis.id)!.history.map((entry) => entry.to)).toEqual(["proposed", "testing", "inconclusive"]);
  });
});

describe("experiment design", () => {
  it("derives the required sample from the predicted effect, not from convenience", () => {
    const small = designExperiment({ ...makeHypothesis(), predictedEffect: 0.25 }, { startDate: "2025-07-07", now: clock });
    const large = designExperiment({ ...makeHypothesis(), predictedEffect: 1.0 }, { startDate: "2025-07-07", now: clock });
    expect(small.minSamplePerCondition).toBeGreaterThan(large.minSamplePerCondition);
  });

  it("produces an alternating crossover with an even number of blocks", () => {
    const design = designExperiment(makeHypothesis(), { startDate: "2025-07-07", blockDays: 7, now: clock });
    expect(design.type).toBe("crossover");
    const blocks = [...new Set(design.assignments.map((assignment) => assignment.block))];
    expect(blocks.length % 2).toBe(0);

    // Consecutive blocks must alternate condition.
    const conditionByBlock = new Map(design.assignments.map((a) => [a.block, a.condition]));
    for (let i = 1; i < blocks.length; i += 1) {
      expect(conditionByBlock.get(blocks[i]!)).not.toBe(conditionByBlock.get(blocks[i - 1]!));
    }
  });

  it("randomises only which condition starts, and does so reproducibly", () => {
    const a = buildAssignments("crossover", "2025-07-07", 28, 7, "seed-1");
    const b = buildAssignments("crossover", "2025-07-07", 28, 7, "seed-1");
    expect(a).toEqual(b);
    const other = buildAssignments("crossover", "2025-07-07", 28, 7, "seed-2");
    expect(other.length).toBe(a.length);
  });

  it("balances an A/B design exactly rather than leaving it to chance", () => {
    const assignments = buildAssignments("ab", "2025-07-07", 20, 1, "ab-seed");
    const counts = assignments.reduce(
      (acc, assignment) =>
        assignment.condition === null
          ? acc
          : { ...acc, [assignment.condition]: (acc[assignment.condition] ?? 0) + 1 },
      {} as Record<string, number>,
    );
    expect(counts.A).toBe(10);
    expect(counts.B).toBe(10);
  });

  it("splits a before/after design into two contiguous halves", () => {
    const assignments = buildAssignments("before-after", "2025-07-07", 20, 1, "ba");
    expect(assignments.slice(0, 10).every((a) => a.condition === "B")).toBe(true);
    expect(assignments.slice(10).every((a) => a.condition === "A")).toBe(true);
  });

  it("names the confounders each design cannot remove", () => {
    const crossover = designExperiment(makeHypothesis(), { startDate: "2025-07-07", now: clock });
    const beforeAfter = designExperiment(makeHypothesis(), { startDate: "2025-07-07", type: "before-after", now: clock });
    expect(crossover.likelyConfounders.join(" ")).toMatch(/Carry-over/);
    expect(beforeAfter.likelyConfounders.join(" ")).toMatch(/General improvement/);
    expect(beforeAfter.analysisMethod).toMatch(/trend check/);
  });

  it("states success criteria that allow an inconclusive outcome", () => {
    const design = designExperiment(makeHypothesis(), { startDate: "2025-07-07", now: clock });
    expect(design.successCriteria).toMatch(/inconclusive/);
    expect(design.successCriteria).toMatch(/excludes zero/);
    expect(design.invalidations.length).toBeGreaterThan(0);
  });

  it("caps the duration so it never proposes an unrunnable experiment", () => {
    const design = designExperiment({ ...makeHypothesis(), predictedEffect: 0.05 }, { startDate: "2025-07-07", sessionsPerWeek: 1, now: clock });
    expect(design.durationDays).toBeLessThanOrEqual(56);
  });
});

describe("experiment analysis", () => {
  const design = designExperiment(makeHypothesis(), { startDate: "2025-07-07", blockDays: 7, sessionsPerWeek: 6, now: clock });
  const dates = design.assignments.map((assignment) => assignment.date);
  const conditionOf = (date: string): "A" | "B" | null => conditionForDate(design, date);

  it("supports the hypothesis when the effect is real, large and well-sampled", () => {
    const events = eventsForRun(dates, conditionOf, { A: 0.78, B: 0.6 }, { perDay: 3, sd: 0.08, seed: "supported" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.verdict).toBe("supported");
    expect(result.summary).toMatch(/supported/);
    expect(result.causalityNote).toMatch(/causal reading is defensible/);
    expect(result.confidence.level).not.toBe("very-low");
  });

  it("refutes the hypothesis when the effect runs the other way", () => {
    const events = eventsForRun(dates, conditionOf, { A: 0.55, B: 0.78 }, { perDay: 3, sd: 0.08, seed: "refuted" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.verdict).toBe("refuted");
    expect(result.summary).toMatch(/does not match the prediction/);
  });

  it("returns inconclusive when the run was followed but under-sampled", () => {
    // Every assigned day happened, but only one session per day, so neither
    // condition reaches the sample the design asked for.
    const events = eventsForRun(dates, conditionOf, { A: 0.66, B: 0.63 }, { perDay: 1, sd: 0.12, seed: "thin" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.adherence.conditionASessions).toBeLessThan(design.minSamplePerCondition);
    expect(result.verdict).toBe("inconclusive");
    expect(result.reasons.join(" ")).toMatch(/target of|includes zero|cannot/i);
  });

  it("marks a mostly-abandoned run invalid rather than inconclusive", () => {
    // A third of the assigned days is not an underpowered experiment, it is an
    // experiment that did not happen.
    const events = eventsForRun(dates.slice(0, 14), conditionOf, { A: 0.66, B: 0.63 }, { perDay: 1, seed: "abandoned" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.verdict).toBe("invalid");
    expect(result.summary).toMatch(/assigned days/);
  });

  it("returns inconclusive rather than 'supported' for a real but trivial difference", () => {
    const events = eventsForRun(dates, conditionOf, { A: 0.652, B: 0.65 }, { perDay: 6, sd: 0.02, seed: "trivial" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.verdict).not.toBe("supported");
  });

  it("marks the run invalid when a condition was never attempted", () => {
    const onlyA = dates.filter((date) => conditionOf(date) === "A");
    const events = eventsForRun(onlyA, conditionOf, { A: 0.8, B: 0.6 }, { perDay: 3, seed: "one-sided" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.verdict).toBe("invalid");
    expect(result.summary).toMatch(/no sessions at all/);
    expect(result.causalityNote).toMatch(/No causal claim/);
  });

  it("marks the run invalid when adherence was too low to mean anything", () => {
    const sparse = dates.filter((_, index) => index % 8 === 0);
    const events = eventsForRun(sparse, conditionOf, { A: 0.8, B: 0.6 }, { perDay: 1, seed: "sparse" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(["invalid", "inconclusive"]).toContain(result.verdict);
    if (result.verdict === "invalid") expect(result.summary).toMatch(/assigned days/);
  });

  it("reports adherence, blocks and achieved power whatever the verdict", () => {
    const events = eventsForRun(dates, conditionOf, { A: 0.75, B: 0.6 }, { perDay: 3, sd: 0.08, seed: "report" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.adherence.assignedDays).toBe(design.assignments.length);
    expect(result.adherence.conditionASessions).toBeGreaterThan(0);
    expect(result.adherence.conditionBSessions).toBeGreaterThan(0);
    expect(result.blocks.length).toBeGreaterThanOrEqual(4);
    expect(result.achievedPower).toBeGreaterThan(0);
    expect(result.secondaryComparison).not.toBeNull();
  });

  it("ignores sessions outside the experiment window", () => {
    const inside = eventsForRun(dates, conditionOf, { A: 0.75, B: 0.6 }, { perDay: 2, seed: "in" });
    const outside = eventsForRun(
      [addDays(design.endDate, 5), addDays(design.endDate, 6)],
      () => "A",
      { A: 0.99, B: 0.99 },
      { perDay: 5, seed: "out" },
    );
    const result = analyseExperiment(design, [...inside, ...outside], { registry, predictedEffect: 0.45, now: clock });
    expect(result.adherence.outOfWindowSessions).toBe(10);
  });

  it("uses a paired analysis for a crossover and an unpaired one for A/B", () => {
    const abDesign = designExperiment(makeHypothesis(), { startDate: "2025-07-07", type: "ab", sessionsPerWeek: 6, now: clock });
    const abDates = abDesign.assignments.map((assignment) => assignment.date);
    const abEvents = eventsForRun(abDates, (date) => conditionForDate(abDesign, date), { A: 0.75, B: 0.6 }, { perDay: 2, seed: "ab" });
    const abResult = analyseExperiment(abDesign, abEvents, { registry, predictedEffect: 0.45, now: clock });
    expect(abResult.comparison?.test).toBe("welch_t");

    const crossEvents = eventsForRun(dates, conditionOf, { A: 0.75, B: 0.6 }, { perDay: 3, seed: "cross" });
    const crossResult = analyseExperiment(design, crossEvents, { registry, predictedEffect: 0.45, now: clock });
    expect(crossResult.comparison?.test).toBe("paired_t");
  });

  it("says a before/after design cannot separate the change from anything else", () => {
    const baDesign = designExperiment(makeHypothesis(), { startDate: "2025-07-07", type: "before-after", sessionsPerWeek: 6, now: clock });
    const baDates = baDesign.assignments.map((assignment) => assignment.date);
    const events = eventsForRun(baDates, (date) => conditionForDate(baDesign, date), { A: 0.75, B: 0.6 }, { perDay: 3, seed: "ba" });
    const result = analyseExperiment(baDesign, events, { registry, predictedEffect: 0.45, now: clock });
    expect(result.causalityNote).toMatch(/cannot separate/);
  });

  it("is deterministic across repeated analyses of the same data", () => {
    const events = eventsForRun(dates, conditionOf, { A: 0.75, B: 0.6 }, { perDay: 3, seed: "determinism" });
    const first = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    const second = analyseExperiment(design, events, { registry, predictedEffect: 0.45, now: clock });
    expect(second.observedEffect).toBe(first.observedEffect);
    expect(second.verdict).toBe(first.verdict);
    expect(second.summary).toBe(first.summary);
  });
});
