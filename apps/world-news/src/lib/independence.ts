// Why two sources are, or are not, independent — and which claims rest on one report.
//
// "Independent" is the word doing all the work in a corroboration count, and
// until now it was a boolean: `shareOwner(a, b)`. A boolean cannot be checked
// by a reader. If the interface says three independent sources agree, the
// reader's next question is *why* those three count as independent, and the
// honest answer has to name the thing that would make them dependent and say
// it is absent.
//
// So every verdict here carries its reason, and the reasons are drawn from
// facts a reader can verify: who owns the outlet (public record, from
// `sourceRegistry`), and which report each account derives from (reconstructed
// in `syndication`). Where we cannot establish ownership we say so and decline
// to call it independent, because "not known to be dependent" and "independent"
// are different claims and only one of them is true.
//
// Pure + deterministic. No network.

import type { ArticleLike } from "./clustering";
import type { SourceAttribution } from "./storyModel";
import { lookupSource, ownerOf } from "./sourceRegistry";
import {
  reconstructSyndication,
  wireOutlet,
  VIRTUAL_ORIGIN_PREFIX,
  type SyndicationGraph,
  type WireRef,
} from "./syndication";

// ---------------------------------------------------------------------------
// Pairwise independence
// ---------------------------------------------------------------------------

export type DependenceReason =
  /** Literally the same outlet. */
  | "same-outlet"
  /** Different mastheads, one owner. */
  | "same-owner"
  /** Both derive from the same original report. */
  | "same-origin"
  /** One of the two derives from the other. */
  | "derives-from"
  /** No shared owner and no shared origin found. */
  | "independent"
  /** At least one outlet's ownership is not recorded. */
  | "ownership-unknown";

export interface IndependenceVerdict {
  independent: boolean;
  reason: DependenceReason;
  /** One sentence, phrased so a reader could check it. */
  explanation: string;
}

/**
 * Explain whether two accounts corroborate each other.
 *
 * Order is deliberate: the strongest dependence wins. Two outlets can share an
 * owner *and* a wire origin, and naming the wire while omitting the common
 * owner would understate how related they are.
 *
 * `ownership-unknown` is not a failure to compute — it is the answer. An outlet
 * missing from the registry might be a genuinely separate newsroom or might be
 * a second masthead of one already counted, and the interface should say which
 * of those it does not know.
 */
export function explainIndependence(
  a: { publisher?: string; url: string },
  b: { publisher?: string; url: string },
  context?: { graph?: SyndicationGraph; idOf?: (s: { url: string }) => string },
): IndependenceVerdict {
  const nameA = a.publisher ?? a.url;
  const nameB = b.publisher ?? b.url;
  const recA = lookupSource(a.publisher ?? a.url);
  const recB = lookupSource(b.publisher ?? b.url);

  if (recA.domain === recB.domain) {
    return {
      independent: false,
      reason: "same-outlet",
      explanation: `${recA.name} and ${recB.name} are the same outlet — one account, not two.`,
    };
  }

  const unknownA = recA.owner.startsWith("unregistered:");
  const unknownB = recB.owner.startsWith("unregistered:");

  if (!unknownA && !unknownB && recA.owner === recB.owner) {
    return {
      independent: false,
      reason: "same-owner",
      explanation: `${recA.name} and ${recB.name} are both owned by ${recA.owner}, so they are not independent of each other.`,
    };
  }

  // Shared derivation, when a syndication graph is available.
  if (context?.graph) {
    const idOf = context.idOf ?? ((s: { url: string }) => s.url);
    const ia = idOf(a), ib = idOf(b);
    const oa = context.graph.originOf.get(ia);
    const ob = context.graph.originOf.get(ib);
    if (oa && ob && oa === ob) {
      if (oa === ia || oa === ib) {
        const carrier = oa === ia ? recB.name : recA.name;
        const origin = oa === ia ? recA.name : recB.name;
        return {
          independent: false,
          reason: "derives-from",
          explanation: `${carrier} is carrying ${origin}'s report, so the two are one account.`,
        };
      }
      const wireName = oa.startsWith(VIRTUAL_ORIGIN_PREFIX)
        ? (wireLabel(oa) ?? "the same wire")
        : "the same original report";
      return {
        independent: false,
        reason: "same-origin",
        explanation: `${recA.name} and ${recB.name} both trace to ${wireName}, so they corroborate nothing beyond it.`,
      };
    }
  }

  if (unknownA || unknownB) {
    const which = unknownA && unknownB ? `${nameA} and ${nameB} are` : `${unknownA ? nameA : nameB} is`;
    return {
      independent: false,
      reason: "ownership-unknown",
      explanation: `${which} not in the ownership registry, so they cannot be shown to be independent — this is unknown, not confirmed.`,
    };
  }

  const wireA = wireOutlet(a.publisher ?? a.url);
  const wireB = wireOutlet(b.publisher ?? b.url);
  const detail =
    wireA && wireB
      ? `${wireA.name} and ${wireB.name} are separate wire services that filed separately`
      : `${recA.name} is owned by ${recA.owner} and ${recB.name} by ${recB.owner}, and neither is carrying the other`;
  return {
    independent: true,
    reason: "independent",
    explanation: `${detail} — two accounts.`,
  };
}

function wireLabel(originId: string): string | null {
  const id = originId.slice(VIRTUAL_ORIGIN_PREFIX.length);
  const known: Record<string, string> = {
    reuters: "Reuters", ap: "the Associated Press", afp: "AFP", dpa: "dpa", efe: "EFE",
    ansa: "ANSA", pa: "PA Media", bloomberg: "Bloomberg", xinhua: "Xinhua", tass: "TASS",
    kyodo: "Kyodo News", yonhap: "Yonhap", pti: "the Press Trust of India", ians: "IANS",
    anadolu: "Anadolu Agency", interfax: "Interfax",
  };
  return known[id] ?? null;
}

// ---------------------------------------------------------------------------
// Independent sets
// ---------------------------------------------------------------------------

export interface IndependenceGroup {
  /** Stable key: owner, origin id, or outlet. */
  key: string;
  /** Outlets that are not independent of one another. */
  members: string[];
  /** Why these are one account. */
  reason: string;
}

export interface IndependenceReport {
  /** One entry per genuinely separate account. */
  groups: IndependenceGroup[];
  /** Number of independent accounts — the figure that belongs beside a claim. */
  independent: number;
  /** Outlets whose ownership is unrecorded, counted separately and never as independent. */
  unverifiable: string[];
  note: string;
}

/**
 * Partition a set of sources into genuinely separate accounts.
 *
 * The grouping key is chosen by the strongest dependence that applies, so two
 * mastheads under one owner collapse even when they also carry different wires,
 * and carriers of one wire collapse even when their owners differ.
 */
export function independenceReport(
  sources: { publisher?: string; url: string }[],
  context?: { graph?: SyndicationGraph; idOf?: (s: { url: string }) => string },
): IndependenceReport {
  const groups = new Map<string, IndependenceGroup>();
  const unverifiable: string[] = [];
  const idOf = context?.idOf ?? ((s: { url: string }) => s.url);

  for (const s of sources) {
    const rec = lookupSource(s.publisher ?? s.url);
    const unknown = rec.owner.startsWith("unregistered:");
    const origin = context?.graph?.originOf.get(idOf(s));
    const isCarrier = origin !== undefined && origin !== idOf(s);

    let key: string;
    let reason: string;
    if (isCarrier) {
      key = `origin:${origin}`;
      const wire = origin!.startsWith(VIRTUAL_ORIGIN_PREFIX) ? wireLabel(origin!) : null;
      reason = wire
        ? `All carrying ${wire}'s report — one account.`
        : "All deriving from the same original report — one account.";
    } else if (!unknown) {
      key = `owner:${rec.owner}`;
      reason = `Owned by ${rec.owner}.`;
    } else {
      key = `unknown:${rec.domain}`;
      reason = "Ownership not recorded — counted on its own and never as corroboration.";
      unverifiable.push(rec.name);
    }

    const g = groups.get(key);
    if (g) { if (!g.members.includes(rec.name)) g.members.push(rec.name); }
    else groups.set(key, { key, members: [rec.name], reason });
  }

  const list = [...groups.values()];
  // Unknown-ownership outlets are excluded from the independent count on
  // purpose: counting them would assert an independence we have not shown.
  const independent = list.filter((g) => !g.key.startsWith("unknown:")).length;
  const note =
    sources.length === 0
      ? "No sources."
      : independent === 0
        ? `${sources.length} source(s), none with recorded ownership — independence cannot be established.`
        : independent === 1
          ? `${sources.length} source(s), but they reduce to a single independent account.`
          : `${independent} independent accounts among ${sources.length} source(s).`;

  return { groups: list, independent, unverifiable, note };
}

// ---------------------------------------------------------------------------
// Claim-level shared origin
// ---------------------------------------------------------------------------

export interface ClaimOrigin {
  originId: string;
  wire?: WireRef;
  /** Whether the origin itself was seen, or inferred from credit lines. */
  inferred: boolean;
  /** Outlets whose citation of this claim traces here. */
  outlets: string[];
}

export interface ClaimOriginReport {
  claim: string;
  citations: number;
  origins: ClaimOrigin[];
  /** Distinct original reports behind the citations. */
  originCount: number;
  /**
   * True when the citation count materially overstates the evidence — the case
   * the interface must not present as corroboration.
   */
  overstated: boolean;
  note: string;
}

/** SourceAttribution → the shape the syndication reconstructor consumes. */
export function sourcesAsArticles(sources: SourceAttribution[]): ArticleLike[] {
  return sources.map((s) => ({
    id: s.url,
    title: s.title ?? "",
    url: s.url,
    publisher: s.publisher,
    countryCode: s.countryCode,
    publishedAt: s.publishedAt,
    tags: [],
  }));
}

/**
 * Trace a claim's citations back to the reports they came from.
 *
 * This is the answer to "six sources say this" when all six ran one wire story.
 * The citation count is kept — it is not wrong, and hiding it would look like
 * concealment — but it is reported alongside the origin count, which is the
 * number that should govern belief.
 */
export function originsForClaim(claim: string, supporters: SourceAttribution[]): ClaimOriginReport {
  const articles = sourcesAsArticles(supporters);
  const graph = reconstructSyndication(articles);
  const byOrigin = new Map<string, ClaimOrigin>();

  for (const a of articles) {
    const origin = graph.originOf.get(a.id) ?? a.id;
    const chain = graph.chains.find((c) => c.originId === origin);
    const name = lookupSource(a.publisher ?? a.url).name;
    const entry = byOrigin.get(origin);
    if (entry) {
      if (!entry.outlets.includes(name)) entry.outlets.push(name);
    } else {
      byOrigin.set(origin, {
        originId: origin,
        wire: chain?.wire,
        inferred: chain?.inferredOrigin ?? false,
        outlets: [name],
      });
    }
  }

  const origins = [...byOrigin.values()].sort((a, b) => b.outlets.length - a.outlets.length);
  const citations = supporters.length;
  const originCount = origins.length;
  const overstated = citations >= 2 && originCount < citations;

  const note =
    citations === 0
      ? "No source in this story explicitly supports this statement."
      : originCount === 1 && citations > 1
        ? origins[0].wire
          ? `${citations} outlets carry this, but all of them trace to ${origins[0].wire.name}. That is one report, not ${citations}.`
          : `${citations} outlets carry this, but all of them trace to a single original report.`
        : originCount === citations
          ? `${citations} independently originated report(s).`
          : `${citations} citations tracing to ${originCount} original reports.`;

  return { claim, citations, origins, originCount, overstated, note };
}

/**
 * Group a story's claims by the report they came from.
 *
 * Two claims sharing an origin is itself information: it means a single
 * newsroom's account is supplying several of the things the page presents as
 * separate facts, and a reader who discounts that source should discount all of
 * them together.
 */
export function claimsSharingOrigin(
  claims: { text: string; supporters: SourceAttribution[] }[],
): { originId: string; wire?: WireRef; claims: string[]; outlets: string[] }[] {
  const byOrigin = new Map<string, { originId: string; wire?: WireRef; claims: string[]; outlets: string[] }>();

  for (const c of claims) {
    const report = originsForClaim(c.text, c.supporters);
    for (const o of report.origins) {
      const entry = byOrigin.get(o.originId);
      if (entry) {
        if (!entry.claims.includes(c.text)) entry.claims.push(c.text);
        for (const outlet of o.outlets) if (!entry.outlets.includes(outlet)) entry.outlets.push(outlet);
      } else {
        byOrigin.set(o.originId, { originId: o.originId, wire: o.wire, claims: [c.text], outlets: [...o.outlets] });
      }
    }
  }

  return [...byOrigin.values()]
    .filter((g) => g.claims.length > 1)
    .sort((a, b) => b.claims.length - a.claims.length);
}

export const INDEPENDENCE_METHODOLOGY =
  "Two outlets count as independent when they have different recorded owners and neither is carrying " +
  "the other's report. Ownership comes from a registry of public-record filings; derivation is " +
  "reconstructed from wire credits, publication order and text overlap. Outlets whose ownership is not " +
  "recorded are never counted as independent — the interface reports them as unknown, because 'not known " +
  "to be dependent' is not the same claim as 'independent'.";

export { ownerOf };
