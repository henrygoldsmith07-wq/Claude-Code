/**
 * Persistent insight history.
 *
 * A discovery scan is a photograph of what the engine believes at one moment.
 * The history ledger turns a sequence of scans into a story: it matches
 * findings across scans by relationship signature (the same identity the
 * replication ledger uses), keeps every scan verbatim so the past can be
 * re-rendered without re-running analysis, and derives each insight's
 * journey — appeared, strengthened, weakened, disappeared — so the product
 * can show what changed rather than only what is true now.
 */

import { describe, expect, it } from "vitest";
import {
  InsightHistory,
  createMemoryInsightHistoryAdapter,
  type RecordScanInput,
} from "../src/history/insight-history.js";
import type { Finding } from "../src/discovery/finding.js";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-test",
    createdAt: "2025-07-01T00:00:00.000Z",
    evidenceClass: "correlation",
    title: "Accuracy is higher after exercise",
    statement: "Across 40 sessions, accuracy was higher after exercise.",
    metricIds: ["study.accuracy", "exercise.volume"],
    sources: ["revise", "arise"],
    sampleSize: 40,
    sampleDescription: "40 sessions",
    effect: { kind: "hedges_g", value: 0.4, magnitude: "small", label: "+0.40 SD" },
    confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: null,
    evidence: [
      {
        kind: "events",
        description: "40 attempts",
        metricIds: ["study.accuracy"],
        sources: ["revise"],
        eventCount: 40,
        dateRange: null,
      },
    ],
    tags: [],
    ...overrides,
  };
}

function scan(
  at: string,
  findings: readonly Finding[],
  rejected: RecordScanInput["rejected"] = [],
  eventCount = 100,
): RecordScanInput {
  return {
    at,
    eventCount,
    findings: [...findings],
    rejected: [...rejected],
    totals: {
      findings: findings.length,
      rejected: rejected.length,
      familySize: 40,
      familyCount: 3,
      expectedFalseDiscoveries: 0.2,
    },
  };
}

describe("InsightHistory ledger", () => {
  it("records the first scan with every insight marked appeared", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding()]));

    expect(history.size()).toBe(1);
    const entries = history.history();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.signature).toBe("study.accuracy|exercise.volume|1");
    expect(entry.title).toBe("Accuracy is higher after exercise");
    expect(entry.firstSeenAt).toBe("2025-07-01T00:00:00.000Z");
    expect(entry.lastSeenAt).toBe("2025-07-01T00:00:00.000Z");
    expect(entry.appearances).toBe(1);
    expect(entry.latestStatus).toBe("new");
    expect(entry.episodes.map((episode) => episode.change)).toEqual(["appeared"]);
  });

  it("ignores a second scan over the same data — an identical observation is not a new episode", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding()]));
    history.recordScan(scan("2025-07-08T00:00:00.000Z", [finding()]));

    expect(history.size()).toBe(1);
    expect(history.history()[0]!.episodes).toHaveLength(1);
  });

  it("ignores a scan from an earlier session when a reload replays it", async () => {
    const adapter = createMemoryInsightHistoryAdapter();
    const first = new InsightHistory(adapter);
    first.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    first.recordScan(scan("2025-08-01T00:00:00.000Z", [finding({ id: "f2", sampleSize: 70 })]));
    await first.persist();

    // A reload starts a fresh ledger from the adapter and replays the same
    // scans (the demo boot does exactly this). The history must not grow.
    const second = new InsightHistory(adapter);
    await second.load();
    second.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    second.recordScan(scan("2025-08-01T00:00:00.000Z", [finding({ id: "f2", sampleSize: 70 })]));
    expect(second.size()).toBe(2);
    expect(second.history()[0]!.appearances).toBe(2);
  });

  it("tracks strengthening and weakening as the effect changes across scans", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1", sampleSize: 40 })]));
    history.recordScan(
      scan("2025-08-01T00:00:00.000Z", [
        finding({ id: "f2", sampleSize: 70, effect: { kind: "hedges_g", value: 0.6, magnitude: "moderate", label: "+0.60 SD" } }),
      ]),
    );
    history.recordScan(
      scan("2025-09-01T00:00:00.000Z", [
        finding({ id: "f3", sampleSize: 90, effect: { kind: "hedges_g", value: 0.25, magnitude: "small", label: "+0.25 SD" } }),
      ]),
    );

    expect(history.size()).toBe(3);
    const entry = history.history()[0]!;
    expect(entry.episodes.map((episode) => episode.change)).toEqual(["appeared", "strengthened", "weakened"]);
    expect(entry.appearances).toBe(3);
    expect(entry.firstSeenAt).toBe("2025-07-01T00:00:00.000Z");
    expect(entry.lastSeenAt).toBe("2025-09-01T00:00:00.000Z");
  });

  it("keeps sub-threshold movement as unchanged rather than manufacturing change", () => {
    const history = new InsightHistory();
    history.recordScan(
      scan("2025-07-01T00:00:00.000Z", [
        finding({ id: "f1", effect: { kind: "hedges_g", value: 0.4, magnitude: "small", label: "+0.40 SD" } }),
      ]),
    );
    history.recordScan(
      scan("2025-08-01T00:00:00.000Z", [
        finding({ id: "f2", effect: { kind: "hedges_g", value: 0.405, magnitude: "small", label: "+0.40 SD" } }),
      ]),
    );

    expect(history.history()[0]!.episodes.map((episode) => episode.change)).toEqual(["appeared", "unchanged"]);
  });

  it("marks an insight disappeared when a later scan drops it, with the reason when the scan explains it", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding()]));
    history.recordScan(scan("2025-08-01T00:00:00.000Z", [], [
      {
        outcomeMetricId: "study.accuracy",
        exposureMetricId: "exercise.volume",
        reason: "Did not survive correction across the 41 comparisons made about study.accuracy",
      },
    ]));

    const entry = history.history()[0]!;
    expect(entry.episodes.map((episode) => episode.change)).toEqual(["appeared", "disappeared"]);
    expect(entry.episodes[1]!.present).toBe(false);
    expect(entry.episodes[1]!.finding).toBeNull();
    expect(entry.episodes[1]!.note).toBe(
      "Did not survive correction across the 41 comparisons made about study.accuracy",
    );
    expect(entry.appearances).toBe(1);
  });

  it("records a disappearance without a note when the rejection log does not explain it", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding()]));
    history.recordScan(scan("2025-08-01T00:00:00.000Z", [], [
      { outcomeMetricId: "study.recall_grade", exposureMetricId: "exercise.volume", reason: "Unrelated rejection" },
    ]));

    const episode = history.history()[0]!.episodes[1]!;
    expect(episode.change).toBe("disappeared");
    expect(episode.note).toBeNull();
  });

  it("treats a re-appearance after absence as appeared, not as a continuation", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    history.recordScan(scan("2025-08-01T00:00:00.000Z", []));
    history.recordScan(scan("2025-09-01T00:00:00.000Z", [finding({ id: "f3", sampleSize: 80 })]));

    expect(history.history()[0]!.episodes.map((episode) => episode.change)).toEqual([
      "appeared",
      "disappeared",
      "appeared",
    ]);
  });

  it("carries the latest replication status into the entry", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1", replicationStatus: "new" })]));
    history.recordScan(scan("2025-08-01T00:00:00.000Z", [finding({ id: "f2", replicationStatus: "replicated" })]));

    expect(history.history()[0]!.latestStatus).toBe("replicated");
  });

  it("persists and rehydrates through an adapter, preserving the derived journey", async () => {
    const adapter = createMemoryInsightHistoryAdapter();
    const first = new InsightHistory(adapter);
    first.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    first.recordScan(
      scan("2025-08-01T00:00:00.000Z", [
        finding({ id: "f2", effect: { kind: "hedges_g", value: 0.6, magnitude: "moderate", label: "+0.60 SD" } }),
      ]),
    );
    await first.persist();

    const second = new InsightHistory(adapter);
    await second.load();
    expect(second.size()).toBe(2);
    const entry = second.history()[0]!;
    expect(entry.appearances).toBe(2);
    expect(entry.episodes.map((episode) => episode.change)).toEqual(["appeared", "strengthened"]);
  });

  it("snapshots are self-contained: rehydrated history renders without re-running analysis", async () => {
    const adapter = createMemoryInsightHistoryAdapter();
    const first = new InsightHistory(adapter);
    first.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    await first.persist();

    const second = new InsightHistory(adapter);
    await second.load();
    const restored = second.history()[0]!.episodes[0]!.finding!;
    expect(restored.title).toBe("Accuracy is higher after exercise");
    expect(restored.effect.label).toBe("+0.40 SD");
  });

  it("prunes snapshots that drew on a deleted source", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding({ id: "f1" })]));
    history.recordScan(scan("2025-08-01T00:00:00.000Z", [finding({ id: "f2", sources: ["le-studio-french"] })]));

    const removed = history.pruneBySources(["revise", "arise"]);
    expect(removed).toBe(1);
    expect(history.size()).toBe(1);
    expect(history.history()[0]!.sources).toEqual(["le-studio-french"]);
  });

  it("returns a defensive copy from listScans so callers cannot mutate the ledger", () => {
    const history = new InsightHistory();
    history.recordScan(scan("2025-07-01T00:00:00.000Z", [finding()]));

    const scans = history.listScans();
    scans[0]!.findings.pop();
    expect(history.listScans()[0]!.findings).toHaveLength(1);
  });
});

describe("Pulse integration", () => {
  it("records a scan on discover and exposes the per-insight view", async () => {
    const { createSyntheticPulse } = await import("../src/synthetic/harness.js");
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "e2e" });

    const report = pulse.discover();
    expect(report.findings.length).toBeGreaterThan(0);
    expect(pulse.insightHistory.size()).toBe(1);
    expect(pulse.insightHistory.history().length).toBeGreaterThan(0);

    const recorded = pulse.insightHistory.listScans()[0]!;
    expect(recorded.eventCount).toBeGreaterThan(0);
    expect(recorded.totals.findings).toBe(recorded.findings.length);
    expect(recorded.totals.rejected).toBeGreaterThan(0);
  });

  it("reconstructs the journey as data accumulated through a scan window", async () => {
    const { createSyntheticPulse } = await import("../src/synthetic/harness.js");
    const { pulse, user } = await createSyntheticPulse({ days: 180, seed: "history-progressive" });
    const { addDays, localDayEnd } = await import("../src/events/time.js");

    const day60 = new Date(localDayEnd(addDays(user.startDate, 59), user.timezone)).toISOString();
    const day120 = new Date(localDayEnd(addDays(user.startDate, 119), user.timezone)).toISOString();
    pulse.discover({ through: day60 });
    pulse.discover({ through: day120 });
    pulse.discover();

    expect(pulse.insightHistory.size()).toBe(3);
    const entries = pulse.insightHistory.history();
    expect(entries.length).toBeGreaterThan(0);
    const multiScan = entries.filter((entry) => entry.episodes.length > 1);
    expect(multiScan.length).toBeGreaterThan(0);
    const allowed = new Set(["appeared", "disappeared", "strengthened", "weakened", "unchanged"]);
    for (const entry of entries) {
      for (const episode of entry.episodes) expect(allowed.has(episode.change), episode.change).toBe(true);
    }
  });

  it("includes the insight history in the full export", async () => {
    const { createSyntheticPulse } = await import("../src/synthetic/harness.js");
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "history-export" });
    pulse.discover();

    const exported = pulse.export();
    expect(exported.insightHistory.version).toBe(1);
    expect(exported.insightHistory.scans.length).toBe(pulse.insightHistory.size());
  });
});
