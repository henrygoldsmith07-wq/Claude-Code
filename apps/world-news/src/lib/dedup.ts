// Syndicated story deduplication + original vs rewrite distinction.
// Pure + deterministic. Used before clustering and for source provenance.

import type { ArticleLike } from "./clustering";

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function titleTokens(s: string): Set<string> {
  const stop = new Set(["the","a","an","and","or","of","in","on","to","for","with","is","are","as","at","by","from"]);
  return new Set(normTitle(s).split(" ").filter(w => w.length >= 3 && !stop.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    u.search = "";
    u.hash = "";
    let p = u.pathname.replace(/\/+$/, "");
    if (!p) p = "/";
    return `${u.hostname}${p}`.toLowerCase();
  } catch { return url.toLowerCase().trim(); }
}

export interface DedupResult {
  kept: ArticleLike[];
  removed: { id: string; reason: string; canonicalOf: string }[];
}

/** Remove exact-URL duplicates and near-duplicate headlines (syndicated wires). */
export function dedupeArticles(articles: ArticleLike[], titleThreshold = 0.88): DedupResult {
  const seenUrl = new Map<string, string>(); // canonical -> id
  const kept: ArticleLike[] = [];
  const removed: DedupResult["removed"] = [];
  const keptTokens = new Map<string, Set<string>>();

  for (const art of articles) {
    const can = canonicalUrl(art.url);
    if (seenUrl.has(can)) {
      removed.push({ id: art.id, reason: "Exact URL duplicate", canonicalOf: seenUrl.get(can)! });
      continue;
    }
    // Near-duplicate title check against already-kept
    const toks = titleTokens(art.title);
    let dupOf: string | null = null;
    for (const k of kept) {
      const kt = keptTokens.get(k.id)!;
      if (jaccard(toks, kt) >= titleThreshold) { dupOf = k.id; break; }
    }
    if (dupOf) {
      // Prefer wire over rewrite when both titles match; keep earlier (assumed earlier = original)
      removed.push({ id: art.id, reason: `Syndicated near-duplicate (Jaccard ≥ ${titleThreshold})`, canonicalOf: dupOf });
      continue;
    }
    seenUrl.set(can, art.id);
    keptTokens.set(art.id, toks);
    kept.push(art);
  }
  return { kept, removed };
}

export type Originality = "original" | "rewrite" | "syndicated" | "unknown";

/** Heuristic: wire + earliest publishedAt among near-duplicates → original; others → syndicated/rewrite. */
export function originalityForCluster(members: ArticleLike[]): Map<string, Originality> {
  const out = new Map<string, Originality>();
  if (members.length === 1) { out.set(members[0].id, "original"); return out; }
  // Sort by publishedAt if present, else by id order
  const sorted = [...members].sort((a,b) => {
    const pa = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const pb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    if (pa && pb) return pa - pb;
    if (pa) return -1;
    if (pb) return 1;
    return a.id.localeCompare(b.id);
  });
  const wireIds = new Set(members.filter(m => /reuters|apnews|afp|dpa|efe/i.test(m.publisher ?? "") || m.publisher === "wire").map(m=>m.id));
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (i === 0) out.set(m.id, wireIds.has(m.id) || members.length > 2 ? "original" : "original");
    else if (wireIds.has(m.id)) out.set(m.id, "syndicated");
    else {
      // High title overlap with first → likely rewrite/syndication
      const j = jaccard(titleTokens(m.title), titleTokens(sorted[0].title));
      out.set(m.id, j >= 0.75 ? "syndicated" : "rewrite");
    }
  }
  return out;
}
