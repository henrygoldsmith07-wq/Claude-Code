// Synthetic benchmark corpus — scale testing for the clusterer.
//
// The human gold set (./benchmarkGold) measures whether we agree with a person
// about what an event is. It cannot measure what happens at 2,000 articles, and
// hand-labelling that volume is not a good use of anyone's afternoon. So this
// module generates a *programmatically labelled* corpus: every article is
// emitted from a known event, so ground truth is exact by construction.
//
// The two are reported separately in the benchmark output and should never be
// pooled — synthetic labels prove scaling behaviour and robustness to
// paraphrase, they do not prove editorial agreement.
//
// Generation is seeded and deterministic: the same seed always yields the same
// corpus, so a metric change means a code change.

import type { GoldArticle, GoldRegion } from "./benchmarkGold";

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  next: () => number;
  int: (n: number) => number;
  pick: <T>(xs: readonly T[]) => T;
  chance: (p: number) => boolean;
  shuffle: <T>(xs: T[]) => T[];
}

function rngFor(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: <T,>(xs: readonly T[]) => xs[int(xs.length)],
    chance: (p: number) => next() < p,
    shuffle: <T,>(xs: T[]) => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

type City = [name: string, lat: number, lng: number, cc: string, region: GoldRegion];

const CITIES: City[] = [
  ["Berlin", 52.52, 13.4, "DE", "Europe"], ["Paris", 48.86, 2.35, "FR", "Europe"],
  ["Madrid", 40.42, -3.7, "ES", "Europe"], ["Rome", 41.9, 12.5, "IT", "Europe"],
  ["Warsaw", 52.23, 21.01, "PL", "Europe"], ["Stockholm", 59.33, 18.07, "SE", "Europe"],
  ["Athens", 37.98, 23.73, "GR", "Europe"], ["Dublin", 53.35, -6.26, "IE", "Europe"],
  ["Kyiv", 50.45, 30.52, "UA", "Europe"], ["Bucharest", 44.43, 26.1, "RO", "Europe"],
  ["Washington", 38.9, -77.04, "US", "North America"], ["Ottawa", 45.42, -75.7, "CA", "North America"],
  ["Chicago", 41.88, -87.63, "US", "North America"], ["Toronto", 43.65, -79.38, "CA", "North America"],
  ["Mexico City", 19.43, -99.13, "MX", "Latin America"], ["Bogota", 4.71, -74.07, "CO", "Latin America"],
  ["Buenos Aires", -34.6, -58.38, "AR", "Latin America"], ["Lima", -12.05, -77.04, "PE", "Latin America"],
  ["Cairo", 30.04, 31.24, "EG", "Middle East"], ["Amman", 31.95, 35.93, "JO", "Middle East"],
  ["Riyadh", 24.71, 46.68, "SA", "Middle East"], ["Ankara", 39.93, 32.86, "TR", "Middle East"],
  ["Lagos", 6.52, 3.38, "NG", "Africa"], ["Nairobi", -1.29, 36.82, "KE", "Africa"],
  ["Accra", 5.6, -0.19, "GH", "Africa"], ["Addis Ababa", 9.03, 38.74, "ET", "Africa"],
  ["Delhi", 28.61, 77.21, "IN", "South Asia"], ["Dhaka", 23.81, 90.41, "BD", "South Asia"],
  ["Colombo", 6.93, 79.86, "LK", "South Asia"], ["Islamabad", 33.69, 73.06, "PK", "South Asia"],
  ["Tokyo", 35.68, 139.69, "JP", "East Asia"], ["Seoul", 37.57, 126.98, "KR", "East Asia"],
  ["Beijing", 39.9, 116.4, "CN", "East Asia"], ["Taipei", 25.03, 121.57, "TW", "East Asia"],
  ["Jakarta", -6.21, 106.85, "ID", "Southeast Asia"], ["Manila", 14.6, 120.98, "PH", "Southeast Asia"],
  ["Bangkok", 13.76, 100.5, "TH", "Southeast Asia"], ["Hanoi", 21.03, 105.85, "VN", "Southeast Asia"],
  ["Sydney", -33.87, 151.21, "AU", "Oceania"], ["Wellington", -41.29, 174.78, "NZ", "Oceania"],
];

const OUTLETS: [domain: string, cc: string, lang: string][] = [
  ["reuters.com", "GB", "en"], ["apnews.com", "US", "en"], ["bbc.co.uk", "GB", "en"],
  ["theguardian.com", "GB", "en"], ["ft.com", "GB", "en"], ["nytimes.com", "US", "en"],
  ["washingtonpost.com", "US", "en"], ["aljazeera.com", "QA", "en"], ["scmp.com", "HK", "en"],
  ["lemonde.fr", "FR", "fr"], ["lefigaro.fr", "FR", "fr"], ["france24.com", "FR", "fr"],
  ["spiegel.de", "DE", "de"], ["faz.net", "DE", "de"], ["zeit.de", "DE", "de"],
  ["elpais.com", "ES", "es"], ["elmundo.es", "ES", "es"],
  ["corriere.it", "IT", "it"], ["nikkei.com", "JP", "en"], ["thehindu.com", "IN", "en"],
];

/** One event archetype: paraphrase pool per language + the slots it fills. */
interface Template {
  topic: string;
  tags: string[];
  /** Language → headline patterns. `en` is required; others drive cross-lingual cases. */
  patterns: Record<string, string[]>;
  /** Slot values that vary *between* events, keeping members of one event aligned. */
  slots: Record<string, string[]>;
}

// Every real event has specifics that distinguish it from the same *kind* of
// event last month: who did it, which body, which programme. Without that a
// generated corpus degenerates into the same headline repeated, and the
// benchmark measures nothing. Each event freezes one subject.
const SUBJECTS = [
  "the transport ministry", "the health authority", "the central committee",
  "the energy regulator", "the port authority", "the education board",
  "the water agency", "the housing council", "the aviation regulator",
  "the finance committee", "the interior ministry", "the labour federation",
  "the grid operator", "the border agency", "the tourism board",
  "the fisheries council", "the postal service", "the customs authority",
  "the pension fund", "the broadcasting authority", "the forestry commission",
  "the seismic institute", "the medicines agency", "the antitrust office",
  "the railway operator", "the airport operator", "the mining regulator",
  "the telecoms authority", "the statistics office", "the maritime agency",
] as const;

const TEMPLATES: Template[] = [
  {
    topic: "Economy & Business", tags: ["central bank", "interest rates"],
    slots: { BANK: ["central bank", "reserve bank", "monetary authority"], DIR: ["raises", "cuts", "holds"], N: ["25", "50", "75"] },
    patterns: {
      en: [
        "{CITY} {BANK} {DIR} rates by {N} basis points after {SUBJ} review",
        "{BANK} in {CITY} moves rates {N} bps in {DIR} decision, {SUBJ} briefed",
        "Rates {DIR} {N} bps as {CITY} {BANK} meets with {SUBJ}",
        "{CITY}: {BANK} decision puts rates {N} basis points on the move",
      ],
      fr: ["La banque centrale de {CITY} modifie ses taux de {N} points de base, selon {SUBJ}"],
      de: ["Zentralbank in {CITY} bewegt Leitzins um {N} Basispunkte, {SUBJ} informiert"],
      es: ["El banco central de {CITY} mueve los tipos {N} puntos basicos"],
    },
  },
  {
    topic: "World & Conflict", tags: ["strike", "casualties"],
    slots: { KIND: ["drone strike", "air strike", "shelling"], N: ["three", "seven", "twelve"] },
    patterns: {
      en: [
        "{KIND} near {SUBJ} in {CITY} leaves {N} injured",
        "{N} injured after {KIND} hits {SUBJ} in {CITY}",
        "{CITY} hit by {KIND} near {SUBJ}, {N} people injured",
        "Officials in {CITY} report {N} injured in {KIND}",
      ],
      fr: ["Une attaque frappe {SUBJ} a {CITY}, {N} blesses"],
      de: ["Angriff auf {CITY} fordert {N} Verletzte"],
    },
  },
  {
    topic: "Politics", tags: ["parliament", "vote"],
    slots: { BILL: ["housing bill", "budget bill", "energy bill", "security bill"], A: ["302", "214", "188", "271"], B: ["241", "196", "160", "233"] },
    patterns: {
      en: [
        "{CITY} parliament passes {BILL} backed by {SUBJ} by {A}-{B}",
        "{BILL} from {SUBJ} clears vote {A} to {B} in {CITY}",
        "Lawmakers in {CITY} back {SUBJ} {BILL} {A}-{B}",
        "{BILL} approved {A}-{B} after debate in {CITY}",
      ],
      es: ["El parlamento de {CITY} aprueba la ley de {SUBJ} por {A}-{B}"],
      de: ["Parlament in {CITY} beschliesst Gesetz mit {A} zu {B}"],
    },
  },
  {
    topic: "Science & Health", tags: ["weather", "evacuation"],
    slots: { EVENT: ["flooding", "wildfire", "typhoon", "heatwave"], N: ["4000", "20000", "150000"] },
    patterns: {
      en: [
        "{EVENT} forces evacuation of {N} near {SUBJ} in {CITY}",
        "{N} evacuated as {EVENT} reaches {SUBJ} in {CITY}",
        "{CITY} region evacuates {N} amid {EVENT}, {SUBJ} coordinating",
        "Authorities move {N} people from {CITY} area as {EVENT} spreads",
      ],
      fr: ["{N} personnes evacuees pres de {CITY}, {SUBJ} mobilise"],
      it: ["{N} persone evacuate vicino a {CITY}"],
    },
  },
  {
    topic: "Technology", tags: ["regulation", "platforms"],
    slots: { RULE: ["data transfer rules", "content moderation rules", "AI transparency rules"], N: ["18", "24", "36"] },
    patterns: {
      en: [
        "{SUBJ} in {CITY} publishes {RULE} with {N}-month compliance window",
        "{RULE} unveiled by {SUBJ} in {CITY}, firms get {N} months",
        "{SUBJ} in {CITY} sets {N}-month deadline under new {RULE}",
        "New {RULE} from {CITY} give platforms {N} months to comply",
      ],
      de: ["{SUBJ} in {CITY} veroeffentlicht neue Regeln mit {N} Monaten Frist"],
      fr: ["Les regulateurs de {CITY} publient de nouvelles regles, {N} mois de delai"],
    },
  },
  {
    topic: "Society & Culture", tags: ["strike", "labour"],
    slots: { SECTOR: ["rail", "hospital", "school", "port"], N: ["48", "72", "24"] },
    patterns: {
      en: [
        "{SECTOR} workers at {SUBJ} in {CITY} begin {N}-hour strike",
        "{N}-hour {SECTOR} strike starts at {SUBJ} in {CITY}",
        "{CITY} braces for {N}-hour walkout by {SECTOR} staff at {SUBJ}",
        "Walkout of {N} hours hits {SECTOR} services in {CITY}",
      ],
      es: ["Huelga de {N} horas en {SUBJ} de {CITY}"],
      fr: ["Greve de {N} heures a {CITY}"],
    },
  },
  {
    topic: "Sport", tags: ["football", "result"],
    slots: { A: ["2", "3", "1", "4"], B: ["1", "0", "2", "3"] },
    patterns: {
      en: [
        "{CITY} side wins {A}-{B} in fixture staged by {SUBJ}",
        "Match at {SUBJ} ground in {CITY} ends {A}-{B}",
        "{A}-{B} win for {CITY} club at {SUBJ} ground after late goal",
        "Late goal seals {A}-{B} result in {CITY}",
      ],
      it: ["Partita a {CITY} presso {SUBJ} finisce {A}-{B}"],
      fr: ["Le match a {CITY} se termine {A}-{B}"],
    },
  },
];

// Syndication rewrites: wires re-run near-verbatim under other mastheads.
const SYNDICATION_PREFIXES = ["", "UPDATE 1-", "BREAKING: ", "Analysis: ", ""];
const SYNDICATION_SUFFIXES = ["", ", officials say", " - report", ", sources say", ""];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface CorpusOptions {
  /** Number of distinct labelled events to generate. */
  events?: number;
  seed?: number;
  /** Min/max articles per event. */
  minArticles?: number;
  maxArticles?: number;
  /** Probability an event gets a deliberate near-miss twin (same template, different slot values). */
  nearMissRate?: number;
  /** Probability an event includes at least one non-English member. */
  crossLingualRate?: number;
  /** Singleton distractors as a fraction of event count. */
  distractorRate?: number;
}

export interface Corpus {
  articles: GoldArticle[];
  groups: string[][];
  meta: { events: number; articles: number; singletons: number; seed: number; crossLingualEvents: number };
}

function fill(pattern: string, city: City, slotValues: Record<string, string>): string {
  return pattern
    .replace(/\{CITY\}/g, city[0])
    .replace(/\{(\w+)\}/g, (_, k: string) => slotValues[k] ?? k);
}

/**
 * Build a labelled corpus at arbitrary scale.
 *
 * Each event picks one template, one city and one frozen set of slot values;
 * its members then vary only in phrasing, language, outlet and timing — the
 * same axes real coverage of one event varies along. Near-miss twins reuse the
 * template and city but change the slot values, which is precisely the case a
 * bag-of-words clusterer gets wrong.
 */
export function generateCorpus(options: CorpusOptions = {}): Corpus {
  const {
    events = 300, seed = 42, minArticles = 2, maxArticles = 7,
    nearMissRate = 0.25, crossLingualRate = 0.4, distractorRate = 0.35,
  } = options;
  const rng = rngFor(seed);
  const articles: GoldArticle[] = [];
  const groups: string[][] = [];
  let crossLingualEvents = 0;

  const emitEvent = (key: string, tpl: Template, city: City, slotValues: Record<string, string>, startMs: number, difficulty: GoldArticle["difficulty"]) => {
    const count = minArticles + rng.int(Math.max(1, maxArticles - minArticles + 1));
    const wantCrossLingual = rng.chance(crossLingualRate);
    const langsAvailable = Object.keys(tpl.patterns).filter((l) => l !== "en");
    const ids: string[] = [];
    // Tags in production are entity-derived, so they differ between two events
    // of the same kind. Template-level tags would hand the clusterer a signal
    // it does not get in the real feed.
    const eventTags = [...tpl.tags, city[0].toLowerCase(), slotValues.SUBJ.replace(/^the /, "")];
    const usedOutlets = new Set<string>();
    let usedNonEnglish = false;
    for (let i = 0; i < count; i++) {
      const useOther = wantCrossLingual && langsAvailable.length > 0 && (i === count - 1 ? !usedNonEnglish : rng.chance(0.3));
      const lang = useOther ? rng.pick(langsAvailable) : "en";
      if (lang !== "en") usedNonEnglish = true;
      const pool = tpl.patterns[lang] ?? tpl.patterns.en;
      let title = fill(rng.pick(pool), city, slotValues);
      if (lang === "en" && rng.chance(0.35)) {
        title = `${rng.pick(SYNDICATION_PREFIXES)}${title}${rng.pick(SYNDICATION_SUFFIXES)}`.trim();
      }
      // Outlet whose language matches, so language and masthead stay coherent.
      const candidates = OUTLETS.filter((o) => o[2] === lang && !usedOutlets.has(o[0]));
      const outlet = candidates.length ? rng.pick(candidates) : rng.pick(OUTLETS);
      usedOutlets.add(outlet[0]);
      const id = `${key}#${i}`;
      ids.push(id);
      articles.push({
        id,
        title,
        url: `https://${outlet[0]}/${key}-${i}`,
        publisher: outlet[0],
        countryCode: city[3],
        publishedAt: new Date(startMs + i * (1 + rng.int(6)) * 3_600_000).toISOString(),
        tags: eventTags,
        location: { label: city[0], lat: city[1], lng: city[2], countryCode: city[3] },
        topic: tpl.topic,
        language: lang,
        eventKey: key,
        region: city[4],
        difficulty,
      });
    }
    if (usedNonEnglish) crossLingualEvents++;
    groups.push(ids);
  };

  const base = Date.parse("2026-01-01T00:00:00Z");
  for (let e = 0; e < events; e++) {
    const tpl = rng.pick(TEMPLATES);
    const city = rng.pick(CITIES);
    const slotValues: Record<string, string> = {};
    for (const [k, vs] of Object.entries(tpl.slots)) slotValues[k] = rng.pick(vs);
    slotValues.SUBJ = rng.pick(SUBJECTS);
    const startMs = base + rng.int(300) * 86_400_000 + rng.int(24) * 3_600_000;
    emitEvent(`ev${e}`, tpl, city, slotValues, startMs, "easy");

    // Near-miss twin: same template + city + day, one slot changed. Reads
    // almost identically to a bag of words; is a different event to a reader.
    if (rng.chance(nearMissRate)) {
      const twin: Record<string, string> = { ...slotValues };
      const keys = Object.keys(tpl.slots);
      if (keys.length) {
        const k = rng.pick(keys);
        const alternatives = tpl.slots[k].filter((v) => v !== slotValues[k]);
        if (alternatives.length) twin[k] = rng.pick(alternatives);
      }
      emitEvent(`ev${e}t`, tpl, city, twin, startMs + 26 * 3_600_000, "nearmiss");
    }
  }

  const singletons = Math.round(events * distractorRate);
  for (let d = 0; d < singletons; d++) {
    const tpl = rng.pick(TEMPLATES);
    const city = rng.pick(CITIES);
    const slotValues: Record<string, string> = {};
    for (const [k, vs] of Object.entries(tpl.slots)) slotValues[k] = rng.pick(vs);
    slotValues.SUBJ = rng.pick(SUBJECTS);
    const outlet = rng.pick(OUTLETS.filter((o) => o[2] === "en"));
    const id = `sing${d}#0`;
    articles.push({
      id,
      title: fill(rng.pick(tpl.patterns.en), city, slotValues),
      url: `https://${outlet[0]}/sing-${d}`,
      publisher: outlet[0],
      countryCode: city[3],
      publishedAt: new Date(base + rng.int(300) * 86_400_000).toISOString(),
      tags: [...tpl.tags, city[0].toLowerCase(), slotValues.SUBJ.replace(/^the /, "")],
      location: { label: city[0], lat: city[1], lng: city[2], countryCode: city[3] },
      topic: tpl.topic,
      language: "en",
      eventKey: null,
      region: city[4],
      difficulty: "longtail",
    });
    groups.push([id]);
  }

  return {
    articles: rngFor(seed + 1).shuffle(articles),
    groups,
    meta: { events: groups.length - singletons, articles: articles.length, singletons, seed, crossLingualEvents },
  };
}
