import { describe, expect, it } from "vitest";
import { createForqSameOriginConnector, FORQ_PULSE_OPT_IN_KEY } from "../src/connectors/forq.js";
import { createFrenchSameOriginConnector, FRENCH_PULSE_OPT_IN_KEY } from "../src/connectors/french.js";
import { createRapportSameOriginConnector, RAPPORT_PULSE_OPT_IN_KEY } from "../src/connectors/rapport.js";
import { SyncEngine } from "../src/connectors/sync.js";
import { ConsentRegistry } from "../src/privacy/consent.js";
import { deleteSource } from "../src/privacy/export.js";
import { MemoryEventStore } from "../src/events/store.js";
import type { Connector } from "../src/connectors/types.js";

const envelope = (source: string, records: unknown[]) => JSON.stringify({
  format: "le-studio.source-history",
  schemaVersion: 2,
  source,
  connectorVersion: "2.0.0",
  generatedAt: "2026-08-17T12:00:00.000Z",
  records,
  cursor: null,
});

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

async function syncAndRevoke(connector: Connector, store: MemoryEventStore, consent: ConsentRegistry) {
  consent.grant(connector);
  const engine = new SyncEngine(store, consent);
  const report = await engine.sync(connector, { timezone: "UTC", now: () => Date.parse("2026-08-17T12:00:00.000Z") });
  expect(report.error).toBeUndefined();
  expect(report.inserted).toBeGreaterThan(0);
  const source = connector.id;
  const revocation = await deleteSource(store, consent, source, {}, () => Date.parse("2026-08-17T12:00:00.000Z"));
  expect(revocation.consentRevoked).toBe(true);
  expect(revocation.eventsDeleted).toBeGreaterThan(0);
  const denied = await engine.sync(connector, { timezone: "UTC", now: () => Date.parse("2026-08-17T12:00:00.000Z") });
  expect(denied.error).toMatch(/No consent/);
  expect(store.query({ sources: [source], includeSensitive: true })).toHaveLength(0);
}

describe("ecosystem integration and consent revocation", () => {
  it("runs French Practice end to end and removes its events on revocation", async () => {
    const connector = createFrenchSameOriginConnector({
      storage: storage({
        "fp.pulse-history.v2": envelope("le-studio-french", [
          { kind: "review", id: "r1", reviewedAt: "2026-08-16T12:00:00.000Z", itemId: "bonjour", skill: "vocab", correct: true, elapsedMs: 1000 },
        ]),
        [FRENCH_PULSE_OPT_IN_KEY]: "1",
      }),
    });
    await syncAndRevoke(connector, new MemoryEventStore(), new ConsentRegistry(() => Date.parse("2026-08-17T12:00:00.000Z")));
  });

  it("covers Rapport and Forq through the same engine path", async () => {
    const rapport = createRapportSameOriginConnector({
      storage: storage({
        "rapport.pulse-history.v2": envelope("rapport", [
          { kind: "challenge", id: "c1", completedAt: "2026-08-16T12:00:00.000Z", skillId: "listening", completed: true, comfort: 3 },
        ]),
        [RAPPORT_PULSE_OPT_IN_KEY]: "1",
      }),
    });
    const forq = createForqSameOriginConnector({
      storage: storage({
        "forq-state-v2": JSON.stringify({ day: "2026-08-17", plan: { "2026-08-16": { dinner: "pasta" } }, cooked: [{ recipeId: "pasta", date: "2026-08-16" }], shops: [] }),
        [FORQ_PULSE_OPT_IN_KEY]: "1",
      }),
    });
    await syncAndRevoke(rapport, new MemoryEventStore(), new ConsentRegistry());
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry();
    consent.grant(forq);
    const report = await new SyncEngine(store, consent).sync(forq, { timezone: "UTC" });
    expect(report.inserted).toBeGreaterThan(0);
  });
});
