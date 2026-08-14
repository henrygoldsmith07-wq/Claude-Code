// Event clustering: group the articles that describe one real-world event.
//
// Three things this has to get right, in priority order:
//  1. Accuracy — measured, not asserted. Every knob here is swept by
//     src/lib/benchmark.ts against a labelled corpus, sliced by topic + region.
//  2. Cross-language recall — a Le Monde piece on the BCE and a Reuters piece
//     on the ECB are one event. Lexical overlap alone cannot see that, so
//     scoring runs over canonical entities (./entities) as well as tokens.
//  3. Scale — thousands of articles per refresh. Naive all-pairs is O(n²);
//     this blocks candidates through an inverted index first, so the number of
//     scored pairs grows close to linearly with corpus size.
//
// Pure + deterministic: no network, no model calls, same input → same output.
import type { NewsPoint } from "./gemini";
import {
  MAX_GAP_HOURS,
  mergeSignature,
  scoreSignatures,
  signatureFor,
  tokens,
  vectorCosine,
  type ArticleLike,
  type Signature,
} from "./clusterSignals";

export type { ArticleLike };
export { MAX_GAP_HOURS };

export interface Cluster {
  id: string;
  headline: string; // most representative member headline
  memberIds: string[];
  topic?: string;
  location?: { label: string; lat: number; lng: number; countryCodes: string[] };
  tags: string[]; // union
  confidence: number; // 0..1 — average linkage within the cluster
  confidenceReasons: string[]; // why this confidence
  countries: string[]; // ISO2s involved
  updatedAt?: string;
  /** Canonical entity ids shared across the cluster — rendered as "why these grouped". */
  entityIds?: string[];
  /** True when members span more than one language. */
  crossLingual?: boolean;
  /** Hours between the earliest and latest member. */
  timeSpanHours?: number;
}

export const DEFAULT_THRESHOLD = 0.42;

/** Pairwise "same event?" score for two articles, with human-readable reasons. */
export function clusterScore(a: ArticleLike, b: ArticleLike): { score: number; reasons: string[] } {
  const idf = new Map<string, number>();
  return scoreSignatures(signatureFor(a, idf), signatureFor(b, idf));
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/** Keys that could plausibly co-occur in two reports of the same event. */
function blockingKeys(a: ArticleLike, sig: Signature, idf: Map<string, number>): string[] {
  const keys = new Set<string>();
  for (const id of sig.known) keys.add(`e:${id}`);
  for (const t of sig.tags.keys()) keys.add(`t:${t}`);
  // Rarest content tokens carry the most blocking power.
  const toks = [...sig.vec.keys()].sort((x, y) => (idf.get(y) ?? 1) - (idf.get(x) ?? 1)).slice(0, 6);
  for (const t of toks) keys.add(`w:${t}`);
  for (const n of sig.numerics) if (!n.startsWith("n")) keys.add(`#:${n}`);
  void a;
  return [...keys];
}

/** Posting lists longer than this are too generic to block on ("rates", "US"). */
const MAX_POSTINGS = 400;
/** Upper bound on candidates scored per article — caps worst-case work. */
const MAX_CANDIDATES = 240;

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): number {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return ra;
    this.parent[rb] = ra;
    return ra;
  }
}

export interface ClusterOptions {
  threshold?: number;
  /**
   * Fraction of the threshold that two *clusters* must still clear to be
   * joined. Below 1 this permits some chaining; at 1 it demands the merged
   * centroids be as similar as a fresh pair. Guards against a bridge article
   * silently welding two unrelated events together.
   */
  linkageRatio?: number;
  /** Override the hard temporal gate (hours). See MAX_GAP_HOURS. */
  maxGapHours?: number;
}

/**
 * Cluster articles into events.
 *
 * Strategy: block → score candidate pairs → sort by strength → union with an
 * average-linkage guard. Processing strongest pairs first means the confident
 * cores form before any marginal pair gets a chance to bridge two events, and
 * the centroid check rejects the bridge outright when it would.
 */
export function clusterArticles(
  articles: ArticleLike[],
  thresholdOrOptions: number | ClusterOptions = DEFAULT_THRESHOLD,
): Cluster[] {
  const opts: ClusterOptions =
    typeof thresholdOrOptions === "number" ? { threshold: thresholdOrOptions } : thresholdOrOptions;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const linkageRatio = opts.linkageRatio ?? 1.0;
  const maxGap = opts.maxGapHours ?? MAX_GAP_HOURS;
  const n = articles.length;
  if (n === 0) return [];

  // Corpus IDF — rare words should dominate the match, common ones should not.
  const df = new Map<string, number>();
  const perDoc = articles.map((a) => new Set(tokens(a.title)));
  for (const s of perDoc) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(1 + n / (1 + c)) + 0.2);

  const sigs = articles.map((a) => signatureFor(a, idf));

  // --- Blocking ---
  const index = new Map<string, number[]>();
  const keysPer: string[][] = [];
  for (let i = 0; i < n; i++) {
    const keys = blockingKeys(articles[i], sigs[i], idf);
    keysPer.push(keys);
    for (const k of keys) {
      const list = index.get(k);
      if (list) list.push(i);
      else index.set(k, [i]);
    }
  }

  // --- Candidate pairs ---
  const pairs: { i: number; j: number; score: number; reasons: string[] }[] = [];
  const seenPair = new Set<number>();
  for (let i = 0; i < n; i++) {
    const cand = new Set<number>();
    for (const k of keysPer[i]) {
      const list = index.get(k);
      if (!list || list.length > MAX_POSTINGS) continue;
      for (const j of list) if (j !== i) cand.add(j);
      if (cand.size >= MAX_CANDIDATES) break;
    }
    for (const j of cand) {
      const lo = Math.min(i, j), hi = Math.max(i, j);
      const key = lo * n + hi;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      const { score, reasons } = scoreSignatures(sigs[lo], sigs[hi], maxGap);
      if (score >= threshold) pairs.push({ i: lo, j: hi, score, reasons });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  // --- Agglomerate with an average-linkage guard ---
  const uf = new UnionFind(n);
  const rootSig = new Map<number, Signature>();
  const rootLinks = new Map<number, { sum: number; count: number; reasons: string[] }>();
  const sigOf = (root: number) => rootSig.get(root) ?? sigs[root];
  for (const p of pairs) {
    const ra = uf.find(p.i), rb = uf.find(p.j);
    if (ra === rb) {
      const acc = rootLinks.get(ra);
      if (acc) { acc.sum += p.score; acc.count++; }
      continue;
    }
    const sa = sigOf(ra), sb = sigOf(rb);
    const link = sa.n === 1 && sb.n === 1 ? { score: p.score, reasons: p.reasons } : scoreSignatures(sa, sb, maxGap);
    if (link.score < threshold * linkageRatio) continue;
    const root = uf.union(ra, rb);
    const other = root === ra ? rb : ra;
    rootSig.set(root, mergeSignature(sa, sb));
    const accA = rootLinks.get(ra) ?? { sum: 0, count: 0, reasons: [] };
    const accB = rootLinks.get(rb) ?? { sum: 0, count: 0, reasons: [] };
    rootLinks.set(root, {
      sum: accA.sum + accB.sum + link.score,
      count: accA.count + accB.count + 1,
      reasons: link.reasons.length ? link.reasons : accA.reasons.length ? accA.reasons : accB.reasons,
    });
    rootLinks.delete(other);
    rootSig.delete(other);
  }

  // --- Materialise ---
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = uf.find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  }

  const out: Cluster[] = [];
  for (const [root, members] of groups) {
    const sig = sigOf(root);
    const link = rootLinks.get(root);
    const arts = members.map((i) => articles[i]);
    // Representative headline: the member closest to the cluster centroid,
    // tie-broken towards the earliest report.
    let bestIdx = members[0], bestSim = -1;
    for (const i of members) {
      const sim = vectorCosine(sigs[i].vec, sig.vec);
      const earlier =
        sim === bestSim &&
        (articles[i].publishedAt ?? "9") < (articles[bestIdx].publishedAt ?? "9");
      if (sim > bestSim || earlier) { bestSim = sim; bestIdx = i; }
    }
    const head = articles[bestIdx];
    const countries = [...sig.countries].filter(Boolean).sort();
    const geoMembers = arts.filter((a) => a.location && Number.isFinite(a.location.lat));
    const confidence =
      members.length === 1 ? 0.5 : link && link.count ? Math.round((link.sum / link.count) * 100) / 100 : 0.5;
    const times = arts.map((a) => (a.publishedAt ? Date.parse(a.publishedAt) : NaN)).filter(Number.isFinite);
    out.push({
      id: head.id,
      headline: head.title,
      memberIds: members.map((i) => articles[i].id),
      topic: [...sig.topics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? head.topic,
      location: geoMembers.length
        ? { label: head.location?.label ?? geoMembers[0].location!.label, lat: sig.lat, lng: sig.lng, countryCodes: countries }
        : undefined,
      tags: [...new Set(arts.flatMap((a) => a.tags ?? []))].slice(0, 12),
      confidence,
      confidenceReasons:
        members.length === 1
          ? ["Single-article cluster (awaiting corroboration)"]
          : link?.reasons.length
            ? link.reasons
            : ["Grouped on combined lexical, entity and location signals"],
      countries,
      entityIds: [...sig.entities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k),
      crossLingual: sig.languages.size > 1,
      timeSpanHours: times.length >= 2 ? Math.round((Math.max(...times) - Math.min(...times)) / 3_600_000) : 0,
    });
  }
  // Largest, most-corroborated events first.
  out.sort((a, b) => b.memberIds.length - a.memberIds.length || b.confidence - a.confidence);
  return out;
}

export function mergeClusters(a: Cluster, b: Cluster): Cluster {
  return {
    id: a.id,
    headline: a.headline,
    memberIds: Array.from(new Set([...a.memberIds, ...b.memberIds])),
    topic: a.topic ?? b.topic,
    location: a.location ?? b.location,
    tags: Array.from(new Set([...a.tags, ...b.tags])).slice(0, 12),
    confidence: Math.round(Math.max(a.confidence, b.confidence) * 100) / 100,
    confidenceReasons: a.confidenceReasons.length ? a.confidenceReasons : b.confidenceReasons,
    countries: Array.from(new Set([...a.countries, ...b.countries])),
    entityIds: Array.from(new Set([...(a.entityIds ?? []), ...(b.entityIds ?? [])])).slice(0, 8),
    crossLingual: Boolean(a.crossLingual || b.crossLingual),
    timeSpanHours: Math.max(a.timeSpanHours ?? 0, b.timeSpanHours ?? 0),
  };
}

/** Convert NewsPoints to ArticleLike for cluster testing / GDELT streaming path. */
export function pointsToArticles(points: NewsPoint[]): ArticleLike[] {
  return points.map((p, i) => ({
    id: `pt-${i}-${p.lat.toFixed(2)}-${p.lng.toFixed(2)}`,
    title: p.headline,
    url: `https://news.local/point/${i}`,
    countryCode: p.countryCode || undefined,
    tags: p.tags ?? [],
    location: p.location ? { label: p.location, lat: p.lat, lng: p.lng, countryCode: p.countryCode || undefined } : undefined,
    topic: p.topic,
  }));
}

export function clusteringQuality(
  clusters: Cluster[],
  totalArticles: number,
): { coverage: number; avgConfidence: number; multiSourceClusters: number; crossLingualClusters: number; largestCluster: number } {
  const clustered = clusters.reduce((n, c) => n + c.memberIds.length, 0);
  const coverage = totalArticles ? clustered / totalArticles : 0;
  const avgConfidence = clusters.length ? clusters.reduce((s, c) => s + c.confidence, 0) / clusters.length : 0;
  return {
    coverage: Math.round(coverage * 100) / 100,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    multiSourceClusters: clusters.filter((c) => c.memberIds.length >= 2).length,
    crossLingualClusters: clusters.filter((c) => c.crossLingual).length,
    largestCluster: clusters.reduce((m, c) => Math.max(m, c.memberIds.length), 0),
  };
}
