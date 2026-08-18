import { describe, expect, it } from "vitest";
import {
  CURRENT_SOURCE_HISTORY_VERSION,
  SOURCE_HISTORY_FORMAT,
  createSourceHistory,
  migrateSourceHistory,
  readSourceHistoryRecords,
} from "../src/events/source-history.js";

describe("cross-app source history contract", () => {
  it("writes the current versioned envelope", () => {
    const envelope = createSourceHistory("rapport", "2.0.0", [{ id: "d1" }], "2026-08-17T12:00:00.000Z");
    expect(envelope).toEqual({
      format: SOURCE_HISTORY_FORMAT,
      schemaVersion: CURRENT_SOURCE_HISTORY_VERSION,
      source: "rapport",
      connectorVersion: "2.0.0",
      generatedAt: "2026-08-17T12:00:00.000Z",
      records: [{ id: "d1" }],
      cursor: null,
    });
  });

  it("migrates legacy arrays and v1 envelopes", () => {
    expect(readSourceHistoryRecords<{ id: string }>([{ id: "legacy" }], "rapport")).toEqual([{ id: "legacy" }]);
    const migrated = migrateSourceHistory(
      {
        format: SOURCE_HISTORY_FORMAT,
        schemaVersion: 1,
        source: "rapport",
        records: [{ id: "v1" }],
      },
      "rapport",
    );
    expect(migrated.schemaVersion).toBe(CURRENT_SOURCE_HISTORY_VERSION);
    expect(migrated.connectorVersion).toBe("0.0.0");
    expect(migrated.records).toEqual([{ id: "v1" }]);
  });

  it("fails closed on a future or unexpected source", () => {
    expect(() => migrateSourceHistory({ format: SOURCE_HISTORY_FORMAT, schemaVersion: 99, source: "rapport", records: [] }, "rapport"))
      .toThrow(/only understands up to/);
    expect(readSourceHistoryRecords({ format: SOURCE_HISTORY_FORMAT, schemaVersion: 2, source: "revise", records: [] }, "rapport"))
      .toEqual([]);
  });
});
