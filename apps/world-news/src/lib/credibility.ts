// Source credibility methodology — explicit, auditable, no editorial opacity.
// Scores are heuristics (transparency), not judgments of truth.
import type { SourceAttribution } from "./storyModel";

export interface CredibilitySignal {
  sourceUrl: string;
  publisher?: string;
  kind: string; // wire, official, newsroom, expert, document, unknown, community
  hasByline?: boolean;
  hasPrimaryAttribution?: boolean; // primary source present in the story
  domainAgeKnown?: boolean; // placeholder for future WHOIS/registry signal
  correctionsNoted?: boolean;
}

export function scoreCredibility(s: CredibilitySignal): { score: number; label: "high" | "medium" | "low"; reasons: string[] } {
  let score = 50; const reasons: string[] = [];
  if (s.kind === "wire") { score += 14; reasons.push("Wire service (editorial standards, syndication breadth)"); }
  if (s.kind === "official" || s.kind === "document") { score += 12; reasons.push("Official document or statement"); }
  if (s.kind === "newsroom") { score += 6; reasons.push("Established newsroom"); }
  if (s.hasPrimaryAttribution) { score += 10; reasons.push("Cites primary sources"); }
  if (s.hasByline) { score += 4; reasons.push("Named byline"); }
  if (s.correctionsNoted) { score -= 6; reasons.push("Recent correction noted"); }
  if (s.kind === "unknown" || s.kind === "community") { score -= 10; reasons.push("Unverified/community source"); }
  score = Math.max(0, Math.min(100, score));
  const label = score >= 72 ? "high" : score >= 48 ? "medium" : "low";
  return { score, label, reasons: reasons.slice(0, 5) };
}

export function storyCredibility(attributions: SourceAttribution[]): { avg: number; min: number; max: number; distribution: { high: number; medium: number; low: number } } {
  if (attributions.length === 0) return { avg: 0, min: 0, max: 0, distribution: { high: 0, medium: 0, low: 0 } };
  const scored = attributions.map(a => scoreCredibility({ sourceUrl: a.url, publisher: a.publisher, kind: (a.sourceKind ?? a.isPrimary ? "official" : "unknown") as string, hasPrimaryAttribution: Boolean(a.isPrimary) }));
  const scores = scored.map(s => s.score);
  const dist = { high: scored.filter(s=>s.label==="high").length, medium: scored.filter(s=>s.label==="medium").length, low: scored.filter(s=>s.label==="low").length };
  return { avg: Math.round(scores.reduce((x,y)=>x+y,0)/scores.length), min: Math.min(...scores), max: Math.max(...scores), distribution: dist };
}

export const METHODOLOGY_NOTE = "Credibility is a transparent heuristic (source kind, primary attribution, byline, corrections) — not a truth judgment. Always follow source links to verify. Summaries distinguish reported facts (attributed) from interpretation (model synthesis). No invented causality: timelines show observed sequences, not causes, unless officials or investigations state causation.";
