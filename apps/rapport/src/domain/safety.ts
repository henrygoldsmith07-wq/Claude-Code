// ---------------------------------------------------------------------------
// Safety gate.
//
// This product tells people what to go and do with other human beings, and
// generates practice scenarios from free text they write. Two failure modes
// matter and both are checked here, deterministically, before anything reaches
// the user:
//
//  1. Unsafe practice — anything that would have the user approach people in
//     isolated settings, press past a refusal, or treat another person as a
//     target to be worked on.
//  2. Manipulation framing — techniques for extracting compliance. The line the
//     product draws is between communicating clearly and engineering someone
//     else's behaviour, and it is drawn here rather than left to a prompt.
//
// Separately, some free text is a person telling us they are in trouble. That
// is not a content-policy problem, it is a duty to respond like a human: the
// app stops training, says something plain, and points somewhere useful.
// ---------------------------------------------------------------------------

export type SafetyVerdict = "ok" | "rewrite" | "block" | "support";

export interface SafetyResult {
  verdict: SafetyVerdict;
  /** Which rule fired. Empty when ok. */
  reasons: string[];
  /** Shown to the user when the verdict is not ok. Always plain and non-judgemental. */
  message?: string;
}

const MANIPULATION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(manipulat\w*|gaslight\w*|coerc\w*)\b/i, reason: "manipulation" },
  { pattern: /\bget (?:them|him|her|someone) to (?:do|say|agree|admit)\b/i, reason: "compliance-engineering" },
  { pattern: /\b(make|force) (?:them|him|her|someone) (?:like|want|feel|agree)\b/i, reason: "compliance-engineering" },
  { pattern: /\b(pickup|pick-up) (?:artist|line)s?\b/i, reason: "seduction-technique" },
  { pattern: /\bneg(?:ging)?\b/i, reason: "seduction-technique" },
  { pattern: /\bwear (?:them|him|her) down\b/i, reason: "pressure" },
  { pattern: /\bkeep asking until\b/i, reason: "pressure" },
  { pattern: /\b(?:guilt|shame) (?:them|him|her) into\b/i, reason: "pressure" },
  { pattern: /\bhow to lie\b|\bconvincing lie\b/i, reason: "deception" },
];

const UNSAFE_CONTEXT_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(follow|approach)(?:ing)? (?:someone|them|her|him) (?:home|to their car|at night)\b/i, reason: "isolation" },
  { pattern: /\b(?:alone|isolated|empty) (?:car ?park|street|carriage|alley)\b/i, reason: "isolation" },
  { pattern: /\bwon'?t take no\b|\bignore (?:the|their) no\b/i, reason: "consent" },
  { pattern: /\bkeep (?:messaging|texting|calling) (?:until|even if)\b/i, reason: "harassment" },
  { pattern: /\bshow up (?:at|to) (?:their|his|her) (?:house|home|work) unannounced\b/i, reason: "harassment" },
  { pattern: /\bconfront\b.*\b(?:drunk|intoxicated|angry mob)\b/i, reason: "escalation" },
];

// Written to catch inflected forms ("ending my life", "hurting myself"), which
// is where a naive keyword list fails exactly when it matters most.
const DISTRESS_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|harm)(?:ing)? myself\b/i,
  /\bsuicid\w*/i,
  // "end it all" and "ending my life" only — a bare "end it" appears in
  // ordinary copy ("end it deliberately") and must not trigger a crisis
  // response. Over-firing here is not a safe default: it would make the app
  // unusable and dilute the response when it genuinely matters.
  /\bend(?:ing)? (?:it all|my life)\b/i,
  /\bself[- ]harm\w*/i,
  /\bno reason to (?:live|go on|carry on)\b/i,
  /\b(?:want|wanted|wanting) to (?:die|disappear forever|not be here)\b/i,
  /\bdon'?t want to (?:be here|exist|wake up)\b/i,
  /\bbetter off without me\b/i,
];

const ABUSE_PATTERNS: RegExp[] = [
  /\b(?:he|she|they|my (?:partner|boyfriend|girlfriend|husband|wife|manager)) (?:hits|hit|threatens|threatened) me\b/i,
  /\bafraid (?:of|for) my safety\b/i,
  /\bwon'?t let me (?:leave|see|talk to)\b/i,
];

/**
 * Distress and disclosed abuse are not moderation categories. The app steps out
 * of the way: no training prompt, no reframing, no cheerfulness.
 */
export function checkForDistress(text: string): SafetyResult | null {
  if (DISTRESS_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      verdict: "support",
      reasons: ["distress"],
      message:
        "That sounds really hard, and it is more than a training app should be handling. If you are in danger right now, please contact your local emergency number. In the UK you can call or text Samaritans free on 116 123, any time. Your note has been saved privately and nothing here has been shared.",
    };
  }
  if (ABUSE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      verdict: "support",
      reasons: ["harm-disclosure"],
      message:
        "What you have described sounds like more than a communication problem, and practising phrasing is not the right help for it. Speaking to someone who supports people in this situation would be a better next step — in the UK, the National Domestic Abuse Helpline is 0808 2000 247, free and 24 hours. Nothing you have written has left this device.",
    };
  }
  return null;
}

/**
 * Gate for anything a user asks to have simulated or coached. Blocks the two
 * categories above; asks for a rewrite where the intent is probably fine but
 * the framing is not.
 */
export function checkPracticeRequest(text: string): SafetyResult {
  const distress = checkForDistress(text);
  if (distress) return distress;

  const unsafe = UNSAFE_CONTEXT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
  if (unsafe.length > 0) {
    return {
      verdict: "block",
      reasons: unsafe,
      message:
        "I can't build practice around that one. Anything that involves pressing past a no, following someone, or approaching people where they can't easily leave is out of scope here — those aren't communication problems. Describe the conversation you want to handle better and I'll set that up instead.",
    };
  }

  const manipulation = MANIPULATION_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
  if (manipulation.length > 0) {
    return {
      verdict: "rewrite",
      reasons: manipulation,
      message:
        "This app trains being clear, not getting a particular reaction out of someone — partly on principle, partly because techniques aimed at the second thing tend not to survive contact with people who notice. If there is something you want to ask for or say plainly, rewrite it that way and I'll build the practice around it.",
    };
  }

  return { verdict: "ok", reasons: [] };
}

/**
 * Gate for model output before it is shown. Catches the failure mode where a
 * model, asked for communication advice, produces a persuasion script.
 */
export function checkGeneratedContent(text: string): SafetyResult {
  const manipulation = MANIPULATION_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
  const unsafe = UNSAFE_CONTEXT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
  const reasons = [...manipulation, ...unsafe];
  if (reasons.length === 0) return { verdict: "ok", reasons: [] };
  return {
    verdict: "block",
    reasons,
    message: "The generated version didn't pass the content check, so you're seeing the built-in version instead.",
  };
}

const APPEARANCE_TERMS = [
  "attractive", "attractiveness", "good-looking", "ugly", "handsome", "pretty", "beautiful",
  "hot", "fit", "overweight", "skinny", "your looks", "how you look",
];

const INFERENCE_TERMS = [
  "personality type", "introvert", "extrovert", "autistic", "adhd", "neurotic", "narcissist",
  "socially anxious", "anxiety disorder", "iq", "intelligent", "ethnicity", "accent suggests",
  "sound gay", "sound foreign",
];

/** Whole-word match, so "fit" does not fire on "fits" and "hot" not on "shot". */
function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/**
 * Feedback must describe behaviour. This blocks the two things the product
 * promises never to do: score appearance, and infer traits or characteristics
 * from how someone speaks.
 */
export function checkFeedbackLanguage(text: string): SafetyResult {
  const appearance = APPEARANCE_TERMS.filter((term) => containsTerm(text, term));
  const inference = INFERENCE_TERMS.filter((term) => containsTerm(text, term));
  const reasons = [
    ...appearance.map(() => "appearance-comment"),
    ...inference.map(() => "trait-inference"),
  ];
  if (reasons.length === 0) return { verdict: "ok", reasons: [] };
  return {
    verdict: "block",
    reasons: [...new Set(reasons)],
    message: "Feedback should describe what you did, not what you are. Showing the measured version instead.",
  };
}

/**
 * Excessive criticism check. A feedback message that is nothing but faults is
 * a training failure regardless of accuracy — people stop opening the app.
 */
export function checkCriticismBalance(whatWorked: string[], improvements: number): SafetyResult {
  if (whatWorked.length === 0 && improvements > 1) {
    return {
      verdict: "rewrite",
      reasons: ["excessive-criticism"],
      message: "Feedback must name at least one thing that worked before an improvement.",
    };
  }
  return { verdict: "ok", reasons: [] };
}

/** True when text is safe to show unmodified. */
export function isSafe(result: SafetyResult): boolean {
  return result.verdict === "ok";
}
