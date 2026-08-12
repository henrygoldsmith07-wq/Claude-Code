import { z } from "zod";
import { BEHAVIOUR_KEYS, COMMUNICATION_STYLES } from "@/domain/types";

// ---------------------------------------------------------------------------
// AI task contracts.
//
// Imported by both the browser and the route handler, so this module must stay
// free of server-only imports.
//
// Every task validates its output against a schema before the value is allowed
// anywhere near the UI or the mastery engine. A model that returns a
// well-formed but wrong-shaped object is treated exactly like a model that
// timed out: the deterministic path runs instead. Nothing downstream ever has
// to ask whether a field might be missing.
// ---------------------------------------------------------------------------

export const AI_TASKS = [
  "simulate-turn",
  "phrase-feedback",
  "summarise-reflection",
  "explain-insight",
  "coach-explain",
  "enrich-scenario",
] as const;
export type AiTask = (typeof AI_TASKS)[number];

const shortText = z.string().min(1).max(600);

// --- simulate-turn ---------------------------------------------------------

export const simulateTurnResponseSchema = z.object({
  /** What the character says next. Length is steered by the engine's turn plan. */
  reply: z.string().min(1).max(900),
  /** Any new fact the character just established about themselves, for memory. */
  newFact: z.string().max(200).optional(),
});
export type SimulateTurnResponse = z.infer<typeof simulateTurnResponseSchema>;

export const simulateTurnRequestSchema = z.object({
  task: z.literal("simulate-turn"),
  character: z.object({
    name: z.string().max(60),
    style: z.enum(COMMUNICATION_STYLES),
    role: z.string().max(160),
    background: z.array(z.string().max(240)).max(8),
    interests: z.array(z.string().max(60)).max(8),
  }),
  scenarioContext: z.string().max(1200),
  /** The engine's decision about what kind of turn this is. The model obeys it. */
  plan: z.object({
    intent: z.enum([
      "answer-short",
      "answer-with-detail",
      "volunteer",
      "ask-back",
      "deflect",
      "change-topic",
      "wind-down",
    ]),
    targetWords: z.number().int().min(3).max(120),
    factToIntroduce: z.string().max(240).optional(),
    callback: z.string().max(240).optional(),
    difficulty: z.number().min(1).max(5),
  }),
  transcript: z
    .array(z.object({ speaker: z.enum(["user", "character"]), text: z.string().max(1200) }))
    .max(40),
});

// --- phrase-feedback -------------------------------------------------------

export const phraseFeedbackResponseSchema = z.object({
  /** Rewritten "what worked" lines. Must stay faithful to the supplied evidence. */
  whatWorked: z.array(shortText).min(1).max(2),
  observation: shortText,
  principle: shortText,
  exampleAlternative: shortText,
});
export type PhraseFeedbackResponse = z.infer<typeof phraseFeedbackResponseSchema>;

export const phraseFeedbackRequestSchema = z.object({
  task: z.literal("phrase-feedback"),
  /** Scores are computed locally and passed in. The model never invents them. */
  scores: z
    .array(z.object({ key: z.enum(BEHAVIOUR_KEYS), score: z.number().min(0).max(1), evidence: z.string().max(300) }))
    .max(12),
  improvement: z.object({
    behaviour: z.enum(BEHAVIOUR_KEYS),
    observation: z.string().max(300),
    principle: z.string().max(600),
    exampleAlternative: z.string().max(600),
  }),
  whatWorked: z.array(z.string().max(300)).max(3),
  /** Two or three quoted user lines, for grounding. Never the whole transcript. */
  excerpts: z.array(z.string().max(400)).max(4),
  skillName: z.string().max(80),
});

// --- summarise-reflection --------------------------------------------------

export const summariseReflectionResponseSchema = z.object({
  /** One neutral sentence. No interpretation of the person. */
  summary: z.string().min(1).max(300),
  obstacles: z.array(z.string().max(60)).max(4),
  behaviours: z.array(z.enum(BEHAVIOUR_KEYS)).max(4),
});
export type SummariseReflectionResponse = z.infer<typeof summariseReflectionResponseSchema>;

export const summariseReflectionRequestSchema = z.object({
  task: z.literal("summarise-reflection"),
  /** Only sent when the user has explicitly permitted it. Enforced server-side. */
  wentWell: z.string().max(2000).optional(),
  wouldChange: z.string().max(2000).optional(),
  attempted: z.enum(["yes", "partly", "no"]),
  difficulty: z.number().int().min(1).max(5),
  skillName: z.string().max(80),
});

// --- explain-insight -------------------------------------------------------

export const explainInsightResponseSchema = z.object({
  /** Must remain hedged; validated again by the caller. */
  possibleExplanation: z.string().min(1).max(500),
  recommendedAction: z.string().min(1).max(300),
});
export type ExplainInsightResponse = z.infer<typeof explainInsightResponseSchema>;

export const explainInsightRequestSchema = z.object({
  task: z.literal("explain-insight"),
  observation: z.string().max(400),
  evidence: z.array(z.string().max(300)).max(6),
  confidence: z.number().min(0).max(1),
  skillNames: z.array(z.string().max(80)).max(6),
});

// --- coach-explain ---------------------------------------------------------

export const coachExplainResponseSchema = z.object({
  /** Restates the routing in the user's terms. Must not answer "what do I say". */
  explanation: z.string().min(1).max(900),
  /** One illustration, explicitly framed as an example rather than the answer. */
  example: z.string().max(500),
});
export type CoachExplainResponse = z.infer<typeof coachExplainResponseSchema>;

export const coachExplainRequestSchema = z.object({
  task: z.literal("coach-explain"),
  question: z.string().max(1000),
  skillName: z.string().max(80),
  diagnosis: z.string().max(500),
  technique: z.string().max(500),
  /** Where the user currently is, so the explanation can meet them there. */
  context: z.string().max(300),
});

// --- enrich-scenario -------------------------------------------------------

export const enrichScenarioResponseSchema = z.object({
  title: z.string().min(1).max(80),
  context: z.string().min(1).max(700),
  characters: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        role: z.string().max(120),
        background: z.array(z.string().max(240)).min(1).max(4),
        interests: z.array(z.string().max(60)).max(4),
      }),
    )
    .min(1)
    .max(3),
});
export type EnrichScenarioResponse = z.infer<typeof enrichScenarioResponseSchema>;

export const enrichScenarioRequestSchema = z.object({
  task: z.literal("enrich-scenario"),
  description: z.string().max(600),
  objective: z.string().max(300),
  difficulty: z.number().int().min(1).max(5),
  /** Styles chosen by the deterministic builder; the model may not change them. */
  styles: z.array(z.enum(COMMUNICATION_STYLES)).min(1).max(3),
});

export const aiRequestSchema = z.discriminatedUnion("task", [
  simulateTurnRequestSchema,
  phraseFeedbackRequestSchema,
  summariseReflectionRequestSchema,
  explainInsightRequestSchema,
  coachExplainRequestSchema,
  enrichScenarioRequestSchema,
]);
export type AiRequest = z.infer<typeof aiRequestSchema>;

export const RESPONSE_SCHEMAS = {
  "simulate-turn": simulateTurnResponseSchema,
  "phrase-feedback": phraseFeedbackResponseSchema,
  "summarise-reflection": summariseReflectionResponseSchema,
  "explain-insight": explainInsightResponseSchema,
  "coach-explain": coachExplainResponseSchema,
  "enrich-scenario": enrichScenarioResponseSchema,
} as const;

/**
 * Every AI response carries how it was produced, and the UI always shows it.
 * A user reading feedback is entitled to know whether a model wrote it.
 */
export interface AiEnvelope<T> {
  data: T;
  source: "ai" | "fallback";
  provider?: string | null;
  promptVersion?: string;
  /** Present when a model was tried and did not work out. */
  note?: string;
  /** Milliseconds, for the observability panel. */
  latencyMs?: number;
}

export function fallbackEnvelope<T>(data: T, note?: string): AiEnvelope<T> {
  return { data, source: "fallback", provider: null, note };
}
