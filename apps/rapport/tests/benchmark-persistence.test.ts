import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "@/data/repository";
import { emptyCorpus } from "@/domain/corpus";
import { corpusIsSeparable, exportSeparationCheck } from "@/domain/privacy";
import type { CorpusBenchmark } from "@/domain/corpus";

const NOW = "2026-08-20T10:00:00.000Z";

async function freshDatabase(): Promise<void> {
  await repo.resetConnection();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("rapport");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

const corpusWithItem = (): CorpusBenchmark => {
  const corpus = emptyCorpus(NOW);
  corpus.items.push({
    id: "item-1",
    title: "Test",
    transcript: [{ turnId: "t0", index: 0, speaker: "user", text: "Hello there." }],
    provenance: { kind: "researcher-entered", enteredAt: NOW },
    rubricVersion: "2026-08-20.1",
    createdAt: NOW,
  });
  return corpus;
};

describe("benchmark persistence and separation", () => {
  beforeEach(freshDatabase);

  it("is opt-in by default — no benchmark export without consent", async () => {
    await repo.saveCorpusBenchmark(corpusWithItem());
    const exported = await repo.exportBenchmark();
    expect(exported).toBeNull();
    expect((await repo.getBenchmarkConsent()).optedIn).toBe(false);
  });

  it("exports benchmark data only after explicit consent", async () => {
    await repo.setBenchmarkConsent(true);
    await repo.saveCorpusBenchmark(corpusWithItem());
    const exported = await repo.exportBenchmark();
    expect(exported).not.toBeNull();
    expect(exported?.corpus.items).toHaveLength(1);
  });

  it("keeps benchmark data out of the normal product export", async () => {
    await repo.setBenchmarkConsent(true);
    await repo.saveCorpusBenchmark(corpusWithItem());
    const normal = await repo.exportNormalExcludingBenchmark(NOW);
    expect(JSON.stringify(normal)).not.toContain("corpusBenchmark");
    expect(JSON.stringify(normal)).not.toContain('"item-1"');
    // And the separation check agrees.
    const check = exportSeparationCheck(normal, { corpus: corpusWithItem() });
    expect(check.ok).toBe(true);
  });

  it("deleting the benchmark leaves product data intact", async () => {
    await repo.appendEvent(
      { kind: "challenge-attempted", at: NOW, attemptId: "a1", skillId: "conv.follow-up", outcome: "yes", difficulty: 3, performance: 0.8, reliability: 0.9 },
      NOW,
    );
    await repo.setBenchmarkConsent(true);
    await repo.saveCorpusBenchmark(corpusWithItem());

    await repo.deleteCorpusBenchmark();
    const corpus = await repo.getCorpusBenchmark();
    expect(corpus.items).toHaveLength(0);
    const states = await repo.getSkillStates(NOW);
    expect(states.find((s) => s.skillId === "conv.follow-up")?.attemptCount).toBe(1);
  });

  it("withdrawing consent deletes the research copy but not normal data", async () => {
    await repo.setBenchmarkConsent(true);
    await repo.saveCorpusBenchmark(corpusWithItem());
    await repo.setBenchmarkConsent(false);
    expect((await repo.getBenchmarkConsent()).optedIn).toBe(false);
    const corpus = await repo.getCorpusBenchmark();
    expect(corpus.items).toHaveLength(0);
  });

  it("full wipe clears both kinds of data", async () => {
    await repo.setBenchmarkConsent(true);
    await repo.saveCorpusBenchmark(corpusWithItem());
    await repo.wipe();
    const corpus = await repo.getCorpusBenchmark();
    expect(corpus.items).toHaveLength(0);
    const events = await repo.allEvents();
    expect(events).toHaveLength(0);
  });

  it("enforces structural separability between snapshot and corpus", () => {
    const snapshot = {
      user: { id: "local", displayName: "", createdAt: NOW, timezoneOffsetMinutes: 0 },
      preference: {},
      simulations: [],
      evaluations: [],
    };
    const check = corpusIsSeparable(snapshot as never, corpusWithItem());
    expect(check.ok).toBe(true);

    const leaky = { ...snapshot, corpus: corpusWithItem() };
    const bad = corpusIsSeparable(leaky as never, corpusWithItem());
    expect(bad.ok).toBe(false);
  });
});
