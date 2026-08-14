// Multilingual entity matching.
//
// The clustering problem that actually matters is cross-language: "Kyiv",
// "Kiew", "Kijów", "Киев" and "Kiev" are the same place, and a French wire
// calling the ECB the "BCE" is reporting the same event as an English one.
// Lexical Jaccard over raw tokens cannot see any of that, so this module gives
// clustering a canonical entity vocabulary to work in.
//
// Pure + deterministic — no network, no model calls. Every transform is
// reversible enough to explain in the UI ("matched Kyiv ≡ Kiew").

// ---------------------------------------------------------------------------
// Script folding
// ---------------------------------------------------------------------------

/** Strip combining marks so "Zelenskyy"/"Zelensky"/"Zełenski" fold together. */
export function foldDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Characters that survive NFD because they are atomic letters.
    .replace(/ø/g, "o").replace(/Ø/g, "O")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .replace(/ı/g, "i").replace(/İ/g, "I");
}

// Digraphs first — order matters, "щ" must beat "ш".
const CYRILLIC: [RegExp, string][] = [
  [/щ/g, "shch"], [/ш/g, "sh"], [/ч/g, "ch"], [/ц/g, "ts"], [/ж/g, "zh"],
  [/ю/g, "yu"], [/я/g, "ya"], [/ё/g, "yo"], [/є/g, "ye"], [/ї/g, "yi"],
  [/х/g, "kh"], [/а/g, "a"], [/б/g, "b"], [/в/g, "v"], [/г/g, "h"],
  [/ґ/g, "g"], [/д/g, "d"], [/е/g, "e"], [/з/g, "z"], [/и/g, "y"],
  [/і/g, "i"], [/й/g, "i"], [/к/g, "k"], [/л/g, "l"], [/м/g, "m"],
  [/н/g, "n"], [/о/g, "o"], [/п/g, "p"], [/р/g, "r"], [/с/g, "s"],
  [/т/g, "t"], [/у/g, "u"], [/ф/g, "f"], [/ы/g, "y"], [/э/g, "e"],
  [/[ьъ]/g, ""],
];

const GREEK: [RegExp, string][] = [
  [/θ/g, "th"], [/χ/g, "ch"], [/ψ/g, "ps"], [/φ/g, "f"], [/ω/g, "o"],
  [/α/g, "a"], [/β/g, "v"], [/γ/g, "g"], [/δ/g, "d"], [/ε/g, "e"],
  [/ζ/g, "z"], [/η/g, "i"], [/ι/g, "i"], [/κ/g, "k"], [/λ/g, "l"],
  [/μ/g, "m"], [/ν/g, "n"], [/ξ/g, "x"], [/ο/g, "o"], [/π/g, "p"],
  [/ρ/g, "r"], [/[σς]/g, "s"], [/τ/g, "t"], [/υ/g, "y"],
];

/** Romanise Cyrillic/Greek so cross-script names land in one vocabulary. */
export function transliterate(s: string): string {
  // Fold first: Greek and Cyrillic carry their own accents (ή, й are composed),
  // and an unfolded accented letter falls straight through the tables below.
  let out = foldDiacritics(s).toLowerCase();
  for (const [re, to] of CYRILLIC) out = out.replace(re, to);
  for (const [re, to] of GREEK) out = out.replace(re, to);
  return out;
}

/** Detect the dominant script — routes language handling and QA checks. */
export function scriptOf(s: string): "latin" | "cyrillic" | "greek" | "arabic" | "han" | "kana" | "hangul" | "other" {
  if (/[\u0400-\u04ff]/.test(s)) return "cyrillic";
  if (/[\u0370-\u03ff]/.test(s)) return "greek";
  if (/[\u0600-\u06ff\u0750-\u077f]/.test(s)) return "arabic";
  if (/[\u3040-\u30ff]/.test(s)) return "kana";
  if (/[\uac00-\ud7af]/.test(s)) return "hangul";
  if (/[\u4e00-\u9fff]/.test(s)) return "han";
  if (/[a-z]/i.test(s)) return "latin";
  return "other";
}

// ---------------------------------------------------------------------------
// Alias registry
// ---------------------------------------------------------------------------
// Canonical id → surface forms in the languages World News actually ingests.
// Values are matched after folding + transliteration, so "Киев" arrives here
// already as "kiev".

const PLACE_ALIASES: Record<string, string[]> = {
  kyiv: ["kiev", "kiew", "kijow", "kyiw", "kyev", "kyiv"],
  moscow: ["moskva", "moskau", "moscou", "mosca", "moskwa", "moscu"],
  beijing: ["peking", "pekin", "pequim", "pechino"],
  "the hague": ["den haag", "la haye", "haag", "l aia"],
  vienna: ["wien", "vienne", "viena"],
  munich: ["munchen", "monaco di baviera", "munique"],
  cologne: ["koln", "colonia"],
  prague: ["praha", "prag", "praga"],
  warsaw: ["warszawa", "warschau", "varsovie", "varsovia"],
  lisbon: ["lisboa", "lissabon", "lisbonne"],
  copenhagen: ["kobenhavn", "kopenhagen", "copenhague"],
  brussels: ["bruxelles", "brussel", "brussel", "bruselas", "bruxelas"],
  geneva: ["geneve", "genf", "ginebra", "ginevra"],
  damascus: ["dimashq", "damas", "damasco", "damaskus"],
  tehran: ["teheran", "tehran"],
  baghdad: ["bagdad", "baghdad"],
  jerusalem: ["yerushalayim", "al quds", "gerusalemme", "jerusalen"],
  gaza: ["ghazzah", "gaza city", "gazastreifen"],
  istanbul: ["constantinople", "estambul", "istambul"],
  seoul: ["soul", "seul"],
  tokyo: ["tokio", "tokyo"],
  mumbai: ["bombay"],
  chennai: ["madras"],
  kolkata: ["calcutta"],
  myanmar: ["burma"],
  "czech republic": ["czechia", "tschechien", "chequia"],
  netherlands: ["holland", "nederland", "pays bas", "niederlande"],
  germany: ["deutschland", "allemagne", "alemania", "germania"],
  spain: ["espana", "espagne", "spanien"],
  japan: ["nippon", "japon", "giappone"],
  china: ["prc", "peoples republic of china"],
  "united states": ["usa", "us", "america", "etats unis", "estados unidos", "vereinigte staaten"],
  "united kingdom": ["uk", "britain", "great britain", "royaume uni", "reino unido", "grossbritannien"],
  ukraine: ["ukraina", "ucrania", "ucraina"],
  russia: ["rossiya", "russie", "rusia", "russland"],
};

const ORG_ALIASES: Record<string, string[]> = {
  "european union": ["eu", "ue", "unione europea", "union europeenne", "union europea", "europaische union"],
  "european central bank": ["ecb", "bce", "ezb"],
  "federal reserve": ["fed", "us federal reserve", "reserva federal"],
  "bank of england": ["boe"],
  "european commission": ["ec", "commission europeenne", "comision europea", "eu commission"],
  nato: ["north atlantic treaty organization", "otan", "nordatlantikpakt"],
  "united nations": ["un", "onu", "uno", "vereinte nationen"],
  "world health organization": ["who", "oms"],
  "international monetary fund": ["imf", "fmi"],
  "world trade organization": ["wto", "omc"],
  "international criminal court": ["icc", "cpi"],
  "international court of justice": ["icj", "cij"],
  "african union": ["au"],
  opec: ["organization of the petroleum exporting countries", "opep"],
  asean: ["association of southeast asian nations"],
  brics: [],
  hamas: ["harakat al muqawama al islamiyya"],
  hezbollah: ["hizbullah", "hizballah", "hezbolla"],
  "world bank": ["banque mondiale", "banco mundial", "weltbank"],
};

// Person aliases carry surname-level canonicalisation; transliteration of the
// same name across wires varies far more than places do.
const PERSON_ALIASES: Record<string, string[]> = {
  zelensky: ["zelenskyy", "zelenskiy", "selenskyj", "zelenski", "zelenskyj"],
  putin: ["poutine", "putins"],
  netanyahu: ["netanyahou", "netanjahu"],
  erdogan: ["erdoğan", "erdogans"],
  xi: ["xi jinping", "si cin ping"],
  macron: ["macrons"],
  lagarde: ["christine lagarde"],
  guterres: ["antonio guterres"],
  modi: ["narendra modi"],
  lula: ["luiz inacio lula da silva", "lula da silva"],
};

export type EntityKind = "place" | "org" | "person" | "term";

interface AliasEntry { canonical: string; kind: EntityKind }

/** Built once: every alias surface form → its canonical id + kind. */
const ALIAS_INDEX: Map<string, AliasEntry> = (() => {
  const m = new Map<string, AliasEntry>();
  const add = (table: Record<string, string[]>, kind: EntityKind) => {
    for (const [canonical, aliases] of Object.entries(table)) {
      m.set(canonical, { canonical, kind });
      for (const a of aliases) {
        const key = foldDiacritics(a).toLowerCase();
        // First writer wins: "us" as a country beats any later collision.
        if (!m.has(key)) m.set(key, { canonical, kind });
      }
    }
  };
  add(PLACE_ALIASES, "place");
  add(ORG_ALIASES, "org");
  add(PERSON_ALIASES, "person");
  return m;
})();

/** Longest alias phrase, in words — bounds the n-gram scan in extractEntities. */
const MAX_ALIAS_WORDS = Math.max(...[...ALIAS_INDEX.keys()].map((k) => k.split(" ").length));

/**
 * Normalise one surface form to its canonical id.
 * Returns the folded/transliterated token unchanged when nothing is known
 * about it — unknown entities still cluster with themselves.
 */
export function canonicalEntity(surface: string): { id: string; kind: EntityKind; matched: boolean } {
  const folded = foldDiacritics(transliterate(surface))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hit = ALIAS_INDEX.get(folded);
  if (hit) return { id: hit.canonical, kind: hit.kind, matched: true };
  // Possessives and plurals are the common near-miss ("Putin's" → "putins").
  const stripped = folded.replace(/(?:'s|s)$/, "");
  const hit2 = ALIAS_INDEX.get(stripped);
  if (hit2) return { id: hit2.canonical, kind: hit2.kind, matched: true };
  return { id: folded, kind: "term", matched: false };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const HEADLINE_STOP = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "for", "with", "is", "are",
  "as", "at", "by", "from", "about", "after", "over", "into", "amid", "says", "say",
  "said", "new", "more", "than", "that", "this", "its", "it", "be", "will", "has",
  "have", "was", "were", "but", "not", "up", "down", "out", "off", "no",
]);

export interface ExtractedEntities {
  /** Canonical ids, deduped, in first-appearance order. */
  ids: string[];
  /** Ids that resolved through the alias registry — high-signal for matching. */
  known: string[];
  /** Surname-ish tokens for person matching. */
  people: string[];
  byKind: Record<EntityKind, string[]>;
}

/**
 * Pull entities out of a headline.
 *
 * Two passes: dictionary n-grams (works in any script, since aliases are keyed
 * post-transliteration) and capitalised runs (Latin scripts only). Both feed the
 * same canonicaliser, so "Kiew" and "Киев" arrive as "kyiv".
 */
export function extractEntities(text: string): ExtractedEntities {
  // Case is read off the *original* word (transliteration lowercases), so
  // "Kiew" still registers as capitalised after romanisation.
  const raw = foldDiacritics(text).replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const lower = raw.map((w) => foldDiacritics(transliterate(w)).toLowerCase());
  const capped = raw.map((w) => /^\p{Lu}/u.test(w));
  const allCaps = raw.map((w) => w.length >= 2 && w === w.toUpperCase() && /\p{L}/u.test(w));
  // Non-Latin scripts have no case, so treat every romanised token as a
  // candidate rather than losing them all to the capitalisation filter.
  const caseless = scriptOf(text) !== "latin";

  const ids: string[] = [];
  const known: string[] = [];
  const people: string[] = [];
  const byKind: Record<EntityKind, string[]> = { place: [], org: [], person: [], term: [] };
  const seen = new Set<string>();
  const consumed = new Set<number>();

  const push = (id: string, kind: EntityKind, matched: boolean) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
    byKind[kind].push(id);
    if (matched) known.push(id);
    if (kind === "person") people.push(id);
  };

  // Pass 1 — dictionary n-grams, longest first so "european central bank" wins
  // over "bank".
  for (let n = Math.min(MAX_ALIAS_WORDS, lower.length); n >= 1; n--) {
    for (let i = 0; i + n <= lower.length; i++) {
      let overlaps = false;
      for (let k = i; k < i + n; k++) if (consumed.has(k)) { overlaps = true; break; }
      if (overlaps) continue;
      const phrase = lower.slice(i, i + n).join(" ");
      const hit = canonicalEntity(phrase);
      if (!hit.matched) continue;
      // Short acronyms only count when the original was uppercase, so "us" in
      // "told us" is not the United States and "un" in French prose is not the UN.
      if (n === 1 && phrase.length <= 3 && !allCaps[i] && !caseless) continue;
      push(hit.id, hit.kind, true);
      for (let k = i; k < i + n; k++) consumed.add(k);
    }
  }

  // Pass 2 — capitalised runs, skipping sentence-initial position where
  // capitalisation carries no signal.
  let run: string[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    const phrase = run.join(" ");
    const hit = canonicalEntity(phrase);
    push(hit.id, hit.matched ? hit.kind : run.length >= 2 ? "person" : "term", hit.matched);
    run = [];
  };
  for (let i = 0; i < raw.length; i++) {
    if (consumed.has(i)) { flushRun(); continue; }
    const eligible = (caseless || (capped[i] && i > 0)) && lower[i].length >= 3;
    if (eligible && !HEADLINE_STOP.has(lower[i])) run.push(lower[i]);
    else flushRun();
  }
  flushRun();

  return { ids, known, people, byKind };
}

// ---------------------------------------------------------------------------
// Numerics — the cheapest disambiguator there is
// ---------------------------------------------------------------------------

/**
 * Extract the numeric facts a headline asserts (percentages, basis points,
 * casualty counts, vote splits, scorelines). Two reports of the same event
 * usually agree on these; two different events in the same topic rarely do.
 */
/**
 * Number words, so "twelve injured" and "12 injured" are the same assertion.
 * Stops at twenty plus the round tens — beyond that news uses digits.
 */
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
};

export function extractNumerics(text: string): string[] {
  const out = new Set<string>();
  const t = foldDiacritics(text).toLowerCase().replace(/,(?=\d{3}\b)/g, "");
  // Scorelines and vote splits: "2-1", "302-241"
  for (const m of t.matchAll(/\b(\d{1,4})\s*[-–]\s*(\d{1,4})\b/g)) out.add(`${m[1]}:${m[2]}`);
  // Percentages: "4%", "4 percent", "4.5 per cent"
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|(?:per\s?cent|percent)\b)/g)) out.add(`pct${m[1]}`);
  // Basis points
  for (const m of t.matchAll(/\b(\d+)\s*(?:bps|basis points?)\b/g)) out.add(`bps${m[1]}`);
  // Magnitudes: "1.2 billion", "50 million"
  for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)\s*(billion|million|trillion|bn|m)\b/g)) {
    const unit = m[2] === "bn" ? "billion" : m[2] === "m" ? "million" : m[2];
    out.add(`${m[1]}${unit}`);
  }
  // Bare counts of 2+ digits (casualties, seats, ages are mostly noise below
  // that). Excluding digits adjacent to a decimal point stops "3.25" being
  // read as a count of 25.
  for (const m of t.matchAll(/(?<![\d.])(\d{2,6})(?![\d.])/g)) out.add(`n${m[1]}`);
  // Spelled-out counts, normalised into the same space as the digit form so
  // "twelve injured" and "12 injured" agree and "three" and "seven" conflict.
  for (const m of t.matchAll(/\b([a-z]+)\b/g)) {
    const v = NUMBER_WORDS[m[1]];
    if (v !== undefined && v >= 2) out.add(`n${v}`);
  }
  return [...out];
}

/** 1 when the two headlines assert compatible numbers, 0 when they conflict. */
export function numericAgreement(a: string[], b: string[]): { score: number; shared: string[]; conflicting: boolean } {
  if (a.length === 0 || b.length === 0) return { score: 0, shared: [], conflicting: false };
  const A = new Set(a), B = new Set(b);
  const shared = [...A].filter((x) => B.has(x));
  if (shared.length > 0) return { score: Math.min(1, shared.length / 2), shared, conflicting: false };
  // Same *kind* of number, different value → active evidence they differ
  // ("50 bps" vs "25 bps" is two central-bank decisions, not one).
  const kind = (s: string) => s.replace(/[\d.:]+/g, "");
  const kindsA = new Set(a.map(kind)), kindsB = new Set(b.map(kind));
  const sharedKind = [...kindsA].some((k) => k !== "n" && kindsB.has(k));
  return { score: 0, shared: [], conflicting: sharedKind };
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

export interface EntityMatch {
  score: number; // 0..1
  shared: string[];
  crossLingual: boolean; // true when a match only held after transliteration/alias
  reason: string;
}

/**
 * Entity-level similarity between two headlines' extracted entities.
 *
 * Known (registry-resolved) entities are weighted double: agreeing on "kyiv"
 * is far more informative than agreeing on an unrecognised capitalised word.
 */
export function entitySimilarity(a: ExtractedEntities, b: ExtractedEntities): EntityMatch {
  if (a.ids.length === 0 || b.ids.length === 0)
    return { score: 0, shared: [], crossLingual: false, reason: "No entities extracted" };
  const A = new Set(a.ids), B = new Set(b.ids);
  const knownA = new Set(a.known), knownB = new Set(b.known);
  const shared = [...A].filter((x) => B.has(x));
  const weight = (id: string) => (knownA.has(id) && knownB.has(id) ? 2 : 1);
  const interW = shared.reduce((s, id) => s + weight(id), 0);
  const unionW =
    [...A].reduce((s, id) => s + (knownA.has(id) ? 2 : 1), 0) +
    [...B].reduce((s, id) => s + (knownB.has(id) ? 2 : 1), 0) -
    interW;
  const score = unionW === 0 ? 0 : interW / unionW;
  const crossLingual = shared.some((id) => knownA.has(id) && knownB.has(id));
  const reason = shared.length
    ? `Shared entities: ${shared.slice(0, 3).join(", ")}`
    : "No shared entities";
  return { score: Math.min(1, score), shared, crossLingual, reason };
}

/**
 * Person-name match tolerant of ordering and initials:
 * "V. Zelensky" ≡ "Volodymyr Zelenskyy" ≡ "Selenskyj, Wolodymyr".
 */
export function personMatch(a: string, b: string): boolean {
  const parts = (s: string) =>
    foldDiacritics(transliterate(s))
      .toLowerCase()
      .replace(/[^a-z\s.]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const pa = parts(a), pb = parts(b);
  if (pa.length === 0 || pb.length === 0) return false;
  const canon = (p: string[]) => p.map((x) => canonicalEntity(x).id);
  const ca = new Set(canon(pa)), cb = new Set(canon(pb));
  // Surname agreement is the load-bearing signal.
  for (const x of ca) {
    if (x.length >= 4 && cb.has(x)) return true;
  }
  // Initial + surname: "v. zelensky" vs "volodymyr zelensky"
  const initials = (p: string[]) => p.filter((x) => x.length <= 2).map((x) => x[0]);
  const longs = (p: string[]) => p.filter((x) => x.length >= 4);
  const la = longs(canon(pa)), lb = longs(canon(pb));
  const surnameShared = la.some((x) => lb.includes(x));
  if (!surnameShared) return false;
  const ia = initials(pa), ib = initials(pb);
  if (ia.length === 0 && ib.length === 0) return true;
  return ia.some((x) => pb.some((y) => y.startsWith(x))) || ib.some((x) => pa.some((y) => y.startsWith(x)));
}
