// Coverage-bias analysis.
//
// Every news product has a shape: which regions it covers, whose outlets it
// quotes, which topics it treats as important. That shape is inherited from the
// sources it can reach and the language it reads in, and it is invisible unless
// something measures it. This module measures it.
//
// The honest framing matters. "Under-covered" here means under-covered
// *relative to a stated baseline*, and the baseline is a choice, not a fact.
// Population says a story about 1.4bn people deserves proportionate attention;
// a reader in Lisbon reasonably disagrees. So the baseline is explicit,
// swappable, and always reported alongside the result — the output is
// "you are reading 71% Europe against a population baseline of 9%", never
// "your coverage is wrong".

import type { CountryNews } from "./gemini";
import type { SourceAttribution } from "./storyModel";
import { localSourcesFor, lookupSource, ownerOf, type Reach } from "./sourceRegistry";

export type Region =
  | "Europe" | "North America" | "Latin America" | "Middle East"
  | "Africa" | "South Asia" | "East Asia" | "Southeast Asia" | "Oceania" | "Unknown";

/** ISO2 → region. Coarse on purpose: finer buckets fragment small samples. */
const COUNTRY_REGION: Record<string, Region> = {
  GB: "Europe", IE: "Europe", FR: "Europe", DE: "Europe", ES: "Europe", IT: "Europe", PT: "Europe",
  NL: "Europe", BE: "Europe", CH: "Europe", AT: "Europe", SE: "Europe", NO: "Europe", DK: "Europe",
  FI: "Europe", PL: "Europe", CZ: "Europe", SK: "Europe", HU: "Europe", RO: "Europe", BG: "Europe",
  GR: "Europe", UA: "Europe", RU: "Europe", BY: "Europe", RS: "Europe", HR: "Europe", LT: "Europe",
  LV: "Europe", EE: "Europe", IS: "Europe", LU: "Europe", SI: "Europe", MD: "Europe",
  US: "North America", CA: "North America",
  MX: "Latin America", BR: "Latin America", AR: "Latin America", CL: "Latin America",
  CO: "Latin America", PE: "Latin America", VE: "Latin America", EC: "Latin America",
  BO: "Latin America", UY: "Latin America", PY: "Latin America", CU: "Latin America",
  GT: "Latin America", CR: "Latin America", PA: "Latin America", DO: "Latin America", HT: "Latin America",
  IL: "Middle East", PS: "Middle East", SA: "Middle East", AE: "Middle East", QA: "Middle East",
  KW: "Middle East", OM: "Middle East", BH: "Middle East", JO: "Middle East", LB: "Middle East",
  SY: "Middle East", IQ: "Middle East", IR: "Middle East", YE: "Middle East", TR: "Middle East",
  EG: "Africa", NG: "Africa", ZA: "Africa", KE: "Africa", ET: "Africa", GH: "Africa", TZ: "Africa",
  UG: "Africa", SD: "Africa", SS: "Africa", MA: "Africa", DZ: "Africa", TN: "Africa", LY: "Africa",
  SN: "Africa", CI: "Africa", CM: "Africa", CD: "Africa", ZW: "Africa", ZM: "Africa", MZ: "Africa",
  AO: "Africa", BF: "Africa", ML: "Africa", NE: "Africa", SO: "Africa", RW: "Africa", BW: "Africa",
  IN: "South Asia", PK: "South Asia", BD: "South Asia", LK: "South Asia", NP: "South Asia", AF: "South Asia",
  CN: "East Asia", JP: "East Asia", KR: "East Asia", KP: "East Asia", TW: "East Asia",
  HK: "East Asia", MN: "East Asia",
  ID: "Southeast Asia", PH: "Southeast Asia", TH: "Southeast Asia", VN: "Southeast Asia",
  MY: "Southeast Asia", SG: "Southeast Asia", MM: "Southeast Asia", KH: "Southeast Asia", LA: "Southeast Asia",
  AU: "Oceania", NZ: "Oceania", FJ: "Oceania", PG: "Oceania",
};

export function regionOf(countryCode?: string): Region {
  if (!countryCode) return "Unknown";
  return COUNTRY_REGION[countryCode.toUpperCase()] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// Baselines
// ---------------------------------------------------------------------------

export interface Baseline {
  id: string;
  label: string;
  /** What this baseline assumes, stated so a reader can disagree with it. */
  premise: string;
  shares: Partial<Record<Region, number>>;
}

/** Share of world population, rounded. Treats every person as equally newsworthy. */
export const POPULATION_BASELINE: Baseline = {
  id: "population",
  label: "World population",
  premise: "Assumes coverage should track where people live.",
  shares: {
    "East Asia": 0.20, "South Asia": 0.24, "Africa": 0.18, "Southeast Asia": 0.09,
    Europe: 0.09, "Latin America": 0.08, "Middle East": 0.06, "North America": 0.05, Oceania: 0.005,
  },
};

/** Share of world economic output, roughly. Tracks where decisions with global spillover are made. */
export const ECONOMIC_BASELINE: Baseline = {
  id: "economic",
  label: "Share of world output",
  premise: "Assumes coverage should track where globally consequential decisions are taken.",
  shares: {
    "North America": 0.28, Europe: 0.22, "East Asia": 0.26, "South Asia": 0.05,
    "Southeast Asia": 0.04, "Latin America": 0.06, "Middle East": 0.05, Africa: 0.03, Oceania: 0.02,
  },
};

export const BASELINES = [POPULATION_BASELINE, ECONOMIC_BASELINE];

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export interface RegionCoverage {
  region: Region;
  stories: number;
  share: number;
  baselineShare: number;
  /** actual / baseline. 1 is proportionate; 0.2 is heavily under-covered. */
  index: number;
  verdict: "over-covered" | "proportionate" | "under-covered" | "absent";
}

export interface TopicRegionCell { topic: string; region: Region; stories: number }

export interface CoverageBiasReport {
  baseline: Baseline;
  totalStories: number;
  byRegion: RegionCoverage[];
  /** Region × topic — shows whether a region only appears for conflict. */
  matrix: TopicRegionCell[];
  /** Regions covered only through a single topic lens. */
  monotopicRegions: { region: Region; topic: string; stories: number }[];
  sourceOrigin: {
    /** Share of sources based in the country the story is about. */
    localShare: number;
    /** Share of sources published in English. */
    englishShare: number;
    /** Share from state-controlled or state-funded outlets. */
    stateAffiliatedShare: number;
    /** Distinct ownership groups across all sources. */
    ownerCount: number;
    /** Sources per ownership group — above 2 means concentrated. */
    concentration: number;
  };
  /** Reader-facing lines. Each states the measurement and the baseline. */
  findings: string[];
}

function verdictFor(index: number, stories: number): RegionCoverage["verdict"] {
  if (stories === 0) return "absent";
  if (index >= 1.5) return "over-covered";
  if (index <= 0.5) return "under-covered";
  return "proportionate";
}

/**
 * Measure the coverage shape of a set of pages against a baseline.
 *
 * Region is taken from the story's own location where available, falling back
 * to the first source's country — a story with no location at all is counted
 * as Unknown rather than being quietly assigned somewhere, because silently
 * inventing a region is how a bias report ends up flattering itself.
 */
export function coverageBias(newsList: CountryNews[], baseline: Baseline = POPULATION_BASELINE): CoverageBiasReport {
  const regionCounts = new Map<Region, number>();
  const cellCounts = new Map<string, number>();
  let totalStories = 0;

  const allSources: { src: SourceAttribution; storyRegion: Region; storyCountry?: string }[] = [];

  for (const news of newsList) {
    for (const s of news.stories ?? []) {
      totalStories++;
      const cc = s.location?.countryCode ?? s.sources[0]?.countryCode;
      const region = regionOf(cc);
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      const key = `${s.topic}||${region}`;
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
      for (const src of s.sources) allSources.push({ src, storyRegion: region, storyCountry: cc });
    }
  }

  const regions = [...new Set([...regionCounts.keys(), ...(Object.keys(baseline.shares) as Region[])])];
  const byRegion: RegionCoverage[] = regions
    .map((region) => {
      const stories = regionCounts.get(region) ?? 0;
      const share = totalStories ? stories / totalStories : 0;
      const baselineShare = baseline.shares[region] ?? 0;
      const index = baselineShare > 0 ? share / baselineShare : share > 0 ? 99 : 0;
      return {
        region,
        stories,
        share: Math.round(share * 1000) / 1000,
        baselineShare,
        index: Math.round(index * 100) / 100,
        verdict: verdictFor(index, stories),
      };
    })
    .filter((r) => r.region !== "Unknown" || r.stories > 0)
    .sort((a, b) => b.share - a.share);

  const matrix: TopicRegionCell[] = [...cellCounts.entries()]
    .map(([key, stories]) => {
      const [topic, region] = key.split("||");
      return { topic, region: region as Region, stories };
    })
    .sort((a, b) => b.stories - a.stories);

  // A region that appears only under one topic is being covered through a
  // single lens — the classic "Africa exists in the conflict section" pattern.
  const monotopicRegions: CoverageBiasReport["monotopicRegions"] = [];
  for (const [region, count] of regionCounts) {
    if (region === "Unknown" || count < 2) continue;
    const cells = matrix.filter((c) => c.region === region);
    if (cells.length === 1) monotopicRegions.push({ region, topic: cells[0].topic, stories: count });
  }

  // --- Source origin -------------------------------------------------------
  const owners = new Set<string>();
  let local = 0, english = 0, stateAffiliated = 0;
  for (const { src, storyCountry } of allSources) {
    const rec = lookupSource(src.url);
    owners.add(ownerOf(src.url));
    if (storyCountry && rec.countryCode && rec.countryCode === storyCountry.toUpperCase()) local++;
    if (rec.language === "en" || rec.language === "") english++;
    if (rec.stateAffiliation === "state-controlled" || rec.stateAffiliation === "state-funded") stateAffiliated++;
  }
  const n = allSources.length || 1;
  const sourceOrigin = {
    localShare: Math.round((local / n) * 100) / 100,
    englishShare: Math.round((english / n) * 100) / 100,
    stateAffiliatedShare: Math.round((stateAffiliated / n) * 100) / 100,
    ownerCount: owners.size,
    concentration: Math.round((allSources.length / Math.max(1, owners.size)) * 100) / 100,
  };

  // --- Findings ------------------------------------------------------------
  const findings: string[] = [];
  const top = byRegion[0];
  if (top && top.stories > 0) {
    findings.push(
      `${Math.round(top.share * 100)}% of stories are ${top.region}, against a ${Math.round(top.baselineShare * 100)}% ${baseline.label.toLowerCase()} baseline.`,
    );
  }
  const missing = byRegion.filter((r) => r.verdict === "absent" && r.baselineShare >= 0.03);
  if (missing.length) {
    findings.push(`No coverage at all from ${missing.map((m) => m.region).join(", ")} in this view.`);
  }
  const under = byRegion.filter((r) => r.verdict === "under-covered" && r.stories > 0);
  if (under.length) {
    findings.push(`Under-represented against the baseline: ${under.map((u) => `${u.region} (${u.index}x)`).join(", ")}.`);
  }
  for (const m of monotopicRegions) {
    findings.push(`${m.region} appears only under ${m.topic} — single-lens coverage.`);
  }
  if (sourceOrigin.localShare < 0.25 && allSources.length >= 6) {
    findings.push(`Only ${Math.round(sourceOrigin.localShare * 100)}% of sources are based in the country they report on.`);
  }
  if (sourceOrigin.englishShare > 0.85 && allSources.length >= 6) {
    findings.push(`${Math.round(sourceOrigin.englishShare * 100)}% of sources publish in English — non-anglophone accounts are thin.`);
  }
  if (sourceOrigin.concentration > 2) {
    findings.push(`${allSources.length} sources trace to ${sourceOrigin.ownerCount} ownership groups — corroboration is more concentrated than the count suggests.`);
  }
  if (sourceOrigin.stateAffiliatedShare > 0.3 && allSources.length >= 6) {
    findings.push(`${Math.round(sourceOrigin.stateAffiliatedShare * 100)}% of sources are state-funded or state-controlled.`);
  }

  return { baseline, totalStories, byRegion, matrix, monotopicRegions, sourceOrigin, findings };
}

// ---------------------------------------------------------------------------
// Actionable gaps
// ---------------------------------------------------------------------------

export interface SourcingSuggestion {
  region: Region;
  countryCode: string;
  /** Registered outlets in that country that would close the gap. */
  outlets: { domain: string; name: string; reach: Reach; language: string }[];
  reason: string;
}

/**
 * Turn a bias report into something a pipeline can act on.
 *
 * A finding that says "Africa is under-covered" is only useful if it comes with
 * the outlets that would fix it, so this pairs each gap with registry entries,
 * preferring local and regional publishers over national ones.
 */
export function sourcingSuggestions(report: CoverageBiasReport, countryHints: string[] = []): SourcingSuggestion[] {
  const gaps = report.byRegion.filter((r) => (r.verdict === "under-covered" || r.verdict === "absent") && r.baselineShare > 0.02);
  const out: SourcingSuggestion[] = [];
  for (const gap of gaps) {
    const codes = countryHints.filter((c) => regionOf(c) === gap.region);
    const candidateCodes = codes.length
      ? codes
      : Object.entries(COUNTRY_REGION).filter(([, r]) => r === gap.region).map(([c]) => c);
    for (const cc of candidateCodes.slice(0, 3)) {
      const outlets = localSourcesFor(cc).filter((o) => o.reach !== "global").slice(0, 3);
      if (!outlets.length) continue;
      out.push({
        region: gap.region,
        countryCode: cc,
        outlets: outlets.map((o) => ({ domain: o.domain, name: o.name, reach: o.reach, language: o.language })),
        reason: gap.verdict === "absent"
          ? `${gap.region} has no coverage in this view`
          : `${gap.region} is at ${gap.index}x its ${report.baseline.label.toLowerCase()} baseline`,
      });
      if (out.length >= 6) return out;
    }
  }
  return out;
}
