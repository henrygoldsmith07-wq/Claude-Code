/**
 * Privacy and security tests.
 *
 * The claims Pulse makes about personal data are only worth as much as the
 * tests behind them. Each of these corresponds to a promise made in the UI:
 * per-source deletion, full export, sensitive data withheld by default,
 * telemetry that carries no content, and encryption at rest.
 */

import { describe, expect, it } from "vitest";
import { MemoryEventStore } from "../src/events/store.js";
import { ConsentRegistry } from "../src/privacy/consent.js";
import { buildExport, deleteEverything, deleteRange, deleteSource, toCsv, toNdjson } from "../src/privacy/export.js";
import { assertNoRawContent, prepareForAi, redactEvent, summariseForTelemetry } from "../src/privacy/redaction.js";
import {
  createEncryptedAdapter,
  createEncryptedBlobAdapter,
  createMemoryBlobStorage,
  decryptJson,
  encryptJson,
} from "../src/privacy/encryption.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import { createArrayReader } from "../src/connectors/sdk.js";
import { createReviseConnector } from "../src/connectors/revise.js";
import { createReflectConnector } from "../src/connectors/reflect.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import type { PulseEvent } from "../src/events/schema.js";
import type { Finding } from "../src/discovery/finding.js";
import type { InsightHistorySnapshot } from "../src/history/insight-history.js";
import type { CausalLibrarySnapshot } from "../src/hypotheses/library.js";
import type { FeedbackSnapshot } from "../src/recommendations/feedback.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

function ctx(source: string): NormaliseContext {
  return { connectorId: source, connectorVersion: "1.0.0", syncId: "s", ingestMode: "live", timezone: "UTC", now: clock };
}

function studyEvent(id: string, notes?: string): PulseEvent {
  return normaliseEvent(
    {
      source: "revise",
      sourceEventId: id,
      type: "revise.attempt",
      category: "study",
      occurredAt: "2025-06-15T15:00:00Z",
      metrics: { accuracy: 0.8, marks_awarded: 8 },
      attributes: { method: "practice", subject_id: "physics" },
      ...(notes ? { notes } : {}),
    },
    ctx("revise"),
  );
}

function reflectEvent(id: string): PulseEvent {
  return normaliseEvent(
    {
      source: "reflect",
      sourceEventId: id,
      type: "reflect.entry",
      category: "reflection",
      occurredAt: "2025-06-15T21:00:00Z",
      metrics: { mood: 7, stress: 4 },
      sensitivity: "sensitive",
    },
    ctx("reflect"),
  );
}

const reviseConnector = createReviseConnector(createArrayReader([], () => "2025-01-01T00:00:00Z"));
const reflectConnector = createReflectConnector(createArrayReader([], () => "2025-01-01T00:00:00Z"));

async function seeded(): Promise<{ store: MemoryEventStore; consent: ConsentRegistry }> {
  const store = new MemoryEventStore();
  await store.put([studyEvent("a"), studyEvent("b"), reflectEvent("r1")]);
  const consent = new ConsentRegistry(clock);
  consent.grant(reviseConnector);
  consent.grant(reflectConnector);
  return { store, consent };
}

describe("export", () => {
  it("omits sensitive sources unless they are explicitly requested", async () => {
    const { store, consent } = await seeded();

    const standard = buildExport(store, consent, { now: clock });
    expect(standard.events.every((event) => event.sensitivity !== "sensitive")).toBe(true);
    expect(standard.excludedSources.map((entry) => entry.source)).toContain("reflect");
    expect(standard.excludedSources[0]!.reason).toMatch(/sensitive/i);

    const full = buildExport(store, consent, { now: clock, includeSensitive: true });
    expect(full.events.some((event) => event.source === "reflect")).toBe(true);
  });

  it("honours a per-source opt-out from exports", async () => {
    const { store, consent } = await seeded();
    consent.get("revise")!.includeInExport = false;
    const result = buildExport(store, consent, { now: clock });
    expect(result.events.some((event) => event.source === "revise")).toBe(false);
    expect(result.excludedSources.some((entry) => entry.source === "revise")).toBe(true);
  });

  it("carries consents and derived artefacts so the export is self-contained", async () => {
    const { store, consent } = await seeded();
    const result = buildExport(store, consent, { now: clock, findings: [], hypotheses: [] });
    expect(result.format).toBe("pulse-export");
    expect(result.schemaVersion).toBeGreaterThan(0);
    expect(result.consents.length).toBe(2);
    expect(result.counts.events).toBe(result.events.length);
  });

  it("renders NDJSON and CSV without free text", async () => {
    const store = new MemoryEventStore();
    await store.put([studyEvent("a", "I found this really hard and felt awful about it")]);
    const events = store.all();

    expect(toNdjson(events).split("\n")).toHaveLength(1);
    const csv = toCsv(events);
    expect(csv).toMatch(/metric_accuracy/);
    expect(csv).not.toMatch(/felt awful/);
  });

  it("escapes CSV values that would otherwise break the format", () => {
    const event = normaliseEvent(
      {
        source: "revise",
        sourceEventId: 'weird","id',
        type: "revise.attempt",
        category: "study",
        occurredAt: "2025-06-15T15:00:00Z",
        subject: 'topic, with "quotes"',
        metrics: { accuracy: 0.5 },
      },
      ctx("revise"),
    );
    const lines = toCsv([event]).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/"topic, with ""quotes"""/);
  });
});

describe("deletion", () => {
  it("removes every event from one source and revokes its consent", async () => {
    const { store, consent } = await seeded();
    const report = await deleteSource(store, consent, "revise", {}, clock);
    expect(report.eventsDeleted).toBe(2);
    expect(report.consentRevoked).toBe(true);
    expect(store.query({ includeSensitive: true }).some((event) => event.source === "revise")).toBe(false);
    // Other sources are untouched.
    expect(store.query({ includeSensitive: true }).some((event) => event.source === "reflect")).toBe(true);
    expect(consent.isGranted("revise")).toBe(false);
  });

  it("reports the findings and hypotheses that deletion invalidated", async () => {
    const { store, consent } = await seeded();
    const finding: Finding = {
      id: "f1",
      createdAt: "2025-06-30T00:00:00Z",
      evidenceClass: "correlation",
      title: "t",
      statement: "s",
      metricIds: ["study.accuracy"],
      sources: ["revise"],
      sampleSize: 10,
      sampleDescription: "10",
      effect: { kind: "hedges_g", value: 0.3, magnitude: "small", label: "" },
      confidence: { level: "low", score: 0.4, reasons: [], limitations: [] },
      confounders: [],
      causalityNote: "n",
      nextAction: null,
      evidence: [],
      tags: [],
    };
    const hypothesis = {
      id: "h1",
      originFindingId: "f1",
      createdAt: "",
      updatedAt: "",
      statement: "",
      exposureMetricId: null,
      outcomeMetricId: "study.accuracy",
      predictedDirection: "increase" as const,
      predictedEffect: 0.3,
      status: "proposed" as const,
      history: [],
      experimentIds: [],
      knownConfounders: [],
    };

    const report = await deleteSource(store, consent, "revise", { findings: [finding], hypotheses: [hypothesis] }, clock);
    expect(report.invalidatedFindings).toEqual(["f1"]);
    expect(report.invalidatedHypotheses).toEqual(["h1"]);
  });

  it("deletes a date range without touching the rest", async () => {
    const store = new MemoryEventStore();
    await store.put([
      normaliseEvent({ source: "revise", sourceEventId: "june", type: "revise.attempt", category: "study", occurredAt: "2025-06-15T10:00:00Z", metrics: { accuracy: 0.5 } }, ctx("revise")),
      normaliseEvent({ source: "revise", sourceEventId: "july", type: "revise.attempt", category: "study", occurredAt: "2025-07-15T10:00:00Z", metrics: { accuracy: 0.5 } }, ctx("revise")),
    ]);
    const report = await deleteRange(store, "revise", "2025-06-01T00:00:00Z", "2025-07-01T00:00:00Z", clock);
    expect(report.eventsDeleted).toBe(1);
    expect(store.size).toBe(1);
  });

  it("erases everything and revokes every grant", async () => {
    const { store, consent } = await seeded();
    const result = await deleteEverything(store, consent);
    expect(result.eventsDeleted).toBe(3);
    expect(store.size).toBe(0);
    expect(result.sourcesRevoked.sort()).toEqual(["reflect", "revise"]);
    expect(consent.list().every((grant) => !grant.granted)).toBe(true);
  });

  it("drops the findings that depended on a deleted source, end to end", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "deletion" });
    pulse.discover();

    // Pick a source that actually underpins a finding for this data, rather
    // than hard-coding one and coupling the test to the generator's seed.
    const target = pulse.findings().flatMap((finding) => finding.sources)[0];
    expect(target).toBeDefined();
    const before = pulse.findings().filter((finding) => finding.sources.includes(target!));
    expect(before.length).toBeGreaterThan(0);

    const report = await pulse.forgetSource(target!);
    expect(report.eventsDeleted).toBeGreaterThan(0);
    expect(report.invalidatedFindings.sort()).toEqual(before.map((finding) => finding.id).sort());
    expect(pulse.findings().some((finding) => finding.sources.includes(target!))).toBe(false);
    expect(pulse.events().some((event) => event.source === target)).toBe(false);
  });
});

describe("redaction", () => {
  it("reduces an event to shapes and counts", () => {
    const redacted = redactEvent(studyEvent("a", "private reflection text"));
    expect(redacted).not.toHaveProperty("metrics");
    expect(redacted.metricKeys).toEqual(["accuracy", "marks_awarded"]);
    expect(redacted.hasNotes).toBe(true);
    expect(JSON.stringify(redacted)).not.toMatch(/private reflection/);
    // Time is coarsened to the hour, never the exact minute.
    expect(redacted.hourBucket).toBe("2025-06-15T15");
  });

  it("suppresses telemetry buckets too small to hide in", () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => studyEvent(`a${i}`)),
      reflectEvent("solo"),
    ];
    const summary = summariseForTelemetry(events, 5);
    expect(summary.sources.map((entry) => entry.source)).toEqual(["revise"]);
    expect(summary.sensitiveCount).toBe(1);
    expect(summary.eventCount).toBe(11);
  });

  it("rejects a payload carrying anything that looks like free text", () => {
    expect(() => assertNoRawContent({ counts: { a: 1 }, sources: ["revise"] })).not.toThrow();
    expect(() => assertNoRawContent({ notes: "how I felt today" })).toThrow(/Redaction violation/);
    expect(() => assertNoRawContent({ nested: { transcript: "hello" } })).toThrow(/Redaction violation/);
    expect(() => assertNoRawContent({ blob: "x".repeat(400) })).toThrow(/long free text/);
  });

  it("keeps sensitive sources and all notes out of anything bound for a model", () => {
    const events = [studyEvent("a", "some private text"), reflectEvent("r1")];
    const prepared = prepareForAi(events, ["revise"]);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]!.notes).toBeUndefined();
    expect(JSON.stringify(prepared)).not.toMatch(/private text/);
  });

  it("a consent registry never lists a sensitive source as AI-eligible by default", () => {
    const consent = new ConsentRegistry(clock);
    consent.grant(reflectConnector);
    consent.grant(reviseConnector);
    expect(consent.aiEligibleSources()).toEqual(["revise"]);
  });
});

describe("encryption at rest", () => {
  it("round-trips a snapshot through AES-GCM", async () => {
    const blob = await encryptJson({ hello: "world", n: 42 }, "correct horse battery staple");
    expect(blob.algorithm).toBe("AES-GCM");
    expect(blob.iterations).toBeGreaterThanOrEqual(100_000);
    expect(JSON.stringify(blob)).not.toMatch(/world/);
    expect(await decryptJson<{ hello: string }>(blob, "correct horse battery staple")).toEqual({ hello: "world", n: 42 });
  });

  it("refuses the wrong passphrase without saying which part was wrong", async () => {
    const blob = await encryptJson({ secret: 1 }, "right");
    await expect(decryptJson(blob, "wrong")).rejects.toThrow(/wrong passphrase, or the data has been altered/);
  });

  it("detects tampering with the ciphertext", async () => {
    const blob = await encryptJson({ secret: 1 }, "key");
    const tampered = { ...blob, ciphertext: `${blob.ciphertext.slice(0, -4)}AAAA` };
    await expect(decryptJson(tampered, "key")).rejects.toThrow(/altered/);
  });

  it("uses a fresh salt and IV for every write", async () => {
    const first = await encryptJson({ a: 1 }, "key");
    const second = await encryptJson({ a: 1 }, "key");
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("stores events encrypted and rehydrates them transparently", async () => {
    const storage = createMemoryBlobStorage();
    const adapter = createEncryptedAdapter(storage, "passphrase");

    const first = new MemoryEventStore(adapter);
    await first.load();
    await first.put([studyEvent("a"), studyEvent("b")]);

    // What sits on disk must not contain the plaintext.
    const raw = await storage.read();
    expect(raw).toBeTruthy();
    expect(raw!).not.toMatch(/revise\.attempt/);

    const second = new MemoryEventStore(createEncryptedAdapter(storage, "passphrase"));
    await second.load();
    expect(second.size).toBe(2);
    expect(second.all()[0]!.type).toBe("revise.attempt");
  });

  it("cannot be read back with the wrong passphrase", async () => {
    const storage = createMemoryBlobStorage();
    const first = new MemoryEventStore(createEncryptedAdapter(storage, "right"));
    await first.load();
    await first.put([studyEvent("a")]);

    const second = new MemoryEventStore(createEncryptedAdapter(storage, "wrong"));
    await expect(second.load()).rejects.toThrow(/Could not decrypt/);
  });

  it("rehydrates the event store through Pulse.load() from an encrypted adapter", async () => {
    const storage = createMemoryBlobStorage();
    const adapter = () => createEncryptedAdapter(storage, "passphrase");

    const first = await createSyntheticPulse({ days: 60, seed: "reload-events", adapter: adapter() });
    const before = first.pulse.events({ includeSensitive: true });
    expect(before.length).toBeGreaterThan(100);

    // A fresh boot over the same storage: the deterministic backfill replays
    // as duplicates (so nothing is rewritten), and load() restores the
    // encrypted snapshot — the events survive the reload untouched.
    const second = await createSyntheticPulse({ days: 60, seed: "reload-events", adapter: adapter() });
    await second.pulse.load();
    const after = second.pulse.events({ includeSensitive: true });
    expect(after).toHaveLength(before.length);
    expect(after[0]).toEqual(before[0]);
    expect(after.at(-1)).toEqual(before.at(-1));

    // The on-disk blob is ciphertext, never the event stream.
    const raw = await storage.read();
    expect(raw).toBeTruthy();
    expect(raw!).not.toMatch(/revise\.attempt/);
    expect(raw!).not.toMatch(/reload-events/);
  });

  it("stores the insight history encrypted and rehydrates it transparently", async () => {
    const storage = createMemoryBlobStorage();
    const snapshot: InsightHistorySnapshot = {
      version: 1,
      scans: [
        {
          at: "2025-07-01T00:00:00.000Z",
          scanId: "scan-abcdef123456",
          eventCount: 100,
          findings: [],
          rejected: [],
          totals: { findings: 0, rejected: 40, familySize: 40, familyCount: 3, expectedFalseDiscoveries: 0.2 },
        },
      ],
    };

    await createEncryptedBlobAdapter<InsightHistorySnapshot>(storage, "passphrase").save(snapshot);

    // What sits on disk must not contain the plaintext.
    const raw = await storage.read();
    expect(raw).toBeTruthy();
    expect(raw!).not.toMatch(/scan-abcdef123456/);

    const restored = await createEncryptedBlobAdapter<InsightHistorySnapshot>(storage, "passphrase").load();
    expect(restored).toEqual(snapshot);
  });

  it("cannot read the insight history back with the wrong passphrase", async () => {
    const storage = createMemoryBlobStorage();
    await createEncryptedBlobAdapter<InsightHistorySnapshot>(storage, "right").save({ version: 1, scans: [] });

    await expect(createEncryptedBlobAdapter<InsightHistorySnapshot>(storage, "wrong").load()).rejects.toThrow(
      /Could not decrypt/,
    );
  });

  it("stores the causal library encrypted and rehydrates it transparently", async () => {
    const storage = createMemoryBlobStorage();
    const snapshot: CausalLibrarySnapshot = {
      version: 1,
      entries: [
        {
          id: "lib-abcdef123456",
          statement: "Evening study improves my recall.",
          cause: "evening study",
          effect: "recall",
          direction: "increase",
          outcomeMetricId: null,
          exposureMetricId: null,
          origin: "user",
          hypothesisId: null,
          createdAt: "2025-07-01T00:00:00.000Z",
          updatedAt: "2025-07-01T00:00:00.000Z",
          standing: "untested",
          standingNote: "Added to the library",
          standingHistory: [{ standing: "untested", at: "2025-07-01T00:00:00.000Z", note: "Added to the library" }],
          evidence: [],
          notes: "",
          tags: [],
        },
      ],
    };

    await createEncryptedBlobAdapter<CausalLibrarySnapshot>(storage, "passphrase").save(snapshot);

    // What sits on disk must not contain the plaintext.
    const raw = await storage.read();
    expect(raw).toBeTruthy();
    expect(raw!).not.toMatch(/Evening study improves/);

    const restored = await createEncryptedBlobAdapter<CausalLibrarySnapshot>(storage, "passphrase").load();
    expect(restored).toEqual(snapshot);
  });

  it("cannot read the causal library back with the wrong passphrase", async () => {
    const storage = createMemoryBlobStorage();
    await createEncryptedBlobAdapter<CausalLibrarySnapshot>(storage, "right").save({ version: 1, entries: [] });

    await expect(createEncryptedBlobAdapter<CausalLibrarySnapshot>(storage, "wrong").load()).rejects.toThrow(
      /Could not decrypt/,
    );
  });

  it("stores finding corrections encrypted and rehydrates them transparently", async () => {
    const storage = createMemoryBlobStorage();
    const snapshot: FeedbackSnapshot = {
      entries: [{ targetId: "finding-private", verdict: "not-useful", at: "2025-07-01T00:00:00Z", metricIds: ["study.accuracy"] }],
      dismissed: ["finding-private"],
      mutedTopics: ["study.accuracy"],
    };
    const adapter = createEncryptedBlobAdapter<FeedbackSnapshot>(storage, "passphrase");
    await adapter.save(snapshot);
    const raw = await storage.read();
    expect(raw).toBeTruthy();
    expect(raw!).not.toMatch(/finding-private|not-useful|study\.accuracy/);
    await expect(adapter.load()).resolves.toEqual(snapshot);
  });
});
