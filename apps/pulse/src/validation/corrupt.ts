/**
 * Real-world-style corruption for benchmark datasets.
 *
 * A clean export is not what months of real logging looks like. Devices
 * die for a week, exports get re-run and double-imported, a unit flips
 * from kilometres to miles, timestamps drift by minutes. The validation
 * benchmarks apply these failures deliberately, with a fixed seed so every
 * run is reproducible, and measure how much the false-positive rate moves.
 *
 * Corruption happens on `PulseEvent[]` — after normalisation, before
 * analysis — so the same transforms work over synthetic users and over
 * real imported datasets. Duplicated events get a fresh id and a small
 * timestamp offset because that is what a double export actually looks
 * like: the store deduplicates identical records, and a real re-export is
 * never byte-identical.
 */

import type { PulseEvent } from "../events/schema.js";
import { createRng } from "../statistics/random.js";

export interface DropoutGap {
  /** Day offset from the dataset's first local date. */
  start: number;
  days: number;
}

export interface CorruptionRecipe {
  seed?: string;
  /** Probability an entire day's events are missing (device off, not synced). */
  dropDayRate?: number;
  /** Probability an event appears twice (re-run export). */
  duplicateRate?: number;
  /** Probability one event carries one metric at a wrong unit scale. */
  unitErrorRate?: number;
  /** The scale applied by a unit error, e.g. 1.6 for km→miles. */
  unitErrorFactor?: number;
  /** Minutes of jitter added to timestamps, ±, uniform. */
  jitterMinutes?: number;
  /** Multi-day outage windows, e.g. a dead tracker or a holiday. */
  dropoutGaps?: DropoutGap[];
}

export interface CorruptionReport {
  originalCount: number;
  corruptedCount: number;
  droppedDays: string[];
  droppedEvents: number;
  duplicatedEvents: number;
  unitErrors: number;
  jitteredEvents: number;
}

const MINUTE_MS = 60_000;

function firstLocalDate(events: readonly PulseEvent[]): string | null {
  let earliest: string | null = null;
  for (const event of events) {
    if (!earliest || event.localDate < earliest) earliest = event.localDate;
  }
  return earliest;
}

function datePlus(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Applies the recipe deterministically. The input array is never mutated;
 * duplicated events are new objects with their own id and offset stamp.
 */
export function corruptEvents(
  events: readonly PulseEvent[],
  recipe: CorruptionRecipe = {},
): { events: PulseEvent[]; report: CorruptionReport } {
  const rng = createRng(recipe.seed ?? "corrupt");
  const dropDayRate = recipe.dropDayRate ?? 0;
  const duplicateRate = recipe.duplicateRate ?? 0;
  const unitErrorRate = recipe.unitErrorRate ?? 0;
  const unitErrorFactor = recipe.unitErrorFactor ?? 1.6;
  const jitterMinutes = recipe.jitterMinutes ?? 0;

  const firstDate = firstLocalDate(events);
  const gapDays = new Set<string>();
  if (firstDate) {
    for (const gap of recipe.dropoutGaps ?? []) {
      for (let day = 0; day < gap.days; day += 1) gapDays.add(datePlus(firstDate, gap.start + day));
    }
  }

  const report: CorruptionReport = {
    originalCount: events.length,
    corruptedCount: 0,
    droppedDays: [],
    droppedEvents: 0,
    duplicatedEvents: 0,
    unitErrors: 0,
    jitteredEvents: 0,
  };

  // Days are dropped as whole units — that is how real data goes missing.
  const dayTotals = new Map<string, number>();
  for (const event of events) dayTotals.set(event.localDate, (dayTotals.get(event.localDate) ?? 0) + 1);
  const droppedDays = new Set<string>();
  for (const date of [...dayTotals.keys()].sort()) {
    if (gapDays.has(date) || rng.next() < dropDayRate) {
      droppedDays.add(date);
      report.droppedDays.push(date);
      report.droppedEvents += dayTotals.get(date)!;
    }
  }

  const out: PulseEvent[] = [];
  for (const event of events) {
    if (droppedDays.has(event.localDate)) continue;

    let working = event;
    let mutated = false;

    if (unitErrorRate > 0 && rng.next() < unitErrorRate) {
      const keys = Object.keys(working.metrics);
      if (keys.length > 0) {
        const key = keys[Math.floor(rng.next() * keys.length)]!;
        const metrics = { ...working.metrics };
        metrics[key] = metrics[key]! * unitErrorFactor;
        working = { ...working, metrics };
        mutated = true;
        report.unitErrors += 1;
      }
    }

    if (jitterMinutes > 0) {
      const offset = Math.round((rng.next() * 2 - 1) * jitterMinutes);
      if (offset !== 0) {
        working = { ...working, occurredAt: new Date(Date.parse(working.occurredAt) + offset * MINUTE_MS).toISOString() };
        mutated = true;
        report.jitteredEvents += 1;
      }
    }

    out.push(working);

    if (duplicateRate > 0 && rng.next() < duplicateRate) {
      // A re-export lands minutes later under a fresh id and fresh dedupe
      // key: near-identical, but distinct enough to survive any sane dedupe.
      const offsetMinutes = 1 + Math.floor(rng.next() * 10);
      out.push({
        ...working,
        id: `${working.id}:dup`,
        sourceEventId: `${working.sourceEventId}:dup`,
        occurredAt: new Date(Date.parse(working.occurredAt) + offsetMinutes * MINUTE_MS).toISOString(),
        ...(working.dedupeKey ? { dedupeKey: `${working.dedupeKey}:dup` } : {}),
      });
      report.duplicatedEvents += 1;
    }

    if (mutated) report.corruptedCount += 1;
  }

  return { events: out, report };
}
