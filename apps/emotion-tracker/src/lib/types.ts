export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

// Hedged bias flag: avoids false certainty ("you have X") in favour of
// "This interpretation may involve X; here's the evidence for and against".
export interface BiasFlag {
  type: string;
  // Hedged description, e.g. "This reading may involve catastrophizing…"
  description: string;
  // Evidence that the flagged pattern is present
  evidenceFor: string[];
  // Evidence or context that counts against that reading
  evidenceAgainst: string[];
  // 0..1 — how confident the model is that the label applies
  confidence: number;
}

// Structured reflection pipeline:
// event → observations → assumptions → emotion → alternative interpretations → intended outcome → action → follow-up
export interface StructuredTrace {
  event: string;
  // Observable facts only, no mind-reading ("they said X", not "they think Y")
  observations: string[];
  // Unchecked assumptions / inferences the user treated as fact
  assumptions: string[];
  namedEmotion: string;
  // Other plausible readings of the same situation
  alternativeInterpretations: string[];
  // What the user actually wants to happen
  intendedOutcome: string;
  // Chosen next step the user intends to take
  intendedAction: string;
  // When to check back in (ISO date or free-text like "tomorrow")
  followUpAt: string | null;
  // Free-text outcome recorded later
  followUpNote: string | null;
}

export interface ReflectionSummary {
  // What the structured pipeline produced
  trace: StructuredTrace;
  // Back-compat / display convenience — derived from trace
  coreEmotion: string;
  underlyingTriggers: string[];
  possibleBiases: BiasFlag[];
  otherPerspective: string;
  balancedAssessment: string;
  cautionFlags: string[];
  suggestedNextSteps: string[];
  // Short hedged disclaimer when biases were flagged
  hedgedDisclaimer: string | null;
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
