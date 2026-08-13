// Entity / Country / Event knowledge graphs — derived nightly from snapshots.
// Pure builders; no network. Rendered as chips on story pages.

export interface GraphEdge { from: string; to: string; weight: number; label?: string; }
export interface Graph { nodes: { id: string; label: string; kind: string; weight: number }[]; edges: GraphEdge[]; }

import type { CountryNews } from "./gemini";

function topN(entries: Map<string, number>, n: number): [string, number][] {
  return [...entries.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
}

export function buildEntityGraph(newsList: CountryNews[]): Graph {
  const counts = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const news of newsList) for (const s of news.stories ?? []) {
    const tags = (s as unknown as { tags?: string[] }).tags ?? s.keyPoints.flatMap(k=> k.toLowerCase().split(/\s+/).filter(w=>w.length>=4)).slice(0,6);
    // fallback: use keyPoints-derived tags when story has no explicit tags
    const uniq = Array.from(new Set(tags.map(t=>t.toLowerCase()).slice(0,6)));
    for (const t of uniq) counts.set(t, (counts.get(t)??0)+1);
    for (let i=0;i<uniq.length;i++) for (let j=i+1;j<uniq.length;j++) {
      const key = [uniq[i], uniq[j]].sort().join("||");
      pairs.set(key, (pairs.get(key)??0)+1);
    }
  }
  const top = topN(counts, 24);
  const idSet = new Set(top.map(([k])=>k));
  const nodes = top.map(([id, w])=> ({ id, label: id, kind: "entity", weight: w }));
  const edges: GraphEdge[] = [];
  for (const [key, w] of pairs) {
    const [a,b] = key.split("||");
    if (idSet.has(a) && idSet.has(b) && w >= 2) edges.push({ from: a, to: b, weight: w });
  }
  return { nodes, edges: edges.sort((a,b)=>b.weight-a.weight).slice(0, 40) };
}

export function buildCountryGraph(newsList: CountryNews[]): Graph {
  const counts = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const news of newsList) for (const s of news.stories ?? []) {
    const ccs = Array.from(new Set(s.sources.map(x=>x.countryCode).filter((c):c is string=> Boolean(c)))).slice(0,4);
    for (const c of ccs) counts.set(c, (counts.get(c)??0)+1);
    for (let i=0;i<ccs.length;i++) for (let j=i+1;j<ccs.length;j++) {
      const key = [ccs[i], ccs[j]].sort().join("||");
      pairs.set(key, (pairs.get(key)??0)+1);
    }
  }
  const top = topN(counts, 16);
  const idSet = new Set(top.map(([k])=>k));
  const nodes = top.map(([id,w])=> ({ id, label: id, kind: "country", weight: w }));
  const edges: GraphEdge[] = [];
  for (const [key,w] of pairs) {
    const [a,b]=key.split("||");
    if (idSet.has(a)&&idSet.has(b)) edges.push({ from: a, to: b, weight: w });
  }
  return { nodes, edges: edges.sort((a,b)=>b.weight-a.weight).slice(0,24) };
}

export function buildEventGraph(newsList: CountryNews[]): Graph {
  const storyIds = new Map<string, { label: string; tags: string[] }>();
  for (const news of newsList) for (const s of news.stories ?? []) storyIds.set(s.id, { label: s.headline.slice(0,60), tags: (s as unknown as { tags?: string[] }).tags ?? [] });
  const ids = [...storyIds.keys()];
  const edges: GraphEdge[] = [];
  // Tag overlap edges between stories
  for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) {
    const a = storyIds.get(ids[i])!, b = storyIds.get(ids[j])!;
    const A = new Set(a.tags.map(t=>t.toLowerCase())), B = new Set(b.tags.map(t=>t.toLowerCase()));
    let inter=0; for (const x of A) if (B.has(x)) inter++;
    const denom = Math.max(A.size, B.size, 1);
    const score = inter/denom;
    if (score >= 0.25) edges.push({ from: ids[i], to: ids[j], weight: Math.round(score*100)/100, label: "related" });
  }
  return {
    nodes: ids.slice(0, 40).map(id=> ({ id, label: storyIds.get(id)!.label, kind: "event", weight: 1 })),
    edges: edges.sort((a,b)=>b.weight-a.weight).slice(0, 40),
  };
}
