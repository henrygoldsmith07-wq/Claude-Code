// observationVsInference.ts — strong separation between tiers of evidence.
// Tiers never render with equal certainty; UI maps each to distinct styling/language.

export type EvidenceTier =
  | "user_stated_fact" // what the user directly reported as fact
  | "direct_observation" // verifiable, camera-checkable observation
  | "computed_pattern" // local longitudinal computation
  | "hypothesis" // model inference / alternative interpretation
  | "user_confirmed"; // user explicitly confirmed after reflection

export interface TieredInterpretation {
  text: string;
  tier: EvidenceTier;
  confidence: number | null; // only for hypothesis/computed_pattern
  evidenceFor: string[]; // supporting excerpts
  evidenceAgainst: string[]; // counter-evidence
}

export const TIER_LABEL: Record<EvidenceTier, string> = {
  user_stated_fact: "You said",
  direct_observation: "Observed",
  computed_pattern: "Pattern (computed locally)",
  hypothesis: "Possible reading",
  user_confirmed: "You confirmed",
};

export const TIER_CERTAINTY: Record<EvidenceTier, string> = {
  user_stated_fact: "Directly reported by you",
  direct_observation: "Verifiable observation",
  computed_pattern: "Computed from your history — check the evidence below",
  hypothesis: "Hypothesis — weigh for and against before acting",
  user_confirmed: "Confirmed by you in review",
};

export function tierStyle(tier: EvidenceTier): string {
  switch (tier) {
    case "user_stated_fact": return "border-border bg-card";
    case "direct_observation": return "border-emerald-500/20 bg-emerald-500/5";
    case "computed_pattern": return "border-sky-500/20 bg-sky-500/5";
    case "hypothesis": return "border-amber-500/20 bg-amber-500/5";
    case "user_confirmed": return "border-violet-500/20 bg-violet-500/10";
  }
}

/** Classify a trace field into its tier automatically. */
export function classifyTraceField(field: "observations" | "assumptions" | "alternativeInterpretations" | "event" | "predictedOutcome"): EvidenceTier {
  switch (field) {
    case "observations": return "direct_observation";
    case "assumptions": return "hypothesis";
    case "alternativeInterpretations": return "hypothesis";
    case "event": return "user_stated_fact";
    case "predictedOutcome": return "hypothesis";
  }
}

export function validateTierSeparation(items: TieredInterpretation[]): string[] {
  const errors: string[] = [];
  for (const it of items) {
    if (it.tier === "hypothesis" && it.confidence == null) errors.push(`hypothesis "${it.text.slice(0, 40)}" should carry confidence`);
    if (it.tier === "direct_observation" && it.confidence != null && it.confidence > 0.9) errors.push(`observation should not carry high confidence as fact`);
    // hedged language in a "fact" means it is actually an inference — flag the mislabel
    if ((it.tier === "user_stated_fact" || it.tier === "direct_observation") && /may involve|might|could/i.test(it.text)) {
      errors.push(`"${it.text.slice(0, 40)}" uses hedged language and should be tiered as a hypothesis, not a fact`);
    }
  }
  return errors;
}

// Helpers for the structured trace
export function tieredTrace(summary: import("./types").ReflectionSummary) {
  const t = summary.trace;
  const out: TieredInterpretation[] = [];
  out.push({ text: t.event, tier: "user_stated_fact", confidence: null, evidenceFor: [], evidenceAgainst: [] });
  for (const o of t.observations) out.push({ text: o, tier: "direct_observation", confidence: null, evidenceFor: [o], evidenceAgainst: [] });
  for (const a of t.assumptions) out.push({ text: a, tier: "hypothesis", confidence: null, evidenceFor: [], evidenceAgainst: t.alternativeInterpretations });
  for (const alt of t.alternativeInterpretations) out.push({ text: alt, tier: "hypothesis", confidence: null, evidenceFor: [], evidenceAgainst: [] });
  for (const b of summary.possibleBiases) {
    out.push({ text: b.description, tier: "hypothesis", confidence: b.confidence, evidenceFor: b.evidenceFor, evidenceAgainst: b.evidenceAgainst });
  }
  return out;
}
