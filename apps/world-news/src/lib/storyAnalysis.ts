// Pure helpers for story-level presentation and diffing ("what changed since yesterday").
// Kept separate from storyModel so they can be imported by both server and client
// and tested independently without LLM calls.

import type { CountryNews } from "./gemini";
import type { SourceAttribution, StoryCluster, NewsMeta } from "./storyModel";
import { buildSourceMix, inferSourceAttribution } from "./storyModel";

/** Build a readable SourceAttribution list from CountryNews sources (URL + title). */
export function attributionsFromCountry(
  country: Pick<CountryNews, "sources">,
): SourceAttribution[] {
  return (country.sources ?? []).map((s) => inferSourceAttribution(s.url, s.title));
}

/** Aggregate a country/world-level SourceMix from its attributions. */
export function sourceMixFromCountry(country: Pick<CountryNews, "sources">) {
  return buildSourceMix(attributionsFromCountry(country));
}

/** Simple diff between today's clusters and yesterday's (by story id/title). */
export interface StoryDiff {
  updated: { id: string; headline: string; change: string }[];
  newStories: StoryCluster[];
  dropped: { id: string; headline: string }[];
}

export function diffStoryClusters(
  today: StoryCluster[],
  yesterday: StoryCluster[] | null | undefined,
  whatChanged?: string | null,
): { whatChanged: string | null; diff: StoryDiff } {
  if (!yesterday || yesterday.length === 0) {
    return {
      whatChanged: whatChanged ?? null,
      diff: { updated: [], newStories: [], dropped: [] },
    };
  }
  const byId = new Map(yesterday.map((s) => [s.id, s]));
  const todayIds = new Set(today.map((s) => s.id));
  const dropped = yesterday
    .filter((s) => !todayIds.has(s.id))
    .map((s) => ({ id: s.id, headline: s.headline }));
  const newStories = today.filter((s) => !byId.has(s.id));
  // "Updated" is not inferrable without yesterday content comparison; leave
  // empty here — the LLM-provided whatChanged string is the authoritative signal.
  return { whatChanged: whatChanged ?? null, diff: { updated: [], newStories, dropped } };
}

/** Heuristic coverage gaps from the payload, for when the LLM omits them. */
export function coverageGapsHeuristic(country: CountryNews): string[] {
  if (Array.isArray(country.meta?.coverageGaps) && country.meta.coverageGaps.length > 0)
    return country.meta.coverageGaps;
  const gaps: string[] = [];
  const sources = (country.sources ?? []).length;
  if (sources > 0 && sources < 3) gaps.push("Few distinct sources — single-outlet risk.");
  const perspectives = new Set(
    attributionsFromCountry(country)
      .map((a) => a.perspective)
      .filter((p) => Boolean(p) && (p as string) !== "unknown"),
  );
  if (perspectives.size === 1 && sources >= 3) gaps.push("Sources lean to one political perspective.");
  if ((country.stories ?? []).length === 0) gaps.push("No story-level detail for this page yet.");
  const hasTimeline = (country.stories ?? []).some((s) => (s.timeline ?? []).length > 0);
  const hasConflicts = (country.stories ?? []).some((s) => (s.conflictingClaims ?? []).length > 0);
  if (!hasTimeline) gaps.push("Timeline not yet established for these stories.");
  if (!hasConflicts) gaps.push("No conflicting-claims comparison available yet.");
  return gaps.slice(0, 4);
}

/** Normalise a headline for change comparison (lowercase, trimmed, de-punctuated). */
export function normaliseHeadline(h: string): string {
  return h.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, " ");
}

/** Jaccard-like headline overlap between two days (0..1), for "how much turned over". */
export function headlineOverlap(a: CountryNews, b: CountryNews): number {
  const A = new Set((a.stories ?? []).map((s) => normaliseHeadline(s.headline)));
  const B = new Set((b.stories ?? []).map((s) => normaliseHeadline(s.headline)));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const h of Array.from(A)) if (B.has(h)) inter++;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}
