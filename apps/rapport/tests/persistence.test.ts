import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "@/data/repository";
import { SCORING_MODEL_VERSION } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";
import { emptyHumanEvidence } from "@/domain/human-evidence";
import type { Reflection } from "@/domain/types";

const NOW = "2026-03-20T09:00:00.000Z";
const at = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();

async function freshDatabase(): Promise<void> {
  await repo.resetConnection();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("rapport");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

const evidenceEvent: DomainEvent = {
  kind: "challenge-attempted",
  at: at(2),
  attemptId: "a1",
  skillId: "conv.follow-up",
  outcome: "yes",
  difficulty: 3,
  performance: 0.8,
  reliability: 0.9,
};

describe("repository", () => {
  beforeEach(freshDatabase);

  it("starts private by default", async () => {
    const preference = await repo.getPreference();
    expect(preference.syncEnabled).toBe(false);
    expect(preference.aiMayReadReflections).toBe(false);
    expect(preference.allowModelTraining).toBe(false);
    expect(preference.retentionDays).toBe(0);
  });

  it("projects skill states from appended events", async () => {
    const states = await repo.appendEvent(evidenceEvent, NOW);
    const followUp = states.find((state) => state.skillId === "conv.follow-up");
    expect(followUp?.attemptCount).toBe(1);
    expect(followUp?.successEvidence).toBeGreaterThan(0);
  });

  it("returns the cached projection when the scoring version matches", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    const cached = await repo.getSkillStates(NOW);
    expect(cached.length).toBeGreaterThan(50);
    expect(cached.find((state) => state.skillId === "conv.follow-up")?.attemptCount).toBe(1);
  });

  it("re-derives identical states from the log on demand", async () => {
    // This is the mechanism behind the scoring-version upgrade path: states are
    // a projection, so recomputing them must be a no-op when nothing changed.
    await repo.appendEvent(evidenceEvent, NOW);
    const cached = await repo.getSkillStates(NOW);
    const recomputed = await repo.refreshStates(NOW);
    const before = cached.find((state) => state.skillId === "conv.follow-up");
    const after = recomputed.find((state) => state.skillId === "conv.follow-up");
    expect(after?.mastery).toBeCloseTo(before?.mastery ?? -1, 10);
    expect(after?.attemptCount).toBe(1);
  });

  it("keeps the event log as the source of truth", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    await repo.appendEvent({ ...evidenceEvent, at: at(1), attemptId: "a2" }, NOW);
    const events = await repo.allEvents();
    expect(events.length).toBe(2);
    expect(events[0]?.at.localeCompare(events[1]?.at ?? "")).toBeLessThan(0);
    // Stored ids are an implementation detail and must not leak into the log.
    expect(Object.keys(events[0] ?? {})).not.toContain("id");
  });

  it("exports everything, including the raw log", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    const exported = await repo.exportAll(NOW);
    expect(exported.events.length).toBe(1);
    expect(exported.snapshot.skillStates.length).toBeGreaterThan(50);
    expect(exported.version).toBe(SCORING_MODEL_VERSION);
    // The export must be serialisable — it is downloaded as JSON.
    expect(() => JSON.stringify(exported)).not.toThrow();
  });

  it("persists, exports and restores the human evidence workspace", async () => {
    const state = {
      ...emptyHumanEvidence(),
      raters: [{ id: "r1", displayName: "Rater A", role: "rater" as const, createdAt: NOW, active: true }],
    };
    await repo.saveHumanEvidence(state);
    expect((await repo.getHumanEvidence()).raters[0]?.displayName).toBe("Rater A");

    const exported = await repo.exportAll(NOW);
    expect(exported.humanEvidence.raters).toHaveLength(1);

    await freshDatabase();
    await repo.importAll({ snapshot: exported.snapshot, events: exported.events, humanEvidence: exported.humanEvidence }, NOW);
    expect((await repo.getHumanEvidence()).raters[0]?.id).toBe("r1");
  });

  it("round-trips an export through import", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    await repo.saveUser({ id: "local", displayName: "Test", createdAt: NOW, timezoneOffsetMinutes: 0 });
    const exported = await repo.exportAll(NOW);

    await freshDatabase();
    await repo.importAll({ snapshot: exported.snapshot, events: exported.events }, NOW);

    const events = await repo.allEvents();
    expect(events.length).toBe(1);
    const states = await repo.getSkillStates(NOW);
    expect(states.find((state) => state.skillId === "conv.follow-up")?.attemptCount).toBe(1);
    expect((await repo.getUser())?.displayName).toBe("Test");
  });

  it("deletes everything irreversibly on wipe", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    await repo.put("reflections", {
      id: "r1",
      userId: "local",
      subject: { kind: "freeform" },
      attempted: "yes",
      difficulty: 3,
      wentWell: "private",
      skillIds: [],
      createdAt: NOW,
    });
    await repo.wipe();

    expect(await repo.allEvents()).toEqual([]);
    expect(await repo.all("reflections")).toEqual([]);
    expect(await repo.getUser()).toBeNull();
  });

  it("deletes a single reflection and its derived signal", async () => {
    const reflection: Reflection = {
      id: "r1",
      userId: "local",
      subject: { kind: "freeform" },
      attempted: "yes",
      difficulty: 3,
      wentWell: "something private",
      skillIds: [],
      createdAt: NOW,
    };
    await repo.put("reflections", reflection);
    await repo.put("signals", {
      reflectionId: "r1",
      behavioursMentioned: [],
      selfAppraisal: 0,
      obstacles: [],
      source: "deterministic",
    });
    await repo.deleteReflection("r1");
    expect(await repo.all("reflections")).toEqual([]);
    expect(await repo.all("signals")).toEqual([]);
  });

  it("applies the retention policy to old free text but keeps the entry", async () => {
    await repo.put("reflections", {
      id: "old",
      userId: "local",
      subject: { kind: "freeform" },
      attempted: "yes",
      difficulty: 4,
      wentWell: "something from months ago",
      skillIds: ["conv.start"],
      createdAt: at(120),
    });
    await repo.put("reflections", {
      id: "recent",
      userId: "local",
      subject: { kind: "freeform" },
      attempted: "yes",
      difficulty: 2,
      wentWell: "this week",
      skillIds: [],
      createdAt: at(2),
    });

    const redacted = await repo.applyRetention(30, NOW);
    expect(redacted).toBe(1);

    const reflections = await repo.all("reflections");
    const old = reflections.find((item) => item.id === "old");
    const recent = reflections.find((item) => item.id === "recent");
    expect(old?.wentWell).toBeUndefined();
    expect(old?.redactedAt).toBe(NOW);
    // The entry itself survives, so counts and trends are unaffected.
    expect(old?.difficulty).toBe(4);
    expect(recent?.wentWell).toBe("this week");
  });

  it("persists dismissed insights rather than the insights themselves", async () => {
    expect(await repo.dismissedInsightIds()).toEqual([]);
    await repo.saveDismissedInsightIds(["insight.a"]);
    expect(await repo.dismissedInsightIds()).toEqual(["insight.a"]);
  });

  it("purges old transcripts but keeps scores and events", async () => {
    const scenario = {
      id: "sc.purge",
      title: "Purge test",
      context: "A conversation.",
      skillIds: ["conv.follow-up"],
      objective: "Talk.",
      difficulty: 3 as const,
      characters: [],
      branches: [],
      evaluationCriteria: [],
    };
    const makeSim = (id: string, startedAt: string) => ({
      id,
      userId: "local",
      scenarioId: scenario.id,
      scenario,
      mode: "text" as const,
      startedAt,
      deliveredDifficulty: 3,
      assistLevel: "none" as const,
      turns: [{ id: `${id}-t0`, simulationId: id, index: 0, speaker: "user" as const, text: "hello there", createdAt: startedAt }],
    });
    await repo.put("simulations", makeSim("sim-old", at(120)));
    await repo.put("simulations", makeSim("sim-recent", at(2)));
    const evaluation = (id: string, simulationId: string) => ({
      id,
      simulationId,
      userId: "local",
      scores: [],
      whatWorked: [],
      highestImpactImprovement: { behaviour: "relevance" as const, observation: "o", principle: "p", exampleAlternative: "e" },
      nextExercise: { id: `ex-${id}`, skillId: "conv.follow-up", kind: "rewrite" as const, prompt: "p", criteria: ["c"], difficulty: 3 as const },
      source: "deterministic" as const,
      createdAt: NOW,
    });
    await repo.put("evaluations", evaluation("eval-old", "sim-old"));
    await repo.appendEvent(evidenceEvent, NOW);

    const purged = await repo.purgeOldTranscripts(30, NOW);
    expect(purged).toBe(1);

    const sims = await repo.all("simulations");
    expect(sims.map((s) => s.id)).toEqual(["sim-recent"]);
    // The score survives the transcript.
    expect((await repo.all("evaluations")).map((e) => e.id)).toEqual(["eval-old"]);
    expect(await repo.allEvents()).toHaveLength(1);
  });

  it("restores atomically: a fresh import replaces everything in one transaction", async () => {
    await repo.appendEvent(evidenceEvent, NOW);
    await repo.put("reflections", {
      id: "stale",
      userId: "local",
      subject: { kind: "freeform" },
      attempted: "yes",
      difficulty: 3,
      wentWell: "leftover from before",
      skillIds: [],
      createdAt: NOW,
    });

    const exported = await repo.exportAll(NOW);
    await freshDatabase();
    // A restore/sync-pull whose payload has no reflections must leave none
    // behind — clearing and writing commit together or not at all.
    await repo.importAll(
      { snapshot: { ...exported.snapshot, reflections: [] }, events: exported.events },
      NOW,
    );

    // The imported state is exactly the export — nothing stale survives.
    expect((await repo.all("reflections")).map((r) => r.id)).toEqual([]);
    expect(await repo.allEvents()).toHaveLength(1);
    expect((await repo.getUser())?.displayName).toBe("");
  });
});
