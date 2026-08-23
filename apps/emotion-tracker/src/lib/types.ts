export type Role = "user" | "assistant";

export type ReflectionMode = "quick" | "full";

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
// event → observations → assumptions → emotion → alternative interpretations → intended outcome → action → predicted outcome → follow-up
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
  // What did I think would happen if I take that action? (prediction to calibrate later)
  predictedOutcome: string;
  // When to check back in (ISO date or free-text like "tomorrow")
  followUpAt: string | null;
  // Free-text outcome recorded later (legacy — prefer Entry.longitudinalReview)
  followUpNote: string | null;
  // One falsification check per assumption, when available: the observable
  // that would count against this reading. Absent on legacy traces.
  assumptionChecks?: AssumptionCheck[];
}

export type AssumptionVerdict = "supported" | "unsupported" | "partial" | "unclear";

export interface LongitudinalReview {
  // What action did I actually take? (may differ from intendedAction)
  actualActionTaken: string | null;
  // What actually happened?
  actualOutcome: string | null;
  // Was my original assumption supported?
  assumptionVerdict: AssumptionVerdict | null;
  // Brief calibration note: what did I learn?
  calibrationNote: string | null;
  // When the review was completed (ISO)
  reviewedAt: string | null;
}

// A concrete, observable check that could prove an assumption wrong —
// what makes an interpretation falsifiable rather than just plausible.
export interface AssumptionCheck {
  // which assumption this belongs to (matches trace.assumptions text)
  assumption: string;
  // the observable that, if true, would count against this reading
  falsifier: string;
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
  // The system's overall confidence in THIS interpretation, 0..1 — the anchor
  // self-calibration is measured against. Absent on legacy summaries.
  overallConfidence?: number | null;
}

export interface Entry {
  id: string;
  createdAt: string;
  title: string;
  messages: Message[];
  summary: ReflectionSummary | null;
  status: "in_progress" | "complete";
  // Existing entries default to full mode when this field is absent.
  mode?: ReflectionMode;
  // Full longitudinal loop — filled after followUpAt, separate from the original trace
  longitudinalReview?: LongitudinalReview | null;
}

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
