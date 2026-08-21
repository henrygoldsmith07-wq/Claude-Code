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

// ---- Runtime validators (pure, no deps) ----

function isCefrLevel(v: unknown): v is CefrLevel {
  return typeof v === 'string' && ['A1','A2','B1','B2','C1','C2'].includes(v);
}

export function validatePlacementResult(o: unknown): o is PlacementResult {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  return isCefrLevel(r.level) && Number.isFinite(r.theta) && Number.isFinite(r.se) && Number.isFinite(r.itemsAsked);
}

export function validateTurnEvaluation(o: unknown): { ok: boolean; error?: string } {
  if (!o || typeof o !== 'object') return { ok: false, error: 'not an object' };
  const j = o as Record<string, unknown>;
  if (typeof j.reply !== 'string' || !j.reply.trim()) return { ok: false, error: 'missing reply' };
  if (typeof j.corrections !== 'string') return { ok: false, error: 'missing corrections' };
  const scores = j.scores as Record<string, unknown> | undefined;
  if (!scores) return { ok: false, error: 'missing scores' };
  for (const k of ['grammar','naturalness','relevance','fluency','overall']) {
    const v = Number(scores[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) return { ok: false, error: `score ${k} invalid` };
  }
  return { ok: true };
}

export function validateWritingFeedback(o: unknown): { ok: boolean; error?: string } {
  if (!o || typeof o !== 'object') return { ok: false, error: 'not an object' };
  const j = o as Record<string, unknown>;
  if (typeof j.corrections !== 'string') return { ok: false, error: 'missing corrections' };
  if (!Array.isArray(j.strengths) || !Array.isArray(j.suggestions)) return { ok: false, error: 'missing strengths/suggestions' };
  return { ok: true };
}

export function validateRelayChatResponse(o: unknown): o is RelayChatResponse {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  if (!Array.isArray(r.choices) || !r.choices.length) return false;
  for (const c of r.choices as Array<unknown>) {
    if (!c || typeof c !== 'object') return false;
    const ch = c as Record<string, unknown>;
    if (!ch.message || typeof (ch.message as Record<string, unknown>).content !== 'string') return false;
  }
  return true;
}
