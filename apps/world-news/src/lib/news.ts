import { unstable_cache } from "next/cache";
import { getCountryName, normaliseCode } from "./countries";
import { summariseCountryNews, summariseWorldNews, type CountryNews } from "./gemini";

// How long a country's summary is reused before we ask Gemini again. News
// moves fast but re-summarising on every page view would be wasteful and slow,
// so we regenerate at most once per window (mirrors daily-debate's
// "generate once per day" intent, minus the database).
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
  return new Date().toISOString().slice(0, 10);
}

// Fetch (and cache) the topic-split, grounded news summary for one country.
// Throws UnknownCountryError for unrecognised codes; MissingApiKeyError
// propagates from the Gemini layer when the key is unset.
export async function getCountryNews(rawCode: string): Promise<CountryNews> {
  const code = normaliseCode(rawCode);
  const name = getCountryName(code);
  if (!name) throw new UnknownCountryError(code);

  const cached = unstable_cache(
    () => summariseCountryNews(name, code),
    ["country-news", code, cacheDay()],
    { revalidate: REVALIDATE_SECONDS },
  );

  return cached();
}

// Fetch (and cache) the topic-split, grounded summary of the most important
// news worldwide. MissingApiKeyError / RateLimitError propagate from the
// Gemini layer.
export async function getWorldNews(): Promise<CountryNews> {
  const cached = unstable_cache(
    () => summariseWorldNews(),
    ["world-news", cacheDay()],
    { revalidate: REVALIDATE_SECONDS },
  );

  return cached();
}
