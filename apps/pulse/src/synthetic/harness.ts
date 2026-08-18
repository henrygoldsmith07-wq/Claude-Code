/**
 * Test harness: a fully loaded Pulse instance backed by a synthetic user.
 *
 * Used by the test suite and by the demo build, so the UI is exercised against
 * exactly the data the statistical tests assert on.
 */

import { Pulse } from "../pulse.js";
import type { PersistenceAdapter } from "../events/store.js";
import type { InsightHistoryAdapter } from "../history/insight-history.js";
import type { CausalLibraryAdapter } from "../hypotheses/library.js";
import { createArrayReader } from "../connectors/sdk.js";
import { createReviseConnector, type ReviseRecord } from "../connectors/revise.js";
import { createAriseConnector, type AriseRecord } from "../connectors/arise.js";
import { createFrenchConnector, type FrenchRecord } from "../connectors/french.js";
import { createForqConnector, type ForqRecord } from "../connectors/forq.js";
import { createReflectConnector, type ReflectRecord } from "../connectors/reflect.js";
import { createWearableConnector } from "../connectors/wearable.js";
import { addDays, localDayStart } from "../events/time.js";
import { generateSyntheticUser, type SyntheticOptions, type SyntheticUser } from "./generator.js";
import { createRng, normalDeviate } from "../statistics/random.js";

export interface HarnessOptions extends SyntheticOptions {
  /** Connect the sensitive Reflect source too. Off by default, as in the product. */
  includeReflect?: boolean;
  /** Connect the wearable source. Off by default so existing tests stay small. */
  includeWearable?: boolean;
  /** Fixed clock. Defaults to the day after the user's last generated day. */
  nowMs?: number;
  /** Persistence for the event store, as with PulseOptions. */
  adapter?: PersistenceAdapter;
  /** Persistence for the insight history, as with PulseOptions. */
  historyAdapter?: InsightHistoryAdapter;
  /** Persistence for the causal hypothesis library, as with PulseOptions. */
  libraryAdapter?: CausalLibraryAdapter;
}

export interface Harness {
  pulse: Pulse;
  user: SyntheticUser;
  nowMs: number;
}

function timestampOfRevise(record: ReviseRecord): string {
  return record.kind === "review" ? record.reviewedAt : record.kind === "attempt" ? record.createdAt : record.startedAt;
}

function timestampOfArise(record: AriseRecord): string {
  return record.kind === "session" ? (record.completedAt ?? `${record.dateISO}T18:00:00.000Z`) : (record.at ?? `${record.dateISO}T08:00:00.000Z`);
}

function timestampOfFrench(record: FrenchRecord): string {
  return record.kind === "speaking" ? record.startedAt : record.reviewedAt;
}

function timestampOfForq(record: ForqRecord): string {
  return record.kind === "meal" ? record.loggedAt : record.closedAt;
}

/** Reflect entries, generated only when a test explicitly asks for them. */
function generateReflectEntries(user: SyntheticUser): ReflectRecord[] {
  const rng = createRng(`${user.seed}:reflect`);
  const entries: ReflectRecord[] = [];
  for (let day = 0; day < user.days; day += 1) {
    if (rng.next() > 0.6) continue;
    const date = addDays(user.startDate, day);
    const dayStart = localDayStart(date, user.timezone);
    entries.push({
      kind: "entry",
      id: `rf-${day}`,
      writtenAt: new Date(dayStart + 21 * 3_600_000).toISOString(),
      mood: Math.round(clamp(normalDeviate(rng, 6.4, 1.6), 0, 10)),
      energy: Math.round(clamp(normalDeviate(rng, 6.1, 1.7), 0, 10)),
      stress: Math.round(clamp(normalDeviate(rng, 4.2, 1.9), 0, 10)),
      clarity: Math.round(clamp(normalDeviate(rng, 6.0, 1.5), 0, 10)),
      wordCount: Math.round(clamp(normalDeviate(rng, 180, 90), 10, 2000)),
      followUpCompleted: rng.next() < 0.55,
      timezone: user.timezone,
    });
  }
  return entries;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Builds a Pulse instance, registers every connector, grants consent and runs
 * a full backfill. Returns before any analysis is run, so tests can assert on
 * ingest separately from discovery.
 */
export async function createSyntheticPulse(options: HarnessOptions = {}): Promise<Harness> {
  const user = generateSyntheticUser(options);
  // A day after the last generated day, so freshness scoring is not penalised.
  const nowMs = options.nowMs ?? localDayStart(addDays(user.startDate, user.days), user.timezone) + 10 * 3_600_000;

  const pulse = new Pulse({
    timezone: user.timezone,
    now: () => nowMs,
    adapter: options.adapter,
    historyAdapter: options.historyAdapter,
    libraryAdapter: options.libraryAdapter,
  });

  pulse.registerConnector(createReviseConnector(createArrayReader(user.revise, timestampOfRevise)));
  pulse.registerConnector(createAriseConnector(createArrayReader(user.arise, timestampOfArise)));
  pulse.registerConnector(createFrenchConnector(createArrayReader(user.french, timestampOfFrench)));
  pulse.registerConnector(createForqConnector(createArrayReader(user.forq, timestampOfForq)));
  if (options.includeWearable) {
    pulse.registerConnector(
      createWearableConnector(createArrayReader(user.wearable, (record) => record.at ?? `${record.dateISO}T12:00:00.000Z`)),
    );
  }

  const reflectEntries = options.includeReflect ? generateReflectEntries(user) : [];
  pulse.registerConnector(
    createReflectConnector(createArrayReader(reflectEntries, (record) => record.writtenAt)),
  );

  pulse.connectAll();
  if (options.includeReflect) pulse.connect("reflect");

  for (const source of ["revise", "arise", "le-studio-french", "forq"] as const) {
    await pulse.backfill(source, user.startDate);
  }
  if (options.includeReflect) await pulse.backfill("reflect", user.startDate);
  if (options.includeWearable) await pulse.backfill("wearable", user.startDate);

  return { pulse, user, nowMs };
}
