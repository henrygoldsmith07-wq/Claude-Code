// memory.ts — Context / memory architecture: separate stores, retrieve only relevant.
// - recent raw entries (last N, capped)
// - validated user facts (trace.observations that survived review)
// - user corrections (rejected interpretations)
// - longitudinal patterns (computed locally)
// - generated summaries (structuredReflection)

import type { Entry } from "./types";
import type { Correction } from "./corrections";
import { automaticSearch } from "./search";
import { detectRecurringPatterns, detectRecurringAssumptions } from "./longitudinal";
import { correctionPromptHint } from "./corrections";

export interface MemorySnapshot {
  recentRaw: Entry[]; // capped recent entries, verbatim not sent to provider except current
  validatedFacts: string[]; // observations the user did not later contradict
  corrections: Correction[];
  patterns: { kind: string; label: string; count: number }[];
  summaries: { id: string; coreEmotion: string | null; triggers: string[]; createdAt: string }[];
}

export function buildMemorySnapshot(entries: Entry[], corrections: Correction[]): MemorySnapshot {
  const sorted = entries.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentRaw = sorted.slice(0, 10);
  // validated facts: observations from entries that were reviewed unsupported? No, those invalidate assumptions, not observations.
  // For now: observations from entries that were reviewed at all are "validated" (user engaged with follow-up)
  const validatedFacts: string[] = [];
  for (const e of entries) {
    if (e.summary && e.longitudinalReview?.assumptionVerdict) {
      validatedFacts.push(...e.summary.trace.observations.slice(0, 2));
    }
  }
  const patterns: { kind: string; label: string; count: number }[] = detectRecurringPatterns(entries).slice(0, 6).map((p) => ({ kind: p.kind, label: p.label, count: p.count }));
  // assumption groups folded into patterns list as "assumption" kind for completeness
  for (const g of detectRecurringAssumptions(entries).slice(0, 3)) patterns.push({ kind: "assumption", label: g.representative.slice(0, 40), count: g.count });
  const summaries = entries.filter((e) => e.summary).map((e) => ({
    id: e.id,
    coreEmotion: e.summary?.coreEmotion ?? null,
    triggers: e.summary?.underlyingTriggers.slice(0, 3) ?? [],
    createdAt: e.createdAt,
  }));
  return { recentRaw, validatedFacts: [...new Set(validatedFacts)].slice(0, 20), corrections: corrections.slice(-20), patterns, summaries };
}

export interface RelevantContext {
  facts: string[]; // top validated facts relevant to query
  relatedSummaries: MemorySnapshot["summaries"];
  correctionsHint: string | null;
  patternHint: string | null;
  query: string;
}

// Retrieve only relevant context for a given user message (local relevance search)
export function retrieveRelevantContext(entries: Entry[], corrections: Correction[], query: string): RelevantContext {
  const snapshot = buildMemorySnapshot(entries, corrections);
  // validated facts relevant: search entries, then collect their observations
  const q = query.trim();
  let facts: string[] = [];
  if (q.length >= 8) {
    const hits = automaticSearch(entries.filter((e) => e.summary), q, 5);
    for (const h of hits) facts.push(...(h.summary?.trace.observations ?? []).slice(0, 1));
  }
  if (facts.length === 0) facts = snapshot.validatedFacts.slice(0, 3);

  // corrections hint: surface rejected interpretations so the model respects them
  const correctionsHint = corrections.length ? correctionPromptHint(corrections, 3) : null;

  // pattern hint: only if a detected pattern label overlaps query tokens
  let patternHint: string | null = null;
  const qTokens = new Set(q.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
  for (const p of snapshot.patterns) {
    const labelTokens = p.label.toLowerCase().split(/\s+/);
    if (labelTokens.some((t) => qTokens.has(t))) {
      patternHint = `Recent pattern "${p.label}" (×${p.count}) may or may not apply here — check evidence.`;
      break;
    }
  }

  return { facts: [...new Set(facts)].slice(0, 6), relatedSummaries: [] as unknown as MemorySnapshot["summaries"], correctionsHint, patternHint, query: q };
}

// What actually gets sent to the provider for a turn — minimal
export function buildProviderContext(entries: Entry[], corrections: Correction[], currentMessages: { role: string; content: string }[], query: string): { hints: string[]; entryHints: { id: string; coreEmotion: string | null; triggers: string[] }[] } {
  const relevant = retrieveRelevantContext(entries, corrections, query);
  const hints: string[] = [];
  if (relevant.correctionsHint) hints.push(relevant.correctionsHint);
  if (relevant.patternHint) hints.push(relevant.patternHint);
  if (relevant.facts.length) hints.push(`Relevant validated facts: ${relevant.facts.slice(0, 3).join(" | ")}`);
  // entry hints: lightweight, no verbatim, capped 5, only those relevant to query (not entire history)
  const candidates = automaticSearch(entries.filter((e) => e.summary), query, 5);
  const source = candidates.length ? candidates : entries.filter((e) => e.summary).slice(0, 5);
  const entryHints = source.slice(0, 5).map((e) => ({ id: e.id, coreEmotion: e.summary?.coreEmotion ?? null, triggers: e.summary?.underlyingTriggers.slice(0, 3) ?? [] }));
  return { hints, entryHints };
}
