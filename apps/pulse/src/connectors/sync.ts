/**
 * The sync engine.
 *
 * Owns everything a connector is deliberately not allowed to own: consent
 * enforcement, normalisation, validation, de-duplication, cursor management,
 * backfill windowing and health reporting. One code path, so a new connector
 * cannot accidentally skip a safety step.
 */

import { normaliseEvent, type NormaliseContext } from "../events/normalise.js";
import { validateEvent, type PulseEvent, type SourceId } from "../events/schema.js";
import type { MemoryEventStore } from "../events/store.js";
import { addDays, localDate, toInstant } from "../events/time.js";
import { hash128 } from "../events/hash.js";
import type { ConsentRegistry } from "../privacy/consent.js";
import { ConnectorError, type Connector, type HealthReport, type SyncPage } from "./types.js";

export interface SyncOptions {
  mode?: "live" | "backfill";
  /** Backfill start date (YYYY-MM-DD). Ignored in live mode. */
  backfillFrom?: string;
  timezone: string;
  /** Hard cap on pages, so a misbehaving connector cannot spin forever. */
  maxPages?: number;
  pageSize?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
  /** Deterministic sync id, otherwise derived from the clock. */
  syncId?: string;
}

export interface SyncReport {
  source: SourceId;
  syncId: string;
  mode: "live" | "backfill";
  startedAt: string;
  finishedAt: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  updated: number;
  /** Records the connector produced that failed schema validation. */
  rejected: number;
  rejectionSamples: string[];
  warnings: string[];
  pages: number;
  cursor: string | null;
  health: HealthReport;
  error?: string;
}

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 100;

export class SyncEngine {
  constructor(
    private readonly store: MemoryEventStore,
    private readonly consent: ConsentRegistry,
  ) {}

  /**
   * Runs one connector to completion (or to `maxPages`).
   *
   * Consent is checked here rather than in the connector: a connector that
   * forgets the check would otherwise silently exfiltrate a revoked source.
   */
  async sync(connector: Connector, options: SyncOptions): Promise<SyncReport> {
    const now = options.now ?? Date.now;
    const startedAtMs = now();
    const mode = options.mode ?? "live";
    const syncId = options.syncId ?? `${connector.id}-${hash128(`${connector.id}:${startedAtMs}`).slice(0, 12)}`;

    const report: SyncReport = {
      source: connector.id,
      syncId,
      mode,
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date(startedAtMs).toISOString(),
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      updated: 0,
      rejected: 0,
      rejectionSamples: [],
      warnings: [],
      pages: 0,
      cursor: null,
      health: { status: "unknown", message: "Not checked", checkedAt: new Date(startedAtMs).toISOString() },
    };

    const grant = this.consent.get(connector.id);
    if (!grant || !grant.granted) {
      report.error = `No consent granted for ${connector.id}. Connect the source before syncing.`;
      report.health = {
        status: "failing",
        message: "Not connected",
        checkedAt: new Date(now()).toISOString(),
      };
      return report;
    }
    if (connector.requiresExplicitPermission && !grant.explicit) {
      report.error = `${connector.name} requires its own explicit permission and cannot be enabled in bulk.`;
      report.health = { status: "failing", message: "Explicit permission required", checkedAt: new Date(now()).toISOString() };
      return report;
    }

    const existingCursor = this.store.getCursor(connector.id);
    const since = resolveSince(mode, options, existingCursor?.lastEventAt ?? null, connector, now());

    const ctx: NormaliseContext = {
      connectorId: connector.id,
      connectorVersion: connector.version,
      syncId,
      ingestMode: mode,
      timezone: options.timezone,
      now,
    };

    let cursor = mode === "backfill" ? null : (existingCursor?.cursor ?? null);
    let latestEventAt = existingCursor?.lastEventAt ?? null;
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

    try {
      for (let page = 0; page < maxPages; page += 1) {
        const result: SyncPage = await connector.fetch({
          since,
          cursor,
          timezone: options.timezone,
          mode,
          limit: options.pageSize ?? DEFAULT_PAGE_SIZE,
        });
        report.pages += 1;
        report.fetched += result.records.length;
        if (result.warnings?.length) report.warnings.push(...result.warnings);

        const events: PulseEvent[] = [];
        for (const raw of result.records) {
          if (raw.source !== connector.id) {
            report.rejected += 1;
            pushSample(report, `Record claimed source "${raw.source}" but came from ${connector.id}`);
            continue;
          }
          try {
            const event = normaliseEvent(raw, ctx);
            const validation = validateEvent(event);
            if (!validation.valid) {
              report.rejected += 1;
              pushSample(report, validation.issues.map((i) => `${i.path}: ${i.message}`).join("; "));
              continue;
            }
            events.push(event);
            if (!latestEventAt || toInstant(event.occurredAt) > toInstant(latestEventAt)) {
              latestEventAt = event.occurredAt;
            }
          } catch (error) {
            report.rejected += 1;
            pushSample(report, error instanceof Error ? error.message : String(error));
          }
        }

        const put = await this.store.put(events);
        report.inserted += put.inserted;
        report.duplicates += put.duplicates;
        report.updated += put.updated;

        cursor = result.cursor;
        if (!result.hasMore) break;
        if (page === maxPages - 1) {
          report.warnings.push(`Stopped after ${maxPages} pages; run sync again to continue.`);
        }
      }

      report.cursor = cursor;
      await this.store.setCursor({
        source: connector.id,
        cursor,
        lastSyncedAt: new Date(now()).toISOString(),
        lastEventAt: latestEventAt,
      });
      report.health = await runHealthCheck(connector, latestEventAt, now(), report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.error = message;
      report.health = {
        status: error instanceof ConnectorError && error.retryable ? "degraded" : "failing",
        message,
        checkedAt: new Date(now()).toISOString(),
      };
    }

    report.finishedAt = new Date(now()).toISOString();
    return report;
  }

  /**
   * Historical import in day-sized windows.
   *
   * Windowing matters because a connector that returns the user's entire
   * history in one page makes progress reporting impossible and blows memory
   * on a five-year archive.
   */
  async backfill(
    connector: Connector,
    fromDate: string,
    options: Omit<SyncOptions, "mode" | "backfillFrom">,
  ): Promise<SyncReport> {
    const now = options.now ?? Date.now;
    const maxDays = connector.maxBackfillDays ?? 3650;
    const earliest = addDays(localDate(now(), options.timezone), -maxDays);
    const clamped = fromDate < earliest ? earliest : fromDate;
    return this.sync(connector, { ...options, mode: "backfill", backfillFrom: clamped });
  }
}

function pushSample(report: SyncReport, message: string): void {
  if (report.rejectionSamples.length < 5) report.rejectionSamples.push(message);
}

function resolveSince(
  mode: "live" | "backfill",
  options: SyncOptions,
  lastEventAt: string | null,
  connector: Connector,
  nowMs: number,
): string | null {
  if (mode === "backfill") {
    const maxDays = connector.maxBackfillDays ?? 3650;
    const floor = addDays(localDate(nowMs, options.timezone), -maxDays);
    const from = options.backfillFrom && options.backfillFrom > floor ? options.backfillFrom : floor;
    return `${from}T00:00:00.000Z`;
  }
  // Live syncs re-read a short overlap window: sources that write events
  // slightly out of order would otherwise leave permanent gaps. Dedup makes
  // the overlap free.
  if (!lastEventAt) return null;
  return new Date(toInstant(lastEventAt) - 6 * 3600_000).toISOString();
}

async function runHealthCheck(
  connector: Connector,
  latestEventAt: string | null,
  nowMs: number,
  report: SyncReport,
): Promise<HealthReport> {
  const checkedAt = new Date(nowMs).toISOString();
  if (connector.healthCheck) {
    try {
      const reported = await connector.healthCheck();
      // A connector's own probe answers "can I reach the source?", which is a
      // different question from "is the data current?". A reachable source
      // that stopped producing weeks ago is still a problem for the user, so
      // the staleness downgrade applies on top of whatever the probe said.
      return applyStaleness(reported, latestEventAt, nowMs);
    } catch (error) {
      return {
        status: "failing",
        message: error instanceof Error ? error.message : String(error),
        checkedAt,
      };
    }
  }

  if (report.rejected > 0 && report.rejected >= report.fetched / 2) {
    return { status: "degraded", message: `${report.rejected} of ${report.fetched} records failed validation`, checkedAt };
  }
  if (!latestEventAt) {
    return { status: "unknown", message: "No events received yet", checkedAt, latestSourceEventAt: null };
  }
  return applyStaleness(
    { status: "healthy", message: "Syncing normally", checkedAt, latestSourceEventAt: latestEventAt },
    latestEventAt,
    nowMs,
  );
}

const STALE_AFTER_DAYS = 14;

/** Downgrades a healthy report when the newest event is too old to trust. */
function applyStaleness(report: HealthReport, latestEventAt: string | null, nowMs: number): HealthReport {
  const latest = report.latestSourceEventAt ?? latestEventAt;
  if (report.status !== "healthy" || !latest) return { ...report, latestSourceEventAt: latest ?? null };

  const staleDays = (nowMs - toInstant(latest)) / 86_400_000;
  if (staleDays <= STALE_AFTER_DAYS) return { ...report, latestSourceEventAt: latest };

  return {
    ...report,
    status: "degraded",
    message: `Source is reachable, but there has been no new data for ${Math.floor(staleDays)} days`,
    latestSourceEventAt: latest,
  };
}
