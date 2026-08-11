// Notifications for meaningful story changes (not every refresh).
// Client-side schedule + server digest hook. Opt-in, local-first.

import type { CountryNews } from "./gemini";
import type { StoryCluster } from "./storyModel";

export type ChangeKind = "new_story" | "correction" | "contradiction_added" | "major_update";

export interface StoryChange {
  kind: ChangeKind;
  storyId: string;
  headline: string;
  note: string;
}

export function meaningfulChanges(prev: CountryNews | null, next: CountryNews): StoryChange[] {
  if (!prev) return (next.stories ?? []).slice(0,2).map(s=> ({ kind: "new_story" as const, storyId: s.id, headline: s.headline, note: "New in this update" }));
  const prevById = new Map((prev.stories ?? []).map(s=>[s.id, s] as const));
  const out: StoryChange[] = [];
  for (const s of next.stories ?? []) {
    const p = prevById.get(s.id);
    if (!p) { out.push({ kind: "new_story", storyId: s.id, headline: s.headline, note: "New story" }); continue; }
    if (s.corrections.length > p.corrections.length) out.push({ kind: "correction", storyId: s.id, headline: s.headline, note: s.corrections[s.corrections.length-1]?.note ?? "Correction added" });
    if (s.conflictingClaims.length > p.conflictingClaims.length) out.push({ kind: "contradiction_added", storyId: s.id, headline: s.headline, note: "New conflicting claim surfaced" });
    if (s.timeline.length > p.timeline.length + 1) out.push({ kind: "major_update", storyId: s.id, headline: s.headline, note: `Timeline grew: +${s.timeline.length - p.timeline.length} events` });
  }
  // Dedupe by storyId, keep most significant
  const seen = new Set<string>();
  return out.filter(c=> { if (seen.has(c.storyId)) return false; seen.add(c.storyId); return true; }).slice(0, 6);
}

export function shouldNotify(changes: StoryChange[]): boolean {
  return changes.some(c=> c.kind !== "new_story") || changes.length >= 2;
}

// Saved topics: localStorage shape
export const SAVED_TOPICS_KEY = "world-news-saved-topics";
export function loadSavedTopics(): string[] {
  if (typeof window === "undefined") return [];
  try { const v = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string=> typeof x==="string") : []; } catch { return []; }
}
export function saveSavedTopics(topics: string[]): void {
  try { localStorage.setItem(SAVED_TOPICS_KEY, JSON.stringify(topics.slice(0,12))); } catch {}
}
