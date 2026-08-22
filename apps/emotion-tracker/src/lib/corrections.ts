// corrections.ts — user corrections over inferred patterns.
// Reflect's patterns are tentative by design; users may reject one and it must
// never resurface (in summaries, insights, or reviews). A correction stores
// the rejected interpretation + context so future outputs respect it.

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
  reason?: string; // why the user rejected it
  // Rich propagation fields — all optional for backwards compat
  rejectedInterpretation?: string; // verbatim rejected interpretation
  affectedFacts?: string[]; // facts/observations that were misread
  affectedPatterns?: string[]; // pattern labels affected
  replacementUnderstanding?: string | null; // user's corrected reading if provided
  timestamp?: string; // alias for rejectedAt
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

// ── correction propagation ────────────────────────────────────────────

export function createCorrection(params: {
  key: string;
  kind: CorrectionKind;
  rejectedInterpretation?: string;
  reason?: string;
  affectedFacts?: string[];
  affectedPatterns?: string[];
  replacementUnderstanding?: string | null;
  timestamp?: string;
}): Correction {
  const at = params.timestamp ?? new Date().toISOString();
  return {
    key: params.key,
    kind: params.kind,
    rejectedAt: at,
    timestamp: at,
    reason: params.reason,
    rejectedInterpretation: params.rejectedInterpretation,
    affectedFacts: params.affectedFacts,
    affectedPatterns: params.affectedPatterns,
    replacementUnderstanding: params.replacementUnderstanding ?? null,
  };
}

/** Prompt suffix that tells the model to respect prior corrections. */
export function correctionPromptHint(corrections: Correction[], max = 6): string | null {
  const recent = (corrections || []).slice(-max);
  if (recent.length === 0) return null;
  const lines = recent.map((c) => {
    const what = c.rejectedInterpretation ?? c.key;
    const repl = c.replacementUnderstanding ? ` — corrected to: "${c.replacementUnderstanding.slice(0, 120)}"` : "";
    const reason = c.reason ? ` (reason: ${c.reason.slice(0, 80)})` : "";
    return `- Do NOT repeat: "${what.slice(0, 120)}"${reason}${repl}`;
  });
  return `USER CORRECTIONS — the user previously rejected these interpretations; do not reintroduce them without new evidence:\n${lines.join("\n")}`;
}

/** Minimum normalised length before substring matching is allowed —
 *  shorter strings match too broadly and would veto unrelated assumptions. */
const MIN_CONTAINMENT_LENGTH = 12;

/** Check if a candidate assumption would violate a stored correction. */
export function violatesCorrection(candidate: string, corrections: Correction[]): Correction | null {
  const n = norm(candidate);
  for (const c of corrections || []) {
    const keys = [c.key, c.rejectedInterpretation ?? "", ...(c.affectedPatterns ?? []), ...(c.affectedFacts ?? [])]
      .map((s) => norm(s))
      .filter(Boolean);
    for (const k of keys) {
      if (n.length >= MIN_CONTAINMENT_LENGTH && k.length >= MIN_CONTAINMENT_LENGTH && (n.includes(k) || k.includes(n))) return c;
    }
    // direct key comparison: assumption:${norm}
    const normCand = `assumption:${n.slice(0, 80)}`;
    if (c.key === normCand) return c;
    if (n.length >= 20 && c.key.includes(n.slice(0, 20))) return c;
  }
  return null;
}

export function filterAssumptionsByCorrections(assumptions: string[], corrections: Correction[]): string[] {
  return assumptions.filter((a) => !violatesCorrection(a, corrections));
}
