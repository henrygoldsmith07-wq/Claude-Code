/**
 * Connector SDK helpers.
 *
 * `defineReaderConnector` is the path every first-party connector takes and
 * the one a third-party connector should take: supply a reader and a pure
 * mapping function, get paging, cursors, health checks and contract
 * conformance for free.
 */

import type { RawEventInput } from "../events/normalise.js";
import { toInstant } from "../events/time.js";
import { stableHash } from "../events/hash.js";
import {
  ConnectorError,
  type Connector,
  type ConnectorScope,
  type EmittedEventSpec,
  type HealthReport,
  type SourceReader,
  type SyncPage,
  type SyncRequest,
} from "./types.js";
import type { EventCategory, Sensitivity, SourceId } from "../events/schema.js";

export interface ReaderConnectorDefinition<TRecord> {
  id: SourceId;
  name: string;
  version: string;
  category: EventCategory;
  description: string;
  scopes: ConnectorScope[];
  emits: EmittedEventSpec[];
  requiresExplicitPermission?: boolean;
  defaultSensitivity?: Sensitivity;
  maxBackfillDays?: number;
  reader: SourceReader<TRecord>;
  /**
   * Pure mapping from one source record to zero or more events.
   * Returning `[]` is the correct way to skip a record the connector cannot
   * interpret — throwing would abort the whole page.
   */
  map(record: TRecord, context: { timezone: string }): RawEventInput[];
  /** Timestamp accessor used for cursors and ordering. */
  timestampOf(record: TRecord): string | number | Date;
}

/**
 * Cursor format: `<iso instant>|<hash of the last record>`.
 *
 * The hash disambiguates records that share a timestamp, so a page boundary
 * landing inside a batch of simultaneous events does not skip or repeat them.
 */
function encodeCursor(instant: number, record: unknown): string {
  return `${new Date(instant).toISOString()}|${stableHash(record).slice(0, 12)}`;
}

export function decodeCursor(cursor: string | null): { since: string | null; guard: string | null } {
  if (!cursor) return { since: null, guard: null };
  const [since, guard] = cursor.split("|");
  return { since: since ?? null, guard: guard ?? null };
}

export function defineReaderConnector<TRecord>(definition: ReaderConnectorDefinition<TRecord>): Connector {
  const {
    reader,
    map,
    timestampOf,
    id,
    name,
    version,
    category,
    description,
    scopes,
    emits,
    requiresExplicitPermission,
    defaultSensitivity,
    maxBackfillDays,
  } = definition;

  const connector: Connector = {
    id,
    name,
    version,
    category,
    description,
    scopes,
    emits,
    ...(requiresExplicitPermission !== undefined ? { requiresExplicitPermission } : {}),
    ...(defaultSensitivity !== undefined ? { defaultSensitivity } : {}),
    ...(maxBackfillDays !== undefined ? { maxBackfillDays } : {}),

    async fetch(request: SyncRequest): Promise<SyncPage> {
      const { since: cursorSince, guard } = decodeCursor(request.cursor);
      // The later of the two bounds wins: the cursor is the resume point, and
      // `since` is the overlap window the engine asked for.
      const effectiveSince = pickLater(cursorSince, request.since);
      const limit = request.limit ?? 500;

      let page: { records: TRecord[]; hasMore: boolean };
      try {
        page = await reader.read(effectiveSince, limit);
      } catch (error) {
        throw new ConnectorError(String(id), error instanceof Error ? error.message : String(error), true);
      }

      const warnings: string[] = [];
      const ordered = [...page.records].sort((a, b) => toInstant(timestampOf(a)) - toInstant(timestampOf(b)));

      // Skip everything up to and including the record the cursor points at.
      let startIndex = 0;
      if (guard) {
        const found = ordered.findIndex((record) => stableHash(record).slice(0, 12) === guard);
        if (found >= 0) startIndex = found + 1;
      }
      const fresh = ordered.slice(startIndex);

      const records: RawEventInput[] = [];
      for (const record of fresh) {
        try {
          records.push(...map(record, { timezone: request.timezone }));
        } catch (error) {
          warnings.push(`Skipped a record: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const last = fresh[fresh.length - 1];
      const cursor = last ? encodeCursor(toInstant(timestampOf(last)), last) : request.cursor;

      return {
        records,
        cursor,
        hasMore: page.hasMore && fresh.length > 0,
        ...(warnings.length ? { warnings } : {}),
      };
    },

    async healthCheck(): Promise<HealthReport> {
      const checkedAt = new Date().toISOString();
      if (!reader.probe) {
        return { status: "unknown", message: "This source does not expose a health probe", checkedAt };
      }
      const probe = await reader.probe();
      return {
        status: probe.ok ? "healthy" : "failing",
        message: probe.message,
        checkedAt,
        latestSourceEventAt: probe.latestAt ?? null,
      };
    },
  };

  return connector;
}

function pickLater(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return toInstant(a) >= toInstant(b) ? a : b;
}

/** In-memory reader over a fixed record array — used by tests, fixtures and the synthetic harness. */
export function createArrayReader<TRecord>(
  records: readonly TRecord[],
  timestampOf: (record: TRecord) => string | number | Date,
  probeResult?: { ok: boolean; message: string },
): SourceReader<TRecord> {
  const sorted = [...records].sort((a, b) => toInstant(timestampOf(a)) - toInstant(timestampOf(b)));
  return {
    async read(since, limit) {
      const cutoff = since ? toInstant(since) : -Infinity;
      const matching = sorted.filter((record) => toInstant(timestampOf(record)) >= cutoff);
      return { records: matching.slice(0, limit), hasMore: matching.length > limit };
    },
    async probe() {
      const last = sorted[sorted.length - 1];
      return {
        ok: probeResult?.ok ?? true,
        message: probeResult?.message ?? `${sorted.length} records available`,
        latestAt: last ? new Date(toInstant(timestampOf(last))).toISOString() : null,
      };
    },
  };
}

/**
 * Verifies a connector honours its own declared contract.
 *
 * Run against every connector in the test suite: a connector that emits a
 * metric it never declared is a connector whose output the metric registry
 * cannot describe, and an undeclared metric is exactly how meaningless
 * numbers sneak into an insight.
 */
export interface ContractViolation {
  kind: "undeclared-type" | "undeclared-metric" | "out-of-range" | "wrong-source" | "missing-metrics";
  detail: string;
}

export function checkContract(connector: Connector, produced: readonly RawEventInput[]): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const specByType = new Map(connector.emits.map((spec) => [spec.type, spec]));

  for (const record of produced) {
    if (record.source !== connector.id) {
      violations.push({ kind: "wrong-source", detail: `Record declares source "${record.source}"` });
      continue;
    }
    const spec = specByType.get(record.type);
    if (!spec) {
      violations.push({ kind: "undeclared-type", detail: `Emitted undeclared event type "${record.type}"` });
      continue;
    }
    if (spec.category !== record.category) {
      violations.push({
        kind: "undeclared-type",
        detail: `"${record.type}" declared category ${spec.category} but emitted ${record.category}`,
      });
    }
    const declaredMetrics = new Map(spec.metrics.map((m) => [m.key, m]));
    const emittedKeys = Object.keys(record.metrics);
    if (emittedKeys.length === 0) {
      violations.push({ kind: "missing-metrics", detail: `"${record.type}" emitted no metrics` });
    }
    for (const [key, value] of Object.entries(record.metrics)) {
      const metricSpec = declaredMetrics.get(key);
      if (!metricSpec) {
        violations.push({ kind: "undeclared-metric", detail: `"${record.type}" emitted undeclared metric "${key}"` });
        continue;
      }
      if (metricSpec.range && (value < metricSpec.range.min || value > metricSpec.range.max)) {
        violations.push({
          kind: "out-of-range",
          detail: `${record.type}.${key} = ${value} is outside ${metricSpec.range.min}..${metricSpec.range.max}`,
        });
      }
    }
  }
  return violations;
}
