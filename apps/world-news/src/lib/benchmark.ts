// Benchmark harness: clustering + summarisation accuracy.
// Run with `npm run benchmark` or `npm test -- benchmark`.
// Keeps the product honest — numbers, not vibes.
import { clusterArticles, type ArticleLike } from "./clustering";

export interface BenchmarkCase {
  name: string;
  articles: ArticleLike[];
  // Which article ids should end up in the same cluster (ground truth)
  expectedGroups: string[][]; // each inner array = one event
}

export interface BenchmarkResult {
  name: string;
  precision: number; // 0..1
  recall: number;
  f1: number;
  note: string;
}

// Pairwise evaluation: treat clustering as pairwise same-event decisions.
export function evaluateBenchmark(c: BenchmarkCase, threshold = 0.42): BenchmarkResult {
  const clusters = clusterArticles(c.articles, threshold);
  const idx = new Map<string, number>();
  c.articles.forEach((a,i)=>idx.set(a.id, i));
  const truth = new Map<string, Set<string>>();
  for (const g of c.expectedGroups) for (const id of g) truth.set(id, new Set(g));
  // Build predicted same-event pairs from clusters
  const predPairs = new Set<string>();
  for (const cl of clusters) for (let i=0;i<cl.memberIds.length;i++) for (let j=i+1;j<cl.memberIds.length;j++) {
    const a = cl.memberIds[i], b = cl.memberIds[j];
    predPairs.add([a,b].sort().join("||"));
  }
  const truePairs = new Set<string>();
  for (const g of c.expectedGroups) for (let i=0;i<g.length;i++) for (let j=i+1;j<g.length;j++) truePairs.add([g[i],g[j]].sort().join("||"));
  let tp=0, fp=0, fn=0;
  for (const p of predPairs) if (truePairs.has(p)) tp++; else fp++;
  for (const p of truePairs) if (!predPairs.has(p)) fn++;
  const precision = tp+fp===0 ? 1 : tp/(tp+fp);
  const recall = tp+fn===0 ? 1 : tp/(tp+fn);
  const f1 = precision+recall===0 ? 0 : 2*precision*recall/(precision+recall);
  return { name: c.name, precision: Math.round(precision*100)/100, recall: Math.round(recall*100)/100, f1: Math.round(f1*100)/100, note: `${clusters.length} clusters from ${c.articles.length} articles` };
}

export const SAMPLE_CASES: BenchmarkCase[] = [
  {
    name: "duplicate-wire-copy",
    articles: [
      { id: "a1", title: "Central bank raises rates by 50 bps", url: "https://reuters.com/a1", publisher: "reuters.com", tags: ["rates","central bank"], topic: "Economy & Business", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "a2", title: "Central bank lifts rates 50 bps in surprise move", url: "https://apnews.com/a2", publisher: "apnews.com", tags: ["rates","central bank"], topic: "Economy & Business", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "a3", title: "Football derby ends 2-1 after late winner", url: "https://bbc.co.uk/sport/a3", publisher: "bbc.co.uk", tags: ["football"], topic: "Sport", location: { label: "Manchester", lat: 53.4, lng: -2.2, countryCode: "GB" } },
    ],
    expectedGroups: [["a1","a2"]],
  },
  {
    name: "multi-country same event",
    articles: [
      { id: "b1", title: "EU unveils new AI act enforcement timeline", url: "https://reuters.com/b1", publisher: "reuters.com", tags: ["eu","ai act"], topic: "Technology", location: { label: "Brussels", lat: 50.8, lng: 4.35, countryCode: "BE" } },
      { id: "b2", title: "EU AI Act: enforcement timeline announced", url: "https://lemonde.fr/b2", publisher: "lemonde.fr", tags: ["eu","ai act"], topic: "Technology", location: { label: "Paris", lat: 48.85, lng: 2.35, countryCode: "FR" } },
    ],
    expectedGroups: [["b1","b2"]],
  },
];
