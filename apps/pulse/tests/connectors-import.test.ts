/**
 * The generic file importer.
 *
 * The theme running through these: an import that *looks* clean and is quietly
 * wrong is the failure worth engineering against. A rejected row announces
 * itself; a "1,234" silently read as 1.234 does not.
 */

import { describe, expect, it } from "vitest";
import {
  assertValidMapping,
  createFileImportConnector,
  parseCsv,
  parseJsonRecords,
  parseNumericCell,
  parseTimestampCell,
  previewImport,
  type ImportMapping,
} from "../src/connectors/tabular.js";

const mapping: ImportMapping = {
  eventType: "import.sleep-diary",
  category: "wellbeing",
  datasetName: "Sleep diary",
  timestampColumn: "date",
  timestampFormat: "date-only",
  assumedHour: 8,
  metrics: [
    { column: "quality", key: "diary_quality", unit: "score", range: { min: 0, max: 10 } },
    { column: "hours", key: "diary_hours", unit: "count", range: { min: 0, max: 24 } },
  ],
  attributes: [{ column: "location", key: "location" }],
};

describe("CSV parsing", () => {
  it("keeps a delimiter that lives inside a quoted field", () => {
    const { headers, rows } = parseCsv('date,note\n2025-06-10,"slept badly, woke at 3"');
    expect(headers).toEqual(["date", "note"]);
    expect(rows[0]!.note).toBe("slept badly, woke at 3");
  });

  it("unescapes doubled quotes", () => {
    const { rows } = parseCsv('a\n"he said ""fine"""');
    expect(rows[0]!.a).toBe('he said "fine"');
  });

  it("keeps a newline that lives inside a quoted field", () => {
    const { rows } = parseCsv('a,b\n"line one\nline two",2');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toBe("line one\nline two");
  });

  it("handles CRLF and a byte-order mark, which is what a spreadsheet export looks like", () => {
    const { headers, rows } = parseCsv("﻿date,quality\r\n2025-06-10,7\r\n");
    expect(headers).toEqual(["date", "quality"]);
    expect(rows).toEqual([{ date: "2025-06-10", quality: "7" }]);
  });

  it("does not turn a trailing newline into an empty row", () => {
    expect(parseCsv("a\n1\n2\n").rows).toHaveLength(2);
  });

  it("pads a short row rather than shifting its columns", () => {
    const { rows } = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("JSON parsing", () => {
  it("reads an array of objects", () => {
    expect(parseJsonRecords('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reads newline-delimited JSON", () => {
    expect(parseJsonRecords('{"a":1}\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("refuses a bare array of values, which has no columns to map", () => {
    expect(() => parseJsonRecords("[1,2,3]")).toThrow(/must be a JSON object/);
  });
});

describe("reading a numeric cell", () => {
  it("distinguishes not measured from measured as zero", () => {
    expect(parseNumericCell("")).toEqual({ value: null, error: null });
    expect(parseNumericCell("n/a")).toEqual({ value: null, error: null });
    expect(parseNumericCell("0")).toEqual({ value: 0, error: null });
  });

  it("refuses a thousands separator rather than guessing the convention", () => {
    // "1,234" is 1234 to one reader and 1.234 to another. Guessing is how an
    // import comes out a thousand times too small and nobody notices.
    expect(parseNumericCell("1,234").error).toMatch(/not a plain number/);
    expect(parseNumericCell("1.234").value).toBe(1.234);
  });

  it("reads a percentage as a fraction", () => {
    expect(parseNumericCell("87%").value).toBeCloseTo(0.87, 10);
  });

  it("refuses text that merely contains a number", () => {
    expect(parseNumericCell("7 hours").error).toMatch(/not a plain number/);
  });
});

describe("reading a timestamp cell", () => {
  it("marks a date with no clock time as estimated", () => {
    const result = parseTimestampCell("2025-06-10", "date-only", 8);
    expect(result.value).toBe("2025-06-10T08:00:00.000Z");
    expect(result.estimated).toBe(true);
  });

  it("reads epoch seconds and milliseconds", () => {
    expect(parseTimestampCell(1_749_513_600, "epoch-s", 8).value).toBe("2025-06-10T00:00:00.000Z");
    expect(parseTimestampCell(1_749_513_600_000, "epoch-ms", 8).value).toBe("2025-06-10T00:00:00.000Z");
  });

  it("catches a seconds column mapped as milliseconds", () => {
    expect(parseTimestampCell(1_749_513_600_000, "epoch-s", 8).error).toMatch(/not a plausible date/);
  });

  it("reports an unreadable date instead of throwing the import away", () => {
    expect(parseTimestampCell("last tuesday", "iso", 8).error).toMatch(/not a readable date/);
  });
});

describe("previewing an import", () => {
  const rows = [
    { date: "2025-06-10", quality: "7", hours: "7.5", location: "home", mood: "fine" },
    { date: "2025-06-11", quality: "8", hours: "8", location: "home", mood: "good" },
    { date: "not a date", quality: "6", hours: "7", location: "home", mood: "" },
    { date: "2025-06-13", quality: "1,0", hours: "", location: "away", mood: "" },
    { date: "2025-06-14", quality: "", hours: "", location: "away", mood: "" },
    { date: "2025-06-15", quality: "70", hours: "8", location: "home", mood: "" },
  ];

  const preview = previewImport(rows, mapping);

  it("counts what it could and could not read", () => {
    // Rows 1, 2 and 6 land; row 6 loses its out-of-range quality but keeps hours.
    expect(preview.accepted).toBe(3);
    expect(preview.rejected).toBe(3);
    expect(preview.totalRows).toBe(6);
  });

  it("names the row and column behind every problem", () => {
    expect(preview.problems).toContainEqual({ row: 3, column: "date", reason: expect.stringContaining("not a YYYY-MM-DD date") });
    expect(preview.problems).toContainEqual({ row: 4, column: "quality", reason: expect.stringContaining("not a plain number") });
    expect(preview.problems).toContainEqual({ row: 5, column: null, reason: "carries no readable measurements" });
  });

  it("rejects a value outside its declared range instead of importing an impossible reading", () => {
    expect(preview.problems).toContainEqual({
      row: 6,
      column: "quality",
      reason: expect.stringContaining("outside the declared range 0..10"),
    });
  });

  it("names the columns the mapping is ignoring", () => {
    // The mistake people actually make is mapping four of five columns and
    // never noticing the fifth.
    expect(preview.unmappedColumns).toEqual(["mood"]);
  });

  it("reports the span the file covers", () => {
    expect(preview.firstEventAt).toBe("2025-06-10T08:00:00.000Z");
    expect(preview.lastEventAt).toBe("2025-06-15T08:00:00.000Z");
  });

  it("stores nothing — a preview is a dry run", () => {
    expect(preview.sample.length).toBeLessThanOrEqual(5);
    for (const event of preview.sample) expect(event.source).toBe("file-import");
  });

  it("flags a mapped column that is empty in every row", () => {
    const empty = previewImport(
      [{ date: "2025-06-10", quality: "7", hours: "" }],
      { ...mapping, attributes: [] },
    );
    expect(empty.emptyColumns).toEqual(["hours"]);
  });
});

describe("the import connector", () => {
  it("reads accepted rows and skips broken ones with a warning", async () => {
    const connector = createFileImportConnector(
      [
        { date: "2025-06-10", quality: "7", hours: "7.5" },
        { date: "nonsense", quality: "6", hours: "7" },
      ],
      mapping,
    );
    const page = await connector.fetch({ since: null, cursor: null, timezone: "Europe/London", mode: "live" });
    expect(page.records).toHaveLength(1);
    expect(page.warnings?.[0]).toMatch(/row 2: date is not a YYYY-MM-DD date/);
  });

  it("gives identical rows a content-derived identity, so re-importing a file changes nothing", async () => {
    const rows = [{ date: "2025-06-10", quality: "7", hours: "7.5" }];
    const first = await createFileImportConnector(rows, mapping).fetch({
      since: null,
      cursor: null,
      timezone: "Europe/London",
      mode: "live",
    });
    const second = await createFileImportConnector(rows, mapping).fetch({
      since: null,
      cursor: null,
      timezone: "Europe/London",
      mode: "live",
    });
    expect(first.records[0]!.naturalKey).toEqual(second.records[0]!.naturalKey);
  });

  it("uses an id column when the file has one", async () => {
    const withIds = createFileImportConnector([{ date: "2025-06-10", quality: "7", entry_id: "e-1" }], {
      ...mapping,
      idColumn: "entry_id",
    });
    const page = await withIds.fetch({ since: null, cursor: null, timezone: "Europe/London", mode: "live" });
    expect(page.records[0]!.sourceEventId).toBe("import.sleep-diary:e-1");
    expect(page.records[0]!.naturalKey).toBeUndefined();
  });

  it("never claims a one-off file has gone stale", () => {
    expect(createFileImportConnector([], mapping).cadence).toBe("irregular");
  });
});

describe("mapping validation", () => {
  it("requires a namespaced import type", () => {
    expect(() => assertValidMapping({ ...mapping, eventType: "sleepdiary" })).toThrow(/import\.sleep-diary/);
  });

  it("requires at least one numeric column", () => {
    expect(() => assertValidMapping({ ...mapping, metrics: [] })).toThrow(/at least one numeric column/);
  });

  it("refuses two columns mapped onto the same metric key", () => {
    expect(() =>
      assertValidMapping({
        ...mapping,
        metrics: [
          { column: "a", key: "same", unit: "score" },
          { column: "b", key: "same", unit: "score" },
        ],
      }),
    ).toThrow(/mapped twice/);
  });
});
