import { NextResponse } from "next/server";

// Lightweight, dependency-free per-client rate limiter (fixed window).
//
// Guards the Anthropic-backed routes so a single visitor can't spam an
// endpoint and run up the account owner's API bill. State lives in the
// server process, so on a single long-lived server this is enforced
// globally; on multi-instance/serverless deployments each instance keeps its
// own counters (effective limit becomes limit x instances).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

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

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitOptions {
  name: string;
  limit: number;
  windowMs: number;
}

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
