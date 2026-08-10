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

export type SourceKind = "newsroom" | "wire" | "official" | "expert" | "document" | "unknown";

export interface SourceAttribution {
  url: string;
  title: string;
  publisher?: string;
  countryCode?: string;
  perspective?: Perspective;
  isPrimary?: boolean;
  // --- Provenance (methodology) ---
  // What kind of origin the URL represents (helps coverage reasoning).
  sourceKind?: SourceKind;
  // Best-effort: when the source piece was published/syndicated, if known from grounding/chunks.
  publishedAt?: string; // ISO-8601 when present; absent means unknown
  // Model-asserted confidence this URL actually supports the story it is attached to.
  confidence?: "high" | "medium" | "low";
}

export interface SourceMix {
  total: number;
  byCountry: { code: string; label: string; count: number }[];
  byPerspective: { perspective: Perspective; count: number }[];
  byKind: { kind: SourceKind; count: number }[];
  primaryCount: number;
  // Methodology signals (not editorial):
  perspectiveEntropy: number; // 0..~2.32 bits — higher = more balanced
  kindDistinctCount: number; // 0..6 — how many different source kinds are present
}

// ---------------------------------------------------------------------------
// Story-level structures
// ---------------------------------------------------------------------------
export interface TimelineEvent {
  date: string; // YYYY-MM-DD or free-text date
  label: string;
  kind?: "reported" | "correction" | "update";
}

export interface ConflictingClaim {
  claim: string;
  attributedTo: string[];
  counterClaim: string;
  counterAttributedTo: string[];
  // Where the two accounts diverge most (one line, helps the methodology surface).
  disagreementDimension?: string; // e.g. "casualty count", "who initiated", "legal authority"
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
  // Who is reporting it (with provenance per source)
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
  // Continuity & significance (distinguish from popularity)
  historicalContext?: string[]; // 0–2 prior related events
  significance?: number; // 0..100 editorial significance
  significanceReasons?: string[];
  // Methodology (computed or model-provided): how the story was assembled.
  methodology?: {
    provenanceNote?: string; // one sentence: how claims were sourced/verified
    coverageScore?: number; // 0..100 — dense sourcing, geography, perspective mix
  };
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
  // Page-level methodology note: one sentence on overall sourcing.
  provenanceNote?: string | null;
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

const DOMAIN_KIND: Record<string, SourceKind> = {
  "bbc.co.uk": "newsroom",
  "bbc.com": "newsroom",
  "theguardian.com": "newsroom",
  "reuters.com": "wire",
  "apnews.com": "wire",
  "bloomberg.com": "newsroom",
  "economist.com": "newsroom",
  "aljazeera.com": "newsroom",
  "nytimes.com": "newsroom",
  "whitehouse.gov": "official",
  "gov.uk": "official",
  "europa.eu": "official",
  "un.org": "official",
  "who.int": "official",
  "imf.org": "official",
};

function inferSourceKind(url: string, title: string): SourceKind {
  const d = domainOf(url);
  if (DOMAIN_KIND[d]) return DOMAIN_KIND[d];
  if (/\.gov|\.int|un\.org|parliament\.|bundestag|elysee/i.test(url)) return "official";
  if (/transcript|official statement|press release|communiqu|data release|report/i.test(title)) return "document";
  if (/university|institute|expert|analyst/i.test(title)) return "expert";
  return "unknown";
}

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
    sourceKind: inferSourceKind(url, title),
  };
}

function shannonEntropy(counts: number[]): number {
  const tot = counts.reduce((a, b) => a + b, 0);
  if (tot <= 1) return 0;
  let acc = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / tot;
    acc -= p * Math.log2(p);
  }
  return Math.round(acc * 100) / 100;
}

export function buildSourceMix(sources: SourceAttribution[]): SourceMix {
  const byCountryMap = new Map<string, number>();
  const byPerspectiveMap = new Map<Perspective, number>();
  const byKindMap = new Map<SourceKind, number>();
  let primaryCount = 0;
  for (const s of sources) {
    byCountryMap.set(s.countryCode ?? "unknown", (byCountryMap.get(s.countryCode ?? "unknown") ?? 0) + 1);
    byPerspectiveMap.set(s.perspective ?? "unknown", (byPerspectiveMap.get(s.perspective ?? "unknown") ?? 0) + 1);
    byKindMap.set(s.sourceKind ?? "unknown", (byKindMap.get(s.sourceKind ?? "unknown") ?? 0) + 1);
    if (s.isPrimary) primaryCount++;
  }
  const dedupedCountries = new Set((sources as { countryCode?: string }[]).map((s) => s.countryCode ?? "unknown").filter((c) => c !== "unknown")).size;
  const dedupedPerspectives = new Set((sources as { perspective?: string }[]).map((s) => s.perspective ?? "unknown").filter((p) => p !== "unknown")).size;
  void dedupedCountries;
  void dedupedPerspectives;
  const byCountry = [...byCountryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, count]) => ({ code, label: COUNTRY_LABEL[code] ?? code, count }));
  const byPerspective = [...byPerspectiveMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([perspective, count]) => ({ perspective, count }));
  const byKind = [...byKindMap.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count }));
  const perspectiveEntropy = shannonEntropy([...byPerspectiveMap.values()]);
  const kindDistinctCount = byKindMap.size;
  return { total: sources.length, byCountry, byPerspective, byKind, primaryCount, perspectiveEntropy, kindDistinctCount };
}

export function emptyMeta(): NewsMeta {
  return { widelyAgreedFacts: [], uncertainty: [], coverageGaps: [], corrections: [], whatChangedSinceYesterday: null, provenanceNote: null };
}

export function emptySourceMix(): SourceMix {
  return { total: 0, byCountry: [], byPerspective: [], byKind: [], primaryCount: 0, perspectiveEntropy: 0, kindDistinctCount: 0 };
}

export function coverageScoreForMix(mix: SourceMix, hasTimeline: boolean, hasConflicts: boolean): number {
  // 0..100 heuristic — not editorial judgment, just density/heterogeneity.
  let s = 0;
  if (mix.total >= 6) s += 28;
  else if (mix.total >= 3) s += 16;
  else if (mix.total >= 1) s += 6;
  // Geographic spread
  const countries = mix.byCountry.filter((c) => c.code !== "unknown").length;
  s += Math.min(22, countries * 7);
  // Perspective entropy (0..~2.3) scaled
  s += Math.round(Math.min(1, mix.perspectiveEntropy / 1.2) * 18);
  if (mix.primaryCount > 0) s += 10;
  s += mix.kindDistinctCount >= 3 ? 8 : mix.kindDistinctCount >= 2 ? 4 : 0;
  if (hasTimeline) s += 8;
  if (hasConflicts) s += 6;
  return Math.max(0, Math.min(100, s));
}
