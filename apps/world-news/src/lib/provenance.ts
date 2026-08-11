// Claim-level provenance: each keyPoint / sentence links to supporting source(s).
// Timeline confidence, disputed-fact representation, and update helpers.

import type { SourceAttribution, StoryCluster } from "./storyModel";
import type { NewsSource } from "./gemini";

export type ClaimKind = "fact" | "claim" | "analysis";

export interface ClaimProvenance {
  text: string;
  kind: ClaimKind;
  sourceUrls: string[];
  confidence: "high" | "medium" | "low";
  disputed?: boolean;
}

export interface DisputedFact {
  text: string;
  claim: string;
  attributedTo: string[];
  counterClaim: string;
  counterAttributedTo: string[];
  status: "disputed" | "unresolved";
}

export function provenanceForStory(story: StoryCluster, groundingUrls?: Set<string>): ClaimProvenance[] {
  const urls = story.sources.map(s=>s.url);
  const bySource = new Map(story.sources.map(s=>[s.url, s] as const));
  return story.keyPoints.map((kp, i) => {
    const src = story.sources[i % Math.max(1, story.sources.length)];
    const isGrounded = groundingUrls ? groundingUrls.has(src?.url ?? "") : Boolean(src);
    return {
      text: kp,
      kind: "fact" as ClaimKind,
      sourceUrls: src ? [src.url] : urls.slice(0,1),
      confidence: (src?.confidence as ClaimProvenance["confidence"]) ?? (isGrounded ? "high" : "medium"),
      disputed: story.conflictingClaims.some(c=> c.claim.toLowerCase().includes(kp.toLowerCase().slice(0,24))),
    };
  });
}

export function timelineConfidence(story: StoryCluster): { score: number; label: "high"|"medium"|"low"; reasons: string[] } {
  const reasons: string[] = [];
  let s = 50;
  if (story.timeline.length >= 4) { s+=18; reasons.push("4+ dated events"); }
  else if (story.timeline.length >= 2) { s+=10; reasons.push(`${story.timeline.length} dated events`); }
  else { s-=10; reasons.push("Sparse timeline"); }
  if (story.sources.length >= 4) { s+=12; reasons.push("4+ sources corroborate"); }
  if (story.primarySources.length > 0) { s+=10; reasons.push("Primary sources present"); }
  if (story.timeline.some(t=>t.kind==="correction")) { s+=6; reasons.push("Corrections tracked"); }
  if (story.uncertainty.length > 2) { s-=8; reasons.push("High uncertainty"); }
  s = Math.max(0, Math.min(100, s));
  const label = s>=72?"high": s>=48?"medium":"low";
  return { score: s, label, reasons: reasons.slice(0,5) };
}

export function disputedFacts(story: StoryCluster): DisputedFact[] {
  return story.conflictingClaims.map(c=> ({
    text: c.claim,
    claim: c.claim, attributedTo: c.attributedTo,
    counterClaim: c.counterClaim, counterAttributedTo: c.counterAttributedTo,
    status: "disputed" as const,
  }));
}

/** Separate confirmed facts vs claims vs analysis for rendering. */
export function splitStoryContent(story: StoryCluster): { facts: string[]; claims: string[]; analysis: string[] } {
  const facts = [...story.widelyAgreedFacts];
  const claims = story.conflictingClaims.flatMap(c=> [c.claim, c.counterClaim]);
  const analysis = story.coverageGaps.filter(g=> /interpret|analysis|frames/i.test(g));
  return { facts, claims, analysis };
}

/** Detect what changed when today's story text differs from yesterday's. */
export function whatChangedSince(prev: StoryCluster | null, next: StoryCluster): { changed: boolean; summary: string | null } {
  if (!prev) return { changed: true, summary: `New story: ${next.headline}` };
  const a = `${prev.summary} ${prev.keyPoints.join(" ")}`.toLowerCase();
  const b = `${next.summary} ${next.keyPoints.join(" ")}`.toLowerCase();
  if (a === b) return { changed: false, summary: null };
  const added = next.timeline.length > prev.timeline.length ? ` +${next.timeline.length - prev.timeline.length} timeline update(s)` : "";
  const corr = next.corrections.length > prev.corrections.length ? " · correction noted" : "";
  return { changed: true, summary: `Updated: ${next.headline}${added}${corr}`.trim() || "Story updated" };
}

export function correctionHistory(story: StoryCluster): { date: string; note: string }[] {
  return story.corrections;
}
