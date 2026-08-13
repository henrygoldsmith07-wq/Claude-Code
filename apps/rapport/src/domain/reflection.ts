import { checkForDistress } from "./safety";
import type { BehaviourKey, ChallengeOutcome, Reflection, ReflectionSignal } from "./types";

// ---------------------------------------------------------------------------
// Reflection.
//
// Four questions, two of them optional. The temptation is to ask more — richer
// data, better model — and the cost is that people stop reflecting at all,
// which loses far more signal than the extra questions gain.
//
// The extraction below is deliberately shallow. It maps described behaviours
// onto the behaviour vocabulary and picks out named obstacles. It does not
// infer mood, traits or motives from someone's private writing, and it never
// produces anything resembling a diagnosis — a reflection saying "I froze" is
// recorded as the obstacle "froze", not as evidence of a condition.
// ---------------------------------------------------------------------------

const BEHAVIOUR_PHRASES: { key: BehaviourKey; patterns: RegExp[] }[] = [
  { key: "followUpQuality", patterns: [/follow[- ]?up/i, /asked (?:them )?(?:more )?about/i, /kept (?:it|the conversation) going/i] },
  { key: "questionQuality", patterns: [/asked (?:an? )?(?:open )?question/i, /open question/i] },
  { key: "listening", patterns: [/listen/i, /let them (?:talk|finish)/i, /repeated back|said it back/i] },
  { key: "empathy", patterns: [/how they felt/i, /acknowledg/i, /validat/i, /didn'?t (?:jump|rush) (?:in|to) (?:with )?advice/i] },
  { key: "assertiveness", patterns: [/said no/i, /pushed back/i, /stood my ground/i, /asked for/i, /stated (?:my )?(?:view|opinion)/i] },
  { key: "contribution", patterns: [/spoke up/i, /contributed/i, /said something/i, /joined in/i] },
  { key: "clarity", patterns: [/rambl/i, /got to the point/i, /clear/i, /waffl/i] },
  { key: "topicTransitions", patterns: [/changed (?:the )?(?:subject|topic)/i, /moved on to/i] },
  { key: "reciprocity", patterns: [/interview/i, /talked about myself/i, /shared something/i, /balanced/i] },
  { key: "relevance", patterns: [/picked up on/i, /stayed on (?:the )?topic/i] },
];

const OBSTACLE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bfroze|blanked|mind went blank\b/i, label: "froze" },
  { pattern: /\bno (?:good )?(?:opening|opportunity|moment)\b|never (?:got|found) (?:a|the) (?:gap|chance)\b/i, label: "no opening" },
  { pattern: /\binterrupted\b/i, label: "interrupted" },
  { pattern: /\btalked too much|took over|dominat/i, label: "over-talked" },
  { pattern: /\bran out of things|dried up|went quiet\b/i, label: "ran dry" },
  { pattern: /\brushed|too fast|spoke quickly\b/i, label: "rushed" },
  { pattern: /\bnervous|anxious|heart (?:was )?racing|shaking\b/i, label: "nerves" },
  { pattern: /\bchickened out|didn'?t (?:do|try) it|bottled it|avoided\b/i, label: "avoided" },
  { pattern: /\bnoisy|loud|couldn'?t hear\b/i, label: "environment" },
  { pattern: /\bno (?:one|body) (?:was )?(?:there|around)|nobody to\b/i, label: "no opportunity" },
  { pattern: /\bthey (?:were )?(?:busy|rushing|distracted)\b/i, label: "other person unavailable" },
  { pattern: /\bapologi[sz]ed too much|over[- ]?explained\b/i, label: "over-explained" },
];

const POSITIVE_MARKERS = [
  /\bwent well|easier than|pleased|proud|glad|surprised how|better than (?:i )?(?:expected|thought)\b/i,
  /\bmanaged to|did it|kept going|stayed\b/i,
];
const NEGATIVE_MARKERS = [
  /\bbadly|awkward|worse than|disaster|failed|hated|cringe|awful\b/i,
  /\bshould have|wish i(?:'d| had)|regret\b/i,
];

/**
 * Extract signals from a reflection. Runs locally and needs no model — the
 * user's private writing does not leave the device for this.
 */
export function extractSignals(reflection: Reflection): ReflectionSignal {
  const text = [reflection.wentWell ?? "", reflection.wouldChange ?? ""].join(" \n ");

  const behavioursMentioned = BEHAVIOUR_PHRASES.filter((entry) =>
    entry.patterns.some((pattern) => pattern.test(text)),
  ).map((entry) => entry.key);

  const obstacles = OBSTACLE_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);

  let appraisal = 0;
  if (reflection.attempted === "yes") appraisal += 0.3;
  if (reflection.attempted === "no") appraisal -= 0.2;
  for (const marker of POSITIVE_MARKERS) if (marker.test(text)) appraisal += 0.25;
  for (const marker of NEGATIVE_MARKERS) if (marker.test(text)) appraisal -= 0.25;
  // Difficulty is not appraisal — a hard thing done well is a good outcome —
  // but very high reported difficulty does temper the reading slightly.
  if (reflection.difficulty >= 5) appraisal -= 0.1;

  return {
    reflectionId: reflection.id,
    behavioursMentioned,
    selfAppraisal: Math.max(-1, Math.min(1, appraisal)),
    obstacles,
    source: "deterministic",
  };
}

/**
 * Performance implied by a reflection, for the mastery engine. Attempt matters
 * more than self-rated success: the product measures what the user did, not how
 * good they felt about it afterwards.
 */
export function performanceFromReflection(reflection: Reflection, signal: ReflectionSignal): {
  performance: number;
  difficulty: number;
  reliability: number;
  comfort: number;
} | null {
  if (reflection.attempted === "no") {
    // A non-attempt is real information about confidence, and none about
    // competence — so it updates only the comfort channel, at low weight.
    return { performance: 0.35, difficulty: reflection.difficulty, reliability: 0.25, comfort: 0.3 };
  }
  const base = reflection.attempted === "yes" ? 0.75 : 0.55;
  const appraisalAdjustment = signal.selfAppraisal * 0.15;
  const obstaclePenalty = Math.min(0.15, signal.obstacles.length * 0.05);
  return {
    performance: Math.max(0, Math.min(1, base + appraisalAdjustment - obstaclePenalty)),
    difficulty: reflection.difficulty,
    // Self-report is weaker evidence than an observed transcript, and the app
    // says so rather than quietly weighting it the same.
    reliability: reflection.wentWell || reflection.wouldChange ? 0.8 : 0.6,
    comfort: Math.max(0, Math.min(1, 0.5 + signal.selfAppraisal * 0.35 - (reflection.difficulty - 3) * 0.1)),
  };
}

export interface ReflectionPrompt {
  id: string;
  question: string;
  kind: "outcome" | "scale" | "text";
  optional: boolean;
  options?: { value: ChallengeOutcome; label: string }[];
}

export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  {
    id: "attempted",
    question: "Did you attempt it?",
    kind: "outcome",
    optional: false,
    options: [
      { value: "yes", label: "Yes" },
      { value: "partly", label: "Partly" },
      { value: "no", label: "No" },
    ],
  },
  { id: "difficulty", question: "How difficult did it feel?", kind: "scale", optional: false },
  { id: "wentWell", question: "What went well?", kind: "text", optional: true },
  { id: "wouldChange", question: "What would you do differently?", kind: "text", optional: true },
];

/** Reflection text can contain a disclosure that outranks training. Checked before anything else. */
export function screenReflection(reflection: Reflection): { verdict: "ok" | "support"; message?: string } {
  const text = `${reflection.wentWell ?? ""} ${reflection.wouldChange ?? ""}`;
  const distress = checkForDistress(text);
  if (distress) return { verdict: "support", message: distress.message };
  return { verdict: "ok" };
}

/**
 * Retention: strip the free text but keep the derived signals, so long-run
 * analytics survive without the app holding years of someone's private notes.
 */
export function redact(reflection: Reflection, at: string): Reflection {
  return { ...reflection, wentWell: undefined, wouldChange: undefined, redactedAt: at };
}

export function shouldRedact(reflection: Reflection, retentionDays: number, now: string): boolean {
  if (retentionDays <= 0 || reflection.redactedAt) return false;
  const age = (new Date(now).getTime() - new Date(reflection.createdAt).getTime()) / 86_400_000;
  return age > retentionDays;
}
