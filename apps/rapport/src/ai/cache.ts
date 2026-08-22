import "server-only";
import type { AiTask } from "./types";

// ---------------------------------------------------------------------------
// Response cache and rate limiting.
//
// Caching policy is per task, and two tasks are deliberately never cached:
//
//  * simulate-turn — a character repeating itself verbatim destroys the
//    illusion the whole feature depends on.
//  * summarise-reflection — reflection text is the most private data here, and
//    a cache keyed on it is a store of it. It is not worth the saved call.
//
// The rest are cached on a hash of their inputs, which meaningfully cuts cost
// on the common path (the same insight explained on every dashboard load).
// ---------------------------------------------------------------------------

const CACHEABLE: Record<AiTask, number> = {
  "simulate-turn": 0,
  "summarise-reflection": 0,
  "phrase-feedback": 30 * 60_000,
  "explain-insight": 6 * 60 * 60_000,
  "coach-explain": 60 * 60_000,
  "enrich-scenario": 24 * 60 * 60_000,
};

interface Entry {
  value: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 200;
const store = new Map<string, Entry>();

/** FNV-1a. Cache keys are hashes, so the cache never holds the prompt text itself. */
export function hashKey(task: AiTask, payload: unknown): string {
  const text = `${task}:${JSON.stringify(payload)}`;
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return `${task}.${(value >>> 0).toString(36)}`;
}

export function isCacheable(task: AiTask): boolean {
  return (CACHEABLE[task] ?? 0) > 0;
}

export function get<T>(task: AiTask, key: string): T | null {
  if (!isCacheable(task)) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function set(task: AiTask, key: string, value: unknown): void {
  const ttl = CACHEABLE[task] ?? 0;
  if (ttl <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

export function clearCache(): void {
  store.clear();
}

// --- Rate limiting ---------------------------------------------------------

interface Bucket {
  count: number;
  resetsAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetsInSeconds: number;
}

/**
 * Fixed-window limiter, keyed per caller. Deliberately simple: the point is a
 * ceiling on spend and abuse, and a token bucket would add state without
 * changing either outcome at this scale.
 */
export function checkRateLimit(key: string, limitPerHour = defaultLimit()): RateLimitResult {
  const now = Date.now();
  // Callers that never come back would otherwise pin their bucket forever.
  // Sweeping past a bound keeps memory flat even under key rotation.
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetsAt < now) buckets.delete(bucketKey);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetsAt < now) {
    buckets.set(key, { count: 1, resetsAt: now + 3_600_000 });
    return { allowed: true, remaining: limitPerHour - 1, resetsInSeconds: 3600 };
  }
  bucket.count += 1;
  const remaining = Math.max(0, limitPerHour - bucket.count);
  return {
    allowed: bucket.count <= limitPerHour,
    remaining,
    resetsInSeconds: Math.ceil((bucket.resetsAt - now) / 1000),
  };
}

function defaultLimit(): number {
  const configured = Number(process.env.AI_RATE_LIMIT_PER_HOUR);
  return Number.isFinite(configured) && configured > 0 ? configured : 60;
}

export function clearRateLimits(): void {
  buckets.clear();
}
