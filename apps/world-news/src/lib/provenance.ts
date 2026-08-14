// Claim-level provenance: which source actually supports which statement.
//
// The previous implementation assigned sources to key points by array index
// modulo — statement 3 got source 3, whether or not that source said anything
// about it. Every link it rendered was a coincidence, and a wrong citation is
// worse than no citation because it survives a reader checking it once.
//
// This delegates the matching and the typing to ./claims and keeps only the
// story-shaped adapters the UI needs.

import type { StoryCluster } from "./storyModel";
import { classifyClaim, buildDisputedFact, type ClaimType, type DisputedFact } from "./claims";
import { changeSummary, whatChanged } from "./storyRelations";
import { ownerOf } from "./sourceRegistry";

export type ClaimKind = ClaimType;

export interface ClaimProvenance {
  text: string;
  kind: ClaimKind;
  /** Only sources whose text supports this statement. Empty is a valid answer. */
  sourceUrls: string[];
  confidence: "high" | "medium" | "low";
  disputed: boolean;
  /** Why it was typed and how well supported it is. */
  reasons: string[];
}

/**
 * Link each of a story's key points to the sources that actually support it.
 *
 * `groundingUrls` (when the model returned live grounding chunks) upgrades
 * confidence, because a chunk is direct evidence the claim came from that page
 * rather than being matched to it after the fact.
 */
export function provenanceForStory(story: StoryCluster, groundingUrls?: Set<string>): ClaimProvenance[] {
  const disputedTexts = new Set(
    (story.conflictingClaims ?? []).flatMap((c) => [c.claim, c.counterClaim]).map((t) => t.toLowerCase().trim()),
  );
  const byPublisher = new Map(story.sources.map((s) => [s.publisher ?? "unknown", s] as const));

  return (story.keyPoints ?? []).map((text) => {
    const assessment = classifyClaim(text, story.sources, {
      disputed: disputedTexts.has(text.toLowerCase().trim()),
      ownerOf,
    });
    const urls = assessment.corroboration.publishers
      .map((p) => byPublisher.get(p)?.url)
      .filter((u): u is string => Boolean(u));
    const grounded = groundingUrls ? urls.some((u) => groundingUrls.has(u)) : false;

    const confidence: ClaimProvenance["confidence"] =
      assessment.corroboration.independent >= 2 && (grounded || assessment.type === "confirmed")
        ? "high"
        : assessment.corroboration.independent >= 1
          ? "medium"
          : "low";

    return {
      text,
      kind: assessment.type,
      sourceUrls: urls,
      confidence,
      disputed: assessment.disputed,
      reasons: [...assessment.reasons, assessment.corroboration.note].slice(0, 4),
    };
  });
}

export function timelineConfidence(story: StoryCluster): { score: number; label: "high" | "medium" | "low"; reasons: string[] } {
  const reasons: string[] = [];
  let s = 50;
  if (story.timeline.length >= 4) { s += 18; reasons.push("4+ dated events"); }
  else if (story.timeline.length >= 2) { s += 10; reasons.push(`${story.timeline.length} dated events`); }
  else { s -= 10; reasons.push("Sparse timeline"); }
  if (story.sources.length >= 4) { s += 12; reasons.push("4+ sources corroborate"); }
  if (story.primarySources.length > 0) { s += 10; reasons.push("Primary sources present"); }
  if (story.timeline.some((t) => t.kind === "correction")) { s += 6; reasons.push("Corrections tracked"); }
  if (story.uncertainty.length > 2) { s -= 8; reasons.push("High uncertainty"); }
  s = Math.max(0, Math.min(100, s));
  return { score: s, label: s >= 72 ? "high" : s >= 48 ? "medium" : "low", reasons: reasons.slice(0, 5) };
}

/** Both sides of every contested point, with corroboration counted per side. */
export function disputedFacts(story: StoryCluster): DisputedFact[] {
  const byPublisher = new Map(story.sources.map((s) => [s.publisher ?? "unknown", s] as const));
  const sourcesFor = (names: string[]) =>
    names.map((n) => byPublisher.get(n)).filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (story.conflictingClaims ?? []).map((c) =>
    buildDisputedFact(
      c.claim,
      sourcesFor(c.attributedTo),
      c.counterClaim,
      sourcesFor(c.counterAttributedTo),
      { dimension: c.disagreementDimension, ownerOf },
    ),
  );
}

/**
 * Split a story's content by what kind of statement it is.
 *
 * Uses the same classifier as everything else, so the split shown to a reader
 * matches the labels on individual claims — the old version derived "analysis"
 * by regex-matching the coverage-gaps list, which had nothing to do with it.
 */
export function splitStoryContent(story: StoryCluster): {
  facts: string[];
  claims: string[];
  analysis: string[];
  predictions: string[];
} {
  const statements = [...(story.keyPoints ?? []), ...(story.widelyAgreedFacts ?? [])];
  const assessed = statements.map((s) => classifyClaim(s, story.sources, { ownerOf }));
  const of = (t: ClaimType) => assessed.filter((a) => a.type === t).map((a) => a.text);
  return {
    facts: of("confirmed"),
    claims: of("allegation"),
    analysis: of("analysis"),
    predictions: of("prediction"),
  };
}

export { whatChanged as whatChangedDetailed };

/** One-line change note, kept for callers that only render a string. */
export function whatChangedSince(prev: StoryCluster | null, next: StoryCluster): { changed: boolean; summary: string | null } {
  const changes = whatChanged(prev, next);
  return { changed: changes.length > 0, summary: changeSummary(changes) };
}

export function correctionHistory(story: StoryCluster): { date: string; note: string }[] {
  return story.corrections;
}
