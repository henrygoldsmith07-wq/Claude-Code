// Story-level model for the repositioned World News:
// "Understand what happened, where it happened, who is reporting it and where accounts differ."
// This sits on top of the existing CountryNews: instead of only country-scoped topic summaries,
// we also produce story clusters and explicit handling for source mix, perspective, primary
// sources, timeline, conflicting claims, agreed facts, uncertainty, corrections, what changed,
// and coverage gaps.

// Topic is the fixed set from gemini.ts; keep as string here to avoid a circular import.

// ---------------------------------------------------------------------------
// Source attribution
// ---------------------------------------------------------------------------
export type Perspective =
  | "left"
  | "center-left"
  | "center"
  | "center-right"
  | "right"
  | "unknown";

export const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  left: "Left",
  "center-left": "Centre-left",
  center: "Centre",
  "center-right": "Centre-right",
  right: "Right",
  unknown: "Unknown",
};

export interface SourceAttribution {
  url: string;
  title: string;
  publisher?: string;
  countryCode?: string;
  perspective?: Perspective;
  isPrimary?: boolean;
}

export interface SourceMix {
  total: number;
  byCountry: { code: string; label: string; count: number }[];
  byPerspective: { perspective: Perspective; count: number }[];
  primaryCount: number;
}

// ---------------------------------------------------------------------------
// Story-level structures
// ---------------------------------------------------------------------------
export interface TimelineEvent {
  date: string; // YYYY-MM-DD or free-text date
  label: string;
}

export interface ConflictingClaim {
  claim: string;
  attributedTo: string[];
  counterClaim: string;
  counterAttributedTo: string[];
  context?: string;
}

export interface StoryCorrection {
  date: string;
  note: string;
}

export interface StoryCluster {
  id: string;
  headline: string;
  topic: string;
  summary: string;
  keyPoints: string[];
  location?: { label: string; lat: number; lng: number; countryCode?: string };
  // Who is reporting it
  sources: SourceAttribution[];
  sourceMix: SourceMix;
  // Depth
  primarySources: SourceAttribution[];
  timeline: TimelineEvent[];
  conflictingClaims: ConflictingClaim[];
  widelyAgreedFacts: string[];
  uncertainty: string[];
  corrections: StoryCorrection[];
  coverageGaps: string[];
}

// ---------------------------------------------------------------------------
// Page-level aggregates (also stored on CountryNews for convenience)
// ---------------------------------------------------------------------------
export interface NewsMeta {
  widelyAgreedFacts: string[];
  uncertainty: string[];
  coverageGaps: string[];
  corrections: StoryCorrection[];
  whatChangedSinceYesterday?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Small heuristic publisher → country code (covers the most common global sources).
const DOMAIN_COUNTRY: Record<string, string> = {
  "bbc.co.uk": "GB",
  "bbc.com": "GB",
  "theguardian.com": "GB",
  "reuters.com": "GB",
  "ft.com": "GB",
  "economist.com": "GB",
  "independent.co.uk": "GB",
  "telegraph.co.uk": "GB",
  "nytimes.com": "US",
  "washingtonpost.com": "US",
  "wsj.com": "US",
  "cnn.com": "US",
  "apnews.com": "US",
  "bloomberg.com": "US",
  "politico.com": "US",
  "axios.com": "US",
  "npr.org": "US",
  "latimes.com": "US",
  "usatoday.com": "US",
  "foxnews.com": "US",
  "lemonade.fr": "FR",
  "lemonde.fr": "FR",
  "lefigaro.fr": "FR",
  "france24.com": "FR",
  "spiegel.de": "DE",
  "zeit.de": "DE",
  "faz.net": "DE",
  "sueddeutsche.de": "DE",
  "elpais.com": "ES",
  "elmundo.es": "ES",
  "lavanguardia.com": "ES",
  "corriere.it": "IT",
  "repubblica.it": "IT",
  "asahi.com": "JP",
  "nikkei.com": "JP",
  "japantimes.co.jp": "JP",
  "chinadaily.com.cn": "CN",
  "xinhuanet.com": "CN",
  "scmp.com": "HK",
  "aljazeera.com": "QA",
  "haaretz.com": "IL",
  "jpost.com": "IL",
  "timesofisrael.com": "IL",
  "themoscowtimes.com": "RU",
  "tass.com": "RU",
  "ria.ru": "RU",
  "indiatimes.com": "IN",
  "thehindu.com": "IN",
  "hindustantimes.com": "IN",
  "abc.net.au": "AU",
  "smh.com.au": "AU",
};

const DOMAIN_PERSPECTIVE: Record<string, Perspective> = {
  "theguardian.com": "center-left",
  "independent.co.uk": "center-left",
  "nytimes.com": "center-left",
  "washingtonpost.com": "center-left",
  "npr.org": "center-left",
  "bbc.co.uk": "center",
  "bbc.com": "center",
  "reuters.com": "center",
  "apnews.com": "center",
  "economist.com": "center",
  "ft.com": "center",
  "bloomberg.com": "center",
  "wsj.com": "center-right",
  "telegraph.co.uk": "center-right",
  "foxnews.com": "right",
  "lemonde.fr": "center-left",
  "lefigaro.fr": "center-right",
  "spiegel.de": "center-left",
  "zeit.de": "center-left",
  "faz.net": "center-right",
  "corriere.it": "center",
  "haaretz.com": "center-left",
  "jpost.com": "center-right",
};

const COUNTRY_LABEL: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  JP: "Japan",
  CN: "China",
  HK: "Hong Kong",
  QA: "Qatar",
  IL: "Israel",
  RU: "Russia",
  IN: "India",
  AU: "Australia",
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function inferSourceAttribution(url: string, title = ""): SourceAttribution {
  const d = domainOf(url);
  const cc = DOMAIN_COUNTRY[d] ?? "";
  const perspective = DOMAIN_PERSPECTIVE[d] ?? "unknown";
  const isPrimary =
    /(\.gov|\.int|un\.org|europa\.eu|whitehouse\.gov|parliament\.|bundestag\.de|elysee\.fr)/i.test(url) ||
    /official statement|press release|transcript|communiqu[eé]/i.test(title);
  return {
    url,
    title: title || url,
    publisher: d || undefined,
    countryCode: cc || undefined,
    perspective,
    isPrimary: isPrimary || undefined,
  };
}

export function buildSourceMix(sources: SourceAttribution[]): SourceMix {
  const byCountryMap = new Map<string, number>();
  const byPerspectiveMap = new Map<Perspective, number>();
  let primaryCount = 0;
  for (const s of sources) {
    const c = s.countryCode ?? "unknown";
    byCountryMap.set(c, (byCountryMap.get(c) ?? 0) + 1);
    const p = s.perspective ?? "unknown";
    byPerspectiveMap.set(p, (byPerspectiveMap.get(p) ?? 0) + 1);
    if (s.isPrimary) primaryCount++;
  }
  const byCountry = [...byCountryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, count]) => ({ code, label: COUNTRY_LABEL[code] ?? code, count }));
  const byPerspective = [...byPerspectiveMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([perspective, count]) => ({ perspective, count }));
  return { total: sources.length, byCountry, byPerspective, primaryCount };
}

export function emptyMeta(): NewsMeta {
  return { widelyAgreedFacts: [], uncertainty: [], coverageGaps: [], corrections: [], whatChangedSinceYesterday: null };
}

export function emptySourceMix(): SourceMix {
  return { total: 0, byCountry: [], byPerspective: [], primaryCount: 0 };
}
