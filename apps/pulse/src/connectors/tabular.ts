/**
 * The generic CSV / JSON importer.
 *
 * Every other connector knows the shape of its source. This one does not, so
 * the user supplies the shape as a mapping and Pulse's job is to be honest
 * about what it could and could not read.
 *
 * The design rule here is *no silent coercion*. An importer that turns "n/a"
 * into 0, or a European decimal comma into a thousands separator, produces a
 * file that imports cleanly and a dataset that is quietly wrong — and the user
 * has no way to notice, because there is no error to see. So every value that
 * cannot be read exactly is rejected with a row number and a reason, and the
 * whole import is previewable before a single event is stored.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, EmittedMetricSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import type { AttributeValue, EventCategory } from "../events/schema.js";
import { toInstant } from "../events/time.js";
import { stampLocalHour } from "./health-events.js";

export type TabularRow = Record<string, unknown>;

/** Strips a UTF-8 BOM, which spreadsheet exports add and `Number()` chokes on. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * RFC 4180 CSV parsing: quoted fields may contain the delimiter, newlines and
 * doubled quotes. Hand-rolled because the alternative is a dependency in a
 * package that currently has two, and because the edge cases that matter
 * (a note field containing a comma, a Windows export with CRLF) are the ones a
 * naive `split(",")` gets wrong.
 */
export function parseCsv(text: string, delimiter = ","): { headers: string[]; rows: TabularRow[] } {
  const source = stripBom(text);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [headerRow, ...bodyRows] = records;
  if (!headerRow) return { headers: [], rows: [] };
  const headers = headerRow.map((header) => header.trim());

  const rows: TabularRow[] = [];
  for (const values of bodyRows) {
    // A trailing newline produces one empty record; that is formatting, not data.
    if (values.length === 1 && values[0]!.trim() === "") continue;
    const row: TabularRow = {};
    headers.forEach((header, position) => {
      row[header] = values[position] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** Accepts a JSON array of objects or newline-delimited JSON. */
export function parseJsonRecords(text: string): TabularRow[] {
  const trimmed = stripBom(text).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of objects");
    return parsed.map(asRow);
  }
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => asRow(JSON.parse(line)));
}

function asRow(candidate: unknown): TabularRow {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new Error("Every record must be a JSON object");
  }
  return candidate as TabularRow;
}

export type TimestampFormat = "iso" | "epoch-ms" | "epoch-s" | "date-only";

export interface MetricMapping {
  column: string;
  /** Key the metric takes in `event.metrics`. */
  key: string;
  unit: EmittedMetricSpec["unit"];
  description?: string;
  range?: { min: number; max: number };
  /** Multiplier applied after parsing, e.g. 1/100 for a column stored as a percentage. */
  scale?: number;
  /** When false, a row missing this column is rejected rather than imported without it. */
  optional?: boolean;
}

export interface AttributeMapping {
  column: string;
  key: string;
}

export interface ImportMapping {
  /** Namespaced event type, e.g. `import.mood`. */
  eventType: string;
  category: EventCategory;
  /** Human name for the dataset, shown on the connector card. */
  datasetName: string;
  timestampColumn: string;
  timestampFormat?: TimestampFormat;
  /** Local hour to assume when the column carries a date with no time. */
  assumedHour?: number;
  /** Column holding a stable id. Without one, rows are keyed by their content. */
  idColumn?: string;
  subjectColumn?: string;
  metrics: MetricMapping[];
  attributes?: AttributeMapping[];
  timezone?: string;
}

const IMPORT_TYPE_RE = /^import\.[a-z0-9-]+$/;

export interface RowProblem {
  /** 1-based row number as it appears in the file, header excluded. */
  row: number;
  column: string | null;
  reason: string;
}

export interface ImportPreview {
  datasetName: string;
  eventType: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  problems: RowProblem[];
  /** First few events, so the user can see what they are agreeing to import. */
  sample: RawEventInput[];
  /** Columns in the file that the mapping ignores. */
  unmappedColumns: string[];
  /** Mapped columns that are empty in every row. */
  emptyColumns: string[];
  firstEventAt: string | null;
  lastEventAt: string | null;
}

/**
 * Reads one cell as a number, or explains why it could not.
 *
 * Blank is not zero and "n/a" is not zero. Distinguishing "measured as nothing"
 * from "not measured" is the whole basis of the completeness score, so a blank
 * returns `null` (absent) while an unparseable value returns an error.
 */
export function parseNumericCell(value: unknown): { value: number | null; error: string | null } {
  if (value === null || value === undefined) return { value: null, error: null };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, error: null } : { value: null, error: "is not a finite number" };
  }
  if (typeof value === "boolean") return { value: value ? 1 : 0, error: null };
  if (typeof value !== "string") return { value: null, error: "is not a number" };

  const trimmed = value.trim();
  if (trimmed === "") return { value: null, error: null };
  if (/^(n\/a|na|null|nil|-|—|unknown)$/i.test(trimmed)) return { value: null, error: null };

  const percent = trimmed.endsWith("%");
  const body = percent ? trimmed.slice(0, -1).trim() : trimmed;
  // Deliberately narrow: no thousands separators, no decimal commas. Guessing
  // which convention a file uses is how "1,234" becomes 1.234.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(body)) {
    return { value: null, error: `is not a plain number ("${trimmed}")` };
  }
  const parsed = Number(body);
  if (!Number.isFinite(parsed)) return { value: null, error: `is not a finite number ("${trimmed}")` };
  return { value: percent ? parsed / 100 : parsed, error: null };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_PLAUSIBLE_MS = Date.UTC(1900, 0, 1);
const LATEST_PLAUSIBLE_MS = Date.UTC(2200, 0, 1);

export function parseTimestampCell(
  value: unknown,
  format: TimestampFormat,
  assumedHour: number,
): { value: string | null; estimated: boolean; error: string | null } {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return { value: null, estimated: false, error: "is empty" };
  }

  if (format === "epoch-ms" || format === "epoch-s") {
    const numeric = parseNumericCell(value);
    if (numeric.value === null) return { value: null, estimated: false, error: numeric.error ?? "is empty" };
    const ms = format === "epoch-s" ? numeric.value * 1000 : numeric.value;
    // Bounded by plausibility rather than by what `Date` can represent. A
    // milliseconds column mapped as seconds lands tens of thousands of years
    // out — perfectly representable, and obviously not a diary entry.
    if (ms < EARLIEST_PLAUSIBLE_MS || ms > LATEST_PLAUSIBLE_MS) {
      return {
        value: null,
        estimated: false,
        error: `is not a plausible date (${ms}); check the unit on the timestamp column`,
      };
    }
    return { value: new Date(ms).toISOString(), estimated: false, error: null };
  }

  const text = String(value).trim();
  if (format === "date-only") {
    if (!DATE_ONLY_RE.test(text)) return { value: null, estimated: false, error: `is not a YYYY-MM-DD date ("${text}")` };
    return { value: stampLocalHour(text, assumedHour), estimated: true, error: null };
  }

  // `iso`, the default, also accepts a bare date so a mixed column still lands.
  if (DATE_ONLY_RE.test(text)) return { value: stampLocalHour(text, assumedHour), estimated: true, error: null };
  try {
    // A bad cell is one row's problem, not the import's — `toInstant` throws,
    // and letting that escape would abandon the other 900 rows.
    return { value: new Date(toInstant(text)).toISOString(), estimated: false, error: null };
  } catch {
    return { value: null, estimated: false, error: `is not a readable date ("${text}")` };
  }
}

function toAttributeValue(value: unknown): AttributeValue | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return null;
}

/** Turns one row into an event, or explains why it could not. */
function mapRow(
  row: TabularRow,
  rowNumber: number,
  mapping: ImportMapping,
): { event: RawEventInput | null; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const assumedHour = mapping.assumedHour ?? 12;

  const stamp = parseTimestampCell(row[mapping.timestampColumn], mapping.timestampFormat ?? "iso", assumedHour);
  if (!stamp.value) {
    problems.push({ row: rowNumber, column: mapping.timestampColumn, reason: stamp.error ?? "is empty" });
    return { event: null, problems };
  }

  const metrics: Record<string, number> = {};
  for (const metric of mapping.metrics) {
    const cell = parseNumericCell(row[metric.column]);
    if (cell.error) {
      problems.push({ row: rowNumber, column: metric.column, reason: cell.error });
      continue;
    }
    if (cell.value === null) {
      if (metric.optional === false) {
        problems.push({ row: rowNumber, column: metric.column, reason: "is required but empty" });
      }
      continue;
    }
    const scaled = cell.value * (metric.scale ?? 1);
    if (metric.range && (scaled < metric.range.min || scaled > metric.range.max)) {
      problems.push({
        row: rowNumber,
        column: metric.column,
        reason: `value ${scaled} is outside the declared range ${metric.range.min}..${metric.range.max}`,
      });
      continue;
    }
    metrics[metric.key] = scaled;
  }

  if (Object.keys(metrics).length === 0) {
    problems.push({ row: rowNumber, column: null, reason: "carries no readable measurements" });
    return { event: null, problems };
  }

  const attributes: Record<string, AttributeValue> = {
    dataset: mapping.eventType,
    time_estimated: stamp.estimated,
  };
  for (const attribute of mapping.attributes ?? []) {
    const value = toAttributeValue(row[attribute.column]);
    if (value !== null) attributes[attribute.key] = value;
  }

  const subject = mapping.subjectColumn ? toAttributeValue(row[mapping.subjectColumn]) : null;
  const id = mapping.idColumn ? toAttributeValue(row[mapping.idColumn]) : null;

  const event: RawEventInput = {
    source: "file-import",
    type: mapping.eventType,
    category: mapping.category,
    occurredAt: stamp.value,
    ...(mapping.timezone ? { timezone: mapping.timezone } : {}),
    ...(id !== null ? { sourceEventId: `${mapping.eventType}:${String(id)}` } : {}),
    ...(subject !== null ? { subject: String(subject) } : {}),
    metrics,
    attributes,
  };
  // Without an id column, identity is the row's own content — so re-importing
  // the same file is a no-op, while a corrected row imports as a new event.
  if (id === null) event.naturalKey = { type: mapping.eventType, occurredAt: stamp.value, metrics };

  return { event, problems };
}

export function assertValidMapping(mapping: ImportMapping): void {
  if (!IMPORT_TYPE_RE.test(mapping.eventType)) {
    throw new Error(`Import event type must look like "import.sleep-diary" (received "${mapping.eventType}")`);
  }
  if (mapping.metrics.length === 0) {
    throw new Error("An import mapping must map at least one numeric column");
  }
  const keys = new Set<string>();
  for (const metric of mapping.metrics) {
    if (keys.has(metric.key)) throw new Error(`Metric key "${metric.key}" is mapped twice`);
    keys.add(metric.key);
  }
}

/**
 * Dry run. Nothing is stored, so the user can see the damage before agreeing
 * to it — including which of their columns Pulse is ignoring, which is the
 * mistake people actually make when mapping a file by hand.
 */
export function previewImport(rows: readonly TabularRow[], mapping: ImportMapping, sampleSize = 5): ImportPreview {
  assertValidMapping(mapping);

  const problems: RowProblem[] = [];
  const sample: RawEventInput[] = [];
  let accepted = 0;
  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;

  rows.forEach((row, index) => {
    const result = mapRow(row, index + 1, mapping);
    problems.push(...result.problems);
    if (!result.event) return;
    accepted += 1;
    if (sample.length < sampleSize) sample.push(result.event);
    const at = String(result.event.occurredAt);
    if (!firstEventAt || at < firstEventAt) firstEventAt = at;
    if (!lastEventAt || at > lastEventAt) lastEventAt = at;
  });

  const mappedColumns = new Set<string>([
    mapping.timestampColumn,
    ...mapping.metrics.map((metric) => metric.column),
    ...(mapping.attributes ?? []).map((attribute) => attribute.column),
    ...(mapping.subjectColumn ? [mapping.subjectColumn] : []),
    ...(mapping.idColumn ? [mapping.idColumn] : []),
  ]);
  const present = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) present.add(key);

  const emptyColumns = [...mappedColumns].filter(
    (column) => present.has(column) && rows.every((row) => toAttributeValue(row[column]) === null),
  );

  return {
    datasetName: mapping.datasetName,
    eventType: mapping.eventType,
    totalRows: rows.length,
    accepted,
    rejected: rows.length - accepted,
    problems,
    sample,
    unmappedColumns: [...present].filter((column) => !mappedColumns.has(column)).sort(),
    emptyColumns: emptyColumns.sort(),
    firstEventAt,
    lastEventAt,
  };
}

function emitsFor(mapping: ImportMapping): EmittedEventSpec[] {
  return [
    {
      type: mapping.eventType,
      category: mapping.category,
      description: mapping.datasetName,
      metrics: mapping.metrics.map((metric) => ({
        key: metric.key,
        unit: metric.unit,
        description: metric.description ?? `${metric.key.replace(/_/g, " ")} from ${mapping.datasetName}`,
        ...(metric.range ? { range: metric.range } : {}),
      })),
    },
  ];
}

const SCOPES: ConnectorScope[] = [
  {
    id: "imported-file",
    description: "A file you chose to import. Pulse reads only the columns you mapped, and nothing leaves your device.",
    readsContent: false,
  },
];

/**
 * A connector over already-parsed rows.
 *
 * Rows that fail to map are skipped with a warning rather than aborting the
 * import: one malformed line in a three-year export should cost that line, not
 * the export. `previewImport` is where the user sees the full tally.
 */
export function createFileImportConnector(rows: readonly TabularRow[], mapping: ImportMapping): Connector {
  assertValidMapping(mapping);

  const indexed = rows.map((row, index) => ({ row, index }));
  const timestampOf = (entry: { row: TabularRow; index: number }): string => {
    const stamp = parseTimestampCell(
      entry.row[mapping.timestampColumn],
      mapping.timestampFormat ?? "iso",
      mapping.assumedHour ?? 12,
    );
    // Unreadable rows sort to the epoch and are dropped by `map` with a warning.
    return stamp.value ?? new Date(0).toISOString();
  };

  const reader: SourceReader<{ row: TabularRow; index: number }> = {
    async read(since, limit) {
      const cutoff = since ? toInstant(since) : -Infinity;
      const matching = indexed.filter((entry) => toInstant(timestampOf(entry)) >= cutoff);
      return { records: matching.slice(0, limit), hasMore: matching.length > limit };
    },
    async probe() {
      const last = indexed[indexed.length - 1];
      return {
        ok: indexed.length > 0,
        message: indexed.length > 0 ? `${indexed.length} rows imported` : "The file contained no rows",
        latestAt: last ? timestampOf(last) : null,
      };
    },
  };

  return defineReaderConnector<{ row: TabularRow; index: number }>({
    id: "file-import",
    name: mapping.datasetName,
    version: "1.0.0",
    category: mapping.category,
    description: `Imported from a file you supplied: ${mapping.datasetName}.`,
    scopes: SCOPES,
    emits: emitsFor(mapping),
    maxBackfillDays: 3650,
    // A file is a one-off. Judging it stale after a fortnight would put a
    // permanent warning on a perfectly good historical import.
    cadence: "irregular",
    reader,
    map: (entry) => {
      const result = mapRow(entry.row, entry.index + 1, mapping);
      if (!result.event) {
        throw new Error(
          result.problems.map((problem) => `row ${problem.row}: ${problem.column ?? "row"} ${problem.reason}`).join("; "),
        );
      }
      return [result.event];
    },
    timestampOf,
  });
}
