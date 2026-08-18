/**
 * Contradictory evidence tracking.
 *
 * The replication ledger answers "has this claim been seen again?"; the
 * contradiction ledger answers the harder question — "has the same
 * outcome-exposure pair been seen pointing *both* ways?". A claim that has
 * been observed in opposing directions is suspect whichever side it was on,
 * and both sides must be marked `contradicted` so neither is shown to the
 * user as established.
 */

import { describe, expect, it } from "vitest";
import { ContradictionLedger } from "../src/discovery/contradictions.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import { HypothesisTracker } from "../src/hypotheses/tracker.js";
import { rankRecommendations } from "../src/recommendations/rank.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { addDays } from "../src/events/time.js";
import type { Finding } from "../src/discovery/finding.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

const negativeEffect = {
  kind: "hedges_g" as const,
  value: -0.45,
  magnitude: "small" as const,
  label: "-0.45 SD",
};

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

describe("contradiction ledger", () => {
  it("leaves a first sighting untouched and records nothing", () => {
    const ledger = new ContradictionLedger(clock);
    const [out] = ledger.annotate([finding({ id: "a" })]);
    expect(out!.replicationStatus).toBeUndefined();
    expect(out!.contradictionNote).toBeUndefined();
    expect(ledger.list()).toEqual([]);
  });

  it("does not treat a same-direction later sighting as a contradiction", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a", createdAt: "2025-06-01T00:00:00Z" })]);
    const [later] = ledger.annotate([finding({ id: "b", createdAt: "2025-06-15T00:00:00Z" })]);
    expect(later!.replicationStatus).toBeUndefined();
    expect(ledger.list()).toEqual([]);
  });

  it("does not contradict across different candidate kinds", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a", createdAt: "2025-06-01T00:00:00Z", tags: ["time-of-day"] })]);
    const [later] = ledger.annotate([
      finding({ id: "b", createdAt: "2025-06-15T00:00:00Z", tags: ["attribute-split"], effect: negativeEffect }),
    ]);
    expect(later!.replicationStatus).toBeUndefined();
    expect(ledger.list()).toEqual([]);
  });

  it("marks both sides contradicted when a later sighting points the other way", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a", createdAt: "2025-06-01T00:00:00Z" })]);
    const [later] = ledger.annotate([
      finding({ id: "b", createdAt: "2025-06-15T00:00:00Z", effect: negativeEffect }),
    ]);
    expect(later!.replicationStatus).toBe("contradicted");
    expect(later!.contradictionNote).toMatch(/opposite/);
    expect(ledger.statusOf("a")).toBe("contradicted");

    const [record] = ledger.list();
    expect(record!.outcomeMetricId).toBe("study.accuracy");
    expect(record!.exposureMetricId).toBe("exercise.volume");
    expect(record!.sightings.map((s) => s.findingId)).toEqual(["a", "b"]);
    expect(record!.evidence).toMatch(/both ways/);
  });

  it("marks both sides contradicted within a single scan", () => {
    const ledger = new ContradictionLedger(clock);
    const [a, b] = ledger.annotate([
      finding({ id: "a", createdAt: "2025-06-01T00:00:00Z" }),
      finding({ id: "b", createdAt: "2025-06-15T00:00:00Z", effect: negativeEffect }),
    ]);
    expect(a!.replicationStatus).toBe("contradicted");
    expect(b!.replicationStatus).toBe("contradicted");
  });

  it("overrides a prior replication status with contradicted", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([
      finding({ id: "a", createdAt: "2025-06-01T00:00:00Z", replicationStatus: "replicated" }),
    ]);
    const [later] = ledger.annotate([
      finding({ id: "b", createdAt: "2025-06-15T00:00:00Z", effect: negativeEffect }),
    ]);
    expect(later!.replicationStatus).toBe("contradicted");
    expect(ledger.statusOf("a")).toBe("contradicted");
  });

  it("keeps every side of a three-way conflict marked contradicted", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a", createdAt: "2025-06-01T00:00:00Z" })]);
    ledger.annotate([finding({ id: "b", createdAt: "2025-06-15T00:00:00Z", effect: negativeEffect })]);
    const [third] = ledger.annotate([finding({ id: "c", createdAt: "2025-06-30T00:00:00Z" })]);
    expect(third!.replicationStatus).toBe("contradicted");
    expect(ledger.statusOf("a")).toBe("contradicted");
    expect(ledger.statusOf("b")).toBe("contradicted");
    expect(ledger.list()[0]!.sightings).toHaveLength(3);
  });

  it("is idempotent across repeated annotation of the same findings", () => {
    const ledger = new ContradictionLedger(clock);
    const batch = [finding({ id: "a" }), finding({ id: "b", effect: negativeEffect })];
    ledger.annotate(batch);
    ledger.annotate(batch);
    expect(ledger.list()[0]!.sightings).toHaveLength(2);
  });

  it("ignores findings with no usable direction", () => {
    const ledger = new ContradictionLedger(clock);
    const [out] = ledger.annotate([
      finding({
        id: "a",
        effect: { kind: "mean_difference", value: NaN, magnitude: "negligible", label: "not estimable" },
      }),
    ]);
    expect(out!.replicationStatus).toBeUndefined();
    expect(ledger.list()).toEqual([]);
  });

  it("prunes a record once either side no longer exists", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a" }), finding({ id: "b", effect: negativeEffect })]);
    ledger.prune(new Set(["a"]));
    expect(ledger.statusOf("b")).toBe("new");
    expect(ledger.size()).toBe(0);
  });

  it("keeps a record while both sides still exist", () => {
    const ledger = new ContradictionLedger(clock);
    ledger.annotate([finding({ id: "a" }), finding({ id: "b", effect: negativeEffect })]);
    ledger.prune(new Set(["a", "b"]));
    expect(ledger.size()).toBe(1);
  });
});

describe("contradictions through Pulse", () => {
  it("annotates findings, appears in the export, and is pruned on source deletion", async () => {
    const { pulse, nowMs } = await createSyntheticPulse({ days: 180, seed: "contradiction-e2e" });
    const first = pulse.discover();
    expect(first.findings.length).toBeGreaterThan(0);

    // Pick a claim whose outcome-exposure pair appears only once in the scan,
    // so the ledger state around it is predictable.
    const seen = new Map<string, number>();
    for (const finding of first.findings) {
      const subject = `${finding.metricIds[0]}|${finding.metricIds[1]}`;
      seen.set(subject, (seen.get(subject) ?? 0) + 1);
    }
    const target = first.findings.find(
      (finding) => seen.get(`${finding.metricIds[0]}|${finding.metricIds[1]}`) === 1,
    )!;
    expect(target).toBeDefined();
    const recordsBefore = pulse.contradictions.list().length;

    // A later scan over fresh data claims the same relationship the other way.
    const flipped: Finding = {
      ...target,
      id: `${target.id}-later`,
      createdAt: new Date(nowMs + 7 * 86_400_000).toISOString(),
      effect: { ...target.effect, value: -target.effect.value },
    };
    const [annotated] = pulse.contradictions.annotate([flipped]);
    expect(annotated!.replicationStatus).toBe("contradicted");

    const records = pulse.contradictions.list();
    expect(records).toHaveLength(recordsBefore + 1);
    const record = records.find((entry) => entry.sightings.some((s) => s.findingId === target.id))!;
    expect(record.sightings.map((s) => s.findingId)).toEqual([target.id, `${target.id}-later`]);

    const exported = pulse.export();
    expect(exported.contradictions.length).toBe(recordsBefore + 1);

    // Deleting the source invalidates the finding, which drops its record too.
    await pulse.forgetSource(target.sources[0]!);
    expect(
      pulse.contradictions.list().some((entry) => entry.sightings.some((s) => s.findingId === target.id)),
    ).toBe(false);
  });
});

describe("hypotheses under contradiction", () => {
  it("never proposes a hypothesis from a contradicted finding", () => {
    const tracker = new HypothesisTracker(clock);
    expect(tracker.proposeFromFinding(finding({ replicationStatus: "contradicted" }))).toBeNull();
  });

  it("moves a proposed hypothesis to contradicted when the next discovery contradicts its finding", async () => {
    const { pulse, nowMs } = await createSyntheticPulse({ days: 180, seed: "contradiction-hyp" });
    const first = pulse.discover();

    const target = first.findings.find(
      (entry) => entry.nextAction?.kind === "run-experiment" && entry.replicationStatus !== "contradicted",
    )!;
    expect(target).toBeDefined();

    const hypothesis = pulse.proposeHypotheses().find((h) => h.originFindingId === target.id)!;
    expect(hypothesis).toBeDefined();
    expect(hypothesis.status).toBe("proposed");

    // A later scan over fresh data claims the same relationship the other way,
    // before the next discovery run.
    pulse.contradictions.annotate([
      {
        ...target,
        id: `${target.id}-flipped`,
        createdAt: new Date(nowMs + 7 * 86_400_000).toISOString(),
        effect: { ...target.effect, value: -target.effect.value },
      },
    ]);

    pulse.discover();
    expect(pulse.hypotheses.get(hypothesis.id)!.status).toBe("contradicted");
    const history = pulse.hypotheses.get(hypothesis.id)!.history;
    expect(history[history.length - 1]!.reason).toMatch(/pointing both ways/);
  });

  it("lets a completed experiment settle a contradicted hypothesis", async () => {
    const { pulse, nowMs } = await createSyntheticPulse({ days: 180, seed: "contradiction-settle" });
    const first = pulse.discover();
    const target = first.findings.find(
      (entry) => entry.nextAction?.kind === "run-experiment" && entry.replicationStatus !== "contradicted",
    )!;
    expect(target).toBeDefined();

    const hypothesis = pulse.proposeHypotheses().find((h) => h.originFindingId === target.id)!;
    pulse.contradictions.annotate([
      {
        ...target,
        id: `${target.id}-flipped`,
        createdAt: new Date(nowMs + 7 * 86_400_000).toISOString(),
        effect: { ...target.effect, value: -target.effect.value },
      },
    ]);
    pulse.discover();
    expect(pulse.hypotheses.get(hypothesis.id)!.status).toBe("contradicted");

    // Running the experiment resolves the conflict instead of leaving the
    // claim withdrawn forever.
    const startDate = addDays(new Date(nowMs).toISOString().slice(0, 10), 1);
    const design = pulse.designExperiment(hypothesis.id, { startDate, sessionsPerWeek: 5 });
    expect(pulse.hypotheses.get(hypothesis.id)!.status).toBe("contradicted");
    const result = pulse.analyseExperiment(design.id);
    expect(["invalid", "inconclusive"]).toContain(result.verdict);
    expect(pulse.hypotheses.get(hypothesis.id)!.status).toBe("inconclusive");
  });

  it("allows a contradicted hypothesis to be retested", () => {
    const tracker = new HypothesisTracker(clock);
    const hypothesis = tracker.proposeFromFinding(finding({ id: "retest" }))!;
    tracker.transition(hypothesis.id, "contradicted", "test");
    const retested = tracker.transition(hypothesis.id, "testing", "test");
    expect(retested.status).toBe("testing");
  });
});

describe("recommendations under contradiction", () => {
  it("never recommends acting on a contradicted finding", () => {
    const recs = rankRecommendations(
      [finding({ id: "ok" }), finding({ id: "conflicted", replicationStatus: "contradicted" })],
      [],
      { registry: createDefaultRegistry(), now: clock, today: "2025-07-01" },
    );
    expect(recs.some((r) => r.sourceId === "ok")).toBe(true);
    expect(recs.some((r) => r.sourceId === "conflicted")).toBe(false);
  });
});
