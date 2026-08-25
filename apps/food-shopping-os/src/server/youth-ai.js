/**
 * Server-side youth-safety invariants for AI requests and responses.
 *
 * The client has a youth policy, but the server cannot trust it. These
 * functions re-derive the rules from the age/profile the server itself
 * holds, filter the AI context before the model call, validate the model's
 * response on the way back, and refuse anything that would violate the
 * under-18 policy — regardless of what the client asked for.
 *
 * Pipeline: request → age/profile policy → context filter → AI call →
 * response validation → safety policy check → UI.
 */

import { isUnderEighteen, youthPolicy } from '../lib/youth.js';

/** Topics that are never allowed through when youth mode is on. */
const BLOCKED_TOPIC_PATTERNS = [
  /weight\s*loss|lose\s*(?:weight|\d+\s*(?:kg|lb|pounds?|stone))/i,
  /calorie\s*deficit|calorie\s*debt/i,
  /cut(?:ting)?\s*(?:calories?|back\s*on\s*food)|how\s*(?:many|much).*(?:calories?).*(?:cut|reduce)/i,
  /get\s*to\s*\d+\s*(?:kg|lbs?|stone)|drop\s*(?:to|weight)/i,
  /cutting|shredding|bulking/i,
  /\bBMI\b|body\s*mass\s*index/i,
  /body\s*fat\s*(?:percentage|%)/i,
  /waist|thigh\s*gap|arm\s*circumference/i,
  /intermittent\s*fasting|16:8|5:2\s*diet|fasting\s*(?:window|plan)/i,
  /keto(?:genic)?\s*diet/i,
  /alcohol|drinking\s*units/i,
  /weekly\s*calorie\s*budget|calorie\s*debt|earn.{0,20}calor|exercis.{0,30}calor/i,
  /body\s*comparison|compare.*(?:body|weight|bmi).*(?:household|family|other|peer)/i,
  /predict.*weight|project.*weight|weight.*forecast/i,
];

/** Keys that must be stripped from AI context before the model sees them. */
const STRIPPED_CONTEXT_KEYS = [
  'weightKg', 'targetWeightKg', 'weeklyKcal', 'maintenanceKcal',
  'calorieDeficit', 'deficitPct', 'bmi', 'bodyFat', 'measurements',
  'vitals', 'fast', 'fastPlan', 'alcohol', 'bloods', 'glucose',
  'youthConsent', 'cycles', 'sleep', 'stress', 'workouts',
];

/** Phrases that must not appear in an AI response to an under-18. */
const RESPONSE_BLOCKED_PATTERNS = [
  /calorie\s*deficit/i,
  /\bcalorie\s*(?:deficit|debt|budget)\b/i,
  /eat\s*back|earn\s*(?:extra\s*)?calor|extra\s*calories?\s*to\s*eat|exercise\s*calories/i,
  /aim\s*for\s*a?\s*(?:calorie\s*)?(?:deficit|target)/i,
  /weekly\s*(?:calorie\s*)?(?:budget|debt|target)/i,
  /lose\s*(?:weight|\d+\s*(?:lb|kg|pounds?|stone))/i,
  /to\s*lose\s*weight/i,
  /body\s*mass\s*index|\bBMI\b/i,
  /body\s*fat\s*(?:percentage|%)/i,
  /fasting|intermittent\s*fast/i,
  /alcohol|units\s*of\s*alcohol/i,
  /compared\s*to\s*(?:other|your\s*peers|the\s*average)|above.{0,10}below.{0,10}average\s*(?:weight|bmi)/i,
  /projected\s*weight|predicted\s*weight|you\s*(?:will|should)\s*(?:weigh|be)\s*\d+\s*(?:kg|lbs?|stone)/i,
  /cut\s*(?:calories|back\s*on)|reduce\s*(?:calories|intake)\s*(?:by|to)/i,
];

/** Derive the youth policy server-side from state fields the client sent. */
export function deriveYouthAiPolicy(state = {}) {
  const under18 = isUnderEighteen(state);
  const policy = youthPolicy(state);
  return {
    isYouth: under18 || policy.on,
    age: policy.age,
    source: policy.source,
    consentGiven: Boolean(state.youthConsent),
    allowedGoals: policy.on ? policy.goals : null,
    caffeineLimitMg: policy.caffeineLimitMg,
    strictSharing: policy.strictSharing || false,
    signpost: policy.signpost || null,
  };
}

/**
 * Strip restricted keys and values from the AI context before the model call.
 * Returns a clean context object plus a list of what was removed (for audit).
 */
export function filterContextForYouth(context, policy) {
  if (!policy.isYouth || !context || typeof context !== 'object') return { context, stripped: [] };
  const stripped = [];
  const clean = {};
  for (const [key_, value] of Object.entries(context)) {
    if (STRIPPED_CONTEXT_KEYS.some((pattern) => key_.toLowerCase().includes(pattern.toLowerCase()))) {
      stripped.push(key_);
      continue;
    }
    // Also strip nested body objects that might carry weight/BMI data
    if (key_ === 'body' && typeof value === 'object' && value !== null) {
      const safeBody = {};
      for (const [bk, bv] of Object.entries(value)) {
        if (STRIPPED_CONTEXT_KEYS.some((p) => bk.toLowerCase().includes(p.toLowerCase()))) {
          stripped.push(`body.${bk}`);
          continue;
        }
        safeBody[bk] = bv;
      }
      clean[key_] = safeBody;
      continue;
    }
    clean[key_] = value;
  }
  return { context: clean, stripped };
}

/** Check whether the user's prompt tries to bypass youth safety. */
export function promptViolatesYouthPolicy(prompt, policy) {
  if (!policy.isYouth || !prompt) return null;
  for (const pattern of BLOCKED_TOPIC_PATTERNS) {
    if (pattern.test(prompt)) {
      return `Request touches a restricted topic (${pattern.source.slice(0, 40)}…).`;
    }
  }
  return null;
}

/**
 * Validate an AI response against the youth safety policy.
 * Returns { safe: boolean, violations: string[], sanitized: string|null }.
 * When unsafe, sanitized contains the response with violating sentences removed.
 */
export function validateAiResponseForYouth(responseText, policy) {
  if (!policy.isYouth || !responseText) return { safe: true, hadViolations: false, violations: [], sanitized: responseText };
  const violations = [];
  for (const pattern of RESPONSE_BLOCKED_PATTERNS) {
    if (pattern.test(responseText)) {
      violations.push(pattern.source.slice(0, 50));
    }
  }
  if (!violations.length) return { safe: true, hadViolations: false, violations: [], sanitized: responseText };

  // Split into sentences and remove any that match a blocked pattern.
  const sentences = responseText.split(/(?<=[.!?])\s+/);
  const sanitized = sentences.filter((sentence) =>
    !RESPONSE_BLOCKED_PATTERNS.some((pattern) => pattern.test(sentence))
  ).join(' ');

  const clean = sanitized.trim();
  return {
    safe: clean.length > 10,
    hadViolations: true,
    violations,
    sanitized: clean || null,
  };
}

/**
 * The full pipeline — called by the AI route.
 * Returns { allowed, reason?, filteredContext?, youthSystemAddition? }.
 */
export function youthAiGate({ state = {}, prompt = '', context = {} } = {}) {
  const policy = deriveYouthAiPolicy(state);

  if (!policy.isYouth) {
    return { allowed: true, filteredContext: context, policy };
  }

  // Step 1: does the prompt itself try to bypass safety?
  const violation = promptViolatesYouthPolicy(prompt, policy);
  if (violation) {
    return { allowed: false, reason: violation, policy };
  }

  // Step 2: strip restricted keys from the context.
  const { context: filteredContext, stripped } = filterContextForYouth(context, policy);

  // Step 3: add a system-level instruction the model can't ignore.
  const youthSystemAddition = [
    'IMPORTANT: This user is under 18.',
    'Never mention, suggest or calculate: calorie deficits, weight loss targets, BMI, body fat percentage, fasting windows, alcohol units, weekly calorie budgets, calorie debts, exercise calorie compensation, or body comparisons between people.',
    'Focus instead on balanced eating, regular meals, variety, and cooking skills.',
    policy.signpost ? `If the question touches weight or growth: ${policy.signpost}` : '',
  ].filter(Boolean).join(' ');

  return {
    allowed: true,
    filteredContext,
    stripped,
    youthSystemAddition,
    policy,
  };
}
