import { getCountryNews, getWorldNews, snapshotsConfigured } from "@/lib/news";

// Scheduled pre-caching. Vercel Cron (see vercel.json) hits this on a schedule
// to regenerate the world summary and a small set of high-traffic countries,
// storing each as today's snapshot so real visits load instantly and don't
// burn Gemini quota. Kept deliberately small to stay well within the free tier.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A compact, globally significant set — expand cautiously (each is one Gemini
// call per run).
const PRECACHE_COUNTRIES = ["us", "gb", "ua", "ru", "cn", "in", "fr", "de", "il", "ps"];

// Stop early enough to return a real response. Overrunning maxDuration gets the
// function killed mid-flight, which loses the run's report entirely even though
// the snapshots written so far are fine — a partial 200 is strictly better.
const DEADLINE_MS = (300 - 30) * 1000;

// Breathing room between generations. Each call is slow enough that this adds
// little to the total, and it keeps a burst of 11 requests from tripping the
// per-minute limit that the key rotation then can't distinguish from real
// quota exhaustion.
const GAP_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
  // set. Also accept ?key= for manual triggering. If no secret is configured,
  // refuse rather than expose an open regeneration endpoint.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key");
  if (!secret || provided !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!snapshotsConfigured()) {
    return Response.json({ error: "snapshots_not_configured" }, { status: 503 });
  }

  const startedAt = Date.now();
  const results: { place: string; ok: boolean }[] = [];
  let skipped = 0;

  // World first (most visited).
  try {
    await getWorldNews();
    results.push({ place: "world", ok: true });
  } catch {
    results.push({ place: "world", ok: false });
  }

  // Countries sequentially, paced, to avoid hammering the LLM's rate limit.
  // Whatever we don't reach before the deadline is left for the next run — the
  // snapshots already written stay valid for the rest of the day either way.
  for (const code of PRECACHE_COUNTRIES) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      skipped++;
      continue;
    }
    await sleep(GAP_MS);
    try {
      await getCountryNews(code);
      results.push({ place: code, ok: true });
    } catch {
      results.push({ place: code, ok: false });
    }
  }

  if (skipped > 0) {
    console.warn(`[cron] deadline reached — ${skipped} place(s) left for the next run`);
  }

  const ok = results.filter((r) => r.ok).length;
  return Response.json({
    refreshed: ok,
    total: results.length + skipped,
    skipped,
    results,
  });
}
