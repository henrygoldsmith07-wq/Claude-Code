// corrections.ts — user corrections over inferred patterns.
// Reflect's patterns are tentative by design; users may reject one and it must
// never resurface (in summaries, insights, or reviews). A correction is just a
// stable key + when it was rejected — enough to filter everywhere the pattern
// would otherwise appear.

export type CorrectionKind =
  | "pattern" // detectRecurringPatterns
  | "assumption" // detectRecurringAssumptions group
  | "contradiction"
  | "calibration"
  | "unresolved";

export interface Correction {
  key: string;
  kind: CorrectionKind;
  rejectedAt: string; // ISO
  reason?: string; // optional — why the user rejected it
}

export interface AnnotatedPattern {
  key: string;
  kind: string;
  label: string;
  count: number;
  entryIds: string[];
  contexts: string[];
}

export interface AnnotatedAssumptionGroup {
  key: string;
  representative: string;
  members: { entryId: string; assumption: string; createdAt: string }[];
  count: number;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Stable key for a recurring pattern (kind + normalised label). */
export function patternKey(p: { kind: string; label: string }): string {
  return `pattern:${p.kind}:${norm(p.label).slice(0, 80)}`;
}

/** Stable key for a recurring-assumption group (normalised representative). */
export function assumptionGroupKey(representative: string): string {
  return `assumption:${norm(representative).slice(0, 80)}`;
}

export function contradictionKey(entryA: string, entryB: string): string {
  return `contradiction:${[entryA, entryB].sort().join(":")}`;
}

export function dismissedKeys(corrections: Correction[]): Set<string> {
  return new Set((corrections || []).map((c) => c.key));
}

/** Filter inferred items (already carrying a stable `key`) by corrections. */
export function withoutDismissed<T extends { key: string }>(items: T[], corrections: Correction[]): T[] {
  const d = dismissedKeys(corrections);
  return (items || []).filter((i) => !d.has(i.key));
}

/** Attach stable keys to BehaviourPattern[] so they can be filtered. */
export function annotatePatterns(patterns: { kind: string; label: string; count: number; entryIds: string[]; contexts: string[] }[]): AnnotatedPattern[] {
  return patterns.map((p) => ({ ...p, key: patternKey(p) }));
}

/** Attach stable keys to RecurringAssumption[] so they can be filtered. */
export function annotateAssumptionGroups(groups: { representative: string; members: { entryId: string; assumption: string; createdAt: string }[]; count: number }[]): AnnotatedAssumptionGroup[] {
  return groups.map((g) => ({ ...g, key: assumptionGroupKey(g.representative) }));
}
