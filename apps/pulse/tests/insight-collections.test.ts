import { describe, expect, it } from "vitest";
import { InsightCollectionStore, createMemoryInsightCollectionsAdapter } from "../src/history/insight-collections.js";
import { Pulse } from "../src/pulse.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

describe("InsightCollectionStore", () => {
  it("creates collections, trims titles, deduplicates insights, and returns copies", () => {
    const store = new InsightCollectionStore(clock);
    const collection = store.create("  Study habits  ");

    store.addInsight(collection.id, "study.accuracy|exercise.volume|1");
    store.addInsight(collection.id, "study.accuracy|exercise.volume|1");

    expect(store.list()).toEqual([
      expect.objectContaining({
        title: "Study habits",
        insightSignatures: ["study.accuracy|exercise.volume|1"],
      }),
    ]);

    const copy = store.list()[0]!;
    copy.insightSignatures.pop();
    expect(store.list()[0]!.insightSignatures).toHaveLength(1);
  });

  it("supports rename, removal, deletion, and pruning after source deletion", () => {
    const store = new InsightCollectionStore(clock);
    const study = store.create("Study");
    const training = store.create("Training");
    store.addInsight(study.id, "keep");
    store.addInsight(study.id, "remove");
    store.addInsight(training.id, "training");

    expect(store.rename(study.id, "Focus").title).toBe("Focus");
    expect(store.prune(new Set(["keep", "training"]))).toBe(1);
    expect(store.removeInsight(study.id, "keep").insightSignatures).toEqual([]);
    expect(store.delete(training.id)).toBe(true);
    expect(store.delete(training.id)).toBe(false);
    expect(() => store.addInsight(study.id, "")).toThrow(/signature cannot be empty/i);
  });

  it("persists and rehydrates user-authored collections", async () => {
    const adapter = createMemoryInsightCollectionsAdapter();
    const first = new InsightCollectionStore(clock, adapter);
    const collection = first.create("Useful patterns");
    first.addInsight(collection.id, "a stable insight");
    await first.persist();

    const second = new InsightCollectionStore(clock, adapter);
    await second.load();
    expect(second.list()).toEqual([expect.objectContaining({ title: "Useful patterns", insightSignatures: ["a stable insight"] })]);
  });
});

describe("Pulse insight collection integration", () => {
  it("includes collections in the export", () => {
    const pulse = new Pulse({ now: clock });
    const collection = pulse.createInsightCollection("Evidence to revisit");
    pulse.insightCollections.addInsight(collection.id, "outcome|exposure|1");

    expect(pulse.export().insightCollections).toEqual([
      expect.objectContaining({ title: "Evidence to revisit", insightSignatures: ["outcome|exposure|1"] }),
    ]);
  });
});
