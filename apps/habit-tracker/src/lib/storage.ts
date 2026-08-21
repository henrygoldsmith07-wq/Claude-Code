/**
 * Durable local persistence helpers with corruption handling and offline queue.
 * Corrupted storage must never crash the app; writes made offline are queued,
 * deduped per (habit, day), and replayed on reconnect without duplicates.
 */

export interface QueuedWrite {
  id: string;
  kind: "upsert_checkin" | "delete_checkin" | "insert_habit" | "update_habit" | "delete_habit";
  payload: unknown;
  attempts: number;
  createdAt: string;
}

const QUEUE_KEY = "habit-tracker-offline-queue-v1";
const CACHE_KEY = "habit-tracker-cache-v1";

export function readQueue(storage: Storage | null = safeStorage()): QueuedWrite[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("queue_not_array");
    return parsed.filter(isQueuedWrite);
  } catch {
    // Corrupted queue — clear it so the app can continue.
    try {
      storage.removeItem(QUEUE_KEY);
    } catch {
      // ignore
    }
    return [];
  }
}

export function writeQueue(queue: QueuedWrite[], storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Quota or blocked — app continues without queue.
  }
}

export function enqueue(
  write: Omit<QueuedWrite, "id" | "attempts" | "createdAt">,
  storage: Storage | null = safeStorage(),
): void {
  const queue = readQueue(storage);
  const next: QueuedWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...write,
  };
  // For idempotent checkin ops, collapse older duplicates for the same habit:day.
  if (write.kind === "upsert_checkin" || write.kind === "delete_checkin") {
    const payload = write.payload as { habit_id?: string; day?: string };
    const key = `${payload.habit_id}:${payload.day}`;
    const filtered = queue.filter((q) => {
      if (q.kind !== "upsert_checkin" && q.kind !== "delete_checkin") return true;
      const p = q.payload as { habit_id?: string; day?: string };
      return `${p.habit_id}:${p.day}` !== key;
    });
    filtered.push(next);
    writeQueue(filtered, storage);
  } else {
    queue.push(next);
    writeQueue(queue, storage);
  }
}

export function dequeue(id: string, storage: Storage | null = safeStorage()): void {
  const queue = readQueue(storage);
  writeQueue(
    queue.filter((q) => q.id !== id),
    storage,
  );
}

export function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Safe JSON parse with fallback; clears corrupted key. */
export function safeGetJSON<T>(key: string, fallback: T, storage: Storage | null = safeStorage()): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return fallback;
  }
}

export function safeSetJSON(key: string, value: unknown, storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isQueuedWrite(v: unknown): v is QueuedWrite {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.kind === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.attempts === "number" &&
    "payload" in o
  );
}

export const CACHE = {
  key: CACHE_KEY,
  read<T>(fallback: T, storage: Storage | null = safeStorage()): T {
    return safeGetJSON(CACHE_KEY, fallback, storage);
  },
  write(value: unknown, storage: Storage | null = safeStorage()): boolean {
    return safeSetJSON(CACHE_KEY, value, storage);
  },
  clear(storage: Storage | null = safeStorage()): void {
    try {
      storage?.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
  },
};
