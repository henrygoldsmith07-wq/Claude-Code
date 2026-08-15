/**
 * The connector health dashboard.
 *
 * Analytics quietly assumes its inputs are still arriving. When a connector
 * dies, nothing breaks and nothing complains — the series just stops, the
 * rolling baseline drifts towards the last fortnight that happened to be
 * captured, and every insight built on it keeps its old confidence grade. A
 * silent connector is worse than a missing one.
 *
 * Two ideas do most of the work here.
 *
 * **Freshness is judged against the source's own cadence.** A sleep tracker
 * that has said nothing for three days is broken; a file import that has said
 * nothing for three months is fine. One global staleness threshold produces
 * either false alarms on the second or silence on the first.
 *
 * **A gap is not automatically a fault.** If every source went quiet on the
 * same three days, the user was on holiday and the connectors are fine.
 * Reporting that as five separate connector failures teaches people to ignore
 * the dashboard, so shared blackouts are named as such and excluded from the
 * per-connector gap counts.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { addDays, daysBetween, localDate, toInstant } from "../events/time.js";
import type { Connector, HealthStatus, SyncCadence } from "./types.js";
import type { SyncReport } from "./sync.js";

export type Freshness = "fresh" | "lagging" | "stale" | "silent" | "unknown";

/** Hours since the last event at which a source moves into each band. */
const FRESHNESS_THRESHOLDS: Record<SyncCadence, { lagging: number; stale: number; silent: number } | null> = {
  continuous: { lagging: 6, stale: 24, silent: 72 },
  daily: { lagging: 36, stale: 72, silent: 168 },
  weekly: { lagging: 192, stale: 336, silent: 720 },
  // A one-off import is never stale; it is simply finished.
  irregular: null,
};

export interface CoverageGap {
  from: string;
  to: string;
  days: number;
}

export interface AttentionItem {
  severity: "info" | "warning" | "critical";
  message: string;
  /** What the user can do. Null when there is nothing to do. */
  remedy: string | null;
}

export interface ConnectorCard {
  source: SourceId;
  name: string;
  connected: boolean;
  status: HealthStatus;
  statusMessage: string;
  cadence: SyncCadence;
  freshness: Freshness;
  /** Null when the source has never produced an event. */
  hoursSinceLastEvent: number | null;
  lastSyncedAt: string | null;
  lastEventAt: string | null;
  firstEventAt: string | null;
  eventCount: number;
  daysWithData: number;
  coverageDays: number;
  /** Days with no data, ignoring days when every source was quiet. */
  missingDays: number;
  longestGapDays: number;
  gaps: CoverageGap[];
  /** Share of fetched records the last sync could not validate. */
  rejectionRate: number;
  warnings: string[];
  attention: AttentionItem[];
}

export interface ConnectorDashboard {
  generatedAt: string;
  cards: ConnectorCard[];
  summary: {
    connected: number;
    healthy: number;
    needingAttention: number;
    silent: number;
  };
  /** Days in the window when no connected source produced anything. */
  blackoutDays: string[];
}

export interface DashboardOptions {
  timezone: string;
  /** Latest sync report per source, when one has been run. */
  syncReports?: readonly SyncReport[];
  /** Sources the user has actually connected. Defaults to every connector given. */
  connectedSources?: readonly SourceId[];
  /** How far back coverage is assessed. */
  windowDays?: number;
  now?: () => number;
}

const DEFAULT_WINDOW_DAYS = 30;
/** A gap shorter than this is ordinary life, not a fault worth a card. */
const MIN_REPORTABLE_GAP_DAYS = 2;

function freshnessFor(cadence: SyncCadence, hoursSinceLastEvent: number | null): Freshness {
  const thresholds = FRESHNESS_THRESHOLDS[cadence];
  if (thresholds === null) return "unknown";
  if (hoursSinceLastEvent === null) return "silent";
  if (hoursSinceLastEvent <= thresholds.lagging) return "fresh";
  if (hoursSinceLastEvent <= thresholds.stale) return "lagging";
  if (hoursSinceLastEvent <= thresholds.silent) return "stale";
  return "silent";
}

/** Every local date in `[from, to]`, inclusive. */
function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function findGaps(covered: ReadonlySet<string>, window: readonly string[], exempt: ReadonlySet<string>): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  let runStart: string | null = null;
  let runEnd: string | null = null;

  for (const date of window) {
    const missing = !covered.has(date) && !exempt.has(date);
    if (missing) {
      runStart ??= date;
      runEnd = date;
      continue;
    }
    if (runStart && runEnd) gaps.push({ from: runStart, to: runEnd, days: daysBetween(runStart, runEnd) + 1 });
    runStart = null;
    runEnd = null;
  }
  if (runStart && runEnd) gaps.push({ from: runStart, to: runEnd, days: daysBetween(runStart, runEnd) + 1 });

  return gaps.filter((gap) => gap.days >= MIN_REPORTABLE_GAP_DAYS);
}

function attentionFor(card: Omit<ConnectorCard, "attention">): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (!card.connected) {
    items.push({
      severity: "info",
      message: `${card.name} is not connected.`,
      remedy: `Connect ${card.name} to include it in your analysis.`,
    });
    return items;
  }

  if (card.status === "failing") {
    items.push({
      severity: "critical",
      message: `${card.name} is failing: ${card.statusMessage}`,
      remedy: "Reconnect the source, then run a sync.",
    });
  }

  if (card.freshness === "silent") {
    items.push({
      severity: "critical",
      message:
        card.lastEventAt === null
          ? `${card.name} is connected but has never sent any data.`
          : `${card.name} has sent nothing since ${card.lastEventAt.slice(0, 10)}.`,
      remedy: "Check the source app is still signed in and syncing to its own service.",
    });
  } else if (card.freshness === "stale") {
    items.push({
      severity: "warning",
      message: `${card.name} is behind — the newest reading is ${Math.floor((card.hoursSinceLastEvent ?? 0) / 24)} days old.`,
      remedy: "Open the source app to let it upload, then sync again.",
    });
  }

  if (card.rejectionRate >= 0.1) {
    items.push({
      severity: "warning",
      message: `${Math.round(card.rejectionRate * 100)}% of the records ${card.name} sent could not be read.`,
      // The user cannot fix a mapping bug, and telling them to try is worse
      // than telling them it is being looked at.
      remedy: null,
    });
  }

  if (card.longestGapDays >= MIN_REPORTABLE_GAP_DAYS && card.freshness !== "silent") {
    items.push({
      severity: card.longestGapDays >= 7 ? "warning" : "info",
      message: `${card.name} is missing ${card.missingDays} of the last ${card.coverageDays} days, the longest run being ${card.longestGapDays} days.`,
      remedy: "Gaps reduce the confidence of anything measured over that period. Backfill if the source supports it.",
    });
  }

  return items;
}

/**
 * Builds the dashboard.
 *
 * Everything is derived from events and sync reports rather than held as
 * mutable state, so the dashboard cannot drift out of step with what was
 * actually ingested.
 */
export function buildConnectorDashboard(
  connectors: readonly Connector[],
  events: readonly PulseEvent[],
  options: DashboardOptions,
): ConnectorDashboard {
  const now = (options.now ?? Date.now)();
  const generatedAt = new Date(now).toISOString();
  const today = localDate(now, options.timezone);
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowStart = addDays(today, -(windowDays - 1));
  const window = datesBetween(windowStart, today);

  const connected = new Set<SourceId>(options.connectedSources ?? connectors.map((connector) => connector.id));
  const reportBySource = new Map<SourceId, SyncReport>();
  for (const report of options.syncReports ?? []) {
    const existing = reportBySource.get(report.source);
    if (!existing || report.finishedAt > existing.finishedAt) reportBySource.set(report.source, report);
  }

  const eventsBySource = new Map<SourceId, PulseEvent[]>();
  for (const event of events) {
    const list = eventsBySource.get(event.source);
    if (list) list.push(event);
    else eventsBySource.set(event.source, [event]);
  }

  // Days when every connected source was quiet. Almost always the person, not
  // the plumbing — a phone left at home, a week off, a flat battery.
  const daysWithAnyData = new Set<string>();
  for (const event of events) {
    if (connected.has(event.source)) daysWithAnyData.add(event.localDate);
  }
  const blackoutDays = window.filter((date) => !daysWithAnyData.has(date));
  const blackoutSet = new Set(blackoutDays);

  const cards: ConnectorCard[] = connectors.map((connector) => {
    const sourceEvents = eventsBySource.get(connector.id) ?? [];
    const report = reportBySource.get(connector.id);
    const cadence = connector.cadence ?? "irregular";

    const instants = sourceEvents.map((event) => toInstant(event.occurredAt));
    const lastEventMs = instants.length ? Math.max(...instants) : null;
    const firstEventMs = instants.length ? Math.min(...instants) : null;
    const hoursSinceLastEvent = lastEventMs === null ? null : Math.max(0, (now - lastEventMs) / 3_600_000);

    const covered = new Set(sourceEvents.map((event) => event.localDate));
    // Coverage is only assessed from the source's first event: a connector
    // added on Tuesday is not "missing" the preceding three weeks.
    const coverageStart =
      firstEventMs === null ? windowStart : maxDate(windowStart, localDate(firstEventMs, options.timezone));
    const coverageWindow = datesBetween(coverageStart, today);
    const gaps = connected.has(connector.id) && FRESHNESS_THRESHOLDS[cadence] !== null
      ? findGaps(covered, coverageWindow, blackoutSet)
      : [];

    const base: Omit<ConnectorCard, "attention"> = {
      source: connector.id,
      name: connector.name,
      connected: connected.has(connector.id),
      status: report?.health.status ?? (connected.has(connector.id) ? "unknown" : "failing"),
      statusMessage: report?.health.message ?? (connected.has(connector.id) ? "Not synced yet" : "Not connected"),
      cadence,
      freshness: connected.has(connector.id) ? freshnessFor(cadence, hoursSinceLastEvent) : "unknown",
      hoursSinceLastEvent: hoursSinceLastEvent === null ? null : Math.round(hoursSinceLastEvent * 10) / 10,
      lastSyncedAt: report?.finishedAt ?? null,
      lastEventAt: lastEventMs === null ? null : new Date(lastEventMs).toISOString(),
      firstEventAt: firstEventMs === null ? null : new Date(firstEventMs).toISOString(),
      eventCount: sourceEvents.length,
      daysWithData: coverageWindow.filter((date) => covered.has(date)).length,
      coverageDays: coverageWindow.length,
      missingDays: gaps.reduce((total, gap) => total + gap.days, 0),
      longestGapDays: gaps.reduce((longest, gap) => Math.max(longest, gap.days), 0),
      gaps,
      rejectionRate: report && report.fetched > 0 ? report.rejected / report.fetched : 0,
      warnings: report?.warnings ?? [],
    };

    return { ...base, attention: attentionFor(base) };
  });

  cards.sort((a, b) => severityRank(b) - severityRank(a) || String(a.source).localeCompare(String(b.source)));

  return {
    generatedAt,
    cards,
    summary: {
      connected: cards.filter((card) => card.connected).length,
      healthy: cards.filter((card) => card.connected && card.attention.every((item) => item.severity === "info")).length,
      needingAttention: cards.filter((card) => card.attention.some((item) => item.severity !== "info")).length,
      silent: cards.filter((card) => card.connected && card.freshness === "silent").length,
    },
    blackoutDays,
  };
}

/** Sorts the cards that need action to the top. */
function severityRank(card: ConnectorCard): number {
  if (card.attention.some((item) => item.severity === "critical")) return 2;
  if (card.attention.some((item) => item.severity === "warning")) return 1;
  return 0;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * A one-line freshness label per source, for the header strip above findings.
 *
 * It exists so the freshness of the inputs is visible at the moment someone
 * reads a conclusion, rather than only on a settings screen they never open.
 */
export function freshnessSummary(dashboard: ConnectorDashboard): { source: SourceId; label: string; freshness: Freshness }[] {
  return dashboard.cards
    .filter((card) => card.connected)
    .map((card) => ({
      source: card.source,
      freshness: card.freshness,
      label: describeFreshness(card),
    }));
}

function describeFreshness(card: ConnectorCard): string {
  if (card.freshness === "unknown") return `${card.name} — imported data`;
  if (card.hoursSinceLastEvent === null) return `${card.name} — no data yet`;
  if (card.hoursSinceLastEvent < 1) return `${card.name} — up to date`;
  if (card.hoursSinceLastEvent < 48) return `${card.name} — ${Math.round(card.hoursSinceLastEvent)}h ago`;
  return `${card.name} — ${Math.floor(card.hoursSinceLastEvent / 24)} days ago`;
}
