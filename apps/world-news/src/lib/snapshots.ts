import type { CountryNews } from "./gemini";

// Persistent daily snapshots of generated news, stored in Supabase (Postgres)
// via its PostgREST API. This backs two features:
//   1. the historical timeline (read past days), and
//   2. scheduled pre-caching (a cron fills today's snapshot so page loads are
//      instant and don't re-hit the LLM).
// Everything here is best-effort and gated on env: if Supabase isn't
// configured, every function no-ops/returns empty and the app falls back to
// generating live, exactly as before.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type Scope = "world" | "country";

export function snapshotsConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function restUrl(): string {
  return `${SUPABASE_URL}/rest/v1/news_snapshots`;
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY as string,
    authorization: `Bearer ${SERVICE_KEY as string}`,
    "content-type": "application/json",
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Store today's snapshot for a place (upsert on scope+code+date). Never throws.
export async function saveSnapshot(scope: Scope, code: string, payload: CountryNews): Promise<void> {
  if (!snapshotsConfigured()) return;
  try {
    await fetch(restUrl(), {
      method: "POST",
      headers: { ...authHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        scope,
        code,
        snapshot_date: today(),
        generated_at: payload.generatedAt,
        payload,
      }),
      cache: "no-store",
    });
  } catch {
    // Best-effort — a failed write must never break page rendering.
  }
}

// Fetch a place's snapshot for a specific date, or the latest one when date is
// omitted. Returns null if none / not configured / on error.
export async function getSnapshot(
  scope: Scope,
  code: string,
  date?: string,
): Promise<CountryNews | null> {
  if (!snapshotsConfigured()) return null;
  try {
    const q = new URLSearchParams({
      scope: `eq.${scope}`,
      code: `eq.${code}`,
      select: "payload",
      order: "snapshot_date.desc",
      limit: "1",
    });
    if (date) q.set("snapshot_date", `eq.${date}`);
    const res = await fetch(`${restUrl()}?${q.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { payload?: CountryNews }[];
    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

// List the dates (newest first) for which a place has snapshots — drives the
// timeline slider. Capped so the control stays manageable.
export async function listSnapshotDates(scope: Scope, code: string): Promise<string[]> {
  if (!snapshotsConfigured()) return [];
  try {
    const q = new URLSearchParams({
      scope: `eq.${scope}`,
      code: `eq.${code}`,
      select: "snapshot_date",
      order: "snapshot_date.desc",
      limit: "60",
    });
    const res = await fetch(`${restUrl()}?${q.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { snapshot_date?: string }[];
    return rows.map((r) => r.snapshot_date).filter((d): d is string => Boolean(d));
  } catch {
    return [];
  }
}
