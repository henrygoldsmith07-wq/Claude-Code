export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface BiasFlag {
  type: string;
  description: string;
}

export interface ReflectionSummary {
  coreEmotion: string;
  underlyingTriggers: string[];
  possibleBiases: BiasFlag[];
  otherPerspective: string;
  balancedAssessment: string;
  cautionFlags: string[];
  suggestedNextSteps: string[];
}

export interface Entry {
  id: string;
  createdAt: string;
  title: string;
  messages: Message[];
  summary: ReflectionSummary | null;
  status: "in_progress" | "complete";
}

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
