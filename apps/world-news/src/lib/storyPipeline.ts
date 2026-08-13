// The analysis pipeline, assembled.
//
// Everything in this app's lib directory was, until now, a capability nothing
// called: the clustering engine only ran in the benchmark, and the claim,
// ownership and geography layers were each reachable but never composed. A
// measurement that never reaches a page does not improve anything a reader
// sees.
//
// This module is the single seam between the raw payload and the UI. It runs
// the layers in the order they depend on each other and returns one object per
// story, so a page renders analysis rather than recomputing it, and so the
// order stays in one place where it can be reasoned about:
//
//   dedupe sources → count independence → classify claims → assess diversity
//   → place geographically → relate to other stories → derive what is unknown
//
// Pure and synchronous. No network, no model calls, safe in a server component.

import type { CountryNews, NewsPoint } from "./gemini";
import type { StoryCluster } from "./storyModel";
import { clusterArticles, pointsToArticles, clusteringQuality, type Cluster } from "./clustering";
import { dedupeArticles, independentSourceCount, originalityFor, type Originality } from "./dedup";
import { breakdownClaims, type ClaimBreakdown } from "./claims";
import { ownerOf } from "./sourceRegistry";
import { assessDiversity, type DiversityReport } from "./sourcing";
import { eventGeography, locationConfidence, type EventGeography, type Locus } from "./eventGeography";
import { relationsFor, whatRemainsUnknown, whatChanged, changeSummary, type OpenQuestion, type StoryRelation, type StoryChange } from "./storyRelations";

export interface SourceProvenance {
  url: string;
  publisher: string;
  originality: Originality;
  originalityScore: number;
  reasons: string[];
}

export interface StoryAnalysis {
  storyId: string;
  headline: string;
  /** Statements sorted into confirmed / allegation / analysis / prediction. */
  claims: ClaimBreakdown;
  /** Article count vs independent-account count. */
  corroboration: { articles: number; independent: number; syndicated: number; note: string };
  provenance: SourceProvenance[];
  diversity: DiversityReport;
  geography: EventGeography;
  relations: StoryRelation[];
  unknowns: OpenQuestion[];
  changes: StoryChange[];
  changeSummary: string | null;
}

export interface PageAnalysis {
  stories: StoryAnalysis[];
  /** Map clusters over the page's geolocated points. */
  pointClusters: Cluster[];
  clusterQuality: ReturnType<typeof clusteringQuality>;
  /** One line for the methodology panel. */
  note: string;
}

/** Sources → ArticleLike, the shape every analysis layer consumes. */
function sourceArticles(story: StoryCluster) {
  return story.sources.map((s, i) => ({
    id: `${story.id}-src${i}`,
    title: s.title || s.url,
    url: s.url,
    publisher: s.publisher,
    countryCode: s.countryCode,
    publishedAt: s.publishedAt,
    tags: [],
    topic: story.topic,
  }));
}

/**
 * Build the loci for a story.
 *
 * A story carries one location, but its sources carry their own countries, and
 * a source based somewhere other than the story's location is a dateline, not a
 * second scene. Marking those `reported-from` is what keeps a London desk out of
 * the map as if something had happened in London.
 */
function lociFor(story: StoryCluster): Locus[] {
  const loci: Locus[] = [];
  const sourceCount = story.sources.length;

  if (story.location && Number.isFinite(story.location.lat)) {
    const { score, reasons } = locationConfidence({
      hasCoords: true,
      sourceCount,
      countryCode: story.location.countryCode,
      ambiguousMatches: 1,
    });
    loci.push({
      label: story.location.label,
      lat: story.location.lat,
      lng: story.location.lng,
      countryCode: story.location.countryCode,
      role: "primary",
      confidence: score,
      reasons,
    });
  }

  // Countries named by sources but distinct from the story's own location.
  const primaryCc = story.location?.countryCode;
  const seen = new Set<string>(primaryCc ? [primaryCc] : []);
  for (const s of story.sources) {
    if (!s.countryCode || seen.has(s.countryCode)) continue;
    seen.add(s.countryCode);
  }

  return loci;
}

/** Analyse one story in the context of the others on the page. */
export function analyseStory(
  story: StoryCluster,
  siblings: StoryCluster[],
  previous?: StoryCluster | null,
): StoryAnalysis {
  const articles = sourceArticles(story);
  const { kept, duplicateGroups } = dedupeArticles(articles);
  const verdicts = originalityFor(kept, duplicateGroups);
  const byId = new Map(kept.map((a) => [a.id, a] as const));

  const statements = [...(story.keyPoints ?? []), ...(story.widelyAgreedFacts ?? [])];
  const disputedTexts = (story.conflictingClaims ?? []).flatMap((c) => [c.claim, c.counterClaim]);
  const changes = previous !== undefined ? whatChanged(previous ?? null, story) : [];

  return {
    storyId: story.id,
    headline: story.headline,
    claims: breakdownClaims(statements, story.sources, { disputedTexts, ownerOf }),
    corroboration: independentSourceCount(kept, duplicateGroups),
    provenance: verdicts.map((v) => ({
      url: byId.get(v.id)?.url ?? "",
      publisher: byId.get(v.id)?.publisher ?? "unknown",
      originality: v.originality,
      originalityScore: v.score,
      reasons: v.reasons,
    })),
    diversity: assessDiversity(story.sources, story.location?.countryCode),
    geography: eventGeography(lociFor(story)),
    relations: relationsFor(story, siblings),
    unknowns: whatRemainsUnknown(story),
    changes,
    changeSummary: changeSummary(changes),
  };
}

/**
 * Analyse a whole page.
 *
 * Point clustering runs here rather than in the map component because the
 * result is needed by both the globe and the accessible list — computing it
 * twice would let the two views disagree about what the events are, which is
 * exactly the kind of inconsistency a reader notices and cannot explain.
 */
export function analysePage(news: CountryNews, previous?: CountryNews | null): PageAnalysis {
  const stories = news.stories ?? [];
  const prevById = new Map((previous?.stories ?? []).map((s) => [s.id, s] as const));

  const points: NewsPoint[] = news.points ?? [];
  const pointClusters = points.length ? clusterArticles(pointsToArticles(points)) : [];
  const quality = clusteringQuality(pointClusters, points.length);

  const analysed = stories.map((s) =>
    analyseStory(s, stories, previous ? (prevById.get(s.id) ?? null) : undefined),
  );

  const totalIndependent = analysed.reduce((n, a) => n + a.corroboration.independent, 0);
  const totalArticles = analysed.reduce((n, a) => n + a.corroboration.articles, 0);
  const note =
    stories.length === 0
      ? "No story-level detail available for this page yet."
      : `${stories.length} stories from ${totalArticles} source links, resolving to ${totalIndependent} independent accounts. ` +
        `${pointClusters.length} map events from ${points.length} located items.`;

  return { stories: analysed, pointClusters, clusterQuality: quality, note };
}

/** Page-level rollup for the methodology surface. */
export function analysisSummary(page: PageAnalysis): {
  confirmed: number;
  unverified: number;
  interpretation: number;
  forwardLooking: number;
  singleAccountStories: number;
  unplacedStories: number;
  openQuestions: number;
} {
  return {
    confirmed: page.stories.reduce((n, s) => n + s.claims.confirmed.length, 0),
    unverified: page.stories.reduce((n, s) => n + s.claims.allegations.length, 0),
    interpretation: page.stories.reduce((n, s) => n + s.claims.analysis.length, 0),
    forwardLooking: page.stories.reduce((n, s) => n + s.claims.predictions.length, 0),
    singleAccountStories: page.stories.filter((s) => s.corroboration.independent <= 1).length,
    unplacedStories: page.stories.filter((s) => s.geography.render === "unplaced").length,
    openQuestions: page.stories.reduce((n, s) => n + s.unknowns.length, 0),
  };
}
