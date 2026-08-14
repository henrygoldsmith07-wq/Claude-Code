// Source diversity, measured on independence rather than headcount.
//
// The previous version counted country codes and called the entropy of that
// "diversity". Two problems with it: five outlets owned by one group scored as
// five, and an outlet's *registered country* is not the same as being local to
// the story. Both flatter the number in the direction that makes the product
// look good, which is the direction a diversity metric must never lean.

import type { SourceAttribution, SourceMix } from "./storyModel";
import { lookupSource, localSourcesFor, ownerOf, type SourceRecord } from "./sourceRegistry";
import { regionOf, type Region } from "./coverageBias";

export interface DiversityReport {
  /** Shannon entropy over ownership groups, not outlets. */
  entropy: number;
  /** Independent ownership groups behind the sources. */
  independentGroups: number;
  totalSources: number;
  /** 0..1 — sources per group, inverted. 1 means every source is its own owner. */
  independenceRatio: number;
  nonEnglishShare: number;
  /** Share published in the country the story is about. */
  localShare: number;
  stateAffiliatedShare: number;
  topCountries: { code: string; share: number }[];
  byRegion: { region: Region; count: number }[];
  /** Concrete things missing, not adjectives. */
  gaps: string[];
  note: string;
}

function shannon(counts: number[]): number {
  const tot = counts.reduce((a, b) => a + b, 0);
  if (tot <= 1) return 0;
  let acc = 0;
  for (const c of counts) if (c > 0) { const p = c / tot; acc -= p * Math.log2(p); }
  return Math.round(acc * 100) / 100;
}

/**
 * Assess the diversity of a source list.
 *
 * `storyCountry` is what makes the local share meaningful: without it we can
 * only say where outlets are registered, not whether anyone reporting was
 * anywhere near the event.
 */
export function assessDiversity(sources: SourceAttribution[], storyCountry?: string): DiversityReport {
  const total = sources.length;
  if (total === 0) {
    return {
      entropy: 0, independentGroups: 0, totalSources: 0, independenceRatio: 0,
      nonEnglishShare: 0, localShare: 0, stateAffiliatedShare: 0, topCountries: [], byRegion: [],
      gaps: ["No sources attached to this story."], note: "No sources to assess.",
    };
  }

  const records: SourceRecord[] = sources.map((s) => lookupSource(s.url));
  const groupCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<Region, number>();
  let nonEnglish = 0, local = 0, stateAffiliated = 0, unregistered = 0;

  for (const rec of records) {
    const owner = ownerOf(rec.domain);
    groupCounts.set(owner, (groupCounts.get(owner) ?? 0) + 1);
    if (owner.startsWith("unregistered:")) unregistered++;
    if (rec.countryCode) {
      countryCounts.set(rec.countryCode, (countryCounts.get(rec.countryCode) ?? 0) + 1);
      const r = regionOf(rec.countryCode);
      regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
    }
    if (rec.language && rec.language !== "en") nonEnglish++;
    if (storyCountry && rec.countryCode === storyCountry.toUpperCase()) local++;
    if (rec.stateAffiliation === "state-controlled" || rec.stateAffiliation === "state-funded") stateAffiliated++;
  }

  const independentGroups = groupCounts.size;
  const independenceRatio = Math.round((independentGroups / total) * 100) / 100;
  const entropy = shannon([...groupCounts.values()]);

  const gaps: string[] = [];
  if (independentGroups < total) {
    const concentrated = [...groupCounts.entries()].filter(([, c]) => c > 1);
    for (const [owner, c] of concentrated.slice(0, 2)) {
      gaps.push(`${c} sources share one owner (${owner.replace(/^unregistered:/, "")}) — they cannot corroborate each other.`);
    }
  }
  if (unregistered > 0) {
    gaps.push(`${unregistered} source(s) have no ownership record — independence unverified.`);
  }
  if (storyCountry && local === 0) {
    const suggestions = localSourcesFor(storyCountry).slice(0, 2).map((r) => r.name);
    gaps.push(
      suggestions.length
        ? `No source based in ${storyCountry.toUpperCase()}. Registry has ${suggestions.join(", ")}.`
        : `No source based in ${storyCountry.toUpperCase()}, and none registered for that country.`,
    );
  }
  if (nonEnglish === 0 && total >= 3) {
    gaps.push("Every source publishes in English — non-anglophone accounts absent.");
  }
  if (stateAffiliated / total > 0.5) {
    gaps.push(`${stateAffiliated} of ${total} sources are state-funded or state-controlled.`);
  }

  const note =
    independentGroups === 1
      ? "All sources trace to one owner — this is a single account, however many links are listed."
      : independentGroups >= 4
        ? `${independentGroups} independent owners behind ${total} sources.`
        : `${independentGroups} independent owners behind ${total} sources — thin corroboration.`;

  return {
    entropy,
    independentGroups,
    totalSources: total,
    independenceRatio,
    nonEnglishShare: Math.round((nonEnglish / total) * 100) / 100,
    localShare: Math.round((local / total) * 100) / 100,
    stateAffiliatedShare: Math.round((stateAffiliated / total) * 100) / 100,
    topCountries: [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([code, count]) => ({ code, share: Math.round((count / total) * 100) / 100 })),
    byRegion: [...regionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([region, count]) => ({ region, count })),
    gaps: gaps.slice(0, 4),
    note,
  };
}

/**
 * Back-compatible entry point for callers holding only a SourceMix.
 *
 * A SourceMix has already discarded the URLs, so ownership cannot be recovered
 * from it — this reports what is still knowable and says so, rather than
 * silently returning a worse number under the same name.
 */
export function diversityReport(mix: SourceMix): Pick<DiversityReport, "entropy" | "nonEnglishShare" | "topCountries" | "note"> & { undercovered: string[] } {
  const map = new Map<string, number>();
  for (const c of mix.byCountry) map.set(c.code, c.count);
  const total = mix.total || 1;
  const NON_ENGLISH_MARKETS = new Set(["FR", "DE", "ES", "IT", "JP", "CN", "RU", "TR", "KR", "PT", "PL", "NL", "BR", "MX", "EG", "TH", "VN", "ID", "UA", "GR", "SE", "DK", "FI"]);
  const nonEn = [...map.entries()].filter(([k]) => NON_ENGLISH_MARKETS.has(k)).reduce((n, [, c]) => n + c, 0);
  return {
    entropy: shannon([...map.values()]),
    nonEnglishShare: Math.round((nonEn / total) * 100) / 100,
    topCountries: [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([code, count]) => ({ code, share: Math.round((count / total) * 100) / 100 })),
    undercovered: [...map.entries()].filter(([, c]) => c === 1).map(([k]) => k).slice(0, 6),
    note: "Country spread only — ownership independence needs source URLs; use assessDiversity for that.",
  };
}

/**
 * Local and regional outlets that would deepen coverage of a country.
 *
 * Replaces a four-entry hint table with the registry, so the suggestion is a
 * real outlet the pipeline can go and fetch rather than editorial advice.
 */
export function localSourcingSuggestions(countryCode: string): { outlets: SourceRecord[]; note: string } {
  const outlets = localSourcesFor(countryCode);
  const nearby = outlets.filter((o) => o.reach === "local" || o.reach === "regional");
  const chosen = nearby.length ? nearby : outlets;
  return {
    outlets: chosen.slice(0, 5),
    note: chosen.length
      ? `${chosen.length} registered outlet(s) based in ${countryCode.toUpperCase()}${nearby.length ? ", local or regional" : ""}.`
      : `No outlets registered for ${countryCode.toUpperCase()} — coverage of this country depends on foreign desks.`,
  };
}
