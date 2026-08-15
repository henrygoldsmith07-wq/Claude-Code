// Syndication chains: which report is the original, and who is carrying it.
//
// `dedup.ts` answers "are these the same text?" and collapses re-runs. That is
// necessary but not sufficient, because it produces a flat set of duplicate
// groups with no direction. The question a reader actually has is directional:
//
//   "Eight outlets report this. Is that eight newsrooms, or one wire?"
//
// This module reconstructs the derivation graph — origin, carriers, and the
// edges between them — so downstream code can count *origins* rather than
// articles. It is the difference between "8 sources corroborate" and "1 source,
// carried by 8", which are opposite claims about how much you should believe.
//
// The load-bearing idea is the **virtual origin**. When six outlets all print
// "(Reuters)" but Reuters' own copy is not in our corpus, those six still share
// one origin. Rooting them at a virtual Reuters node keeps the corroboration
// count honest even though we never saw the original. Without it, six carriers
// of one wire report look like six independent accounts — the exact error this
// whole product exists to avoid.
//
// Pure + deterministic. No network.

import type { ArticleLike } from "./clustering";
import { isWire, isOfficialHost, titleSimilarity } from "./dedup";
import { extractEntities } from "./entities";

// ---------------------------------------------------------------------------
// Wire services
// ---------------------------------------------------------------------------

export type WireId =
  | "reuters" | "ap" | "afp" | "dpa" | "efe" | "ansa" | "pa" | "bloomberg"
  | "xinhua" | "tass" | "kyodo" | "yonhap" | "pti" | "ians" | "anadolu" | "interfax";

export interface WireRef {
  id: WireId;
  name: string;
  domain: string;
}

/**
 * `alias` matches the wire's name inside a credit line.
 *
 * Case is written explicitly rather than handled with an `i` flag, because the
 * initialisms cannot tolerate case folding: `/\bAP\b/i` also matches the
 * Spanish preposition "ap" and any number of ordinary words, which would credit
 * a wire that had nothing to do with the story. Spelled-out names accept either
 * case; initialisms accept upper only.
 */
const WIRES: (WireRef & { alias: string; host: RegExp })[] = [
  { id: "reuters", name: "Reuters", domain: "reuters.com", alias: "[Rr]euters", host: /(^|\.)reuters\.com$/i },
  { id: "ap", name: "Associated Press", domain: "apnews.com", alias: "[Aa]ssociated [Pp]ress|\\bAP\\b", host: /(^|\.)apnews\.com$/i },
  { id: "afp", name: "Agence France-Presse", domain: "afp.com", alias: "[Aa]gence [Ff]rance[- ][Pp]resse|\\bAFP\\b", host: /(^|\.)afp\.com$/i },
  { id: "dpa", name: "Deutsche Presse-Agentur", domain: "dpa.com", alias: "[Dd]eutsche [Pp]resse-[Aa]gentur|\\bdpa\\b|\\bDPA\\b", host: /(^|\.)dpa\.com$/i },
  { id: "efe", name: "EFE", domain: "efe.com", alias: "\\bEFE\\b", host: /(^|\.)efe\.com$/i },
  { id: "ansa", name: "ANSA", domain: "ansa.it", alias: "\\bANSA\\b", host: /(^|\.)ansa\.it$/i },
  { id: "pa", name: "PA Media", domain: "pamediagroup.com", alias: "\\bPA Media\\b|[Pp]ress [Aa]ssociation", host: /(^|\.)pamediagroup\.com$/i },
  { id: "bloomberg", name: "Bloomberg", domain: "bloomberg.com", alias: "[Bb]loomberg", host: /(^|\.)bloomberg\.com$/i },
  { id: "xinhua", name: "Xinhua", domain: "xinhuanet.com", alias: "[Xx]inhua", host: /(^|\.)xinhuanet\.com$/i },
  { id: "tass", name: "TASS", domain: "tass.com", alias: "\\bTASS\\b", host: /(^|\.)tass\.(com|ru)$/i },
  { id: "kyodo", name: "Kyodo News", domain: "kyodonews.net", alias: "[Kk]yodo", host: /(^|\.)kyodonews\.net$/i },
  { id: "yonhap", name: "Yonhap", domain: "yna.co.kr", alias: "[Yy]onhap", host: /(^|\.)yna\.co\.kr$/i },
  { id: "pti", name: "Press Trust of India", domain: "pti.in", alias: "[Pp]ress [Tt]rust of [Ii]ndia|\\bPTI\\b", host: /(^|\.)pti\.in$/i },
  { id: "ians", name: "IANS", domain: "ians.in", alias: "\\bIANS\\b", host: /(^|\.)ians\.in$/i },
  { id: "anadolu", name: "Anadolu Agency", domain: "aa.com.tr", alias: "[Aa]nadolu", host: /(^|\.)aa\.com\.tr$/i },
  { id: "interfax", name: "Interfax", domain: "interfax.com", alias: "[Ii]nterfax", host: /(^|\.)interfax\.(com|ru)$/i },
];

/**
 * Credit positions. A wire name only counts as a credit when it appears where
 * newsrooms actually put one — parenthesised, delimited at either end, or after
 * an explicit sourcing preposition. A bare mention is not a credit: "Thomson
 * Reuters posts quarterly profit" is a story *about* Reuters, not from it.
 */
const CREDIT_SHAPES: ((alias: string) => RegExp)[] = [
  (a) => new RegExp(`\\(\\s*(?:${a})\\s*\\)`),                        // "... (Reuters)"
  (a) => new RegExp(`^\\s*(?:${a})\\s*[-–—:|/]`),                     // "Reuters — ..."
  (a) => new RegExp(`[-–—|/]\\s*(?:${a})\\s*$`),                      // "... / Reuters"
  (a) => new RegExp(`\\b[Vv]ia\\s+(?:${a})\\b`),                      // "... via AFP"
  (a) => new RegExp(`\\b[Ss]ources?\\s*:\\s*(?:${a})\\b`),            // "Source: AP"
  (a) => new RegExp(`\\b(?:[Aa]dditional\\s+)?[Rr]eporting\\s+by\\s+(?:${a})\\b`),
  (a) => new RegExp(`\\b(?:${a})\\s+(?:reported|reports|said|has\\s+reported)\\b`),
  (a) => new RegExp(`\\b[Ww]ith\\s+(?:${a})\\b`),                     // "... with Reuters"
];

/** Which wire a piece of text credits, if any. */
export function wireCreditIn(text: string): WireRef | null {
  for (const w of WIRES) {
    for (const shape of CREDIT_SHAPES) {
      if (shape(w.alias).test(text)) return { id: w.id, name: w.name, domain: w.domain };
    }
  }
  return null;
}

/** The wire an outlet *is*, when the publisher is itself a wire service. */
export function wireOutlet(publisherOrUrl?: string): WireRef | null {
  if (!publisherOrUrl) return null;
  let host = publisherOrUrl.toLowerCase();
  if (host.includes("://")) {
    try { host = new URL(host).hostname; } catch { /* fall through to raw */ }
  }
  host = host.replace(/^(www|amp|m|mobile)\./, "");
  for (const w of WIRES) {
    if (w.host.test(host)) return { id: w.id, name: w.name, domain: w.domain };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Chain model
// ---------------------------------------------------------------------------

export type Relation =
  /** Root of a chain — nothing in this set derives it from anywhere else. */
  | "origin"
  /** Near-identical text to its parent: the same copy under another masthead. */
  | "verbatim"
  /** Derived but substantially reworded. */
  | "rewrite"
  /** Names a wire in a credit line; rooted at that wire. */
  | "credited"
  /** No derivation found — its own account. */
  | "independent";

export interface ChainMember {
  id: string;
  publisher?: string;
  relation: Relation;
  /** The article (or virtual wire node) this one derives from. */
  parentId: string | null;
  /** Text similarity to the parent, 0..1. Zero when the link is not textual. */
  similarity: number;
  reasons: string[];
}

/** Virtual origins are prefixed so they can never collide with an article id. */
export const VIRTUAL_ORIGIN_PREFIX = "wire:";

export interface SyndicationChain {
  /** Article id, or `wire:<id>` when the origin was never seen. */
  originId: string;
  /** Set when this chain is rooted at a wire. */
  wire?: WireRef;
  /** True when the origin is a virtual node — the wire's own copy is not in the corpus. */
  inferredOrigin: boolean;
  members: ChainMember[];
  /** Distinct publishers carrying this origin, excluding the origin itself. */
  carriers: number;
}

export interface SyndicationGraph {
  chains: SyndicationChain[];
  /** article id → origin id of its chain. */
  originOf: Map<string, string>;
  /** How many genuinely distinct origins the set contains. */
  origins: number;
  /** Articles whose origin is themselves and which carry no wire credit. */
  independent: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Reconstruction
// ---------------------------------------------------------------------------

/** Similarity at or above this is the same copy, not an independent account. */
const VERBATIM = 0.62;
/**
 * Floor for treating overlap as derivation at all.
 *
 * Between REWRITE and VERBATIM, headline similarity on its own does not
 * separate the cases, and this is worth stating precisely because it is
 * tempting to fix with a threshold. Measured on real pairs:
 *
 *   0.34  "Parliament approves the budget after long debate"
 *      vs "Parliament approves budget following lengthy debate"   → same report
 *   0.55  "El gobierno anuncia una reforma fiscal amplia"
 *      vs "El gobierno anuncia una reforma tributaria"            → different reports
 *
 * The pair we want linked scores *lower* than the pair we want kept apart, so
 * no cutoff orders them correctly. In this band a link therefore requires a
 * structural signal as well — a wire or official parent, or shared entities
 * close together in time — and similarity alone is never enough.
 */
const REWRITE = 0.3;

/** Mid-band links need the two pieces to be this close in time. */
const MID_BAND_WINDOW_HOURS = 72;

function publishedMs(a: ArticleLike): number {
  return a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
}

/**
 * Reconstruct who derived what from whom.
 *
 * Parent selection is constrained by time: a report cannot derive from one
 * published after it. Where timestamps are missing the edge is only drawn if
 * the text is near-identical, because without an ordering we cannot tell which
 * way a rewrite ran, and guessing would invent a direction the data does not
 * support.
 *
 * An explicit wire credit outranks textual similarity. A masthead that says
 * "(Reuters)" is telling us its origin directly; inferring a different parent
 * because the wording happens to be closer to another carrier would be
 * substituting a guess for a statement.
 */
export function reconstructSyndication(articles: ArticleLike[]): SyndicationGraph {
  if (articles.length === 0) {
    return { chains: [], originOf: new Map(), origins: 0, independent: 0, note: "No articles." };
  }

  // Earliest first; a wire wins ties because it is the more likely origin.
  const ordered = [...articles].sort((a, b) => {
    const pa = publishedMs(a), pb = publishedMs(b);
    const va = Number.isNaN(pa), vb = Number.isNaN(pb);
    if (va !== vb) return va ? 1 : -1;         // undated last
    if (!va && pa !== pb) return pa - pb;
    const wa = isWire(a.publisher) ? 0 : 1, wb = isWire(b.publisher) ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return a.id.localeCompare(b.id);
  });

  const members = new Map<string, ChainMember>();
  const virtualWires = new Map<string, WireRef>();
  /** Wire id → the in-corpus article that is that wire's own copy, if present. */
  const wireOwnCopy = new Map<WireId, string>();

  for (const a of ordered) {
    const own = wireOutlet(a.publisher) ?? wireOutlet(a.url);
    if (own && !wireOwnCopy.has(own.id)) wireOwnCopy.set(own.id, a.id);
  }

  for (let i = 0; i < ordered.length; i++) {
    const art = ordered[i];
    const reasons: string[] = [];
    const ownWire = wireOutlet(art.publisher) ?? wireOutlet(art.url);

    // 1. An explicit credit line is a statement of origin — take it.
    const credited = wireCreditIn(art.title);
    if (credited && (!ownWire || ownWire.id !== credited.id)) {
      const seen = wireOwnCopy.get(credited.id);
      // Only root at the wire's own copy if that copy is not later than this one.
      const seenArt = seen ? ordered.find((o) => o.id === seen) : undefined;
      const usable =
        seenArt && seenArt.id !== art.id &&
        (Number.isNaN(publishedMs(seenArt)) || Number.isNaN(publishedMs(art)) || publishedMs(seenArt) <= publishedMs(art));

      const parentId = usable ? seenArt!.id : `${VIRTUAL_ORIGIN_PREFIX}${credited.id}`;
      if (!usable) virtualWires.set(parentId, credited);
      reasons.push(
        usable
          ? `Credits ${credited.name}, whose report is in this set`
          : `Credits ${credited.name} — the wire's own copy is not in this set, so the chain is rooted at the wire`,
      );
      members.set(art.id, {
        id: art.id,
        publisher: art.publisher,
        relation: "credited",
        parentId,
        similarity: usable ? titleSimilarity(art.title, seenArt!.title) : 0,
        reasons,
      });
      continue;
    }

    // 2. Otherwise look for the earlier article this one most resembles.
    let bestId: string | null = null;
    let best = 0;
    let bestSignal: string | null = null;
    const artEntities = new Set(extractEntities(art.title).ids);

    for (let j = 0; j < i; j++) {
      const prev = ordered[j];
      const sim = titleSimilarity(art.title, prev.title);
      if (sim <= best || sim < REWRITE) continue;

      const bothDated = !Number.isNaN(publishedMs(art)) && !Number.isNaN(publishedMs(prev));

      if (sim >= VERBATIM) {
        // Near-identical text is self-evidently the same copy; no extra signal
        // is needed, and undated pairs are still safe to link.
        best = sim; bestId = prev.id; bestSignal = null;
        continue;
      }

      // Mid band: similarity is not evidence on its own (see REWRITE above).
      if (!bothDated) continue; // no ordering, no direction, no link
      const prevWire = wireOutlet(prev.publisher) ?? wireOutlet(prev.url);
      if (prevWire) {
        best = sim; bestId = prev.id; bestSignal = `${prevWire.name} is a wire — its copy is what others rework`;
        continue;
      }
      if (isOfficialHost(prev.url)) {
        best = sim; bestId = prev.id; bestSignal = "Derived from a primary/official publication";
        continue;
      }
      const prevEntities = new Set(extractEntities(prev.title).ids);
      const shared = [...artEntities].filter((e) => prevEntities.has(e));
      const gapHours = Math.abs(publishedMs(art) - publishedMs(prev)) / 3_600_000;
      if (shared.length >= 1 && gapHours <= MID_BAND_WINDOW_HOURS) {
        best = sim; bestId = prev.id;
        bestSignal = `Shares ${shared.length} named actor(s) with a report ${Math.round(gapHours)}h earlier`;
      }
    }

    if (bestId) {
      const verbatim = best >= VERBATIM;
      reasons.push(
        verbatim
          ? `Text ${Math.round(best * 100)}% identical to an earlier report — carried, not independently written`
          : `Text ${Math.round(best * 100)}% overlapping with an earlier report — reworded from it`,
      );
      if (bestSignal) reasons.push(bestSignal);
      if (ownWire) reasons.push(`${ownWire.name} is itself a wire, but this copy follows an earlier report here`);
      members.set(art.id, {
        id: art.id,
        publisher: art.publisher,
        relation: verbatim ? "verbatim" : "rewrite",
        parentId: bestId,
        similarity: Math.round(best * 100) / 100,
        reasons,
      });
      continue;
    }

    // 3. Nothing derives it. Say why it counts as its own account.
    if (ownWire) reasons.push(`${ownWire.name} wire copy — originates reporting that others carry`);
    else if (isOfficialHost(art.url)) reasons.push("Primary or official publication — the source, not a report of it");
    else if (i === 0 && ordered.length > 1) reasons.push("Earliest report in this set");
    else reasons.push("No earlier report in this set that it derives from");

    members.set(art.id, {
      id: art.id,
      publisher: art.publisher,
      relation: i === 0 || ownWire || isOfficialHost(art.url) ? "origin" : "independent",
      parentId: null,
      similarity: 0,
      reasons,
    });
  }

  // ---- Resolve every member to its root ------------------------------------
  const originOf = new Map<string, string>();
  const rootOf = (id: string): string => {
    const seen = new Set<string>();
    let cur = id;
    for (;;) {
      if (seen.has(cur)) return cur; // defensive: cycles cannot occur, but never hang
      seen.add(cur);
      const m = members.get(cur);
      if (!m || m.parentId === null) return cur;
      cur = m.parentId;
    }
  };
  for (const id of members.keys()) originOf.set(id, rootOf(id));

  // ---- Group into chains ---------------------------------------------------
  const byOrigin = new Map<string, ChainMember[]>();
  for (const [id, origin] of originOf) {
    const g = byOrigin.get(origin);
    if (g) g.push(members.get(id)!);
    else byOrigin.set(origin, [members.get(id)!]);
  }

  const chains: SyndicationChain[] = [...byOrigin.entries()].map(([originId, mem]) => {
    const virtual = virtualWires.get(originId);
    const originArticle = articles.find((a) => a.id === originId);
    const wire =
      virtual ??
      (originArticle ? (wireOutlet(originArticle.publisher) ?? wireOutlet(originArticle.url) ?? undefined) : undefined);
    const carrierPublishers = new Set(
      mem.filter((m) => m.id !== originId).map((m) => m.publisher ?? m.id),
    );
    return {
      originId,
      wire: wire ?? undefined,
      inferredOrigin: Boolean(virtual),
      members: mem.sort((a, b) => a.id.localeCompare(b.id)),
      carriers: carrierPublishers.size,
    };
  }).sort((a, b) => b.members.length - a.members.length || a.originId.localeCompare(b.originId));

  const origins = chains.length;
  const independent = chains.filter((c) => c.members.length === 1 && !c.wire).length;
  const total = articles.length;

  const note =
    origins === total
      ? `${total} articles, ${origins} distinct origins — no syndication detected.`
      : origins === 1
        ? `${total} articles, all tracing to one origin${chains[0].wire ? ` (${chains[0].wire.name})` : ""} — treat as a single account.`
        : `${total} articles tracing to ${origins} distinct origins.`;

  return { chains, originOf, origins, independent, note };
}

// ---------------------------------------------------------------------------
// Reader-facing summary
// ---------------------------------------------------------------------------

export interface SyndicationSummary {
  articles: number;
  origins: number;
  /** Chains with at least one carrier — i.e. genuinely syndicated reports. */
  syndicatedChains: { wire?: string; origin: string; carriers: number; inferred: boolean }[];
  /** The sentence to put next to a source count. */
  headline: string;
}

/**
 * The one line that belongs beside "12 sources".
 *
 * Deliberately states the origin count first: it is the number that should
 * drive how much weight a reader gives the story, and putting the article
 * count first is what makes aggregators look more corroborated than they are.
 */
export function summariseSyndication(articles: ArticleLike[]): SyndicationSummary {
  const graph = reconstructSyndication(articles);
  const syndicatedChains = graph.chains
    .filter((c) => c.carriers > 0)
    .map((c) => ({
      wire: c.wire?.name,
      origin: c.originId,
      carriers: c.carriers,
      inferred: c.inferredOrigin,
    }));

  const headline =
    graph.origins === 0
      ? "No sources."
      : graph.origins === 1
        ? `1 original report, carried by ${articles.length - 1} other outlet(s).`
        : `${graph.origins} original reports across ${articles.length} articles.`;

  return { articles: articles.length, origins: graph.origins, syndicatedChains, headline };
}

export const SYNDICATION_METHODOLOGY =
  "Origins are reconstructed from wire credit lines, publication order and text overlap. A credit line " +
  "is taken at its word: when six outlets credit Reuters and Reuters' own copy is not in the set, all " +
  "six are rooted at Reuters rather than counted as six accounts. Text overlap alone is only treated as " +
  "derivation when the later piece can be ordered after the earlier one, because without an ordering the " +
  "direction of a rewrite cannot be known. This under-reports syndication rather than over-reporting " +
  "independence: an unlinked carrier inflates the origin count, which is the safer error.";
