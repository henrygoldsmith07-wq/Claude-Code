/**
 * Connector SDK — contract types.
 *
 * A connector's only job is to turn one app's records into `RawEventInput`s.
 * It never touches the store, never decides what is sensitive, never computes
 * a local date, and never talks to the analytics layer. That narrowness is
 * what makes a third-party connector safe to add.
 */

import type { RawEventInput } from "../events/normalise.js";
import type { EventCategory, Sensitivity, SourceId } from "../events/schema.js";

/** A named capability the user consents to, shown verbatim in the permission dialog. */
export interface ConnectorScope {
  id: string;
  /** Plain-language description — this is the consent copy, so no jargon. */
  description: string;
  /** Whether this scope can pull free-text or otherwise personal content. */
  readsContent: boolean;
}

/** The metrics a connector promises to emit. Enforced by contract tests. */
export interface EmittedMetricSpec {
  /** Metric key as it appears in `event.metrics`. */
  key: string;
  unit:
    | "count"
    | "ratio"
    | "ms"
    | "minutes"
    | "score"
    | "kg"
    | "reps"
    | "level"
    /** Beats per minute. Kept distinct from `count` so a heart rate is never summed. */
    | "bpm"
    /** Breaths per minute and similar per-minute rates. */
    | "per-minute"
    /** Degrees Celsius, or a deviation in them. */
    | "celsius"
    | "kcal"
    /** Metres. */
    | "m";
  description: string;
  /** Inclusive bounds used by the quality scorer to spot impossible values. */
  range?: { min: number; max: number };
}

export interface EmittedEventSpec {
  type: string;
  category: EventCategory;
  description: string;
  metrics: EmittedMetricSpec[];
}

export interface SyncRequest {
  /** Only fetch records at or after this instant. Null on a first sync. */
  since: string | null;
  /** Opaque connector-owned position from the previous run. */
  cursor: string | null;
  /** Zone to stamp on records that carry no zone of their own. */
  timezone: string;
  mode: "live" | "backfill";
  /** Soft cap on records per page. */
  limit?: number;
}

export interface SyncPage {
  records: RawEventInput[];
  /** Cursor to resume from. Null means "fully caught up". */
  cursor: string | null;
  hasMore: boolean;
  /** Non-fatal problems worth surfacing on the connector health card. */
  warnings?: string[];
}

/**
 * How often a healthy source is expected to produce data.
 *
 * Freshness is meaningless without it: a sleep source silent for three days is
 * broken, while a weekly review source silent for three days is fine. Judging
 * both against one global staleness threshold produces either false alarms or
 * silent gaps, so the connector declares its own cadence.
 */
export type SyncCadence = "continuous" | "daily" | "weekly" | "irregular";

export type HealthStatus = "healthy" | "degraded" | "failing" | "unknown";

export interface HealthReport {
  status: HealthStatus;
  message: string;
  checkedAt: string;
  /** Most recent event the source says it has, for staleness detection. */
  latestSourceEventAt?: string | null;
}

export interface Connector {
  id: SourceId;
  name: string;
  /** Semver. Bumping it lets the store detect events normalised by an older mapping. */
  version: string;
  category: EventCategory;
  description: string;
  scopes: ConnectorScope[];
  /**
   * When true, blanket "connect everything" flows must not enable this
   * connector — the user has to grant it on its own. Reflect sets this.
   */
  requiresExplicitPermission?: boolean;
  /** Default sensitivity for events this connector emits. */
  defaultSensitivity?: Sensitivity;
  /** Declared output contract. */
  emits: EmittedEventSpec[];
  /** How far back a backfill is allowed to reach, in days. */
  maxBackfillDays?: number;
  /** Expected data rhythm, used to judge freshness. Defaults to `irregular`. */
  cadence?: SyncCadence;
  fetch(request: SyncRequest): Promise<SyncPage>;
  healthCheck?(): Promise<HealthReport>;
}

/**
 * The data access seam. Connectors receive one of these rather than making
 * their own network calls, so tests and the synthetic harness can substitute a
 * fixture with no mocking framework.
 */
export interface SourceReader<TRecord> {
  /** Records at or after `since`, oldest first. */
  read(since: string | null, limit: number): Promise<{ records: TRecord[]; hasMore: boolean }>;
  /** Optional liveness probe. */
  probe?(): Promise<{ ok: boolean; message: string; latestAt?: string | null }>;
}

export class ConnectorError extends Error {
  constructor(
    readonly connectorId: string,
    message: string,
    readonly retryable = false,
  ) {
    super(`[${connectorId}] ${message}`);
    this.name = "ConnectorError";
  }
}
