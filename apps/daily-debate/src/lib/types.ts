export type DebateSide = "for" | "against";
export type InputMode = "text" | "voice";

export interface TopicSource {
  name: string;
  homepage: string;
  angle: string;
}

export interface DailyTopic {
  id: string;
  topic_date: string;
  title: string;
  prompt: string;
  category: string | null;
  sources: TopicSource[];
  created_at: string;
}

export interface TurnScores {
  depth: number;
  evidence: number;
  logic: number;
  rebuttal: number;
  clarity: number;
}

export interface SoloDebate {
  id: string;
  user_id: string;
  topic_id: string;
  side: DebateSide;
  status: "active" | "completed";
  round_count: number;
  total_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface SoloDebateTurn {
  id: string;
  debate_id: string;
  round_number: number;
  ai_message: string;
  user_message: string | null;
  input_mode: InputMode;
  scores: TurnScores | null;
  turn_score: number | null;
  feedback: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  total_points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  created_at: string;
}

export interface DebateSummary {
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
}

export const MIN_ROUNDS = 5;
