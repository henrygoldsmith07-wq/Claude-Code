/**
 * Question understanding for Ask Pulse.
 *
 * Rule-based, not model-based. The parser decides *which analysis to run*, and
 * running the wrong analysis silently is worse than saying "I did not
 * understand that". A model may later be used to map an unusual phrasing onto
 * one of these intents, but the intent set — and therefore what Pulse is
 * capable of asserting — stays fixed and reviewable.
 */

import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";

export type Intent =
  | "best-time"
  | "does-x-affect-y"
  | "best-method"
  | "predicts-missed"
  | "precedes-strong-days"
  | "what-changed"
  | "what-to-test"
  | "metric-summary"
  | "unknown";

export interface ParsedQuestion {
  raw: string;
  intent: Intent;
  /** Metric the question is about, when one could be identified. */
  outcomeMetricId: string | null;
  /** Second metric, for relationship questions. */
  exposureMetricId: string | null;
  /** Confidence in the parse itself, 0..1. Low values are surfaced to the user. */
  parseConfidence: number;
  matchedTerms: string[];
}

interface IntentRule {
  intent: Intent;
  patterns: RegExp[];
  weight: number;
}

const RULES: IntentRule[] = [
  {
    intent: "what-changed",
    patterns: [/what\s+(has\s+)?changed/i, /what'?s\s+(new|different)/i, /\bthis\s+week\b.*\bchang/i],
    weight: 1,
  },
  {
    intent: "what-to-test",
    patterns: [/what\s+should\s+i\s+(test|try|experiment)/i, /\bnext\s+experiment\b/i, /what\s+to\s+test/i],
    weight: 1,
  },
  {
    intent: "best-time",
    patterns: [
      /\bwhen\s+(?:do|is|are|am|does)\b/i,
      /\bwhat\s+time\b/i,
      /\bbest\s+time\b/i,
      /\btime\s+of\s+day\b/i,
    ],
    weight: 0.95,
  },
  {
    intent: "precedes-strong-days",
    patterns: [/\bprecede/i, /\bbefore\s+my\s+(best|strongest)/i, /\bstrongest\s+days\b/i, /\bbest\s+days\b/i],
    weight: 0.9,
  },
  {
    intent: "predicts-missed",
    patterns: [/\bpredict/i, /\bmissed?\b/i, /\bskip(ped)?\b/i, /\bfall\s+off\b/i],
    weight: 0.85,
  },
  {
    intent: "best-method",
    // Allows a qualifier between "which" and the noun, as in
    // "which revision methods produce the best retention?".
    patterns: [
      /\bwhich\s+(?:\w+\s+){0,2}(methods?|approach(?:es)?|techniques?|modes?)\b/i,
      /\bwhat\s+kind\s+of\b/i,
      /\bbest\s+(method|way)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: "does-x-affect-y",
    patterns: [
      /\bdoes\b.+\b(affect|improve|help|hurt|change|influence|impact)\b/i,
      /\bis\s+there\s+a\s+(link|relationship|connection)\b/i,
      /\brelated\s+to\b/i,
    ],
    weight: 0.9,
  },
  {
    intent: "metric-summary",
    patterns: [/\bhow\s+(am|are)\s+i\b/i, /\bhow\s+has\b.+\bgone\b/i, /\bshow\s+me\b/i, /\btrend\b/i],
    weight: 0.7,
  },
];

/** Words that identify a metric even when the user does not use its formal name. */
const METRIC_SYNONYMS: Record<string, string[]> = {
  "study.accuracy": ["accuracy", "revision", "revise", "study performance", "study", "questions", "marks", "score"],
  "study.delayed_recall": ["retention", "recall", "remember", "delayed recall", "forgetting"],
  "study.recall_grade": ["flashcards", "cards", "recall grade"],
  "study.response_time": ["speed", "how fast", "response time"],
  "study.calibration_error": ["confidence", "calibration", "overconfident"],
  "study.session_minutes": ["study time", "hours studying", "session length"],
  "exercise.volume": ["exercise", "training", "workout", "gym", "lifting"],
  "exercise.effort": ["effort", "rpe", "how hard"],
  "wellbeing.sleep": ["sleep", "slept", "rest"],
  "wellbeing.readiness": ["readiness", "recovery"],
  "language.speaking_minutes": ["french speaking", "speaking practice", "speaking", "french"],
  "language.recall_accuracy": ["french recall", "french vocabulary", "vocab"],
  "language.pronunciation": ["pronunciation", "accent"],
  "schedule.fragmentation": ["fragmented", "busy day", "meetings", "calendar"],
  "schedule.longest_free_block": ["free time", "free block"],
  "wellbeing.plan_adherence": ["meals", "eating", "meal plan", "diet"],
  "social.drill_score": ["conversation", "social", "rapport"],
  "reflection.mood": ["mood", "how i felt", "feeling"],
  "reflection.stress": ["stress", "stressed"],
};

export function parseQuestion(raw: string, registry: MetricRegistry): ParsedQuestion {
  const text = raw.trim();
  const matchedTerms: string[] = [];

  let intent: Intent = "unknown";
  let parseConfidence = 0;
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match && rule.weight > parseConfidence) {
        intent = rule.intent;
        parseConfidence = rule.weight;
        matchedTerms.push(match[0]);
        break;
      }
    }
  }

  const metrics = identifyMetrics(text, registry);
  matchedTerms.push(...metrics.terms);

  // A question naming two metrics is a relationship question regardless of
  // phrasing — "exercise and study accuracy" needs no verb to be clear.
  if (metrics.ids.length >= 2 && (intent === "unknown" || intent === "metric-summary")) {
    intent = "does-x-affect-y";
    parseConfidence = Math.max(parseConfidence, 0.7);
  }
  if (metrics.ids.length === 1 && intent === "unknown") {
    intent = "metric-summary";
    parseConfidence = 0.5;
  }

  // For relationship questions the outcome is the metric with `role: outcome`.
  let outcomeMetricId: string | null = null;
  let exposureMetricId: string | null = null;
  if (metrics.ids.length >= 1) {
    const definitions = metrics.ids.map((id) => registry.get(id)).filter((d): d is MetricDefinition => Boolean(d));
    const outcome = definitions.find((definition) => definition.role === "outcome");
    const driver = definitions.find((definition) => definition.role !== "outcome");
    outcomeMetricId = outcome?.id ?? definitions[0]?.id ?? null;
    exposureMetricId = driver?.id ?? definitions.find((d) => d.id !== outcomeMetricId)?.id ?? null;
  }

  return {
    raw: text,
    intent,
    outcomeMetricId,
    exposureMetricId,
    parseConfidence: intent === "unknown" ? 0 : parseConfidence,
    matchedTerms: [...new Set(matchedTerms)],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identifyMetrics(text: string, registry: MetricRegistry): { ids: string[]; terms: string[] } {
  const lowered = text.toLowerCase();
  const hits: { id: string; term: string; position: number }[] = [];

  for (const [metricId, synonyms] of Object.entries(METRIC_SYNONYMS)) {
    if (!registry.get(metricId)) continue;
    for (const synonym of synonyms) {
      // Word boundaries, not substring matching: without them "airspeed"
      // matches "speed" and Pulse confidently answers a question about
      // swallows with your flashcard response times.
      const match = new RegExp(`\\b${escapeRegExp(synonym)}\\b`).exec(lowered);
      if (match) {
        hits.push({ id: metricId, term: synonym, position: match.index });
        break;
      }
    }
  }

  // Longest-match-first, then by position, so "french recall" beats "recall".
  hits.sort((a, b) => a.position - b.position || b.term.length - a.term.length);
  const ids: string[] = [];
  const terms: string[] = [];
  for (const hit of hits) {
    if (ids.includes(hit.id)) continue;
    ids.push(hit.id);
    terms.push(hit.term);
  }
  return { ids, terms };
}
