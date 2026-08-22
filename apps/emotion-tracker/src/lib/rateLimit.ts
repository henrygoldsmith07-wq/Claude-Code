import { NextResponse } from "next/server";

// Lightweight, dependency-free per-client rate limiter (fixed window).
//
// It guards the paid API routes so a single visitor can't spam an endpoint and
// run up the account owner's Gemini bill. State lives in the server
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

// Best-effort client identifier.
//
// Security note: x-forwarded-for's first value is client-controlled unless a
// trusted proxy overwrites it. Only honour it when TRUST_PROXY=1 is set
// (i.e. the deployment actually sits behind such a proxy); otherwise callers
// fall back to x-real-ip / a shared bucket so a spoofed header can't mint
// unlimited fresh buckets against the paid-API route.
export function getClientIp(request: Request): string {
  const forwarded = process.env.TRUST_PROXY === "1" ? request.headers.get("x-forwarded-for") : null;
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
