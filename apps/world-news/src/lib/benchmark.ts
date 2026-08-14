// Clustering benchmark harness.
//
// Three questions this answers, in order of how much they matter:
//   1. Do we agree with a human about what one event is?   → human gold set
//   2. Does that hold at thousands of articles?             → synthetic corpus
//   3. Where exactly do we fail?                            → per-slice metrics
//
// Two metric families are reported because they disagree in useful ways:
//   - Pairwise P/R/F1 is dominated by large clusters (a 40-article event
//     contributes 780 pairs), so it flatters a system that gets the big
//     stories right and the long tail wrong.
//   - B-cubed weights every *article* equally, which is closer to what a reader
//     experiences, and unlike pairwise it degrades gracefully on singletons.
// A regression in one and not the other is a signal, not noise — read both.
//
// Everything here is deterministic and LLM-free. `npm run benchmark` prints it.

import { clusterArticles, type ArticleLike, DEFAULT_THRESHOLD } from "./clustering";
import { goldArticles, goldGroups, type GoldArticle } from "./benchmarkGold";

export interface BenchmarkCase {
  name: string;
  articles: ArticleLike[];
  /** Which article ids should end up in the same cluster (ground truth). */
  expectedGroups: string[][];
}

export interface PairMetrics { precision: number; recall: number; f1: number }
export interface BenchmarkResult extends PairMetrics {
  name: string;
  note: string;
  /** B-cubed: per-article precision/recall, insensitive to cluster size skew. */
  bcubed: PairMetrics;
  articles: number;
  predictedClusters: number;
  trueClusters: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function pairKey(a: string, b: string): string { return a < b ? `${a}||${b}` : `${b}||${a}`; }

function pairsOf(groups: string[][]): Set<string> {
  const out = new Set<string>();
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) out.add(pairKey(g[i], g[j]));
  return out;
}

export function pairwiseMetrics(predicted: string[][], truth: string[][]): PairMetrics {
  const pred = pairsOf(predicted), gold = pairsOf(truth);
  let tp = 0;
  for (const p of pred) if (gold.has(p)) tp++;
  const fp = pred.size - tp;
  const fn = gold.size - tp;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision: round2(precision), recall: round2(recall), f1: round2(f1) };
}

/**
 * B-cubed (Bagga & Baldwin): for each article, precision is the share of its
 * predicted cluster that shares its true event; recall is the share of its true
 * event captured in its predicted cluster. Averaged over articles, so one huge
 * event cannot drown out a hundred small ones.
 */
export function bcubedMetrics(predicted: string[][], truth: string[][]): PairMetrics {
  const predOf = new Map<string, string[]>();
  for (const g of predicted) for (const id of g) predOf.set(id, g);
  const trueOf = new Map<string, string[]>();
  for (const g of truth) for (const id of g) trueOf.set(id, g);
  const ids = [...trueOf.keys()];
  if (ids.length === 0) return { precision: 1, recall: 1, f1: 1 };
  let pSum = 0, rSum = 0;
  for (const id of ids) {
    const p = predOf.get(id) ?? [id];
    const t = trueOf.get(id) ?? [id];
    const tSet = new Set(t);
    let shared = 0;
    for (const x of p) if (tSet.has(x)) shared++;
    pSum += shared / p.length;
    rSum += shared / t.length;
  }
  const precision = pSum / ids.length, recall = rSum / ids.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision: round2(precision), recall: round2(recall), f1: round2(f1) };
}

/** Evaluate one labelled case at a given threshold. */
export function evaluateBenchmark(c: BenchmarkCase, threshold = DEFAULT_THRESHOLD): BenchmarkResult {
  const clusters = clusterArticles(c.articles, threshold);
  const predicted = clusters.map((cl) => cl.memberIds);
  // Ground truth omits singletons in hand-written cases; add them back so
  // precision is scored against every article, not only the interesting ones.
  const covered = new Set(c.expectedGroups.flat());
  const truth = [...c.expectedGroups, ...c.articles.filter((a) => !covered.has(a.id)).map((a) => [a.id])];
  const pair = pairwiseMetrics(predicted, truth);
  return {
    name: c.name,
    ...pair,
    bcubed: bcubedMetrics(predicted, truth),
    articles: c.articles.length,
    predictedClusters: clusters.length,
    trueClusters: truth.length,
    note: `${clusters.length} clusters from ${c.articles.length} articles (truth: ${truth.length})`,
  };
}

// ---------------------------------------------------------------------------
// Small hand-written cases (kept: they are fast, readable regression guards)
// ---------------------------------------------------------------------------

export const SAMPLE_CASES: BenchmarkCase[] = [
  {
    name: "duplicate-wire-copy",
    articles: [
      { id: "a1", title: "Central bank raises rates by 50 bps", url: "https://reuters.com/a1", publisher: "reuters.com", tags: ["rates", "central bank"], topic: "Economy & Business", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "a2", title: "Central bank lifts rates 50 bps in surprise move", url: "https://apnews.com/a2", publisher: "apnews.com", tags: ["rates", "central bank"], topic: "Economy & Business", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "a3", title: "Football derby ends 2-1 after late winner", url: "https://bbc.co.uk/sport/a3", publisher: "bbc.co.uk", tags: ["football"], topic: "Sport", location: { label: "Manchester", lat: 53.4, lng: -2.2, countryCode: "GB" } },
    ],
    expectedGroups: [["a1", "a2"]],
  },
  {
    name: "multi-country same event",
    articles: [
      { id: "b1", title: "EU unveils new AI act enforcement timeline", url: "https://reuters.com/b1", publisher: "reuters.com", tags: ["eu", "ai act"], topic: "Technology", location: { label: "Brussels", lat: 50.8, lng: 4.35, countryCode: "BE" } },
      { id: "b2", title: "EU AI Act: enforcement timeline announced", url: "https://lemonde.fr/b2", publisher: "lemonde.fr", tags: ["eu", "ai act"], topic: "Technology", location: { label: "Paris", lat: 48.85, lng: 2.35, countryCode: "FR" } },
    ],
    expectedGroups: [["b1", "b2"]],
  },
];

// ---------------------------------------------------------------------------
// Gold-set evaluation with slices
// ---------------------------------------------------------------------------

export interface SliceResult extends PairMetrics {
  slice: string;
  articles: number;
  events: number;
  bcubedF1: number;
}

export interface GoldReport {
  threshold: number;
  overall: BenchmarkResult;
  byTopic: SliceResult[];
  byRegion: SliceResult[];
  byDifficulty: SliceResult[];
  /** Events the clusterer split across multiple predicted clusters. */
  worstSplits: { event: string; pieces: number; topic: string; region: string }[];
  /** Predicted clusters that fused more than one labelled event. */
  worstMerges: { cluster: string; events: string[]; size: number }[];
}

function sliceMetrics(
  articles: GoldArticle[],
  predicted: string[][],
  truth: string[][],
  keyOf: (a: GoldArticle) => string,
): SliceResult[] {
  const keys = [...new Set(articles.map(keyOf))].sort();
  const byId = new Map(articles.map((a) => [a.id, a] as const));
  const restrict = (groups: string[][], key: string) =>
    groups
      .map((g) => g.filter((id) => { const a = byId.get(id); return a && keyOf(a) === key; }))
      .filter((g) => g.length > 0);
  return keys.map((key) => {
    const p = restrict(predicted, key);
    const t = restrict(truth, key);
    const arts = articles.filter((a) => keyOf(a) === key);
    return {
      slice: key,
      ...pairwiseMetrics(p, t),
      bcubedF1: bcubedMetrics(p, t).f1,
      articles: arts.length,
      events: t.length,
    };
  });
}

/**
 * Evaluate against the human-labelled gold set, sliced by topic, region and
 * difficulty. Slice metrics are computed on the *restriction* of both predicted
 * and true groupings to that slice, so a Europe number answers "how well do we
 * cluster European coverage" rather than being contaminated by other regions.
 */
export function evaluateGold(threshold = DEFAULT_THRESHOLD): GoldReport {
  const articles = goldArticles();
  const truth = goldGroups(articles);
  const clusters = clusterArticles(articles, threshold);
  const predicted = clusters.map((c) => c.memberIds);

  const byId = new Map(articles.map((a) => [a.id, a] as const));
  const predOf = new Map<string, number>();
  predicted.forEach((g, i) => g.forEach((id) => predOf.set(id, i)));

  // Splits: one labelled event scattered over several predicted clusters.
  const worstSplits: GoldReport["worstSplits"] = [];
  for (const g of truth) {
    if (g.length < 2) continue;
    const pieces = new Set(g.map((id) => predOf.get(id))).size;
    if (pieces > 1) {
      const a = byId.get(g[0])!;
      worstSplits.push({ event: a.eventKey ?? g[0], pieces, topic: a.topic ?? "?", region: a.region });
    }
  }
  worstSplits.sort((a, b) => b.pieces - a.pieces);

  // Merges: one predicted cluster covering several labelled events.
  const worstMerges: GoldReport["worstMerges"] = [];
  predicted.forEach((g, i) => {
    const evs = new Set(g.map((id) => byId.get(id)?.eventKey ?? `singleton:${id}`));
    if (evs.size > 1) worstMerges.push({ cluster: clusters[i].headline.slice(0, 60), events: [...evs], size: g.length });
  });
  worstMerges.sort((a, b) => b.events.length - a.events.length);

  const pair = pairwiseMetrics(predicted, truth);
  return {
    threshold,
    overall: {
      name: "human-gold",
      ...pair,
      bcubed: bcubedMetrics(predicted, truth),
      articles: articles.length,
      predictedClusters: predicted.length,
      trueClusters: truth.length,
      note: `${predicted.length} predicted vs ${truth.length} labelled events over ${articles.length} articles`,
    },
    byTopic: sliceMetrics(articles, predicted, truth, (a) => a.topic ?? "unknown"),
    byRegion: sliceMetrics(articles, predicted, truth, (a) => a.region),
    byDifficulty: sliceMetrics(articles, predicted, truth, (a) => a.difficulty),
    worstSplits: worstSplits.slice(0, 8),
    worstMerges: worstMerges.slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Scale evaluation
// ---------------------------------------------------------------------------

export interface ScaleReport extends PairMetrics {
  articles: number;
  events: number;
  predictedClusters: number;
  bcubed: PairMetrics;
  elapsedMs: number;
  /** Scored pairs per article — the number that tells you whether it is O(n²). */
  msPerArticle: number;
}

/** Run the generated corpus at a given size and report accuracy + wall time. */
export async function evaluateScale(events = 400, seed = 42, threshold = DEFAULT_THRESHOLD): Promise<ScaleReport> {
  const { generateCorpus } = await import("./benchmarkCorpus");
  const corpus = generateCorpus({ events, seed });
  const t0 = Date.now();
  const clusters = clusterArticles(corpus.articles, threshold);
  const elapsedMs = Date.now() - t0;
  const predicted = clusters.map((c) => c.memberIds);
  return {
    ...pairwiseMetrics(predicted, corpus.groups),
    bcubed: bcubedMetrics(predicted, corpus.groups),
    articles: corpus.articles.length,
    events: corpus.groups.length,
    predictedClusters: predicted.length,
    elapsedMs,
    msPerArticle: Math.round((elapsedMs / Math.max(1, corpus.articles.length)) * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Threshold sweep
// ---------------------------------------------------------------------------

export interface SweepRow extends PairMetrics { threshold: number; bcubedF1: number; clusters: number }

/**
 * Sweep the clustering threshold over the gold set.
 *
 * The point is not to pick the peak — that would overfit 200 labelled articles.
 * It is to see the *shape*: a sharp peak means the threshold is load-bearing
 * and fragile, a plateau means the signal is doing the work.
 */
export function sweepThreshold(from = 0.28, to = 0.62, step = 0.02): SweepRow[] {
  const articles = goldArticles();
  const truth = goldGroups(articles);
  const rows: SweepRow[] = [];
  for (let t = from; t <= to + 1e-9; t += step) {
    const threshold = Math.round(t * 100) / 100;
    const predicted = clusterArticles(articles, threshold).map((c) => c.memberIds);
    rows.push({
      threshold,
      ...pairwiseMetrics(predicted, truth),
      bcubedF1: bcubedMetrics(predicted, truth).f1,
      clusters: predicted.length,
    });
  }
  return rows;
}

export function bestThreshold(rows = sweepThreshold()): SweepRow {
  return rows.reduce((best, r) => (r.bcubedF1 + r.f1 > best.bcubedF1 + best.f1 ? r : best), rows[0]);
}

// ---------------------------------------------------------------------------
// Legacy aggregate (kept for the /benchmark page and older callers)
// ---------------------------------------------------------------------------

export async function allCases(): Promise<BenchmarkCase[]> {
  const { EXTENDED_CASES } = await import("./benchmarkDataset");
  return [...SAMPLE_CASES, ...EXTENDED_CASES];
}

export async function evaluateAll(threshold = DEFAULT_THRESHOLD) {
  const cases = await allCases();
  const results = cases.map((c) => evaluateBenchmark(c, threshold));
  const mean = (f: (r: BenchmarkResult) => number) => round2(results.reduce((s, r) => s + f(r), 0) / (results.length || 1));
  return {
    results,
    macro: { precision: mean((r) => r.precision), recall: mean((r) => r.recall), f1: mean((r) => r.f1) },
    macroBcubed: { precision: mean((r) => r.bcubed.precision), recall: mean((r) => r.bcubed.recall), f1: mean((r) => r.bcubed.f1) },
  };
}
