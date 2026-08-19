// ---------------------------------------------------------------------------
// The complete data model.
//
// Two rules shape every type here:
//
//  1. Competence and confidence are separate variables. A user can be good at
//     saying no and still dread it; training that conflates the two prescribes
//     the wrong exercise in both directions.
//  2. Evidence is kept, not just its summary. Every mastery number is derived
//     from an append-only event log (see events.ts), so when the scoring model
//     improves, history is recomputed rather than lost.
// ---------------------------------------------------------------------------

export type Id = string;
/** YYYY-MM-DD in the user's local timezone. */
export type IsoDate = string;
/** Full ISO-8601 instant. */
export type IsoInstant = string;

// --- Skill graph -----------------------------------------------------------

export const SKILL_DOMAINS = [
  "conversation",
  "confidence",
  "non-verbal",
  "relationships",
  "assertiveness",
  "empathy",
  "group",
  "difficult",
  "digital",
  "leadership",
] as const;
export type SkillDomain = (typeof SKILL_DOMAINS)[number];

/** Bands are a readable projection of a continuous mastery value, never a label for the person. */
export const SKILL_STATES = ["developing", "functional", "strong", "advanced"] as const;
export type SkillState = (typeof SKILL_STATES)[number];

export interface Skill {
  id: Id;
  domain: SkillDomain;
  name: string;
  /** One sentence, phrased as an observable behaviour. */
  summary: string;
  /** Behaviours a trained observer could tick off. Drives evaluation and challenge criteria. */
  behaviours: string[];
  /** Roughly how demanding the skill is in isolation, 1 (approachable) to 5 (advanced). */
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
  /** Contexts where the skill applies; used for contextual relevance in the recommender. */
  contexts: TrainingContext[];
}

/** Directed edge: `skill` is easier to learn once `requires` is at least `minMastery`. */
export interface SkillDependency {
  skill: Id;
  requires: Id;
  /** 0-1. Soft gate: below this the recommender routes to the prerequisite instead. */
  minMastery: number;
  /** Why the dependency exists — shown to the user so the graph is not a black box. */
  rationale: string;
}

export const TRAINING_CONTEXTS = [
  "work",
  "study",
  "social",
  "family",
  "strangers",
  "online",
] as const;
export type TrainingContext = (typeof TRAINING_CONTEXTS)[number];

// --- User, goals, preferences ----------------------------------------------

export interface User {
  id: Id;
  /** Display name only; never required, never shared. */
  displayName: string;
  createdAt: IsoInstant;
  /** Local timezone offset in minutes, captured so streaks respect the user's day. */
  timezoneOffsetMinutes: number;
}

export interface Goal {
  id: Id;
  userId: Id;
  /** The user's own words. Never rewritten by the system. */
  statement: string;
  /** Skills the goal maps onto, resolved at creation and revisable. */
  skillIds: Id[];
  contexts: TrainingContext[];
  createdAt: IsoInstant;
  archivedAt?: IsoInstant;
}

export type TrainingIntensity = "light" | "steady" | "focused";

export interface Preference {
  userId: Id;
  intensity: TrainingIntensity;
  /** Target minutes for a daily session. Derived from intensity but user-editable. */
  sessionMinutes: number;
  contexts: TrainingContext[];
  /** Opt-in, default false. Nothing leaves the device while this is false. */
  syncEnabled: boolean;
  /** Opt-in, default false. Governs whether reflection text may be sent to a model. */
  aiMayReadReflections: boolean;
  /** Opt-in, default false. Explicit, separate permission — never bundled with the above. */
  allowModelTraining: boolean;
  /** Days after which raw reflection text is deleted locally. 0 = keep indefinitely. */
  retentionDays: number;
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  /** Voice practice needs microphone access; kept off until asked for. */
  voiceEnabled: boolean;
  /** How much scaffolding the simulator offers. Auto-decays as competence rises. */
  assistLevel: AssistLevel;
  updatedAt: IsoInstant;
}

/** Suggestion density inside practice. "none" is the goal state, not a punishment. */
export const ASSIST_LEVELS = ["full", "partial", "minimal", "none"] as const;
export type AssistLevel = (typeof ASSIST_LEVELS)[number];

// --- Skill state -----------------------------------------------------------

export interface UserSkillState {
  userId: Id;
  skillId: Id;
  /** 0-1 estimated competence. */
  mastery: number;
  /** 0-1 standard-deviation-like uncertainty on `mastery`. High = the app is guessing. */
  masteryUncertainty: number;
  /** 0-1 self-reported/observed comfort. Tracked independently of mastery. */
  confidence: number;
  confidenceUncertainty: number;
  attemptCount: number;
  /** Distinct pieces of corroborating evidence (real-world attempts count double). */
  successEvidence: number;
  /** 1-5. The hardest difficulty the user has recently handled without failing. */
  difficultyTolerance: number;
  lastPractisedAt?: IsoInstant;
  /** 0-1 estimated current retention, decayed from lastPractisedAt. */
  retentionEstimate: number;
  /** Set when the user overrides the system's estimate; suppresses auto-correction for a while. */
  userAssertedAt?: IsoInstant;
  updatedAt: IsoInstant;
}

// --- Assessment ------------------------------------------------------------

export interface AssessmentAnswer {
  questionId: string;
  /** Index into the question's options, or a free-text value for open questions. */
  value: string | number | string[];
}

export interface Assessment {
  id: Id;
  userId: Id;
  kind: "onboarding" | "recheck";
  answers: AssessmentAnswer[];
  createdAt: IsoInstant;
}

// --- Content ---------------------------------------------------------------

export interface LessonSource {
  /** Short citation, e.g. "Gordon (1970), Parent Effectiveness Training". */
  citation: string;
  /** What the source actually supports, so a reader can audit the claim. */
  claim: string;
  /** How well-supported the claim is. Shown when a user asks "says who?". */
  strength: "strong" | "moderate" | "practitioner-consensus";
  url?: string;
}

export interface Lesson {
  id: Id;
  skillId: Id;
  title: string;
  /** ~1-3 minutes of reading. Enforced by scripts/validate-content.mjs. */
  concept: string;
  whyItMatters: string;
  example: string;
  practice: string;
  commonMistake: string;
  realWorldApplication: string;
  sources: LessonSource[];
  estimatedMinutes: number;
  version: number;
}

export type ExerciseKind = "recall" | "rewrite" | "choose" | "plan";

export interface Exercise {
  id: Id;
  skillId: Id;
  kind: ExerciseKind;
  prompt: string;
  /** For `choose`: the options. For others: worked examples of good responses. */
  options?: string[];
  /** Index of the strongest option, where one exists. Never framed as "the only right answer". */
  bestOptionIndex?: number;
  /** What makes a response strong — used for self-marking and AI evaluation alike. */
  criteria: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Generated exercises carry the weakness that produced them. */
  generatedFrom?: { evaluationId: Id; behaviour: string };
}

// --- Simulation ------------------------------------------------------------

export const COMMUNICATION_STYLES = [
  "talkative",
  "quiet",
  "distracted",
  "friendly",
  "direct",
  "uncertain",
  "enthusiastic",
] as const;
export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

export interface SimulatedCharacter {
  id: Id;
  name: string;
  style: CommunicationStyle;
  /** Situational role, e.g. "colleague on your project team". Never a demographic stereotype. */
  role: string;
  /** Facts the character knows about themselves; the source of conversational memory. */
  background: string[];
  /** Interests they will follow up on if the user opens the door. */
  interests: string[];
  /** 0-1. How much unprompted material they volunteer. Low = the user must work. */
  openness: number;
  /** 0-1. How much they reciprocate questions. Low = the user must not rely on being asked. */
  reciprocity: number;
}

export interface SimulationScenario {
  id: Id;
  title: string;
  /** Where this happens and what has just occurred. */
  context: string;
  skillIds: Id[];
  objective: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  characters: SimulatedCharacter[];
  /** Conversational directions the scenario is expected to take. Guides the character engine. */
  branches: string[];
  /** Behaviours this scenario is set up to elicit and evaluate. */
  evaluationCriteria: BehaviourKey[];
  /** Present when the user described the situation themselves. */
  authoredBy?: "system" | "user" | "ai";
  /** Set for user/AI-authored scenarios that passed the safety gate. */
  safetyCheckedAt?: IsoInstant;
}

export interface SimulationTurn {
  id: Id;
  simulationId: Id;
  index: number;
  speaker: "user" | "character";
  characterId?: Id;
  text: string;
  /** Milliseconds the user took to reply. Used only for voice/pace metrics, never for scoring text. */
  latencyMs?: number;
  createdAt: IsoInstant;
  /** Populated for voice turns. */
  voice?: VoiceTurnMetrics;
}

export interface Simulation {
  id: Id;
  userId: Id;
  scenarioId: Id;
  /** Snapshot: scenarios can be generated, so the transcript keeps its own copy. */
  scenario: SimulationScenario;
  mode: "text" | "voice";
  startedAt: IsoInstant;
  endedAt?: IsoInstant;
  /** Difficulty actually delivered, which drifts within the session. */
  deliveredDifficulty: number;
  assistLevel: AssistLevel;
  turns: SimulationTurn[];
}

/** The observable behaviours the evaluator scores. Deliberately not personality traits. */
export const BEHAVIOUR_KEYS = [
  "relevance",
  "listening",
  "followUpQuality",
  "reciprocity",
  "clarity",
  "assertiveness",
  "empathy",
  "topicTransitions",
  "questionQuality",
  "contribution",
  // Group only — see MULTI_PARTY_BEHAVIOURS below.
  "inclusion",
  "floorEntry",
] as const;
export type BehaviourKey = (typeof BEHAVIOUR_KEYS)[number];

/**
 * Behaviours that only exist when there is more than one other person present.
 *
 * `scoreTranscript` drops these from a one-to-one transcript rather than
 * scoring them low. "Did you bring the quiet one in?" is not a question a
 * two-person conversation can answer, and answering it anyway would invent a
 * weakness out of a situation that could not have displayed the behaviour —
 * which would then feed the mastery model as though it were evidence.
 */
export const MULTI_PARTY_BEHAVIOURS: readonly BehaviourKey[] = ["inclusion", "floorEntry"];

export interface BehaviourScore {
  key: BehaviourKey;
  /** 0-1, computed from countable transcript features — not asked of a model. */
  score: number;
  /** The countable evidence, e.g. "4 of 6 replies referenced their previous turn". */
  evidence: string;
  /** False when the transcript was too short to judge; such scores never move mastery. */
  reliable: boolean;
  /**
   * 0-1: how much of a low score reflects something actively done (minimising
   * a feeling, talking over the whole exchange) rather than something merely
   * absent. Used only to break ties when choosing which single improvement to
   * name — "you did X" is more useful feedback than "you didn't do Y".
   */
  severity?: number;
}

export interface SimulationEvaluation {
  id: Id;
  simulationId: Id;
  userId: Id;
  scores: BehaviourScore[];
  /** Specific things the user actually did, quoted from the transcript. */
  whatWorked: string[];
  /** Exactly one. Overwhelming users with a list is how feedback stops being used. */
  highestImpactImprovement: {
    behaviour: BehaviourKey;
    observation: string;
    principle: string;
    /** An illustration, explicitly not "the correct answer". */
    exampleAlternative: string;
  };
  /** Generated from the weakness above. */
  nextExercise: Exercise;
  /** How this evaluation was produced. Always shown in the UI. */
  source: "deterministic" | "ai-assisted";
  promptVersion?: string;
  createdAt: IsoInstant;
}

// --- Challenges and reflection --------------------------------------------

export interface Challenge {
  id: Id;
  skillId: Id;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** What to do, in one line, phrased as an action the user controls. */
  objective: string;
  /** Where and when this makes sense. */
  context: string;
  /** How the user knows they did it. Never "they responded well". */
  completionCriteria: string[];
  easierVariant?: string;
  harderVariant?: string;
  /** The reflection prompt shown afterwards, tailored to the challenge. */
  reflectionPrompt: string;
  contexts: TrainingContext[];
  /** Generated challenges record their origin so they can be audited. */
  generated?: boolean;
}

export type ChallengeOutcome = "yes" | "partly" | "no" | "no-opportunity" | "wrong-situation";

export interface ChallengeAttempt {
  id: Id;
  userId: Id;
  challengeId: Id;
  /** Snapshot so history survives content edits. */
  challenge: Challenge;
  assignedAt: IsoInstant;
  completedAt?: IsoInstant;
  skippedAt?: IsoInstant;
  /** The user asked to try this later; postponement is never scored as failure. */
  postponedUntil?: IsoDate;
  /** In-app reminder time for the real-world challenge. */
  reminderAt?: IsoInstant;
  /** Set when the user swapped this challenge out. Never counted against them. */
  replacedByAttemptId?: Id;
  outcome?: ChallengeOutcome;
  /** 1-5 as reported by the user. The primary difficulty-trend signal. */
  perceivedDifficulty?: number;
}

export interface Reflection {
  id: Id;
  userId: Id;
  /** What this reflection is about. */
  subject: { kind: "challenge"; attemptId: Id } | { kind: "simulation"; simulationId: Id } | { kind: "freeform" };
  attempted: ChallengeOutcome;
  difficulty: number;
  wentWell?: string;
  wouldChange?: string;
  /** Skills the user says were involved. Optional; the system infers the rest. */
  skillIds: Id[];
  createdAt: IsoInstant;
  /** Set once the retention policy has scrubbed the free text but kept the signals. */
  redactedAt?: IsoInstant;
}

/** Non-diagnostic signals lifted from a reflection. Never a psychological interpretation. */
export interface ReflectionSignal {
  reflectionId: Id;
  /** Behaviours the user described doing, matched to skill behaviours. */
  behavioursMentioned: BehaviourKey[];
  /** -1..1 self-evaluation direction, from the user's own framing. */
  selfAppraisal: number;
  /** Named obstacles, e.g. "no opening", "interrupted". Descriptive, not clinical. */
  obstacles: string[];
  source: "deterministic" | "ai-assisted";
}

// --- Sessions --------------------------------------------------------------

export type SessionStepKind = "lesson" | "exercise" | "simulation" | "challenge" | "reflection";

export interface SessionStep {
  kind: SessionStepKind;
  refId: Id;
  /** Filled once the step is done; steps are never mandatory. */
  completedAt?: IsoInstant;
  estimatedMinutes: number;
  /** Shown under the step so the user always knows why it is there. */
  reason: string;
}

export interface TrainingSession {
  id: Id;
  userId: Id;
  date: IsoDate;
  /** The single skill the day is built around. */
  focusSkillId: Id;
  /** Plain-language justification, surfaced on the home screen. */
  focusReason: string;
  steps: SessionStep[];
  startedAt?: IsoInstant;
  completedAt?: IsoInstant;
}

// --- Analytics -------------------------------------------------------------

export interface Insight {
  id: Id;
  userId: Id;
  /** What the data shows, stated without interpretation. */
  observation: string;
  /** The counts and comparisons behind it, so the user can check the reasoning. */
  evidence: string[];
  /** 0-1. Below 0.5 the UI labels it explicitly as a guess. */
  confidence: number;
  /** Hedged by construction: "one explanation is…", never "you are…". */
  possibleExplanation: string;
  recommendedAction: string;
  /** Which skills the insight concerns. */
  skillIds: Id[];
  kind: "observation" | "interpretation";
  createdAt: IsoInstant;
  dismissedAt?: IsoInstant;
}

export interface Experiment {
  id: Id;
  userId: Id;
  question: string;
  /** The change the user will make. */
  plan: string;
  /** What will be recorded. */
  measure: "perceived-difficulty" | "conversation-flow" | "attempt-rate";
  skillIds: Id[];
  targetObservations: number;
  startedAt: IsoInstant;
  endedAt?: IsoInstant;
}

export interface ExperimentObservation {
  id: Id;
  experimentId: Id;
  /** Whether the planned change was applied on this occasion. */
  applied: boolean;
  /** 1-5 on the experiment's measure. */
  value: number;
  note?: string;
  createdAt: IsoInstant;
}

export interface WeeklyReview {
  id: Id;
  userId: Id;
  /** Monday of the week under review. */
  weekStart: IsoDate;
  trainingCompleted: { sessions: number; simulations: number; challenges: number; reflections: number };
  skillsPractised: { skillId: Id; count: number }[];
  strongestEvidence: { skillId: Id; statement: string; evidence: string[] } | null;
  needsReinforcement: { skillId: Id; reason: string }[];
  difficultyProgression: { skillId: Id; from: number; to: number }[];
  confidenceChanges: { skillId: Id; delta: number }[];
  nextFocus: { skillId: Id; reason: string };
  createdAt: IsoInstant;
}

export interface Achievement {
  id: Id;
  userId: Id;
  /** Stable key, e.g. "first-real-world-challenge". */
  key: string;
  label: string;
  description: string;
  unlockedAt: IsoInstant;
}

// --- Voice -----------------------------------------------------------------

/**
 * Measured communication mechanics only. Nothing here infers attractiveness,
 * personality, intelligence, ethnicity or health, and the extractor is written
 * so those inferences are not even computable from what is stored.
 */
export interface VoiceTurnMetrics {
  durationMs: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillerWords: string[];
  /** Pauses longer than 1.5s, which listeners notice. */
  longPauseCount: number;
  longestPauseMs: number;
  /** Rough turn share within the exchange, 0-1. */
  turnShare?: number;
}

// --- Recommendation --------------------------------------------------------

export interface Recommendation {
  skillId: Id;
  /** Total ordering score. Never shown as a number to the user. */
  score: number;
  /** Component scores, exposed in the UI as "why this". */
  factors: { key: RecommendationFactor; weight: number; value: number; note: string }[];
  reason: string;
  /** Suggested first step for this skill. */
  suggested: SessionStepKind;
}

export const RECOMMENDATION_FACTORS = [
  "goalAlignment",
  "weakness",
  "prerequisite",
  "spacing",
  "confidenceGap",
  "variety",
  "challengeFit",
  "recentProgress",
  "contextRelevance",
  "fatigue",
] as const;
export type RecommendationFactor = (typeof RECOMMENDATION_FACTORS)[number];

// --- Persistence -----------------------------------------------------------

/** Everything the app holds for one user. The unit of export and of deletion. */
export interface Snapshot {
  user: User;
  preference: Preference;
  goals: Goal[];
  skillStates: UserSkillState[];
  assessments: Assessment[];
  simulations: Simulation[];
  evaluations: SimulationEvaluation[];
  challengeAttempts: ChallengeAttempt[];
  reflections: Reflection[];
  reflectionSignals: ReflectionSignal[];
  sessions: TrainingSession[];
  insights: Insight[];
  experiments: Experiment[];
  observations: ExperimentObservation[];
  reviews: WeeklyReview[];
  achievements: Achievement[];
  generatedExercises: Exercise[];
  generatedChallenges: Challenge[];
  savedScenarios: SimulationScenario[];
}
