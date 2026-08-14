// Human-labelled clustering gold set.
//
// Every event below was labelled by hand against the guidelines in
// LABELLING_GUIDELINES: one `GoldEvent` = one real-world occurrence, and an
// article belongs to it if a reader would say "these are covering the same
// thing that happened", regardless of language, outlet or framing.
//
// The hard cases are deliberate and carry a `difficulty` tag so the benchmark
// can report where the clusterer actually breaks rather than reporting one
// flattering average:
//   - `crosslingual`  same event reported in 2+ languages
//   - `nearmiss`      two genuinely different events that look alike
//   - `syndication`   the same wire copy running under many mastheads
//   - `multilocation` one event with several geographic loci
//   - `longtail`      thin coverage, 1-2 outlets
//
// Distractors (DISTRACTORS) are singletons on purpose: an event of one. A
// clusterer that sweeps them into neighbouring events loses precision, which is
// exactly what we want measured.

import type { ArticleLike } from "./clustering";
import { GOLD_BATCH_1 } from "./benchmarkGoldBatch1";
import { GOLD_BATCH_2 } from "./benchmarkGoldBatch2";

export const LABELLING_GUIDELINES = [
  "Same event = same occurrence at a point in time, not the same subject. Two rate decisions by the same bank are two events.",
  "Language and framing are irrelevant to identity. A French and an English report of one announcement are one event.",
  "Analysis and reaction pieces belong to the event they analyse when they are anchored to that specific occurrence.",
  "A rolling situation (a war, an election campaign) is not one event; label the discrete developments within it.",
  "When two outlets differ on the facts (casualty counts, who acted first), that is one contested event, not two.",
  "If a labeller is unsure after 30 seconds, mark the case `difficulty` and record why in `note`.",
] as const;

export type GoldRegion =
  | "Europe" | "North America" | "Latin America" | "Middle East"
  | "Africa" | "South Asia" | "East Asia" | "Southeast Asia" | "Oceania" | "Global";

export type GoldDifficulty = "easy" | "crosslingual" | "nearmiss" | "syndication" | "multilocation" | "longtail";

/** [publisher, headline, language, hoursAfterEventStart, optional place override] */
type ArticleSpec = [string, string, string, number, [string, number, number, string]?];

export interface GoldEventSpec {
  key: string;
  topic: string;
  region: GoldRegion;
  /** [label, lat, lng, ISO2] — the event's primary locus. */
  place: [string, number, number, string];
  /** ISO timestamp the event broke. */
  at: string;
  tags: string[];
  difficulty: GoldDifficulty;
  note?: string;
  articles: ArticleSpec[];
}

// ---------------------------------------------------------------------------
// Labelled events
// ---------------------------------------------------------------------------

export const GOLD_EVENTS: GoldEventSpec[] = [...GOLD_BATCH_1, ...GOLD_BATCH_2];


// ---------------------------------------------------------------------------
// Distractors — labelled singletons
// ---------------------------------------------------------------------------

/** [publisher, headline, topic, region, place, ISO time, tags] */
type DistractorSpec = [string, string, string, GoldRegion, [string, number, number, string], string, string[]];

export const DISTRACTORS: DistractorSpec[] = [
  ["reuters.com", "Tokyo stocks close higher on technology gains", "Economy & Business", "East Asia", ["Tokyo", 35.68, 139.69, "JP"], "2026-02-05T06:00:00Z", ["stocks"]],
  ["bloomberg.com", "Copper hits nine-month high on supply concerns", "Economy & Business", "Latin America", ["Santiago", -33.45, -70.67, "CL"], "2026-02-09T14:00:00Z", ["commodities"]],
  ["bbc.co.uk", "Rail strike called off after pay deal agreed", "Society & Culture", "Europe", ["London", 51.5, -0.13, "GB"], "2026-02-14T08:00:00Z", ["strike", "rail"]],
  ["lemonde.fr", "Le musee du Louvre annonce une renovation majeure", "Society & Culture", "Europe", ["Paris", 48.86, 2.34, "FR"], "2026-03-01T10:00:00Z", ["museum"]],
  ["thehindu.com", "Monsoon forecast revised upward for the season", "Science & Health", "South Asia", ["Mumbai", 19.08, 72.88, "IN"], "2026-04-20T05:00:00Z", ["monsoon"]],
  ["scmp.com", "High-speed rail link opens between two southern cities", "Society & Culture", "East Asia", ["Guangzhou", 23.13, 113.26, "CN"], "2026-05-08T03:00:00Z", ["rail"]],
  ["apnews.com", "Wildfire contained after week-long effort", "Science & Health", "North America", ["Sacramento", 38.58, -121.49, "US"], "2026-08-14T20:00:00Z", ["wildfire"]],
  ["abc.net.au", "Great Barrier Reef survey reports partial coral recovery", "Science & Health", "Oceania", ["Cairns", -16.92, 145.77, "AU"], "2026-03-22T02:00:00Z", ["coral", "reef"]],
  ["aljazeera.com", "Football club appoints new head coach", "Sport", "Middle East", ["Doha", 25.29, 51.53, "QA"], "2026-06-30T15:00:00Z", ["football"]],
  ["france24.com", "Film festival announces competition lineup", "Society & Culture", "Europe", ["Cannes", 43.55, 7.02, "FR"], "2026-04-14T11:00:00Z", ["film"]],
  ["npr.org", "Study links urban tree cover to lower summer mortality", "Science & Health", "North America", ["Chicago", 41.88, -87.63, "US"], "2026-07-02T13:00:00Z", ["urban", "heat"]],
  ["elpais.com", "Renovables superan al gas en la generacion electrica mensual", "Economy & Business", "Europe", ["Madrid", 40.42, -3.7, "ES"], "2026-05-19T09:00:00Z", ["renewables"]],
  ["hindustantimes.com", "Metro line extension opens ahead of schedule", "Society & Culture", "South Asia", ["Delhi", 28.61, 77.21, "IN"], "2026-09-09T06:00:00Z", ["metro"]],
  ["nikkei.com", "Retail sales rise for a third consecutive month", "Economy & Business", "East Asia", ["Tokyo", 35.68, 139.69, "JP"], "2026-10-01T04:00:00Z", ["retail"]],
  ["theguardian.com", "Report finds gaps in school mental health provision", "Society & Culture", "Europe", ["Manchester", 53.48, -2.24, "GB"], "2026-11-11T07:00:00Z", ["education", "health"]],
  ["reuters.com", "Airline orders forty narrowbody jets", "Economy & Business", "Middle East", ["Dubai", 25.2, 55.27, "AE"], "2026-11-17T09:00:00Z", ["aviation"]],
  ["bbc.co.uk", "Archaeologists uncover Roman-era villa during roadworks", "Society & Culture", "Europe", ["Verona", 45.44, 10.99, "IT"], "2026-06-06T12:00:00Z", ["archaeology"]],
  ["apnews.com", "Court upholds emissions rule for heavy vehicles", "Politics", "North America", ["Washington", 38.9, -77.04, "US"], "2026-03-27T16:00:00Z", ["courts", "emissions"]],
  ["aljazeera.com", "Aid convoy reaches remote province after road reopens", "World & Conflict", "Africa", ["Juba", 4.85, 31.58, "SS"], "2026-02-27T10:00:00Z", ["aid"]],
  ["france24.com", "Farmers stage tractor protest over pricing rules", "Society & Culture", "Europe", ["Lyon", 45.76, 4.84, "FR"], "2026-01-30T09:00:00Z", ["protest", "agriculture"]],
  ["reuters.com", "Central bank governor to step down at end of term", "Economy & Business", "Europe", ["Stockholm", 59.33, 18.07, "SE"], "2026-04-03T08:00:00Z", ["central bank", "appointment"]],
  ["scmp.com", "Typhoon season forecast points to fewer landfalls", "Science & Health", "East Asia", ["Taipei", 25.03, 121.57, "TW"], "2026-05-02T01:00:00Z", ["typhoon", "forecast"]],
  ["elpais.com", "Un tribunal anula una multa a una empresa energetica", "Politics", "Latin America", ["Bogota", 4.71, -74.07, "CO"], "2026-06-11T15:00:00Z", ["courts", "energy"]],
  ["abc.net.au", "Wool prices climb after export demand rebounds", "Economy & Business", "Oceania", ["Melbourne", -37.81, 144.96, "AU"], "2026-07-23T02:00:00Z", ["wool", "exports"]],
  ["thehindu.com", "Tiger census reports population up in three reserves", "Science & Health", "South Asia", ["Nagpur", 21.15, 79.09, "IN"], "2026-08-05T06:00:00Z", ["wildlife", "census"]],
  ["aljazeera.com", "Desalination plant opens on the northern coast", "Science & Health", "Middle East", ["Muscat", 23.59, 58.41, "OM"], "2026-09-13T09:00:00Z", ["water", "infrastructure"]],
  ["france24.com", "Un festival de jazz annonce sa programmation", "Society & Culture", "Africa", ["Dakar", 14.72, -17.47, "SN"], "2026-10-19T12:00:00Z", ["music", "festival"]],
  ["reuters.com", "Shipping line adds direct route to west coast ports", "Economy & Business", "Southeast Asia", ["Ho Chi Minh City", 10.82, 106.63, "VN"], "2026-11-02T04:00:00Z", ["shipping", "trade"]],
  ["bbc.co.uk", "Museum returns disputed artefacts after ten-year claim", "Society & Culture", "Europe", ["Edinburgh", 55.95, -3.19, "GB"], "2026-12-08T11:00:00Z", ["museum", "restitution"]],
  ["apnews.com", "Snowpack survey shows above-average water content", "Science & Health", "North America", ["Denver", 39.74, -104.99, "US"], "2026-01-21T17:00:00Z", ["snowpack", "water"]],
];

// ---------------------------------------------------------------------------
// Materialisation
// ---------------------------------------------------------------------------

export interface GoldArticle extends ArticleLike {
  /** Gold event key, or null for a labelled singleton. */
  eventKey: string | null;
  region: GoldRegion;
  difficulty: GoldDifficulty;
}

/** Expand the specs into flat labelled articles. Deterministic ids. */
export function goldArticles(): GoldArticle[] {
  const out: GoldArticle[] = [];
  for (const ev of GOLD_EVENTS) {
    ev.articles.forEach(([publisher, title, language, hours, place], i) => {
      const loc = place ?? ev.place;
      out.push({
        id: `${ev.key}#${i}`,
        title,
        url: `https://${publisher}/${ev.key}-${i}`,
        publisher,
        countryCode: loc[3] || undefined,
        publishedAt: new Date(Date.parse(ev.at) + hours * 3_600_000).toISOString(),
        tags: ev.tags,
        location: { label: loc[0], lat: loc[1], lng: loc[2], countryCode: loc[3] || undefined },
        topic: ev.topic,
        language,
        eventKey: ev.key,
        region: ev.region,
        difficulty: ev.difficulty,
      });
    });
  }
  DISTRACTORS.forEach(([publisher, title, topic, region, place, at, tags], i) => {
    out.push({
      id: `distractor#${i}`,
      title,
      url: `https://${publisher}/distractor-${i}`,
      publisher,
      countryCode: place[3] || undefined,
      publishedAt: at,
      tags,
      location: { label: place[0], lat: place[1], lng: place[2], countryCode: place[3] || undefined },
      topic,
      language: "en",
      eventKey: null,
      region,
      difficulty: "easy",
    });
  });
  return out;
}

/** Ground-truth groups: one array of article ids per labelled event. */
export function goldGroups(articles = goldArticles()): string[][] {
  const byEvent = new Map<string, string[]>();
  for (const a of articles) {
    const key = a.eventKey ?? `singleton:${a.id}`;
    const g = byEvent.get(key);
    if (g) g.push(a.id);
    else byEvent.set(key, [a.id]);
  }
  return [...byEvent.values()];
}

export function goldStats(): { events: number; articles: number; singletons: number; regions: number; topics: number } {
  const arts = goldArticles();
  return {
    events: GOLD_EVENTS.length,
    articles: arts.length,
    singletons: DISTRACTORS.length,
    regions: new Set(arts.map((a) => a.region)).size,
    topics: new Set(arts.map((a) => a.topic)).size,
  };
}
