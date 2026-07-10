import { unstable_cache } from "next/cache";
import { getCountryName, normaliseCode } from "./countries";
import { summariseCountryNews, summariseWorldNews, type CountryNews } from "./gemini";
import { summariseViaOpenRouter, openrouterConfigured } from "./openrouter";
import {
  getSnapshot,
  saveSnapshot,
  listSnapshotDates,
  snapshotsConfigured,
  today,
  type Scope,
} from "./snapshots";

// Once a place's news is generated on a given day it should stay fixed for the
// rest of that day, so a country reads the same all day rather than changing on
// each visit. We cache until the end of the current UTC day; a new day gets a
// new cache key (see cacheDay) and regenerates.
function secondsUntilEndOfUtcDay(): number {
  const now = new Date();
  const endOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((endOfDay - now.getTime()) / 1000));
}

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

// Signals a generation that came back empty (no topics). Thrown inside the
// cached loader so the empty result is NOT cached/persisted for the day — the
// next visit retries instead of showing a blank page all day.
class EmptyResultError extends Error {
  constructor(readonly payload: CountryNews) {
    super("Generated summary was empty.");
    this.name = "EmptyResultError";
  }
}

// Load today's news for a place: prefer a stored snapshot (written by a visit
// or the pre-cache cron), otherwise generate it live and persist it. Wrapped in
// unstable_cache so repeated views in one window skip even the snapshot read.
// Only successful (non-empty) results are cached/persisted, so a failed or empty
// generation is retried on the next visit rather than sticking for the day.
function loadToday(scope: Scope, code: string, generate: () => Promise<CountryNews>) {
  return unstable_cache(
    async (): Promise<CountryNews> => {
      const stored = await getSnapshot(scope, code, today());
      if (stored && stored.topics.length > 0) return stored;
      const fresh = await generate();
      if (fresh.topics.length === 0) throw new EmptyResultError(fresh);
      await saveSnapshot(scope, code, fresh);
      return fresh;
    },
    ["news", scope, code, cacheDay()],
    { revalidate: secondsUntilEndOfUtcDay() },
  )().catch((error) => {
    // Rejections aren't cached, so an empty result is returned (rendered once)
    // without being locked in — the next request will regenerate.
    if (error instanceof EmptyResultError) return error.payload;
    throw error;
  });
}

// Generate a place's news. When OPENROUTER_API_KEY is set, the primary source
// is GDELT (real articles) organised by the OpenRouter model; Gemini (grounded
// search) is the fallback when OpenRouter is unconfigured, errors, or yields
// nothing usable. When OpenRouter is unset, this is just the Gemini path.
async function generateCountry(name: string, code: string): Promise<CountryNews> {
  if (openrouterConfigured()) {
    try {
      const via = await summariseViaOpenRouter("country", name, code, name);
      if (via && via.topics.length > 0) return via;
    } catch {
      // fall through to Gemini
    }
  }
  return summariseCountryNews(name, code);
}

async function generateWorld(): Promise<CountryNews> {
  if (openrouterConfigured()) {
    try {
      const via = await summariseViaOpenRouter("world", "Around the World", "world");
      if (via && via.topics.length > 0) return via;
    } catch {
      // fall through to Gemini
    }
  }
  return summariseWorldNews();
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
  return loadToday("country", key, () => generateCountry(name, code));
}

// Fetch the grounded summary of the most important news worldwide. With `date`,
// returns that day's archived snapshot (or null).
export async function getWorldNews(): Promise<CountryNews>;
export async function getWorldNews(date: string): Promise<CountryNews | null>;
export async function getWorldNews(date?: string): Promise<CountryNews | null> {
  if (date) return getSnapshot("world", "world", date);
  return loadToday("world", "world", () => generateWorld());
}

// Available archive dates for a place, newest first (empty if no history).
export function getCountryArchiveDates(rawCode: string): Promise<string[]> {
  return listSnapshotDates("country", normaliseCode(rawCode).toLowerCase());
}

export function getWorldArchiveDates(): Promise<string[]> {
  return listSnapshotDates("world", "world");
}

export { snapshotsConfigured };
