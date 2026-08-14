/**
 * Event storage.
 *
 * The store is the only stateful part of the ingest path; everything
 * downstream is a pure function over an array of events. It owns three
 * responsibilities and no more: de-duplication, per-source deletion (a privacy
 * requirement, not a convenience), and sync cursors.
 */

import type { PulseEvent, SourceId } from "./schema.js";
import { migrateEvent, needsMigration, type AnyStoredEvent } from "./migrate.js";
import { toInstant } from "./time.js";

export interface EventQuery {
  sources?: readonly SourceId[];
  types?: readonly string[];
  categories?: readonly string[];
  /** Inclusive lower bound on occurredAt. */
  from?: string | number | Date;
  /** Exclusive upper bound on occurredAt. */
  to?: string | number | Date;
  subjects?: readonly string[];
  /** Sensitive events are excluded unless explicitly requested. */
  includeSensitive?: boolean;
}

export interface PutResult {
  inserted: number;
  duplicates: number;
  /** Same dedupe key, different content — the later ingest wins. */
  updated: number;
  ids: string[];
}

export interface SyncCursor {
  source: SourceId;
  /** Opaque to the store; connectors decide what it means. */
  cursor: string | null;
  lastSyncedAt: string;
  lastEventAt: string | null;
}

/** Pluggable persistence. Kept tiny so an encrypted adapter is trivial to write. */
export interface PersistenceAdapter {
  load(): Promise<{ events: AnyStoredEvent[]; cursors: SyncCursor[] } | null>;
  save(snapshot: { events: PulseEvent[]; cursors: SyncCursor[] }): Promise<void>;
}

export class MemoryEventStore {
  private byDedupeKey = new Map<string, PulseEvent>();
  private cursors = new Map<SourceId, SyncCursor>();
  private readonly adapter: PersistenceAdapter | null;
  private loaded = false;

  constructor(adapter?: PersistenceAdapter) {
    this.adapter = adapter ?? null;
  }

  /** Rehydrates from the adapter, migrating anything written by an older build. */
  async load(): Promise<void> {
    if (this.loaded || !this.adapter) {
      this.loaded = true;
      return;
    }
    const snapshot = await this.adapter.load();
    if (snapshot) {
      for (const stored of snapshot.events) {
        const event = needsMigration(stored) ? migrateEvent(stored) : (stored as unknown as PulseEvent);
        this.byDedupeKey.set(event.dedupeKey, event);
      }
      for (const cursor of snapshot.cursors) this.cursors.set(cursor.source, cursor);
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.save({ events: this.all(), cursors: [...this.cursors.values()] });
  }

  /**
   * Idempotent insert. Re-ingesting the same record is a no-op; re-ingesting a
   * *changed* record (upstream edit) replaces it and reports an update, which
   * the quality scorer uses to flag unstable sources.
   */
  async put(events: readonly PulseEvent[]): Promise<PutResult> {
    const result: PutResult = { inserted: 0, duplicates: 0, updated: 0, ids: [] };
    for (const event of events) {
      const existing = this.byDedupeKey.get(event.dedupeKey);
      if (!existing) {
        this.byDedupeKey.set(event.dedupeKey, event);
        result.inserted += 1;
      } else if (existing.provenance.rawHash === event.provenance.rawHash) {
        result.duplicates += 1;
      } else {
        this.byDedupeKey.set(event.dedupeKey, event);
        result.updated += 1;
      }
      result.ids.push(event.id);
    }
    await this.persist();
    return result;
  }

  /** Chronological snapshot of everything held. */
  all(): PulseEvent[] {
    return [...this.byDedupeKey.values()].sort(compareByTime);
  }

  query(q: EventQuery = {}): PulseEvent[] {
    return filterEvents(this.all(), q);
  }

  count(q: EventQuery = {}): number {
    return this.query(q).length;
  }

  getById(id: string): PulseEvent | undefined {
    for (const event of this.byDedupeKey.values()) if (event.id === id) return event;
    return undefined;
  }

  /** Privacy primitive: erase everything a single source ever contributed. */
  async deleteBySource(source: SourceId): Promise<number> {
    let removed = 0;
    for (const [key, event] of this.byDedupeKey) {
      if (event.source === source) {
        this.byDedupeKey.delete(key);
        removed += 1;
      }
    }
    this.cursors.delete(source);
    await this.persist();
    return removed;
  }

  async deleteRange(source: SourceId, fromISO: string, toISO: string): Promise<number> {
    const from = toInstant(fromISO);
    const to = toInstant(toISO);
    let removed = 0;
    for (const [key, event] of this.byDedupeKey) {
      const at = toInstant(event.occurredAt);
      if (event.source === source && at >= from && at < to) {
        this.byDedupeKey.delete(key);
        removed += 1;
      }
    }
    await this.persist();
    return removed;
  }

  async clear(): Promise<void> {
    this.byDedupeKey.clear();
    this.cursors.clear();
    await this.persist();
  }

  getCursor(source: SourceId): SyncCursor | null {
    return this.cursors.get(source) ?? null;
  }

  async setCursor(cursor: SyncCursor): Promise<void> {
    this.cursors.set(cursor.source, cursor);
    await this.persist();
  }

  listCursors(): SyncCursor[] {
    return [...this.cursors.values()];
  }

  get size(): number {
    return this.byDedupeKey.size;
  }
}

export function compareByTime(a: PulseEvent, b: PulseEvent): number {
  const delta = toInstant(a.occurredAt) - toInstant(b.occurredAt);
  // Tie-break on id so ordering is total and reproducible across runs.
  return delta !== 0 ? delta : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Pure filter, exported so analytics can slice an in-memory array the same way. */
export function filterEvents(events: readonly PulseEvent[], q: EventQuery = {}): PulseEvent[] {
  const from = q.from === undefined ? -Infinity : toInstant(q.from);
  const to = q.to === undefined ? Infinity : toInstant(q.to);
  const sources = q.sources ? new Set(q.sources) : null;
  const types = q.types ? new Set(q.types) : null;
  const categories = q.categories ? new Set(q.categories) : null;
  const subjects = q.subjects ? new Set(q.subjects) : null;

  return events.filter((event) => {
    if (!q.includeSensitive && event.sensitivity === "sensitive") return false;
    if (sources && !sources.has(event.source)) return false;
    if (types && !types.has(event.type)) return false;
    if (categories && !categories.has(event.category)) return false;
    if (subjects && (!event.subject || !subjects.has(event.subject))) return false;
    const at = toInstant(event.occurredAt);
    return at >= from && at < to;
  });
}

/** In-memory adapter, used by tests and by the synthetic benchmark harness. */
export function createMemoryAdapter(): PersistenceAdapter {
  let snapshot: { events: PulseEvent[]; cursors: SyncCursor[] } | null = null;
  return {
    async load() {
      return snapshot ? { events: snapshot.events as unknown as AnyStoredEvent[], cursors: snapshot.cursors } : null;
    },
    async save(next) {
      snapshot = { events: [...next.events], cursors: [...next.cursors] };
    },
  };
}
