/**
 * End-to-end: the full core loop, and performance budgets.
 *
 * COLLECT -> NORMALISE -> VALIDATE -> ANALYSE -> DISCOVER -> HYPOTHESISE
 * -> EXPERIMENT -> RECOMMEND -> MEASURE -> LEARN
 *
 * One test walks the whole loop on a synthetic user and asserts each stage
 * hands something usable to the next. The performance budgets are deliberately
 * generous: they exist to catch an accidental quadratic, not to police
 * milliseconds.
 */

import { describe, expect, it } from "vitest";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import { generateSyntheticUser } from "../src/synthetic/generator.js";
import { Pulse } from "../src/pulse.js";
import { createArrayReader } from "../src/connectors/sdk.js";
import { createReviseConnector } from "../src/connectors/revise.js";
import { discoverRelationships } from "../src/discovery/engine.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { addDays } from "../src/events/time.js";

describe("the full core loop", () => {
  it("runs collect through learn and produces usable output at every stage", async () => {
    // COLLECT + NORMALISE + VALIDATE
    const { pulse, user, nowMs } = await createSyntheticPulse({ days: 180, seed: "e2e" });
    expect(pulse.store.size).toBeGreaterThan(3000);
    for (const event of pulse.events().slice(0, 50)) {
      expect(event.provenance.connectorId).toBeTruthy();
      expect(event.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const quality = pulse.quality();
    expect(quality.every((entry) => entry.score > 0)).toBe(true);

    // ANALYSE
    const timeline = pulse.timeline();
    expect(timeline.days.length).toBeGreaterThan(100);
    expect(timeline.sources.length).toBeGreaterThanOrEqual(3);

    // DISCOVER
    const discovery = pulse.discover();
    expect(discovery.findings.length).toBeGreaterThan(0);
    expect(discovery.familySize).toBeGreaterThan(discovery.findings.length);

    // HYPOTHESISE
    const hypotheses = pulse.proposeHypotheses();
    expect(hypotheses.length).toBeGreaterThan(0);
    expect(hypotheses[0]!.status).toBe("proposed");
    expect(hypotheses[0]!.predictedEffect).toBeGreaterThan(0);

    // EXPERIMENT
    const startDate = addDays(new Date(nowMs).toISOString().slice(0, 10), 1);
    const design = pulse.designExperiment(hypotheses[0]!.id, { startDate, sessionsPerWeek: 5 });
    expect(design.assignments.length).toBe(design.durationDays);
    expect(design.minSamplePerCondition).toBeGreaterThan(5);
    expect(pulse.hypotheses.get(hypotheses[0]!.id)!.status).toBe("testing");

    // MEASURE — the experiment has not been run, so it must not claim a result.
    const result = pulse.analyseExperiment(design.id);
    expect(["invalid", "inconclusive"]).toContain(result.verdict);
    expect(pulse.hypotheses.get(hypotheses[0]!.id)!.status).toBe("inconclusive");

    // RECOMMEND
    const recommendations = pulse.recommendations(5);
    for (const recommendation of recommendations) {
      expect(recommendation.caveats.length).toBeGreaterThan(0);
      expect(recommendation.score).toBeGreaterThan(0);
    }

    // LEARN
    const graph = pulse.knowledgeGraph();
    expect(graph.size.nodes).toBeGreaterThan(10);
    expect(graph.listNodes("hypothesis").length).toBeGreaterThan(0);

    const brief = pulse.weeklyBrief();
    expect(brief.headline.length).toBeGreaterThan(10);

    const answer = pulse.ask("When do I revise most effectively?");
    expect(answer.statement.length).toBeGreaterThan(20);

    // Feedback closes the loop.
    if (recommendations[0]) {
      pulse.feedback.record(recommendations[0].sourceId, "not-useful", recommendations[0].metricIds);
      const after = pulse.recommendations(5);
      expect(after.some((entry) => entry.id === recommendations[0]!.id)).toBe(false);
    }

    // And the whole thing can be exported and then erased.
    const exported = pulse.export();
    expect(exported.counts.events).toBeGreaterThan(0);
    expect(exported.events.every((event) => event.sensitivity !== "sensitive")).toBe(true);

    const deletion = await pulse.forgetSource(user.groundTruth[0]!.outcomeMetricId.startsWith("study") ? "revise" : "arise");
    expect(deletion.eventsDeleted).toBeGreaterThan(0);
  });

  it("produces nothing but honest emptiness for a brand-new user", async () => {
    const { pulse } = await createSyntheticPulse({ days: 3, seed: "brand-new" });
    const discovery = pulse.discover();
    expect(discovery.findings).toEqual([]);
    expect(pulse.proposeHypotheses()).toEqual([]);
    expect(pulse.recommendations()).toEqual([]);
    expect(pulse.ask("When do I revise most effectively?").declined).toBe(true);
    expect(pulse.weeklyBrief().headline.length).toBeGreaterThan(10);
  });

  it("refuses to sync anything before consent is granted", async () => {
    const user = generateSyntheticUser({ days: 30 });
    const pulse = new Pulse({ timezone: user.timezone, now: () => Date.parse("2025-07-01T00:00:00Z") });
    pulse.registerConnector(
      createReviseConnector(
        createArrayReader(user.revise, (record) =>
          record.kind === "review" ? record.reviewedAt : record.kind === "attempt" ? record.createdAt : record.startedAt,
        ),
      ),
    );

    const blocked = await pulse.sync("revise");
    expect(blocked.error).toMatch(/No consent granted/);
    expect(pulse.store.size).toBe(0);

    pulse.connect("revise");
    const allowed = await pulse.backfill("revise", user.startDate);
    expect(allowed.error).toBeUndefined();
    expect(pulse.store.size).toBeGreaterThan(0);
  });

  it("survives a source that goes silent partway through", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "silent-source" });
    await pulse.forgetSource("le-studio-french");
    // Discovery must still run, just with fewer candidates.
    const discovery = pulse.discover();
    expect(discovery.candidatesGenerated).toBeGreaterThan(0);
    expect(discovery.findings.every((finding) => !finding.sources.includes("le-studio-french"))).toBe(true);
  });
});

describe("performance budgets", () => {
  const registry = createDefaultRegistry();

  it("ingests a year of data in reasonable time", async () => {
    const started = performance.now();
    const { pulse } = await createSyntheticPulse({ days: 365, seed: "perf-ingest" });
    const elapsed = performance.now() - started;
    expect(pulse.store.size).toBeGreaterThan(7000);
    expect(elapsed).toBeLessThan(20_000);
  });

  it("runs a full discovery scan over a year of data within budget", async () => {
    const { pulse } = await createSyntheticPulse({ days: 365, seed: "perf-discover" });
    const events = pulse.events();
    const started = performance.now();
    const report = discoverRelationships(events, { registry, now: () => Date.parse("2026-01-10T00:00:00Z") });
    const elapsed = performance.now() - started;
    expect(report.candidatesEvaluated).toBeGreaterThan(20);
    expect(elapsed).toBeLessThan(30_000);
  });

  it("scales sub-quadratically in the number of events", async () => {
    const small = await createSyntheticPulse({ days: 90, seed: "perf-scale" });
    const large = await createSyntheticPulse({ days: 360, seed: "perf-scale" });

    const time = (events: ReturnType<Pulse["events"]>): number => {
      const started = performance.now();
      discoverRelationships(events, { registry, now: () => Date.parse("2026-01-10T00:00:00Z") });
      return performance.now() - started;
    };

    const smallTime = Math.max(1, time(small.pulse.events()));
    const largeTime = time(large.pulse.events());
    const sizeRatio = large.pulse.store.size / small.pulse.store.size;
    // Quadratic on a 4x data increase would be ~16x. Anything under 10x rules
    // that out with room for measurement noise on a shared CI runner.
    expect(largeTime / smallTime).toBeLessThan(sizeRatio ** 2 * 0.7);
  });

  it("answers a question quickly enough to feel interactive", async () => {
    const { pulse } = await createSyntheticPulse({ days: 365, seed: "perf-ask" });
    pulse.discover();
    const started = performance.now();
    pulse.ask("When do I revise most effectively?");
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("builds a timeline over a year without materialising the world twice", async () => {
    const { pulse } = await createSyntheticPulse({ days: 365, seed: "perf-timeline" });
    const started = performance.now();
    const timeline = pulse.timeline({ includeEmptyDays: true });
    expect(timeline.days.length).toBeGreaterThan(300);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
