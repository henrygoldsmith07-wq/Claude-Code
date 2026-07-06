import { NextResponse } from "next/server";

// Lightweight, dependency-free per-client rate limiter (fixed window).
//
// It guards the paid API routes so a single visitor can't spam an endpoint and
// run up the account owner's Anthropic bill. State lives in the server
// process, so on a single long-lived server this is enforced globally.
//
// NOTE: on multi-instance or serverless deployments each instance keeps its own
// counters, so the effective limit is (limit × instances). For strict global
// limits, swap the in-memory Map for a shared store such as @upstash/ratelimit
// or Redis — the checkRateLimit() call sites stay the same.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Keep the Map from growing without bound by pruning expired buckets whenever
// it gets large. Cheap and only runs occasionally.
function pruneIfNeeded(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  pruneIfNeeded(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

// Best-effort client identifier. Behind a proxy/CDN (Vercel, etc.) the real
// client IP arrives in x-forwarded-for; fall back to x-real-ip, then a shared
// bucket so the limit still applies even when no IP header is present.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitOptions {
  // Distinguishes buckets per endpoint so limits don't bleed across routes.
  name: string;
  // Max requests allowed per window, per client.
  limit: number;
  // Window length in milliseconds.
  windowMs: number;
}

// Returns a 429 NextResponse when the client is over the limit, or null when
// the request may proceed. Call at the top of a route handler:
//
//   const limited = checkRateLimit(request, { name: "generate", limit: 10, windowMs: 60_000 });
//   if (limited) return limited;
export function checkRateLimit(request: Request, options: RateLimitOptions): NextResponse | null {
  const ip = getClientIp(request);
  const result = rateLimit(`${options.name}:${ip}`, options.limit, options.windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
