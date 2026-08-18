/**
 * Personal causal hypothesis library tests.
 *
 * The library is the user's own record of what they believe changes what.
 * What matters here: findings and experiment verdicts move an entry's
 * standing automatically, the user can override it, and the library survives
 * reloads and source deletion like every other persisted store.
 */

import { describe, expect, it } from "vitest";
import { CausalHypothesisLibrary, createMemoryCausalLibraryAdapter } from "../src/hypotheses/library.js";
import { HypothesisTracker, type Hypothesis } from "../src/hypotheses/tracker.js";
import { conditionForDate, designExperiment } from "../src/experiments/design.js";
import { analyseExperiment } from "../src/experiments/analysis.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import type { Finding } from "../src/discovery/finding.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import { addDays } from "../src/events/time.js";
import { createRng, normalDeviate } from "../src/statistics/random.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");
const registry = createDefaultRegistry();

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

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-lib",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

/** Attempt events on the given dates with a mean that depends on the condition. */
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

/** Runs a real experiment (real design, real analysis) and returns its verdict. */
function experimentResult(hypothesis: Hypothesis, means: { A: number; B: number }, seed: string) {
  const design = designExperiment(hypothesis, { startDate: "2025-07-07", blockDays: 7, sessionsPerWeek: 6, now: clock });
  const dates = design.assignments.map((assignment) => assignment.date);
  const events = eventsForRun(dates, (date) => conditionForDate(design, date), means, { perDay: 3, sd: 0.08, seed });
  return analyseExperiment(design, events, { registry, predictedEffect: hypothesis.predictedEffect, now: clock });
}

describe("the causal hypothesis library", () => {
  it("adds a belief as untested, with the user's wording", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.add({
      statement: "Evening study improves my recall.",
      cause: "evening study",
      effect: "recall",
      direction: "increase",
      notes: "My tutor suggested this.",
    });
    expect(entry.standing).toBe("untested");
    expect(entry.origin).toBe("user");
    expect(entry.evidence).toEqual([]);
    expect(entry.hypothesisId).toBeNull();
    expect(entry.standingHistory).toEqual([
      { standing: "untested", at: "2025-07-01T12:00:00.000Z", note: "Added to the library" },
    ]);
    expect(library.size()).toBe(1);
  });

  it("promotes a finding into an entry with the finding as its first evidence", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    expect(entry.origin).toBe("engine");
    expect(entry.standing).toBe("plausible");
    expect(entry.cause).toBe("within 4h of training");
    expect(entry.effect).toBe("question accuracy");
    expect(entry.direction).toBe("increase");
    expect(entry.outcomeMetricId).toBe("study.accuracy");
    expect(entry.exposureMetricId).toBe("exercise.volume");
    expect(entry.statement).toMatch(/within 4h of training/i);
    expect(entry.statement).toMatch(/question accuracy/i);
    expect(entry.evidence).toHaveLength(1);
    expect(entry.evidence[0]!.id).toBe(finding.id);
    expect(entry.evidence[0]!.supports).toBe(true);
  });

  it("never promotes the same finding twice", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    library.addFromFinding(finding);
    expect(library.addFromFinding(finding)).toBeNull();
    expect(library.size()).toBe(1);
  });

  it("promotes a replicated finding straight to strengthening", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding({ ...finding, id: "f-rep", replicationStatus: "replicated" })!;
    expect(entry.standing).toBe("strengthening");
  });

  it("a replicated finding strengthens a plausible belief", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    library.addEvidence(entry.id, {
      id: "f-rep-2",
      kind: "finding",
      at: "2025-07-05T00:00:00Z",
      title: "Question accuracy is higher within 4h of training",
      supports: true,
      strength: 0.5,
      confidence: 0.7,
      replicationStatus: "replicated",
    });
    expect(entry.standing).toBe("strengthening");
    expect(entry.standingHistory.at(-1)!.note).toMatch(/replicated/);
  });

  it("deduplicates evidence with the same id", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    library.addEvidence(entry.id, {
      id: "f-second",
      kind: "finding",
      at: "2025-07-05T00:00:00Z",
      title: "title",
      supports: true,
      strength: 0.4,
      confidence: 0.6,
    });
    library.addEvidence(entry.id, {
      id: "f-second",
      kind: "finding",
      at: "2025-07-05T00:00:00Z",
      title: "title",
      supports: true,
      strength: 0.4,
      confidence: 0.6,
    });
    expect(entry.evidence).toHaveLength(2);
  });

  it("a supported experiment confirms the belief", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    library.addFromFinding(finding);
    const hypothesis = makeHypothesis();
    const result = experimentResult(hypothesis, { A: 0.78, B: 0.6 }, "lib-supported");
    expect(result.verdict).toBe("supported");
    library.recordExperimentResult(result, hypothesis);
    const entry = library.list()[0]!;
    expect(entry.standing).toBe("confirmed");
    expect(entry.hypothesisId).toBe(hypothesis.id);
    expect(entry.evidence.some((e) => e.kind === "experiment" && e.supports === true)).toBe(true);
    expect(entry.standingHistory.at(-1)!.note).toMatch(/controlled experiment/);
  });

  it("a refuted experiment refutes the belief", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    library.addFromFinding(finding);
    const hypothesis = makeHypothesis();
    const result = experimentResult(hypothesis, { A: 0.55, B: 0.78 }, "lib-refuted");
    expect(result.verdict).toBe("refuted");
    library.recordExperimentResult(result, hypothesis);
    const entry = library.list()[0]!;
    expect(entry.standing).toBe("refuted");
    expect(entry.evidence.some((e) => e.kind === "experiment" && e.supports === false)).toBe(true);
  });

  it("an inconclusive experiment records the evidence but leaves the standing alone", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    library.addFromFinding(finding);
    const hypothesis = makeHypothesis();
    const design = designExperiment(hypothesis, { startDate: "2025-07-07", blockDays: 7, sessionsPerWeek: 6, now: clock });
    const dates = design.assignments.map((assignment) => assignment.date);
    const events = eventsForRun(dates, (date) => conditionForDate(design, date), { A: 0.66, B: 0.63 }, { perDay: 1, sd: 0.12, seed: "lib-thin" });
    const result = analyseExperiment(design, events, { registry, predictedEffect: hypothesis.predictedEffect, now: clock });
    expect(result.verdict).toBe("inconclusive");
    library.recordExperimentResult(result, hypothesis);
    const entry = library.list()[0]!;
    expect(entry.standing).toBe("plausible");
    expect(entry.evidence.some((e) => e.kind === "experiment" && e.supports === null)).toBe(true);
  });

  it("matches experiments by linked hypothesis, and by metric signature otherwise", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    // Promoted entry: hypothesisId null, but the metric triple matches the
    // hypothesis that gets tested.
    const promoted = library.addFromFinding(finding)!;
    // Unrelated entry: different outcome.
    const unrelated = library.add({
      statement: "Sitting near a window helps me focus.",
      cause: "window seat",
      effect: "focus",
      direction: "increase",
      outcomeMetricId: "reflect.clarity",
    });
    const hypothesis = makeHypothesis();
    const result = experimentResult(hypothesis, { A: 0.78, B: 0.6 }, "lib-matched");
    library.recordExperimentResult(result, hypothesis);
    expect(promoted.standing).toBe("confirmed");
    expect(promoted.hypothesisId).toBe(hypothesis.id);
    expect(unrelated.standing).toBe("untested");
    expect(unrelated.evidence).toEqual([]);
  });

  it("ignores an experiment that matches no entry", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const hypothesis = makeHypothesis();
    const result = experimentResult(hypothesis, { A: 0.78, B: 0.6 }, "lib-orphan");
    library.recordExperimentResult(result, hypothesis);
    expect(library.size()).toBe(0);
  });

  it("lets the user set the standing manually, recording why", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.add({ statement: "S", cause: "c", effect: "e", direction: "increase" });
    library.setStanding(entry.id, "confirmed", "My physio and I both noticed this");
    const updated = library.get(entry.id)!;
    expect(updated.standing).toBe("confirmed");
    expect(updated.standingHistory).toHaveLength(2);
    expect(updated.standingHistory[1]!.note).toMatch(/physio/);
  });


  it("treats retired as sticky until the user changes it", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    library.setStanding(entry.id, "retired", "No longer relevant this term");
    library.addEvidence(entry.id, {
      id: "f-after-retire",
      kind: "finding",
      at: "2025-08-01T00:00:00Z",
      title: "Question accuracy is higher within 4h of training",
      supports: true,
      strength: 0.6,
      confidence: 0.8,
      replicationStatus: "replicated",
    });
    expect(library.get(entry.id)!.standing).toBe("retired");
  });

  it("updates the editable fields and bumps updatedAt", () => {
    let tick = Date.parse("2025-07-01T12:00:00Z");
    const library = new CausalHypothesisLibrary(undefined, () => tick);
    const entry = library.add({ statement: "S", cause: "c", effect: "e", direction: "increase" });
    const before = entry.updatedAt;
    tick += 1000;
    const updated = library.update(entry.id, { statement: "New wording", notes: "rewritten", tags: ["sleep"] })!;
    expect(updated.statement).toBe("New wording");
    expect(updated.notes).toBe("rewritten");
    expect(updated.tags).toEqual(["sleep"]);
    expect(updated.updatedAt).not.toBe(before);
    expect(library.update("missing", { statement: "x" })).toBeUndefined();
  });

  it("removes an entry", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.add({ statement: "S", cause: "c", effect: "e", direction: "decrease" });
    expect(library.remove(entry.id)).toBe(true);
    expect(library.size()).toBe(0);
    expect(library.remove(entry.id)).toBe(false);
  });

  it("drops evidence invalidated by source deletion and re-bases an emptied entry", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    expect(entry.standing).toBe("plausible");
    const pruned = library.pruneEvidence(new Set([finding.id]), new Set());
    expect(pruned).toBe(1);
    const after = library.get(entry.id)!;
    expect(after.evidence).toEqual([]);
    expect(after.standing).toBe("untested");
    expect(after.standingHistory.at(-1)!.note).toMatch(/deleted/);
  });

  it("unlinks a hypothesis invalidated by source deletion", () => {
    const library = new CausalHypothesisLibrary(undefined, clock);
    const entry = library.addFromFinding(finding)!;
    const hypothesis = makeHypothesis();
    const result = experimentResult(hypothesis, { A: 0.78, B: 0.6 }, "lib-unlink");
    library.recordExperimentResult(result, hypothesis);
    expect(library.get(entry.id)!.hypothesisId).toBe(hypothesis.id);
    library.pruneEvidence(new Set(), new Set([hypothesis.id]));
    expect(library.get(entry.id)!.hypothesisId).toBeNull();
    // The experiment evidence survives — the experiment itself was not deleted.
    expect(library.get(entry.id)!.evidence.some((e) => e.kind === "experiment")).toBe(true);
  });

  it("persists and rehydrates through an adapter", async () => {
    const adapter = createMemoryCausalLibraryAdapter();
    const first = new CausalHypothesisLibrary(adapter, clock);
    first.add({ statement: "S", cause: "c", effect: "e", direction: "decrease" });
    await first.persist();

    const second = new CausalHypothesisLibrary(adapter, clock);
    await second.load();
    expect(second.size()).toBe(1);
    expect(second.list()[0]!.statement).toBe("S");
  });
});

describe("the library inside Pulse", () => {
  it("rehydrates the library through Pulse.load()", async () => {
    const adapter = createMemoryCausalLibraryAdapter();
    const first = await createSyntheticPulse({ days: 30, seed: "lib-pulse", libraryAdapter: adapter });
    const entry = first.pulse.causalLibrary.add({
      statement: "Coffee after 2pm keeps me up.",
      cause: "afternoon coffee",
      effect: "sleep",
      direction: "decrease",
    });
    await first.pulse.causalLibrary.persist();

    const second = await createSyntheticPulse({ days: 30, seed: "lib-pulse", libraryAdapter: adapter });
    await second.pulse.load();
    expect(second.pulse.causalLibrary.get(entry.id)?.statement).toBe("Coffee after 2pm keeps me up.");
  });

  it("promotes a finding and records an experiment verdict automatically", async () => {
    const { pulse, nowMs } = await createSyntheticPulse({ days: 180, seed: "lib-e2e" });
    pulse.discover();
    const target = pulse.findings()[0]!;
    const promoted = pulse.promoteFindingToLibrary(target)!;
    const hypothesis = pulse.proposeHypotheses().find((h) => h.originFindingId === target.id)!;

    const startDate = addDays(new Date(nowMs).toISOString().slice(0, 10), 1);
    const design = pulse.designExperiment(hypothesis.id, { startDate, sessionsPerWeek: 5 });
    const result = pulse.analyseExperiment(design.id);
    expect(["invalid", "inconclusive"]).toContain(result.verdict);

    const entry = pulse.causalLibrary.get(promoted.id)!;
    // The verdict landed in the library, linked to the hypothesis it tested.
    expect(entry.evidence.some((e) => e.kind === "experiment")).toBe(true);
    expect(entry.hypothesisId).toBe(hypothesis.id);
    // An experiment that was never actually run cannot move the standing.
    expect(["plausible", "strengthening"]).toContain(entry.standing);
  });

  it("scans that follow a promotion never duplicate it", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "discovery-suite" });
    pulse.discover();
    const target = pulse.findings()[0]!;
    pulse.promoteFindingToLibrary(target);
    pulse.discover();
    pulse.promoteFindingToLibrary(target);
    const matches = pulse.causalLibrary.list().filter((e) => e.evidence.some((ev) => ev.id === target.id));
    expect(matches).toHaveLength(1);
  });
});
