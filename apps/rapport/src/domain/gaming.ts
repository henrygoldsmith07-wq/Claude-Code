// ---------------------------------------------------------------------------
// Score-gaming resistance.
//
// The evaluator rewards genuine conversational quality. A user who optimises
// the metric — asking 12 questions, mirroring vocabulary, spamming "I hear
// you" — should not get a high score. This module detects 8 gaming strategies
// and converts them into penalties that lower the relevant behaviour scores.
//
// Every detector is deterministic, explainable, and calibrated to avoid
// punishing normal conversation: a single acknowledgement is fine, five in four
// turns is not; one open question is good, eight is an interview.
//
// Detected patterns are surfaced as a `GamingSignal` so the UI can explain why
// a transcript that looks "high effort" was still scored low — transparency is
// what keeps gaming resistance from feeling arbitrary.
// ---------------------------------------------------------------------------

import type { Simulation } from "./types";
import { extractFeatures } from "./evaluation";
import type { TranscriptFeatures } from "./evaluation";

export const GAMING_PATTERNS = [
  "excessive-questions",
  "mechanical-mirroring",
  "repetitive-acknowledgements",
  "unnatural-name-repetition",
  "formulaic-empathy",
  "unnaturally-short-responses",
  "forced-topic-references",
  "artificial-conversational-balance",
] as const;
export type GamingPattern = (typeof GAMING_PATTERNS)[number];

export interface GamingSignal {
  pattern: GamingPattern;
  /** 0-1 how strongly gaming was detected. 0 = not present, 1 = strong. */
  severity: number;
  /** Human-readable explanation of what was seen. */
  evidence: string;
  /** Which behaviours should be penalised when this pattern is present. */
  affectedBehaviours: string[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// --- 1. Excessive questions -------------------------------------------------

function detectExcessiveQuestions(features: TranscriptFeatures): GamingSignal | null {
  const total = features.openQuestions + features.closedQuestions;
  const turns = features.userTurns.length;
  if (turns === 0) return null;
  const perTurn = total / turns;
  // Normal is ~0.4 questions per turn; >1 per turn is interview territory
  const severity = clamp01((perTurn - 0.7) / 0.8);
  // Also flag stacked questions and long question runs
  const stackedPenalty = clamp01(features.stackedQuestions / Math.max(1, turns * 0.5));
  const combined = Math.max(severity, stackedPenalty * 0.8);
  if (combined < 0.2) return null;
  return {
    pattern: "excessive-questions",
    severity: combined,
    evidence: `${total} question${total === 1 ? "" : "s"} across ${turns} replies${features.stackedQuestions > 0 ? `, including ${features.stackedQuestions} multi-question turns` : ""}`,
    affectedBehaviours: ["questionQuality", "reciprocity", "followUpQuality"],
  };
}

// --- 2. Mechanical mirroring ------------------------------------------------

function detectMechanicalMirroring(simulation: Simulation, features: TranscriptFeatures): GamingSignal | null {
  const userTurns = features.userTurns;
  const charTurns = features.characterTurns;
  if (userTurns.length < 3 || charTurns.length === 0) return null;
  // Count how often user repeats a content word verbatim from previous char turn, without reflection markers
  const reflectionMarkers = ["so you", "sounds like", "i hear you", "that makes sense"];
  let mechanical = 0;
  for (const uTurn of userTurns) {
    const lower = uTurn.text.toLowerCase();
    const hasReflection = reflectionMarkers.some((m) => lower.includes(m));
    if (hasReflection) continue;
    // Find previous char turn
    const idx = features.turns.findIndex((t) => t.id === uTurn.id);
    const prevChar = [...features.turns].slice(0, idx).reverse().find((t) => t.speaker === "character");
    if (!prevChar) continue;
    const charWords = prevChar.text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 4);
    const userWords = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    const copied = charWords.filter((w) => userWords.includes(w)).length;
    // Exact copy of 2+ long content words without acknowledgement framing = mechanical
    if (copied >= 2 && wordCount(uTurn.text) < 10) mechanical++;
  }
  const severity = clamp01(mechanical / Math.max(2, userTurns.length * 0.6));
  if (severity < 0.25) return null;
  return {
    pattern: "mechanical-mirroring",
    severity,
    evidence: `${mechanical} repl${mechanical === 1 ? "y" : "ies"} copied wording from the previous turn without adding acknowledgement or interpretation`,
    affectedBehaviours: ["relevance", "listening"],
  };
}

// --- 3. Repetitive acknowledgements -----------------------------------------

function detectRepetitiveAcknowledgements(simulation: Simulation, features: TranscriptFeatures): GamingSignal | null {
  const markers = ["i hear you", "i get that", "i understand", "thanks for telling me", "right, i see", "got it", "i see what you mean"];
  const counts = new Map<string, number>();
  let totalAck = 0;
  for (const turn of features.userTurns) {
    const lower = turn.text.toLowerCase();
    for (const marker of markers) {
      const re = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = lower.match(re);
      if (matches) {
        totalAck += matches.length;
        counts.set(marker, (counts.get(marker) ?? 0) + matches.length);
      }
    }
  }
  if (totalAck === 0) return null;
  // Flag if same phrase repeated or high ack density with low variety
  const maxRepeated = Math.max(...counts.values(), 0);
  const repeatedPhrase = maxRepeated >= 3;
  const density = totalAck / features.userTurns.length;
  const severity = repeatedPhrase ? clamp01(maxRepeated / 4) : clamp01((density - 0.6) / 0.7);
  if (severity < 0.25) return null;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    pattern: "repetitive-acknowledgements",
    severity,
    evidence: top ? `"${top[0]}" appeared ${top[1]} time${top[1] === 1 ? "" : "s"} across ${features.userTurns.length} replies — acknowledgement should vary, not repeat verbatim` : `${totalAck} acknowledgements across ${features.userTurns.length} replies`,
    affectedBehaviours: ["listening", "empathy"],
  };
}

// --- 4. Unnatural name repetition -------------------------------------------

function detectUnnaturalNameRepetition(simulation: Simulation, features: TranscriptFeatures): GamingSignal | null {
  const characters = simulation.scenario.characters;
  if (characters.length === 0) return null;
  const nameCounts = new Map<string, number>();
  let totalNameMentions = 0;
  for (const turn of features.userTurns) {
    for (const char of characters) {
      const re = new RegExp(`\\b${char.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = turn.text.match(re);
      if (matches) {
        totalNameMentions += matches.length;
        nameCounts.set(char.name, (nameCounts.get(char.name) ?? 0) + matches.length);
      }
    }
  }
  if (totalNameMentions === 0) return null;
  const turns = features.userTurns.length;
  const perTurn = totalNameMentions / turns;
  // Normal: 0.2-0.4 mentions per turn in group; >0.8 is formulaic
  const maxForOne = Math.max(...nameCounts.values(), 0);
  const repeatedOne = maxForOne >= 4;
  const severity = repeatedOne ? clamp01(maxForOne / 6) : clamp01((perTurn - 0.6) / 0.6);
  if (severity < 0.25) return null;
  return {
    pattern: "unnatural-name-repetition",
    severity,
    evidence: `${totalNameMentions} name mention${totalNameMentions === 1 ? "" : "s"} across ${turns} replies${repeatedOne ? ` — "${[...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]}" repeated ${maxForOne} times` : ""}`,
    affectedBehaviours: ["inclusion", "listening"],
  };
}

// --- 5. Formulaic empathy ---------------------------------------------------

function detectFormulaicEmpathy(simulation: Simulation, features: TranscriptFeatures): GamingSignal | null {
  const validationMarkers = ["that makes sense", "makes sense", "of course you", "no wonder", "i'd be", "id be", "that sounds", "fair enough", "understandable", "i can see why"];
  const validations = features.validations;
  if (validations === 0) return null;
  // Formulaic if validations appear when no emotional cue was present, or same phrase repeated
  const phraseCounts = new Map<string, number>();
  for (const turn of features.userTurns) {
    const lower = turn.text.toLowerCase();
    for (const marker of validationMarkers) {
      const re = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const m = lower.match(re);
      if (m) phraseCounts.set(marker, (phraseCounts.get(marker) ?? 0) + m.length);
    }
  }
  const maxRepeat = Math.max(...phraseCounts.values(), 0);
  const repeated = maxRepeat >= 3;
  // Empathy without opportunity: validations but emotionalCues = 0
  const cueCount = Number(features.emotionalCues);
  const withoutOpportunity = cueCount === 0 && validations >= 2;
  const severity = repeated ? clamp01(maxRepeat / 4) : withoutOpportunity ? clamp01(validations / 3) : 0;
  if (severity < 0.25) return null;
  const cuePlural = cueCount === 1 ? "moment" : "moments";
  const ackPlural = validations === 1 ? "acknowledgement" : "acknowledgements";
  return {
    pattern: "formulaic-empathy",
    severity,
    evidence: withoutOpportunity
      ? `${validations} empathic ${ackPlural} when the conversation offered ${cueCount} ${cuePlural} that invited one — empathy should follow the other person's cue, not precede it`
      : `"${[...phraseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]}" repeated ${maxRepeat} times — genuine acknowledgement varies`,
    affectedBehaviours: ["empathy"],
  };
}

// --- 6. Unnaturally short responses -----------------------------------------

function detectUnnaturallyShortResponses(features: TranscriptFeatures): GamingSignal | null {
  const turns = features.userTurns;
  if (turns.length < 3) return null;
  const shorts = turns.filter((t) => wordCount(t.text) <= 3).length;
  const veryShorts = turns.filter((t) => wordCount(t.text) <= 6).length;
  // Genuine short responses occasionally fine; systematically short is gaming balance/contribution without substance
  const shortRatio = shorts / turns.length;
  const veryShortRatio = veryShorts / turns.length;
  let severity = 0;
  if (shortRatio > 0.4) severity = clamp01((shortRatio - 0.3) / 0.4);
  else if (veryShortRatio > 0.6) severity = clamp01((veryShortRatio - 0.5) / 0.4);
  // Also flag very low average length
  if (features.averageReplyWords > 0 && features.averageReplyWords < 6) severity = Math.max(severity, 0.5);
  if (severity < 0.25) return null;
  return {
    pattern: "unnaturally-short-responses",
    severity,
    evidence: `${shorts} repl${shorts === 1 ? "y" : "ies"} of ${turns.length} were 3 words or fewer (average ${Math.round(features.averageReplyWords)} words) — balance is about substance, not move count`,
    affectedBehaviours: ["clarity", "reciprocity", "contribution"],
  };
}

// --- 7. Forced topic references ---------------------------------------------

function detectForcedTopicReferences(simulation: Simulation, features: TranscriptFeatures): GamingSignal | null {
  // Forced topic reference: shoehorning a previous topic word when context has moved on
  // Heuristic: high referencingReplies but also high unsignalledTransitions + signalledTransitions? Actually forced references show overlap but with stale context (2+ turns old topic)
  // Simpler: detect same noun phrase repeated >2 times across user turns
  const allText = features.userTurns.map((t) => t.text.toLowerCase()).join(" ");
  const words = allText.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 5);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const repeatedTopic = [...freq.entries()].filter(([, n]) => n >= 4);
  if (repeatedTopic.length === 0) return null;
  const maxRep = Math.max(...repeatedTopic.map(([, n]) => n));
  if (maxRep < 4) return null;
  // Only flag if referencing is high (user is forcing the same detail repeatedly)
  if (features.referencingReplies < features.judgeableReplies * 0.5) return null;
  const severity = clamp01((maxRep - 3) / 3);
  if (severity < 0.3) return null;
  return {
    pattern: "forced-topic-references",
    severity,
    evidence: `Same topic word "${repeatedTopic[0]?.[0]}" appeared ${maxRep} times — continuity is about following their lead, not repeating a detail`,
    affectedBehaviours: ["relevance", "topicTransitions"],
  };
}

// --- 8. Artificial conversational balance -----------------------------------

function detectArtificialBalance(features: TranscriptFeatures): GamingSignal | null {
  const totalQuestions = features.openQuestions + features.closedQuestions;
  const disclosures = features.disclosures;
  if (totalQuestions === 0 && disclosures === 0) return null;
  // Artificial balance: exactly alternating (ratio ~1) with very short disclosures (1 disclosure per question, disclosure = "I like it too")
  // Heuristic: perfect 1:1 ratio but disclosures are all minimal (5-7 words) → gaming
  const balance = totalQuestions + disclosures === 0 ? 0 : 1 - Math.abs(totalQuestions - disclosures) / (totalQuestions + disclosures);
  if (balance < 0.9) return null; // not perfectly balanced, not gaming
  // Check if disclosures are substance-free (very short or templated)
  const shortDisclosures = features.userTurns.filter((t) => /\b(i|i'm|im|i've|my|mine)\b/i.test(t.text) && wordCount(t.text) <= 8 && wordCount(t.text) >= 5).length;
  // If half the disclosures are minimal and balance is perfect, likely formulaic
  const disclosureShortRatio = disclosures > 0 ? shortDisclosures / disclosures : 0;
  const severity = clamp01(disclosureShortRatio * balance);
  if (severity < 0.3) return null;
  // Also detect exact count matching over longer conversation (e.g., 4 questions, 4 disclosures)
  const exactMatch = totalQuestions === disclosures && totalQuestions >= 3;
  const finalSeverity = exactMatch ? Math.max(severity, 0.5) : severity;
  if (finalSeverity < 0.3) return null;
  return {
    pattern: "artificial-conversational-balance",
    severity: finalSeverity,
    evidence: `${totalQuestions} question${totalQuestions === 1 ? "" : "s"} and ${disclosures} disclosure${disclosures === 1 ? "" : "s"} — exactly balanced but disclosures are brief and templated; real balance includes substance`,
    affectedBehaviours: ["reciprocity", "contribution"],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectGaming(simulation: Simulation): GamingSignal[] {
  const features = extractFeatures(simulation);
  const signals: GamingSignal[] = [];
  const checks: (Array<GamingSignal | null>) = [
    detectExcessiveQuestions(features),
    detectMechanicalMirroring(simulation, features),
    detectRepetitiveAcknowledgements(simulation, features),
    detectUnnaturalNameRepetition(simulation, features),
    detectFormulaicEmpathy(simulation, features),
    detectUnnaturallyShortResponses(features),
    detectForcedTopicReferences(simulation, features),
    detectArtificialBalance(features),
  ];
  for (const signal of checks) if (signal && signal.severity >= 0.25) signals.push(signal);
  return signals;
}

export interface GamingPenalty {
  pattern: GamingPattern;
  severity: number;
  penalty: number; // 0-1 amount to subtract from affected behaviours
  evidence: string;
}

/**
 * Convert gaming signals into calibrated penalties. Penalties are capped and
 * behaviour-specific: spamming questions hurts questionQuality more than clarity.
 */
export function gamingPenalties(simulation: Simulation): GamingPenalty[] {
  const signals = detectGaming(simulation);
  return signals.map((signal) => ({
    pattern: signal.pattern,
    severity: signal.severity,
    evidence: signal.evidence,
    // Cap penalty: even egregious gaming cannot wipe out a behaviour to 0 — it is a nudge, not a fail.
    penalty: Math.min(0.35, signal.severity * 0.45),
  }));
}

/** Apply gaming penalties to a behaviour score keyed by its name. */
export function penaltyForBehaviour(signal: GamingSignal | GamingPenalty, behaviour: string): number {
  const affected = ("affectedBehaviours" in signal ? (signal as GamingSignal).affectedBehaviours : []) as string[];
  // If no affected list (GamingPenalty without behaviours), use severity scaling
  if (affected.length === 0) return 0;
  if (!affected.includes(behaviour)) return 0;
  return Math.min(0.35, signal.severity * 0.4);
}

export function isGamingDetected(simulation: Simulation, threshold = 0.3): boolean {
  return detectGaming(simulation).some((s) => s.severity >= threshold);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface GamingReport {
  signals: GamingSignal[];
  totalSeverity: number;
  summary: string;
}

export function gamingReport(simulation: Simulation): GamingReport {
  const signals = detectGaming(simulation);
  const totalSeverity = signals.reduce((sum, s) => sum + s.severity, 0);
  const summary =
    signals.length === 0
      ? "No gaming patterns detected."
      : `Detected ${signals.length} gaming pattern${signals.length === 1 ? "" : "s"}: ${signals.map((s) => `${s.pattern} (${Math.round(s.severity * 100)}%)`).join(", ")}. These lower affected behaviour scores rather than raising them.`;
  return { signals, totalSeverity, summary };
}
