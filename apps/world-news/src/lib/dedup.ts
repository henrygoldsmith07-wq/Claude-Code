// Syndication detection and original-reporting attribution.
//
// A cluster of twelve articles is not twelve sources. Eight of them are the
// same AP copy under eight mastheads, two are rewrites of that copy, and maybe
// two did their own reporting. Presenting that as "12 sources corroborate" is
// the single most misleading thing a news aggregator can do, so this module
// exists to tell those cases apart before anything downstream counts them.
//
// Two jobs:
//   dedupeArticles()  — collapse re-runs of the same text into one entry
//   originalityFor()  — grade what remains: original / rewrite / syndicated
//
// Pure + deterministic. No network.

import type { ArticleLike } from "./clustering";
import { foldDiacritics, transliterate } from "./entities";

// ---------------------------------------------------------------------------
// URL canonicalisation
// ---------------------------------------------------------------------------

/** Tracking parameters that never change what a URL points at. */
const JUNK_PARAMS = /^(utm_|fbclid|gclid|mc_|ref|ref_src|cmp|CMP|ito|smid|partner|at_|s_campaign|__twitter_impression|guccounter|guce_)/;

/**
 * Reduce a URL to what actually identifies the article.
 *
 * Publishers serve the same story from AMP paths, mobile subdomains, regional
 * editions and a forest of campaign parameters. Treating those as distinct
 * sources inflates every corroboration count on the page.
 */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.replace(/^(www|amp|m|mobile)\./, "").toLowerCase();
    // amp.example.com and example.com/amp/... are the same publisher.
    host = host.replace(/\.cdn\.ampproject\.org$/, "");
    const kept = [...u.searchParams.entries()]
      .filter(([k]) => !JUNK_PARAMS.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    let path = u.pathname
      .replace(/\/amp\/?$/i, "")
      .replace(/^\/amp\//i, "/")
      .replace(/\.amp$/i, "")
      .replace(/\/+$/, "");
    if (!path) path = "/";
    const query = kept.length ? `?${kept.map(([k, v]) => `${k}=${v}`).join("&")}` : "";
    return `${host}${path}${query}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ---------------------------------------------------------------------------
// Near-duplicate text detection
// ---------------------------------------------------------------------------

function normalise(s: string): string {
  return foldDiacritics(transliterate(s)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Character 5-grams — robust to the small edits a subeditor makes to a wire headline. */
function shingles(s: string, k = 5): Set<string> {
  const t = normalise(s).replace(/\s/g, "_");
  const out = new Set<string>();
  for (let i = 0; i + k <= t.length; i++) out.add(t.slice(i, i + k));
  if (out.size === 0 && t) out.add(t);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 64-bit SimHash over shingles.
 *
 * Used as a cheap prefilter: articles whose hashes differ in many bits cannot
 * be near-duplicates, so the exact Jaccard only runs on plausible candidates.
 * Kept exported because the Hamming distance is a useful debugging signal.
 */
export function simhash(text: string): bigint {
  const v = new Array<number>(64).fill(0);
  for (const sh of shingles(text)) {
    // FNV-1a, widened to 64 bits.
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < sh.length; i++) {
      h ^= BigInt(sh.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    for (let b = 0; b < 64; b++) v[b] += (h >> BigInt(b)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (v[b] > 0) out |= 1n << BigInt(b);
  return out;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

/** Wire credit lines a syndicating outlet leaves in the headline or standfirst. */
const WIRE_CREDIT = /\((reuters|ap|associated press|afp|dpa|efe|ansa|pa media|bloomberg|xinhua|tass|kyodo|yonhap|ians|pti)\)|\b(reuters|afp|dpa|associated press)\s*[-–—]\s/i;

const WIRE_DOMAIN = /\b(reuters|apnews|afp|dpa|efe|ansa|pamedia|bloomberg|xinhuanet|tass|kyodo|yna\.co\.kr)\b/i;

export function isWire(publisher?: string): boolean {
  return WIRE_DOMAIN.test(publisher ?? "");
}

/** Government, intergovernmental and multilateral hosts — primary publishers. */
export function isOfficialHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)(gov|gouv|govt|gc|go)\.[a-z]{2,3}$|\.gov$|(^|\.)(un|who|imf|oecd|nato|worldbank)\.(org|int)$|(^|\.)europa\.eu$|\.int$/.test(host);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export interface DedupRemoval {
  id: string;
  reason: string;
  canonicalOf: string;
  similarity: number;
}

export interface DedupResult {
  kept: ArticleLike[];
  removed: DedupRemoval[];
  /** canonical article id → ids collapsed into it. */
  duplicateGroups: Map<string, string[]>;
}

/**
 * Collapse re-runs of the same article.
 *
 * The survivor of a duplicate pair is chosen, not just "whichever came first":
 * the earliest timestamp wins, because that is the copy the others derive from,
 * and a wire breaks the tie when timestamps are equal or missing.
 */
export function dedupeArticles(articles: ArticleLike[], titleThreshold = 0.72): DedupResult {
  const order = [...articles].sort((a, b) => {
    const pa = a.publishedAt ? Date.parse(a.publishedAt) : Number.POSITIVE_INFINITY;
    const pb = b.publishedAt ? Date.parse(b.publishedAt) : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const wa = isWire(a.publisher) ? 0 : 1, wb = isWire(b.publisher) ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return a.id.localeCompare(b.id);
  });

  const seenUrl = new Map<string, string>();
  const kept: ArticleLike[] = [];
  const removed: DedupRemoval[] = [];
  const duplicateGroups = new Map<string, string[]>();
  const keptShingles = new Map<string, Set<string>>();
  const keptHashes = new Map<string, bigint>();

  const collapse = (id: string, into: string, reason: string, similarity: number) => {
    removed.push({ id, reason, canonicalOf: into, similarity });
    const g = duplicateGroups.get(into);
    if (g) g.push(id);
    else duplicateGroups.set(into, [id]);
  };

  for (const art of order) {
    const can = canonicalUrl(art.url);
    const urlOwner = seenUrl.get(can);
    if (urlOwner) {
      collapse(art.id, urlOwner, "Same article URL after canonicalisation", 1);
      continue;
    }

    const sh = shingles(art.title);
    const hash = simhash(art.title);
    let dupOf: string | null = null;
    let sim = 0;
    for (const k of kept) {
      // Cheap gate first: >22 differing bits cannot clear the threshold.
      if (hammingDistance(hash, keptHashes.get(k.id)!) > 22) continue;
      const j = jaccard(sh, keptShingles.get(k.id)!);
      if (j >= titleThreshold && j > sim) { dupOf = k.id; sim = j; }
    }
    if (dupOf) {
      collapse(art.id, dupOf, `Near-identical text (${Math.round(sim * 100)}% shingle overlap) — syndicated re-run`, Math.round(sim * 100) / 100);
      continue;
    }

    seenUrl.set(can, art.id);
    keptShingles.set(art.id, sh);
    keptHashes.set(art.id, hash);
    kept.push(art);
  }
  return { kept, removed, duplicateGroups };
}

// ---------------------------------------------------------------------------
// Original reporting
// ---------------------------------------------------------------------------

export type Originality = "original" | "rewrite" | "syndicated" | "unknown";

export interface OriginalityVerdict {
  id: string;
  originality: Originality;
  /** 0..100 — how much of this piece looks like first-hand work. */
  score: number;
  reasons: string[];
}

/** Markers of first-hand work in a headline or standfirst. */
const ORIGINAL_MARKERS: [RegExp, number, string][] = [
  [/\bexclusive\b/i, 18, "Labelled exclusive"],
  [/\binvestigation\b|\brevealed\b|\bobtained by\b|\bdocuments (?:seen|obtained)\b/i, 20, "Investigative framing"],
  [/\btold (?:this|our)\b|\bspoke to\b|\binterview(?:ed)?\b/i, 14, "First-hand interviews"],
  [/\bfrom our correspondent\b|\breporting from\b|\bon the ground\b/i, 16, "Own correspondent"],
  [/\banalysis\b|\bexplainer\b|\bcomment\b|\bopinion\b/i, -10, "Analysis or comment, not original reporting"],
];

/**
 * Grade every member of a cluster for how much original work it represents.
 *
 * The heuristic is unavoidably shallow — we see a headline and a URL, not a
 * newsroom — so the output is a graded signal with stated reasons, never a
 * verdict presented as fact. What it does reliably catch is the structural
 * case: one wire piece first, then N mastheads running near-identical text.
 */
export function originalityFor(members: ArticleLike[], duplicateGroups?: Map<string, string[]>): OriginalityVerdict[] {
  if (members.length === 0) return [];
  const sorted = [...members].sort((a, b) => {
    const pa = a.publishedAt ? Date.parse(a.publishedAt) : Number.POSITIVE_INFINITY;
    const pb = b.publishedAt ? Date.parse(b.publishedAt) : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
  const first = sorted[0];
  const firstShingles = shingles(first.title);
  const anyTimes = sorted.some((m) => m.publishedAt);

  return sorted.map((m, i) => {
    const reasons: string[] = [];
    let score = 45;

    if (i === 0 && anyTimes && members.length > 1) {
      score += 18;
      reasons.push("Earliest report in the cluster");
    }
    if (isWire(m.publisher)) {
      score += 10;
      reasons.push("Wire service — originates copy that others carry");
    }
    if (WIRE_CREDIT.test(m.title)) {
      score -= 30;
      reasons.push("Carries a wire credit line — running someone else's copy");
    }
    if (duplicateGroups?.has(m.id)) {
      score += 8;
      reasons.push(`${duplicateGroups.get(m.id)!.length} outlet(s) re-ran this text`);
    }
    // Primary/official domains are the source, not a report of it. Matched on
    // the hostname so "gov.uk" counts and "example.com/gov-review" does not.
    if (isOfficialHost(m.url)) {
      score += 20;
      reasons.push("Primary/official publication");
    }
    for (const [re, delta, why] of ORIGINAL_MARKERS) {
      if (re.test(m.title)) { score += delta; reasons.push(why); }
    }
    // Textual distance from the earliest piece: near-identical means carried,
    // clearly different wording means it was at least rewritten.
    if (i > 0) {
      const j = jaccard(shingles(m.title), firstShingles);
      if (j >= 0.6) { score -= 25; reasons.push(`Text ${Math.round(j * 100)}% identical to the earliest report`); }
      else if (j >= 0.3) { score -= 10; reasons.push("Substantially reworded version of the earliest report"); }
      else { score += 6; reasons.push("Independently worded account"); }
    }

    score = Math.max(0, Math.min(100, score));
    const originality: Originality =
      score >= 62 ? "original" : score >= 40 ? "rewrite" : members.length === 1 ? "unknown" : "syndicated";
    return { id: m.id, originality, score, reasons: reasons.slice(0, 4) };
  });
}

/**
 * How many *independent* accounts a cluster actually contains.
 *
 * This is the number that belongs next to a story, not the raw article count.
 */
export function independentSourceCount(members: ArticleLike[], duplicateGroups?: Map<string, string[]>): {
  articles: number;
  independent: number;
  syndicated: number;
  note: string;
} {
  const verdicts = originalityFor(members, duplicateGroups);
  const collapsed = [...(duplicateGroups?.values() ?? [])].reduce((n, g) => n + g.length, 0);
  const independent = verdicts.filter((v) => v.originality === "original" || v.originality === "rewrite").length;
  const syndicated = verdicts.length - independent;
  const articles = verdicts.length + collapsed;
  const note =
    articles <= 1
      ? "Single account — no corroboration yet."
      : independent <= 1
        ? `${articles} articles, but they trace to one account — treat as a single source.`
        : `${independent} independently worded accounts out of ${articles} articles.`;
  return { articles, independent, syndicated, note };
}
