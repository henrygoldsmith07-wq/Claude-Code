// Type-safe schemas for critical high-risk domain logic.
// Runtime validators (no external deps) + TypeScript interfaces for
// placement, progression, marking, learner state, AI structured outputs,
// exam scoring and relay response types.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Skill = 'reading' | 'listening' | 'writing' | 'speaking' | 'grammar' | 'vocabulary' | 'pronunciation';

export interface PlacementResult {
  level: CefrLevel;
  theta: number;
  se: number;
  confidence: number;
  range: string;
  itemsAsked: number;
  correct: number;
  bySkill: Record<string, { asked: number; correct: number; pct: number }>;
  strongest: string | null;
  weakest: string | null;
}

export interface ProgressionEvidence {
  vocabKnown: number;
  grammarMastered: number;
  speakingAvg: number;
  checkpointsPassed: number;
}

export interface LearnerState {
  srs: Record<string, unknown>;
  topicScores: Record<string, number | { best: number }>;
  sessions: Array<{ score?: number; overall?: number; at?: string; date?: string }>;
  metrics: Array<{ skill: string; score: number; at: string }>;
  level: CefrLevel;
}

export type CorrectionLevel = 'definite_error' | 'likely_error' | 'stylistic_suggestion' | 'acceptable_alternative' | 'uncertain';

export interface TurnEvaluation {
  reply: string;
  translation: string;
  corrections: string;
  corrections_detailed: Array<{ original: string; correction: string; level: CorrectionLevel; note: string }>;
  native_alternative: string;
  grammar_topic: string | null;
  scores: { grammar: number; naturalness: number; relevance: number; fluency: number; overall: number };
}

export interface WritingFeedback {
  corrections: string;
  corrections_detailed: Array<{ original: string; correction: string; level: CorrectionLevel; note: string }>;
  strengths: string[];
  suggestions: string[];
  scores: Record<string, number>;
}

export interface ExamTaskScore {
  taskId: string;
  percent: number | null;
  marks: number | null;
  outOf: number;
  bands: Array<{ criterion: string; label: string; desc: string; score: number }>;
  unscored?: string[];
}

export interface RelayChatResponse {
  id?: string;
  object?: string;
  choices: Array<{ message: { role: string; content: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// ---- Runtime validators ----
// Single source of truth lives in aiValidate.js (plain JS, used by groq.js);
// re-exported here so TypeScript consumers share the same behaviour.

export {
  CORRECTION_LEVELS,
  validateTurnEvaluation,
  validateWritingFeedback,
  normalizeCorrectionsDetailed,
} from './aiValidate.js';
