/**
 * Same-origin source readers.
 *
 * The apps in this ecosystem are built and deployed separately but are served
 * under a single origin, which means the browser gives them exactly one
 * `localStorage`. That shared storage *is* the connection: a sibling app writes
 * its own state under its own namespaced key, and Pulse reads that key. No
 * network call, no backend, no second copy of the data — Pulse reads state the
 * user already owns, in their own browser.
 *
 * This replaces three abandoned attempts at the same idea. Arise pushed to a
 * `window.__PULSE_ADAPTER__` that nothing ever set; Reflect dispatched a
 * `CustomEvent` no one listened for; Forq exposed a snapshot no one called.
 * All three assumed a host that could reach into the app. Reading storage
 * inverts that: the sibling app needs no knowledge of Pulse at all, which is
 * why nothing here requires changing how those apps store anything.
 *
 * Two limits are deliberate:
 *
 * - A reader only ever touches the one key it was constructed with, so "what
 *   Pulse can see" is a reviewable list rather than a capability.
 * - A reader reads nothing while consent is absent. Each app already gates
 *   Pulse behind its own opt-in (Arise's `preferences.pulseEnabled`, Reflect's
 *   `reflectPulseOptIn`); passing that same flag as `consent` means revoking it
 *   in the app stops the data flow here, not merely in some settings screen.
 */

import type { SourceReader } from "./types.js";

/** The slice of `localStorage` this module needs, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
}

export interface SameOriginReaderOptions<TRecord> {
  /** The sibling app's storage key, e.g. `arise.store.v1`. */
  key: string;
  /**
   * Pull the records out of whatever the app happens to store. Returning `[]`
   * for a shape you do not recognise is correct: a sibling app may migrate its
   * own state at any time, and a connector that throws would take Pulse's whole
   * sync down with it.
   */
  select(state: unknown): readonly TRecord[];
  /** When a record happened. Records without a usable timestamp are dropped. */
  timestampOf(record: TRecord): string | null | undefined;
  /**
   * Whether the user has opted this source in. Read from the app's own flag so
   * there is one source of truth for consent, not two that can disagree.
   */
  consent?(state: unknown): boolean;
  /** Defaults to the real `localStorage` when one exists. */
  storage?: StorageLike | null;
  /** Human-readable source name for probe messages. */
  label?: string;
}

function resolveStorage(explicit: StorageLike | null | undefined): StorageLike | null {
  if (explicit !== undefined) return explicit;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage access throws outright when the browser blocks it (Safari private
    // mode, an iframe with third-party storage partitioned off). Treat that as
    // "no data available", never as a crash.
    return null;
  }
}

interface ReadState<TRecord> {
  /** null when the key is absent, unparseable, or consent is withheld. */
  records: readonly TRecord[];
  problem: string | null;
}

function loadRecords<TRecord>(options: SameOriginReaderOptions<TRecord>): ReadState<TRecord> {
  const storage = resolveStorage(options.storage);
  if (!storage) return { records: [], problem: "No storage available in this environment." };

  let raw: string | null;
  try {
    raw = storage.getItem(options.key);
  } catch {
    return { records: [], problem: "Storage read was blocked by the browser." };
  }
  if (raw === null) return { records: [], problem: `Nothing stored under ${options.key} yet.` };

  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return { records: [], problem: `${options.key} is not valid JSON.` };
  }

  if (options.consent && !options.consent(state)) {
    return { records: [], problem: "Not connected — turn Pulse on in the source app." };
  }

  let selected: readonly TRecord[];
  try {
    selected = options.select(state);
  } catch {
    // A shape we don't understand is a gap in coverage, not a failure.
    return { records: [], problem: `Could not read the shape stored under ${options.key}.` };
  }

  // Stamp, drop the unusable, and sort oldest-first so `since` paging is a
  // simple scan. The engine relies on this ordering.
  const stamped: { record: TRecord; at: number; iso: string }[] = [];
  for (const record of selected) {
    const iso = options.timestampOf(record);
    if (typeof iso !== "string") continue;
    const at = Date.parse(iso);
    if (!Number.isFinite(at)) continue;
    stamped.push({ record, at, iso });
  }
  stamped.sort((a, b) => a.at - b.at || a.iso.localeCompare(b.iso));

  return { records: stamped.map((entry) => entry.record), problem: null };
}

/**
 * A `SourceReader` over one same-origin storage key.
 *
 * Storage is re-read on every `read` rather than cached: the user may be using
 * the sibling app in another tab right now, and a stale snapshot would quietly
 * hide the events the sync was called to collect.
 */
export function createSameOriginReader<TRecord>(
  options: SameOriginReaderOptions<TRecord>,
): SourceReader<TRecord> {
  const timestampAt = (record: TRecord): number => {
    const iso = options.timestampOf(record);
    return typeof iso === "string" ? Date.parse(iso) : Number.NaN;
  };

  return {
    async read(since: string | null, limit: number) {
      const { records } = loadRecords(options);
      const cutoff = since === null ? null : Date.parse(since);

      const eligible =
        cutoff === null || !Number.isFinite(cutoff)
          ? records
          : records.filter((record) => {
              const at = timestampAt(record);
              // `>=` on purpose: the sync layer dedups by id/natural key, so an
              // inclusive bound costs a duplicate check but never drops an event
              // that shares a timestamp with the last one seen.
              return Number.isFinite(at) && at >= cutoff;
            });

      const capped = Math.max(0, Math.floor(limit));
      return { records: eligible.slice(0, capped), hasMore: eligible.length > capped };
    },

    async probe() {
      const { records, problem } = loadRecords(options);
      const label = options.label ?? options.key;
      if (problem) return { ok: false, message: problem, latestAt: null };
      const newest = records.at(-1);
      const latest = newest === undefined ? null : options.timestampOf(newest);
      return {
        ok: true,
        message: `${label}: ${records.length} record${records.length === 1 ? "" : "s"} readable.`,
        latestAt: typeof latest === "string" ? latest : null,
      };
    },
  };
}

/** Undo a live subscription. */
export type Unsubscribe = () => void;

/**
 * Call `onChange` when a sibling app writes to `key`.
 *
 * This is what makes the connection live rather than a manual import. The
 * `storage` event fires only in *other* documents, which is normally an
 * annoyance and here is exactly right: each app is its own document, so a write
 * in Arise reaches Pulse and Pulse's own writes don't feed back into a loop.
 *
 * Coalescing matters: apps persist their whole state on every keystroke, so an
 * uncoalesced handler would kick off a sync per character typed.
 */
export function subscribeToSameOriginSource(
  key: string,
  onChange: () => void,
  { debounceMs = 750, target = globalThis as unknown as EventTarget | null } = {},
): Unsubscribe {
  if (!target || typeof target.addEventListener !== "function") return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  const handler = (event: Event): void => {
    const changed = (event as StorageEvent).key;
    // A null key means "everything was cleared", which is also news.
    if (changed !== null && changed !== key) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  target.addEventListener("storage", handler);
  return () => {
    if (timer !== null) clearTimeout(timer);
    target.removeEventListener("storage", handler);
  };
}
