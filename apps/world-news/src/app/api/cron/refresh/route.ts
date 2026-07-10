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

  const results: { place: string; ok: boolean }[] = [];

  // World first (most visited).
  try {
    await getWorldNews();
    results.push({ place: "world", ok: true });
  } catch {
    results.push({ place: "world", ok: false });
  }

  // Countries sequentially to avoid hammering the LLM's rate limit.
  for (const code of PRECACHE_COUNTRIES) {
    try {
      await getCountryNews(code);
      results.push({ place: code, ok: true });
    } catch {
      results.push({ place: code, ok: false });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  return Response.json({ refreshed: ok, total: results.length, results });
}
