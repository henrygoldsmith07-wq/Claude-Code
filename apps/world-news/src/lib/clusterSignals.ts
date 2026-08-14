// Similarity signals for event clustering.
//
// A Signature is the comparable form of an article *or* a cluster: merging two
// signatures yields the cluster signature, and scoreSignatures works identically
// on both. That is what makes average-linkage agglomeration in ./clustering
// cheap — no need to re-score every member pair when two clusters meet.
//
// Split out of ./clustering so the scoring model can be read, tested and tuned
// without the indexing and union-find machinery in the way.
import {
  entitySimilarity,
  extractEntities,
  extractNumerics,
  numericAgreement,
  foldDiacritics,
  transliterate,
  type ExtractedEntities,
} from "./entities";

export interface ArticleLike {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  countryCode?: string;
  publishedAt?: string;
  tags: string[];
  location?: { label: string; lat: number; lng: number; countryCode?: string };
  topic?: string;
  /** ISO 639-1 when known; drives the cross-lingual flag on the cluster. */
  language?: string;
}

/**
 * Beyond this span, two reports are treated as different events no matter how
 * alike they read. 14 days is generous for a discrete occurrence while still
 * separating this year's budget from last year's.
 */
export const MAX_GAP_HOURS = 14 * 24;

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------
// A Signature is the comparable form of an article *or* a cluster. Merging two
// signatures yields the cluster signature, and scoring works identically on
// both — which is what makes average-linkage agglomeration cheap below.

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "for", "with", "is", "are",
  "as", "at", "by", "from", "about", "after", "over", "into", "amid", "says", "say",
  "said", "new", "more", "than", "that", "this", "its", "it", "be", "will", "has",
  "have", "was", "were", "but", "not", "up", "down", "out", "off", "no", "who",
]);

export function tokens(s: string): string[] {
  return foldDiacritics(transliterate(s))
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

export interface Signature {
  n: number;
  vec: Map<string, number>; // L2-normalised tf-idf
  entities: Map<string, number>;
  known: Set<string>;
  numerics: Set<string>;
  tags: Map<string, number>;
  topics: Map<string, number>;
  lat: number; lng: number; geoWeight: number;
  countries: Set<string>;
  languages: Set<string>;
  tMin: number; tMax: number; hasTime: boolean;
}

function normalise(vec: Map<string, number>): Map<string, number> {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vec;
  const out = new Map<string, number>();
  for (const [k, v] of vec) out.set(k, v / norm);
  return out;
}

export function signatureFor(a: ArticleLike, idf: Map<string, number>, ents?: ExtractedEntities): Signature {
  const tf = new Map<string, number>();
  for (const t of tokens(a.title)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [t, c] of tf) vec.set(t, (1 + Math.log(c)) * (idf.get(t) ?? 1));
  const e = ents ?? extractEntities(a.title);
  const entities = new Map<string, number>();
  for (const id of e.ids) entities.set(id, (entities.get(id) ?? 0) + 1);
  const tags = new Map<string, number>();
  for (const t of a.tags ?? []) tags.set(t.toLowerCase().trim(), 1);
  const topics = new Map<string, number>();
  if (a.topic) topics.set(a.topic, 1);
  const t = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
  const hasTime = Number.isFinite(t);
  const hasGeo = Boolean(a.location && Number.isFinite(a.location.lat) && Number.isFinite(a.location.lng));
  const countries = new Set<string>();
  if (a.countryCode) countries.add(a.countryCode.toUpperCase());
  if (a.location?.countryCode) countries.add(a.location.countryCode.toUpperCase());
  return {
    n: 1,
    vec: normalise(vec),
    entities,
    known: new Set(e.known),
    numerics: new Set(extractNumerics(a.title)),
    tags,
    topics,
    lat: hasGeo ? a.location!.lat : 0,
    lng: hasGeo ? a.location!.lng : 0,
    geoWeight: hasGeo ? 1 : 0,
    countries,
    languages: new Set(a.language ? [a.language.toLowerCase()] : []),
    tMin: hasTime ? t : 0,
    tMax: hasTime ? t : 0,
    hasTime,
  };
}

export function mergeSignature(a: Signature, b: Signature): Signature {
  const vec = new Map<string, number>();
  // Weighted mean of unit vectors, re-normalised — the standard centroid.
  for (const [k, v] of a.vec) vec.set(k, v * a.n);
  for (const [k, v] of b.vec) vec.set(k, (vec.get(k) ?? 0) + v * b.n);
  const merge2 = <T>(x: Map<T, number>, y: Map<T, number>) => {
    const m = new Map(x);
    for (const [k, v] of y) m.set(k, (m.get(k) ?? 0) + v);
    return m;
  };
  const gw = a.geoWeight + b.geoWeight;
  return {
    n: a.n + b.n,
    vec: normalise(vec),
    entities: merge2(a.entities, b.entities),
    known: new Set([...a.known, ...b.known]),
    numerics: new Set([...a.numerics, ...b.numerics]),
    tags: merge2(a.tags, b.tags),
    topics: merge2(a.topics, b.topics),
    lat: gw ? (a.lat * a.geoWeight + b.lat * b.geoWeight) / gw : 0,
    lng: gw ? (a.lng * a.geoWeight + b.lng * b.geoWeight) / gw : 0,
    geoWeight: gw,
    countries: new Set([...a.countries, ...b.countries]),
    languages: new Set([...a.languages, ...b.languages]),
    tMin: a.hasTime && b.hasTime ? Math.min(a.tMin, b.tMin) : a.hasTime ? a.tMin : b.tMin,
    tMax: a.hasTime && b.hasTime ? Math.max(a.tMax, b.tMax) : a.hasTime ? a.tMax : b.tMax,
    hasTime: a.hasTime || b.hasTime,
  };
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

export function vectorCosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w) dot += v * w;
  }
  return Math.max(0, Math.min(1, dot));
}

function setOverlap(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const k of a.keys()) if (b.has(k)) inter++;
  return inter / Math.max(a.size, b.size);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface Component { weight: number; value: number; reason?: string }

/**
 * Score two signatures as "same event".
 *
 * The result is a weighted mean over the components that are *available* for
 * this pair, so an article with no timestamp is not punished for it — the
 * temporal weight simply drops out of the denominator. Numerics then apply as
 * an additive bonus/penalty, because a numeric conflict ("50 bps" vs "25 bps")
 * is positive evidence of two different events rather than a missing signal.
 */
export function scoreSignatures(a: Signature, b: Signature, maxGapHours = MAX_GAP_HOURS): { score: number; reasons: string[] } {
  const comps: Component[] = [];
  const reasons: string[] = [];

  // Hard temporal gate. Wording repeats endlessly across a beat — "central bank
  // raises rates by 25 basis points" is a headline that runs several times a
  // year — so without this the clusterer fuses every recurrence of a routine
  // event into one blob. Discrete events are reported within days, not months.
  // The constraint is on the *span of the merged group*, not the gap between
  // the two sides. Bounding only the gap lets a cluster creep along the
  // calendar — each merge widens its range, and the widened range is then
  // adjacent to the next week's coverage. Bounding the span stops the creep.
  if (a.hasTime && b.hasTime) {
    const spanH = (Math.max(a.tMax, b.tMax) - Math.min(a.tMin, b.tMin)) / 3_600_000;
    if (spanH > maxGapHours) return { score: 0, reasons: [`Coverage would span ${Math.round(spanH / 24)} days — separate events`] };
  }

  const lex = vectorCosine(a.vec, b.vec);
  comps.push({ weight: 0.42, value: lex });
  if (lex >= 0.3) reasons.push(`Wording overlap ${Math.round(lex * 100)}%`);

  const ea: ExtractedEntities = { ids: [...a.entities.keys()], known: [...a.known], people: [], byKind: { place: [], org: [], person: [], term: [] } };
  const eb: ExtractedEntities = { ids: [...b.entities.keys()], known: [...b.known], people: [], byKind: { place: [], org: [], person: [], term: [] } };
  const ent = entitySimilarity(ea, eb);
  if (ea.ids.length && eb.ids.length) {
    comps.push({ weight: 0.28, value: ent.score });
    if (ent.shared.length) reasons.push(`Shared entities: ${ent.shared.slice(0, 3).join(", ")}`);
  }

  const tagO = setOverlap(a.tags, b.tags);
  if (a.tags.size && b.tags.size) {
    comps.push({ weight: 0.12, value: tagO });
    if (tagO >= 0.34) reasons.push(`Tag overlap ${Math.round(tagO * 100)}%`);
  }

  if (a.topics.size && b.topics.size) {
    const shared = [...a.topics.keys()].some((t) => b.topics.has(t));
    comps.push({ weight: 0.08, value: shared ? 1 : 0 });
    if (shared) reasons.push(`Same topic: ${[...a.topics.keys()][0]}`);
  }

  let farApartKm = 0;
  if (a.geoWeight > 0 && b.geoWeight > 0) {
    const d = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const geo = d <= 60 ? 1 : d >= 1500 ? 0 : 1 - (d - 60) / 1440;
    comps.push({ weight: 0.1, value: geo });
    if (geo >= 0.5) reasons.push(`Same locale (~${Math.round(d)}km)`);
    if (d > 1000) farApartKm = d;
  }

  if (a.hasTime && b.hasTime) {
    const gapH = Math.max(0, (Math.max(a.tMin, b.tMin) - Math.min(a.tMax, b.tMax))) / 3_600_000;
    const temporal = gapH <= 12 ? 1 : gapH >= 96 ? 0 : 1 - (gapH - 12) / 84;
    comps.push({ weight: 0.1, value: temporal });
    if (temporal >= 0.6) reasons.push(`Reported within ${Math.round(gapH)}h`);
  }

  const totalW = comps.reduce((s, c) => s + c.weight, 0) || 1;
  let score = comps.reduce((s, c) => s + c.weight * c.value, 0) / totalW;

  const num = numericAgreement([...a.numerics], [...b.numerics]);
  if (num.shared.length) {
    score += 0.1 * num.score;
    reasons.push(`Matching figures: ${num.shared.slice(0, 2).join(", ")}`);
  } else if (num.conflicting) {
    score -= 0.2;
    reasons.push("Conflicting figures — likely distinct events");
  }

  // Distance is evidence against, not merely absence of evidence for: the same
  // kind of thing happening in two cities is two events. Multi-location stories
  // (a strike rippling from the Red Sea to Rotterdam) survive this because they
  // still share distinctive entities, which the penalty steps aside for.
  if (farApartKm > 0) {
    const sharedDistinctive = [...a.known].some((id) => b.known.has(id));
    if (!sharedDistinctive) {
      score -= 0.14 * Math.min(1, (farApartKm - 1000) / 4000);
      reasons.push(`Locations ~${Math.round(farApartKm)}km apart with no shared actor`);
    }
  }

  // Two outlets in different countries converging is corroboration, not noise.
  if (lex >= 0.3 && a.countries.size && b.countries.size) {
    const distinct = [...a.countries].some((c) => !b.countries.has(c));
    if (distinct) { score += 0.02; reasons.push("Independent outlets, different countries"); }
  }

  return { score: Math.max(0, Math.min(1, score)), reasons: reasons.slice(0, 5) };
}

