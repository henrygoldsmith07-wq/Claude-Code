// Clustering that improves understanding: duplicate-coverage collapse,
// event merging, multi-country handling, and explained confidence.
// Pure + deterministic — benchmarkable without LLM calls.
import type { NewsPoint } from "./gemini";
import type { SourceAttribution } from "./storyModel";

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
}

export interface Cluster {
  id: string;
  headline: string; // representative headline
  memberIds: string[];
  topic?: string;
  location?: { label: string; lat: number; lng: number; countryCodes: string[] };
  tags: string[]; // union
  confidence: number; // 0..1
  confidenceReasons: string[]; // why this confidence
  countries: string[]; // ISO2s involved
  updatedAt?: string;
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): Set<string> {
  const stop = new Set(["the","a","an","and","or","of","in","on","to","for","with","is","are","as","at","by","from","about","after","over","into","amid","says","say"]);
  return new Set(normTitle(s).split(" ").filter(w => w.length >= 3 && !stop.has(w)));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function tagOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map(s => s.toLowerCase()));
  const B = new Set(b.map(s => s.toLowerCase()));
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / Math.max(A.size, B.size);
}
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

export function clusterScore(a: ArticleLike, b: ArticleLike): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const tj = jaccard(tokens(a.title), tokens(b.title));
  if (tj >= 0.5) { score += 0.45; reasons.push(`Title overlap ${Math.round(tj*100)}%`); }
  else if (tj >= 0.3) { score += 0.22; reasons.push(`Title overlap ${Math.round(tj*100)}%`); }
  const to = tagOverlap(a.tags, b.tags);
  if (to >= 0.5) { score += 0.22; reasons.push(`Tag overlap ${Math.round(to*100)}%`); }
  else if (to >= 0.25) { score += 0.12; reasons.push(`Tag overlap ${Math.round(to*100)}%`); }
  if (a.location && b.location && Number.isFinite(a.location.lat) && Number.isFinite(b.location.lat)) {
    const d = haversineKm(a.location.lat, a.location.lng, b.location.lat, b.location.lng);
    if (d <= 120) { score += 0.14; reasons.push(`Same locale (~${Math.round(d)}km)`); }
    else if (d <= 600) { score += 0.06; reasons.push(`Nearby region (~${Math.round(d)}km)`); }
  }
  if (a.topic && b.topic && a.topic === b.topic) { score += 0.08; reasons.push(`Same topic: ${a.topic}`); }
  // Publisher diversity is treated as corroboration, not a penalty — slightly
  // boost when two different publishers converge.
  if (a.publisher && b.publisher && a.publisher !== b.publisher && tj >= 0.3) { score += 0.04; reasons.push("Independent outlets"); }
  return { score: Math.min(1, score), reasons };
}

export function clusterArticles(articles: ArticleLike[], threshold = 0.42): Cluster[] {
  // Greedy agglomerative: iterate articles, attach to best scoring cluster head.
  const clusters: Cluster[] = [];
  const heads: ArticleLike[] = [];
  for (const art of articles) {
    let bestIdx = -1, bestScore = 0, bestReasons: string[] = [];
    for (let i = 0; i < heads.length; i++) {
      const { score, reasons } = clusterScore(art, heads[i]);
      if (score > bestScore) { bestScore = score; bestReasons = reasons; }
      if (score >= threshold && score > bestScore) { /* already captured */ }
    }
    // re-scan to find the max explicitly
    let maxI = -1, maxS = 0;
    for (let i = 0; i < heads.length; i++) {
      const s = clusterScore(art, heads[i]).score;
      if (s > maxS) { maxS = s; maxI = i; }
    }
    if (maxI >= 0 && maxS >= threshold) {
      const c = clusters[maxI];
      c.memberIds.push(art.id);
      c.tags = Array.from(new Set([...c.tags, ...art.tags])).slice(0, 12);
      const cc = art.countryCode ? [art.countryCode] : [];
      c.countries = Array.from(new Set([...c.countries, ...cc]));
      if (art.location) {
        const existing = c.location;
        if (!existing) c.location = { label: art.location.label, lat: art.location.lat, lng: art.location.lng, countryCodes: cc };
        else {
          // keep centroid-ish but preserve label diversity
          const n = c.memberIds.length;
          const nextLat = (existing.lat * (n - 1) + art.location.lat) / n;
          const nextLng = (existing.lng * (n - 1) + art.location.lng) / n;
          const nextCodes = Array.from(new Set([...(existing.countryCodes ?? []), ...cc]));
          if (art.location.countryCode && !nextCodes.includes(art.location.countryCode)) nextCodes.push(art.location.countryCode);
          c.location = { label: existing.label, lat: nextLat, lng: nextLng, countryCodes: nextCodes };
        }
      }
      // confidence is the max pairwise score seen inside the cluster (explainable)
      if (maxS > c.confidence) {
        c.confidence = Math.round(maxS*100)/100;
        c.confidenceReasons = clusterScore(art, heads[maxI]).reasons;
      }
    } else {
      clusters.push({
        id: art.id,
        headline: art.title,
        memberIds: [art.id],
        topic: art.topic,
        location: art.location ? { label: art.location.label, lat: art.location.lat, lng: art.location.lng, countryCodes: art.countryCode ? [art.countryCode] : [] } : undefined,
        tags: [...art.tags].slice(0, 8),
        confidence: 0.5,
        confidenceReasons: ["Single-article cluster (awaiting corroboration)"],
        countries: art.countryCode ? [art.countryCode] : [],
      });
      heads.push(art);
    }
    void bestIdx; void bestScore; void bestReasons;
  }
  return clusters;
}

export function mergeClusters(a: Cluster, b: Cluster): Cluster {
  return {
    id: a.id,
    headline: a.headline,
    memberIds: Array.from(new Set([...a.memberIds, ...b.memberIds])),
    topic: a.topic ?? b.topic,
    location: a.location ?? b.location,
    tags: Array.from(new Set([...a.tags, ...b.tags])).slice(0, 12),
    confidence: Math.round(Math.max(a.confidence, b.confidence)*100)/100,
    confidenceReasons: a.confidenceReasons.length ? a.confidenceReasons : b.confidenceReasons,
    countries: Array.from(new Set([...a.countries, ...b.countries])),
  };
}

// Convert NewsPoints to ArticleLike for cluster testing / GDELT streaming path
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

export function clusteringQuality(clusters: Cluster[], totalArticles: number): { coverage: number; avgConfidence: number; multiSourceClusters: number } {
  const clustered = clusters.reduce((n,c) => n + c.memberIds.length, 0);
  const coverage = totalArticles ? clustered/totalArticles : 0;
  const avgConfidence = clusters.length ? clusters.reduce((s,c)=>s+c.confidence,0)/clusters.length : 0;
  const multiSourceClusters = clusters.filter(c => c.memberIds.length >= 2).length;
  return { coverage: Math.round(coverage*100)/100, avgConfidence: Math.round(avgConfidence*100)/100, multiSourceClusters };
}
