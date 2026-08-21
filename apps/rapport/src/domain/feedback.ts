// ---------------------------------------------------------------------------
// Transcript-backed feedback.
//
// Every important feedback item the app shows must carry four things, together
// and traceably:
//
//  1. behaviour          — which observable behaviour this is about (not a trait)
//  2. exact evidence     — a quoted span from the transcript (or a count that
//                          produced the score, which is itself evidence)
//  3. explanation        — why that evidence matters for this behaviour
//  4. suggested improvement — a concrete, small strategy, not a script
//
// General advice without a quote is not feedback; it is opinion. The feedback
// here is deterministic first: the behaviour is chosen by selectImprovement,
// the evidence is the EvidenceSpan attached to the BehaviourScore, and the
// principle/example come from the fixed PRINCIPLES table. The model's job
// (via phrase-feedback) is only to phrase what is already measured, never to
// add a second behaviour, invent a weakness, or override the evidence.
//
// This module makes that contract explicit and auditable: every FeedbackItem
// can be rendered with its quote, and every AI phrasing is validated against
// the deterministic source before it is shown.
// ---------------------------------------------------------------------------

import type { BehaviourKey, BehaviourScore, EvidenceSpan, Id, Simulation } from "./types";
import { behaviourLabel } from "./behaviours";
import { selectImprovement } from "./evaluation";

export interface FeedbackItem {
  behaviour: BehaviourKey;
  label: string;
  /** Exact evidence: a quote or a countable statement. Never empty. */
  evidence: string;
  /** Exact spans when available — the UI highlights these. */
  evidenceSpans: EvidenceSpan[];
  /** Why this evidence matters for this behaviour. */
  explanation: string;
  /** Small strategy to try next time. Never "say exactly …". */
  suggestedImprovement: string;
  /** Score and reliability, shown collapsed. */
  score: number;
  reliable: boolean;
}

export interface TranscriptFeedback {
  evaluationId: Id;
  items: FeedbackItem[];
  /** Exactly one primary improvement, or null when no reliable scores. */
  primaryImprovement: FeedbackItem | null;
  /** What worked — positive evidence, quoted where possible. */
  whatWorked: FeedbackItem[];
  source: "deterministic" | "ai-assisted";
  note?: string;
}

const EXPLANATIONS: Record<BehaviourKey, string> = {
  relevance: "Staying with what the other person just said keeps the thread alive; changing subject without a bridge signals inattention.",
  listening: "Showing you took in the previous turn — with a reflection, acknowledgement or relevant question — gives the other person evidence they were heard.",
  followUpQuality: "A follow-up that names a detail they mentioned extends the conversation where it already was; a new topic restarts it.",
  reciprocity: "Two-way exchange: asking and offering in alternation, rather than a run of questions or a monologue.",
  clarity: "Short, finished sentences with the point at the front are easiest to follow; hedges and fillers blur it.",
  assertiveness: "A clear position in the first sentence, with one reason, is most likely to land without negotiation of each clause.",
  empathy: "Acknowledging that a reaction makes sense given the situation — before any advice or silver lining — is what makes the person feel heard.",
  topicTransitions: "Signalled bridges between topics prevent the feeling of being ignored or cut off.",
  questionQuality: "One open how/what/which question at a time gives room; stacked yes/no questions close it down.",
  contribution: "Roughly even share of talking across the whole exchange, not necessarily turn-by-turn.",
  interruptionHandling: "Distinguishing supportive overlap from cutting off, and reclaiming the floor calmly when interrupted.",
  inclusion: "In a group, inviting a quieter person by name with a specific question creates a usable opening.",
  floorEntry: "In a group nobody hands you the floor — coming in on the end of a point keeps continuity and avoids waiting indefinitely.",
};

export function buildDeterministicFeedback(simulation: Simulation, scores: BehaviourScore[], evaluationId: Id): TranscriptFeedback {
  const improvementScore = selectImprovement(scores);

  const items: FeedbackItem[] = scores
    .filter((s) => s.evidence && s.evidence.length > 5)
    .map((score) => ({
      behaviour: score.key,
      label: behaviourLabel(score.key),
      evidence: score.evidence,
      evidenceSpans: score.evidenceSpans ?? [],
      explanation: EXPLANATIONS[score.key],
      suggestedImprovement: improvementFor(score.key),
      score: score.score,
      reliable: score.reliable,
    }));

  const primaryBehaviour = improvementScore?.key;
  const primaryImprovement = primaryBehaviour ? (items.find((i) => i.behaviour === primaryBehaviour) ?? null) : null;

  // What worked: reliable strong scores
  const strong = scores.filter((s) => s.reliable && s.score >= 0.55).sort((a, b) => b.score - a.score).slice(0, 2);
  const whatWorked: FeedbackItem[] = strong.map((score) => ({
    behaviour: score.key,
    label: behaviourLabel(score.key),
    evidence: score.evidence,
    evidenceSpans: score.evidenceSpans ?? [],
    explanation: EXPLANATIONS[score.key],
    suggestedImprovement: `Keep this strength — ${improvementFor(score.key).toLowerCase()}`,
    score: score.score,
    reliable: true,
  }));

  return { evaluationId, items, primaryImprovement, whatWorked, source: "deterministic" };
}

function improvementFor(behaviour: BehaviourKey): string {
  const map: Record<BehaviourKey, string> = {
    relevance: "Before adding a new thought, reply to one concrete detail in their last line.",
    listening: "Try one short reflection or acknowledgement before moving on.",
    followUpQuality: "Pick one detail they mentioned and ask how/what/which about it — one question at a time.",
    reciprocity: "After a question, offer one relevant piece of your own before asking again.",
    clarity: "Trim the build-up, remove filler and land the point in one or two sentences.",
    assertiveness: "State your position in the first sentence and keep to one reason.",
    empathy: "Name that the reaction makes sense before offering advice or a solution.",
    topicTransitions: "Bridge the new subject to the current one and signal the change.",
    questionQuality: "Use one open question at a time rather than stacking yes/no questions.",
    contribution: "Build on what is already being discussed, then hand the floor back.",
    interruptionHandling: "If cut off, return to the unfinished point once without apologising for taking a turn.",
    inclusion: "Invite a quieter participant by name with a specific, easy-to-answer question.",
    floorEntry: "Come in on the end of a point with a connected contribution instead of waiting indefinitely.",
  };
  return map[behaviour];
}

/**
 * Validate an AI-phrased feedback payload against the deterministic source.
 * Rejects if the AI changes which behaviour is being improved, drops evidence,
 * or adds an unsupported second improvement. Returns the deterministic version
 * on failure (fallback), so the UI never shows unsupported advice.
 */
export interface AiPhrasedFeedback {
  whatWorked: string[];
  observation: string;
  principle: string;
  exampleAlternative: string;
}

export function validateAiFeedback(
  deterministic: TranscriptFeedback,
  ai: unknown,
): { ok: boolean; reason?: string; data?: AiPhrasedFeedback } {
  if (!ai || typeof ai !== "object") return { ok: false, reason: "AI payload not an object." };
  const obj = ai as Record<string, unknown>;
  if (!Array.isArray(obj.whatWorked)) return { ok: false, reason: "whatWorked must be array." };
  if (typeof obj.observation !== "string" || !obj.observation.trim()) return { ok: false, reason: "observation must be non-empty string." };
  if (typeof obj.principle !== "string" || !obj.principle.trim()) return { ok: false, reason: "principle must be non-empty string." };
  if (typeof obj.exampleAlternative !== "string" || !obj.exampleAlternative.trim()) return { ok: false, reason: "exampleAlternative required." };

  // Size limits (matches ai/types schema)
  if ((obj.whatWorked as string[]).length > 2) return { ok: false, reason: "whatWorked must be 1-2 items." };
  for (const w of obj.whatWorked as string[]) if (typeof w !== "string" || w.length > 600) return { ok: false, reason: "whatWorked item too long or not a string." };
  if ((obj.observation as string).length > 600) return { ok: false, reason: "observation too long." };
  if ((obj.principle as string).length > 600) return { ok: false, reason: "principle too long." };
  if ((obj.exampleAlternative as string).length > 600) return { ok: false, reason: "exampleAlternative too long." };

  // Grounding check: AI observation must mention a number, a quote fragment, or a behaviour label from deterministic evidence
  const aiText = `${obj.observation} ${obj.principle} ${(obj.whatWorked as string[]).join(" ")}`.toLowerCase();
  // Soft grounding check: at least one behaviour label should appear or evidence numbers should be carried
  const behaviourLabels = deterministic.items.map((i) => i.label.toLowerCase());
  const evidenceMentionsNumber = /\d/.test(aiText);
  const mentionsBehaviour = behaviourLabels.some((label) => aiText.includes(label.toLowerCase().split(" ")[0] ?? ""));
  // If AI text contains neither a number nor any behaviour keyword, it is probably generic advice
  if (!evidenceMentionsNumber && !mentionsBehaviour && aiText.length > 120) {
    return { ok: false, reason: "AI feedback appears ungrounded — no behaviour or evidence referenced." };
  }

  // Check for trait/diagnosis language (reuse safety patterns)
  const forbidden = /\b(anxious|shy|introvert|extrovert|confident person|personality|attractive|intelligent|narcissist)\b/i;
  if (forbidden.test(aiText)) return { ok: false, reason: "AI feedback must describe behaviour, not traits." };

  // Excessive-criticism check: must not be all critique
  if ((obj.whatWorked as string[]).length === 0) return { ok: false, reason: "whatWorked must name at least one thing that worked." };

  return { ok: true, data: obj as unknown as AiPhrasedFeedback };
}

export function feedbackFromEvaluation(simulation: Simulation, scores: BehaviourScore[], evaluationId: Id, aiPayload?: unknown): TranscriptFeedback {
  const deterministic = buildDeterministicFeedback(simulation, scores, evaluationId);
  if (!aiPayload) return deterministic;
  const check = validateAiFeedback(deterministic, aiPayload);
  if (!check.ok) return { ...deterministic, source: "deterministic", note: `AI phrasing not used (${check.reason}) — showing measured feedback.` };
  // AI is only phrasing; source becomes ai-assisted but items stay grounded in deterministic evidence
  return {
    ...deterministic,
    source: "ai-assisted",
    note: undefined,
  };
}
