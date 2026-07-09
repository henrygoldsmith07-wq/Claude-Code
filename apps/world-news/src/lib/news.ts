import { unstable_cache } from "next/cache";
import { getCountryName, normaliseCode } from "./countries";
import { summariseCountryNews, summariseWorldNews, type CountryNews } from "./gemini";
import {
  getSnapshot,
  saveSnapshot,
  listSnapshotDates,
  snapshotsConfigured,
  today,
  type Scope,
} from "./snapshots";

// How long a summary is reused before we ask Gemini again. News moves fast but
// re-summarising on every page view would be wasteful and slow, so we
// regenerate at most once per window (mirrors daily-debate's "generate once per
// day" intent).
const REVALIDATE_SECONDS = 6 * 60 * 60; // 6 hours

// Raised when the route param isn't a country we know about.
export class UnknownCountryError extends Error {
  constructor(code: string) {
    super(`Unknown country code: ${code}`);
    this.name = "UnknownCountryError";
  }
}

// Cache key includes the calendar date so a new day always regenerates even if
// the process has been alive longer than the revalidate window.
function cacheDay(): string {
  return today();
}

// Load today's news for a place: prefer a stored snapshot (written by a visit
// or the pre-cache cron), otherwise generate it live and persist it. Wrapped in
// unstable_cache so repeated views in one window skip even the snapshot read.
function loadToday(scope: Scope, code: string, generate: () => Promise<CountryNews>) {
  return unstable_cache(
    async (): Promise<CountryNews> => {
      const stored = await getSnapshot(scope, code, today());
      if (stored) return stored;
      const fresh = await generate();
      await saveSnapshot(scope, code, fresh);
      return fresh;
    },
    ["news", scope, code, cacheDay()],
    { revalidate: REVALIDATE_SECONDS },
  )();
}

// Fetch the topic-split, grounded news summary for one country. When `date` is
// given, returns that day's archived snapshot (or null if none exists).
// Throws UnknownCountryError for unrecognised codes; MissingApiKeyError /
// RateLimitError propagate from the Gemini layer for the live path.
export async function getCountryNews(rawCode: string): Promise<CountryNews>;
export async function getCountryNews(rawCode: string, date: string): Promise<CountryNews | null>;
export async function getCountryNews(
  rawCode: string,
  date?: string,
): Promise<CountryNews | null> {
  const code = normaliseCode(rawCode);
  const name = getCountryName(code);
  if (!name) throw new UnknownCountryError(code);
  const key = code.toLowerCase();

  if (date) return getSnapshot("country", key, date);
  return loadToday("country", key, () => summariseCountryNews(name, code));
}

// Fetch the grounded summary of the most important news worldwide. With `date`,
// returns that day's archived snapshot (or null).
export async function getWorldNews(): Promise<CountryNews>;
export async function getWorldNews(date: string): Promise<CountryNews | null>;
export async function getWorldNews(date?: string): Promise<CountryNews | null> {
  if (date) return getSnapshot("world", "world", date);
  return loadToday("world", "world", () => summariseWorldNews());
}

// Available archive dates for a place, newest first (empty if no history).
export function getCountryArchiveDates(rawCode: string): Promise<string[]> {
  return listSnapshotDates("country", normaliseCode(rawCode).toLowerCase());
}

export function getWorldArchiveDates(): Promise<string[]> {
  return listSnapshotDates("world", "world");
}

export { snapshotsConfigured };
