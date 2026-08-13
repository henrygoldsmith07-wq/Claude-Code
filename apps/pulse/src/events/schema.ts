/**
 * The universal event schema — the single shape every connector normalises into.
 *
 * Design rules that the rest of Pulse depends on:
 *  - `metrics` holds numbers only. All statistics read from here and nowhere else.
 *  - `attributes` holds low-cardinality categoricals used for slicing/confounders.
 *  - Free text never enters the analytic path; it lives in `notes` and is
 *    excluded from export-to-AI unless the user opts in per source.
 *  - Every event carries provenance, so any insight can be traced back to the
 *    exact sync that produced its inputs.
 */

export const CURRENT_SCHEMA_VERSION = 2;

/** Sources Pulse knows about. `custom:*` is reserved for connector-SDK apps. */
export const KNOWN_SOURCES = [
  "revise",
  "arise",
  "forq",
  "chrono",
  "le-studio-french",
  "reflect",
  "rapport",
] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];
export type SourceId = KnownSource | (string & {});

export const EVENT_CATEGORIES = [
  "study",
  "exercise",
  "language",
  "focus",
  "schedule",
  "social",
  "reflection",
  "wellbeing",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** `sensitive` events are excluded from AI prompts and telemetry by default. */
export type Sensitivity = "normal" | "sensitive";

export interface Provenance {
  /** Connector that produced the event. */
  connectorId: string;
  /** Connector semver — lets us re-normalise when a mapping bug is fixed. */
  connectorVersion: string;
  /** Sync run that ingested it. */
  syncId: string;
  ingestedAt: string;
  /** `live` = pulled from the source, `backfill` = historical import, `synthetic` = benchmark data. */
  ingestMode: "live" | "backfill" | "synthetic";
  /** Hash of the raw record, so re-normalisation can detect upstream edits. */
  rawHash: string;
}

export type AttributeValue = string | number | boolean;

export interface PulseEvent {
  /** Deterministic id derived from `dedupeKey` — re-syncing yields the same id. */
  id: string;
  schemaVersion: number;
  source: SourceId;
  /** Stable identifier within the source system, when it has one. */
  sourceEventId: string;
  /** Namespaced event type, e.g. `revise.review`. */
  type: string;
  category: EventCategory;
  /** UTC instant the event happened. */
  occurredAt: string;
  /** IANA zone the user was in — required for honest wall-clock analysis. */
  timezone: string;
  /** Local calendar date, derived from occurredAt + timezone. */
  localDate: string;
  /** Minutes since local midnight (0..1439). */
  localMinutes: number;
  /** Local day of week, 0 = Sunday. */
  localDayOfWeek: number;
  durationMs?: number;
  /** What the event was about: topic id, exercise id, language skill. */
  subject?: string;
  metrics: Record<string, number>;
  attributes: Record<string, AttributeValue>;
  /** Free text. Never read by the analytics engine. */
  notes?: string;
  sensitivity: Sensitivity;
  provenance: Provenance;
  dedupeKey: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPE_RE = /^[a-z0-9-]+\.[a-z0-9-]+(\.[a-z0-9-]+)?$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Boundary validation. Deliberately strict about numbers: a NaN or Infinity
 * that reaches the statistics layer poisons every downstream aggregate
 * silently, so it is rejected at ingest instead.
 */
export function validateEvent(candidate: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) => issues.push({ path, message, severity: "error" });
  const warn = (path: string, message: string) =>
    issues.push({ path, message, severity: "warning" });

  if (!isPlainObject(candidate)) {
    return { valid: false, issues: [{ path: "", message: "Event must be an object", severity: "error" }] };
  }
  const e = candidate;

  for (const field of ["id", "source", "sourceEventId", "type", "timezone", "dedupeKey"]) {
    if (typeof e[field] !== "string" || (e[field] as string).length === 0) {
      err(field, `${field} must be a non-empty string`);
    }
  }

  if (typeof e.schemaVersion !== "number" || !Number.isInteger(e.schemaVersion)) {
    err("schemaVersion", "schemaVersion must be an integer");
  } else if (e.schemaVersion > CURRENT_SCHEMA_VERSION) {
    err("schemaVersion", `Event is from a newer schema (v${e.schemaVersion}); upgrade Pulse`);
  }

  if (typeof e.type === "string" && !TYPE_RE.test(e.type)) {
    err("type", `type must be namespaced lowercase, e.g. "revise.review" (received "${e.type}")`);
  }

  if (!EVENT_CATEGORIES.includes(e.category as EventCategory)) {
    err("category", `category must be one of: ${EVENT_CATEGORIES.join(", ")}`);
  }

  if (typeof e.occurredAt !== "string" || !ISO_INSTANT_RE.test(e.occurredAt)) {
    err("occurredAt", "occurredAt must be an ISO-8601 instant with an offset");
  } else if (Number.isNaN(Date.parse(e.occurredAt))) {
    err("occurredAt", "occurredAt is not a real date");
  }

  if (typeof e.localDate !== "string" || !LOCAL_DATE_RE.test(e.localDate)) {
    err("localDate", "localDate must be YYYY-MM-DD");
  }

  if (typeof e.localMinutes !== "number" || e.localMinutes < 0 || e.localMinutes > 1439) {
    err("localMinutes", "localMinutes must be within 0..1439");
  }

  if (typeof e.localDayOfWeek !== "number" || e.localDayOfWeek < 0 || e.localDayOfWeek > 6) {
    err("localDayOfWeek", "localDayOfWeek must be within 0..6");
  }

  if (e.durationMs !== undefined) {
    if (typeof e.durationMs !== "number" || !Number.isFinite(e.durationMs) || e.durationMs < 0) {
      err("durationMs", "durationMs must be a non-negative finite number");
    }
  }

  if (!isPlainObject(e.metrics)) {
    err("metrics", "metrics must be an object of numbers");
  } else {
    for (const [key, value] of Object.entries(e.metrics)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        err(`metrics.${key}`, "Metric values must be finite numbers");
      }
    }
    if (Object.keys(e.metrics).length === 0) warn("metrics", "Event carries no metrics");
  }

  if (!isPlainObject(e.attributes)) {
    err("attributes", "attributes must be an object");
  } else {
    for (const [key, value] of Object.entries(e.attributes)) {
      const t = typeof value;
      if (t !== "string" && t !== "number" && t !== "boolean") {
        err(`attributes.${key}`, "Attribute values must be string, number or boolean");
      }
    }
  }

  if (e.sensitivity !== "normal" && e.sensitivity !== "sensitive") {
    err("sensitivity", 'sensitivity must be "normal" or "sensitive"');
  }

  if (!isPlainObject(e.provenance)) {
    err("provenance", "provenance is required — every event must be traceable");
  } else {
    for (const field of ["connectorId", "connectorVersion", "syncId", "ingestedAt", "rawHash"]) {
      if (typeof e.provenance[field] !== "string" || !(e.provenance[field] as string)) {
        err(`provenance.${field}`, `${field} is required`);
      }
    }
    const mode = e.provenance.ingestMode;
    if (mode !== "live" && mode !== "backfill" && mode !== "synthetic") {
      err("provenance.ingestMode", 'ingestMode must be "live", "backfill" or "synthetic"');
    }
  }

  if (e.notes !== undefined && typeof e.notes !== "string") {
    err("notes", "notes must be a string when present");
  }

  return { valid: issues.every((i) => i.severity !== "error"), issues };
}

export function assertValidEvent(candidate: unknown): PulseEvent {
  const result = validateEvent(candidate);
  if (!result.valid) {
    const detail = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid Pulse event — ${detail}`);
  }
  return candidate as PulseEvent;
}
