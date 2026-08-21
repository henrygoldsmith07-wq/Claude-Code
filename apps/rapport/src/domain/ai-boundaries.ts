// ---------------------------------------------------------------------------
// AI boundaries.
//
// Deterministic transcript evidence is primary where possible. The model is
// allowed to:
//
//  * extract     — pull signals from text (e.g. reflection summarisation)
//  * explain     — phrase feedback and principles in user-specific terms
//  * personalise — adapt examples to the user's situation
//  * interpret   — offer a hedged possible explanation for a pattern
//
// It is never allowed to silently override the deterministic evidence. Any AI
// output that contains a numeric score, alters which behaviour was flagged,
// or contradicts the counted evidence is rejected and the deterministic fallback
// is shown instead.
//
// Boundaries are enforced in three places:
//
//  1. Prompt level   — house rules forbid inventing numbers
//  2. Schema level   — zod schemas have no score field, so the model cannot
//                      return one without failing validation
//  3. Runtime level  — this module, which checks the returned text against the
//                      evidence and against the behaviour key that was selected
//
// Together this keeps the architecture's promise: with no provider configured,
// nothing is missing; with one, nothing numeric changes.
// ---------------------------------------------------------------------------

import type { BehaviourKey } from "./types";
import { checkGeneratedContent, checkFeedbackLanguage } from "./safety";

export type AiRole = "extraction" | "explanation" | "personalisation" | "contextual-interpretation";

export const AI_ALLOWED_ROLES: Record<string, AiRole[]> = {
  "simulate-turn": ["personalisation"],
  "phrase-feedback": ["explanation", "personalisation"],
  "summarise-reflection": ["extraction"],
  "explain-insight": ["contextual-interpretation", "explanation"],
  "coach-explain": ["explanation", "personalisation"],
  "enrich-scenario": ["personalisation"],
};

export interface AiBoundaryCheck {
  task: string;
  ok: boolean;
  reason?: string;
  fallbackMessage: string;
}

/**
 * Validate an AI response against deterministic evidence.
 *
 * @param task            The AI task that was run
 * @param aiData          The parsed AI response object (unknown)
 * @param deterministic   The deterministic source of truth for this task
 */
export function checkAiBoundary(
  task: string,
  aiData: unknown,
  deterministic: { behaviour?: BehaviourKey; evidence?: string; scores?: { key: BehaviourKey; score: number }[] },
): AiBoundaryCheck {
  const fallbackBase = "Showing the built-in version — the model's reply did not pass the boundary check.";

  // Global: no AI output may contain a numeric score that would override deterministic evidence
  if (aiData && typeof aiData === "object") {
    const text = JSON.stringify(aiData);
    // Scores in AI output that look like invented metrics: "score: 0.8" or "8/10"
    const scoreLike = /\b(score\s*[:=]\s*0\.\d+|\d\s*\/\s*10|rated\s+your\s+\w+\s+as\s+\d)/i;
    if (scoreLike.test(text) && task !== "simulate-turn") {
      // Only allow scores when they exactly match a deterministic score that was passed in
      const hasMatchingScore = deterministic.scores?.some((s) => text.includes(String(s.score)) || text.includes(String(Math.round(s.score * 10)))) ?? false;
      if (!hasMatchingScore) {
        return { task, ok: false, reason: "AI output contained a score not present in deterministic evidence.", fallbackMessage: fallbackBase };
      }
    }
  }

  // Task-specific: phrase-feedback must not change which behaviour is flagged
  if (task === "phrase-feedback" && deterministic.behaviour && aiData && typeof aiData === "object") {
    const obj = aiData as Record<string, unknown>;
    // If observation mentions a different behaviour label strongly, flag it. We check the text vs expected behaviour
    const aiText = `${obj.observation ?? ""} ${obj.principle ?? ""}`.toLowerCase();
    // Allowed to mention other behaviours as "what worked", but must not claim a different "one thing worth changing"
    // Simple check: if AI observation explicitly names a different behaviour as "weakness", reject. Hard to detect perfectly; require evidence grounding instead.
    if (typeof obj.observation === "string" && obj.observation.length > 20) {
      // Ensure observation contains a countable number or a quote-relevant fragment, otherwise it is generic and might be ungrounded
      const hasEvidenceHint = /\d/.test(obj.observation) || aiText.includes(deterministic.behaviour) || aiText.includes(deterministic.evidence?.toLowerCase().slice(0, 20) ?? "");
      if (!hasEvidenceHint && aiText.length > 100) {
        return { task, ok: false, reason: "phrase-feedback AI text appears ungrounded in deterministic evidence.", fallbackMessage: fallbackBase };
      }
    }
  }

  // Safety gates are always applied — AI must not bypass them
  if (aiData && typeof aiData === "object") {
    const text = Object.values(aiData).flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])).join("\n");
    const safety = checkGeneratedContent(text);
    if (safety.verdict !== "ok") return { task, ok: false, reason: safety.message ?? "Generated content failed safety check.", fallbackMessage: safety.message ?? fallbackBase };
    if (task === "phrase-feedback" || task === "coach-explain" || task === "explain-insight") {
      const lang = checkFeedbackLanguage(text);
      if (lang.verdict !== "ok") return { task, ok: false, reason: lang.message ?? "Feedback language check failed.", fallbackMessage: lang.message ?? fallbackBase };
    }
  }

  return { task, ok: true, fallbackMessage: "" };
}

/**
 * Whether a task is allowed to read a transcript. Transcripts contain sensitive
 * text; only tasks that need them should receive them.
 */
export function aiMayReadTranscript(task: string): boolean {
  return task === "phrase-feedback" || task === "simulate-turn";
}

export function aiMayReadReflection(task: string): boolean {
  return task === "summarise-reflection";
}

export const AI_BOUNDARY_NOTE =
  "Scores, behaviour selection and evidence are computed on-device from transcript features. " +
  "The model, where configured, rephrases feedback and plays characters — and its output is validated " +
  "against the deterministic evidence before display, with the built-in version shown on failure.";
