// ---------------------------------------------------------------------------
// The domain model. Everything here is board-, qualification- and
// subject-agnostic: WJEC A-level is seeded data, not a hard-coded assumption.
// A future board is added by dropping a new curriculum module into
// src/domain/curriculum — no type in this file changes.
// ---------------------------------------------------------------------------

export type Id = string;
/** Date-only, `YYYY-MM-DD`. Used everywhere a wall-clock day is meant. */
export type IsoDate = string;
/** Full ISO-8601 instant. Used everywhere an ordering-sensitive moment is meant. */
export type IsoInstant = string;

// --- curriculum ------------------------------------------------------------

export interface ExamBoard {
  id: Id;
  name: string;
  country: string;
}

export interface Qualification {
  id: Id;
  boardId: Id;
  name: string;
  /** e.g. "A Level", "GCSE", "IB Diploma" — free text so new systems fit. */
  level: string;
  /** Ordered best → worst, e.g. ["A*","A","B",...]. Drives grade prediction. */
  grades: string[];
}

export interface PaperSpec {
  id: Id;
  name: string;
  /** Share of the total qualification mark, 0–1. Weights grade prediction. */
  weight: number;
  durationMinutes: number;
  calculatorAllowed: boolean;
}

export interface Subject {
  id: Id;
  qualificationId: Id;
  name: string;
  /** Board's own specification code, shown in the UI for trust. */
  specCode?: string;
  papers: PaperSpec[];
  /** Percentage thresholds per grade, best grade first. Approximate by nature. */
  gradeBoundaries: { grade: string; percent: number }[];
}

export interface Unit {
  id: Id;
  subjectId: Id;
  title: string;
  order: number;
}

export interface Topic {
  id: Id;
  subjectId: Id;
  unitId: Id;
  title: string;
  order: number;
  /** Spec reference as printed by the board, when known. */
  specRef?: string;
  /** 1 (foundational) – 5 (stretch). Seeds the planner before any data exists. */
  intrinsicDifficulty: 1 | 2 | 3 | 4 | 5;
  /** Short prose used by the learn step and as AI grounding. */
  summary: string;
  /** The handful of things an examiner actually rewards. */
  keyPoints: string[];
  /** Errors this topic is notorious for; drives targeted feedback. */
  commonErrors: string[];
}

// --- spaced repetition -----------------------------------------------------

export type CardKind = "basic" | "cloze" | "image" | "equation" | "mistake" | "audio";
export type RecallGrade = "again" | "hard" | "good" | "easy";

export interface Card {
  id: Id;
  userId: Id;
  subjectId: Id;
  topicId: Id;
  kind: CardKind;
  front: string;
  back: string;
  /** Cloze cards keep the un-blanked sentence so it can be re-rendered. */
  clozeSource?: string;
  /** Data URL or remote URL. Data URLs keep images working offline. */
  imageUrl?: string;
  /** Data URL for a recorded or uploaded clip. */
  audioUrl?: string;
  /** Free-form note shown under the answer; never tested. */
  note?: string;
  /** Lower-case, deduplicated. The browser filters on these. */
  tags: string[];
  /** Set when the card was minted from a specific mistake. */
  sourceMistakeId?: Id;
  origin: "seed" | "manual" | "ai" | "document" | "mistake" | "import";
  /** Suspended cards never appear until explicitly unsuspended. */
  suspended?: boolean;
  /** Buried cards reappear on this date. Bury is a one-day snooze. */
  buriedUntil?: IsoDate;
  // FSRS state
  due: IsoDate;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  lastReviewedAt: IsoInstant | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface ReviewLog {
  id: Id;
  userId: Id;
  cardId: Id;
  topicId: Id;
  grade: RecallGrade;
  /** Self-reported before the answer is revealed; feeds weak-topic detection. */
  confidence?: 1 | 2 | 3 | 4 | 5;
  elapsedMs: number;
  reviewedAt: IsoInstant;
}

// --- questions & marking ---------------------------------------------------

export type QuestionKind = "mcq" | "short" | "structured" | "calculation" | "extended";

export interface QuestionPart {
  id: Id;
  label: string;
  prompt: string;
  marks: number;
  /** Mark-scheme points; each is one awardable mark unless `marks` says more. */
  markScheme: string[];
  modelAnswer: string;
}

export interface Question {
  id: Id;
  subjectId: Id;
  topicIds: Id[];
  kind: QuestionKind;
  stem: string;
  /** MCQ only. */
  options?: string[];
  correctIndex?: number;
  parts: QuestionPart[];
  totalMarks: number;
  calculatorAllowed: boolean;
  difficulty: 1 | 2 | 3 | 4 | 5;
  origin: "seed" | "ai" | "past-paper";
  /** Set when extracted from an uploaded paper. */
  paperId?: Id;
  paperQuestionNumber?: string;
  createdAt: IsoInstant;
}

export interface MarkedPart {
  partId: Id;
  awarded: number;
  max: number;
  /** Which mark-scheme points the answer hit. */
  creditedPoints: string[];
  missedPoints: string[];
  comment: string;
}

export interface Attempt {
  id: Id;
  userId: Id;
  questionId: Id;
  subjectId: Id;
  topicIds: Id[];
  /** Keyed by part id; MCQ attempts use the single part id. */
  answers: Record<Id, string>;
  marked: MarkedPart[];
  awarded: number;
  max: number;
  /** Examiner-style prose, ready to show verbatim. */
  feedback: string;
  markedBy: "ai" | "rubric" | "self";
  confidence?: 1 | 2 | 3 | 4 | 5;
  elapsedMs: number;
  mode: "practice" | "paper" | "recall";
  createdAt: IsoInstant;
}

export interface Mistake {
  id: Id;
  userId: Id;
  subjectId: Id;
  topicId: Id;
  questionId?: Id;
  attemptId?: Id;
  /** What went wrong, in the student's language. */
  description: string;
  /** Classification used to spot repeat patterns across topics. */
  category: "recall" | "method" | "arithmetic" | "interpretation" | "communication" | "unclassified";
  cardId?: Id;
  resolved: boolean;
  createdAt: IsoInstant;
  resolvedAt?: IsoInstant;
}

// --- past papers -----------------------------------------------------------

export interface Paper {
  id: Id;
  userId: Id;
  subjectId: Id;
  title: string;
  year?: number;
  series?: string;
  paperSpecId?: Id;
  /** Extracted plain text, kept so questions can be re-extracted later. */
  sourceText?: string;
  markSchemeText?: string;
  totalMarks: number;
  questionIds: Id[];
  status: "uploaded" | "extracted" | "practised";
  createdAt: IsoInstant;
}

// --- planning --------------------------------------------------------------

export type ActivityKind = "learn" | "flashcards" | "recall" | "practice" | "paper" | "mistakes";

export interface PlannedSession {
  id: Id;
  userId: Id;
  date: IsoDate;
  /** Minutes from midnight; the timetable renders these as blocks. */
  startMinute: number;
  minutes: number;
  subjectId: Id;
  topicId?: Id;
  activity: ActivityKind;
  reason: string;
  status: "pending" | "done" | "skipped" | "missed";
  completedAt?: IsoInstant;
}

export interface ExamDate {
  id: Id;
  userId: Id;
  subjectId: Id;
  paperSpecId?: Id;
  date: IsoDate;
  label: string;
}

export interface Availability {
  /** 0 = Sunday … 6 = Saturday. Minutes of study available that weekday. */
  weekday: number;
  minutes: number;
}

export interface UserSettings {
  userId: Id;
  displayName: string;
  subjectIds: Id[];
  availability: Availability[];
  sessionLengthMinutes: number;
  targetGrades: Record<Id, string>;
  theme: "light" | "dark" | "system";
  accessibility: {
    largeText: boolean;
    dyslexiaFont: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
  };
  aiEnabled: boolean;
  updatedAt: IsoInstant;
}

// --- progress --------------------------------------------------------------

export interface TopicMastery {
  topicId: Id;
  subjectId: Id;
  /** 0–1. Blends recall stability, question accuracy and recency. */
  mastery: number;
  /** 0–1 predicted probability of recall right now (forgetting curve). */
  retention: number;
  confidence: number;
  cardsTotal: number;
  cardsDue: number;
  attempts: number;
  accuracy: number;
  lastStudiedAt: IsoInstant | null;
  /** True when this topic is costing the most marks per minute of revision. */
  weak: boolean;
}

export interface Recommendation {
  activity: ActivityKind;
  subjectId: Id;
  topicId?: Id;
  minutes: number;
  /** One sentence, shown to the student. Never jargon. */
  reason: string;
  /** Higher runs first. */
  score: number;
  plannedSessionId?: Id;
}

export interface StreakState {
  userId: Id;
  current: number;
  longest: number;
  lastActiveDate: IsoDate | null;
  xp: number;
  /** Ids of unlocked achievements. */
  achievements: Id[];
}

export interface Achievement {
  id: Id;
  name: string;
  description: string;
  /** Evaluated against the aggregate stats; pure so it is trivially testable. */
  test: (stats: GamificationStats) => boolean;
}

export interface GamificationStats {
  reviews: number;
  attempts: number;
  marksEarned: number;
  papers: number;
  streak: number;
  masteredTopics: number;
  perfectSessions: number;
}

// --- custom study ----------------------------------------------------------

/** What goes into a hand-built session, as chosen in the custom-study dialog. */
export interface CustomStudySpec {
  /** Browser query string; empty means "everything in scope". */
  query: string;
  subjectIds?: Id[];
  topicIds?: Id[];
  tags?: string[];
  /** Which pool to draw from before the query narrows it further. */
  pool: "due" | "new" | "lapsed" | "suspended" | "all";
  limit: number;
  order: "due" | "random" | "difficulty" | "lapses" | "added";
  /** Custom sessions can preview ahead of schedule without rescheduling. */
  ahead?: boolean;
}

// --- deck import/export ----------------------------------------------------

export interface DeckExportCard {
  front: string;
  back: string;
  kind: CardKind;
  tags: string[];
  note?: string;
  imageUrl?: string;
  audioUrl?: string;
  clozeSource?: string;
  topicId?: Id;
  subjectId?: Id;
  /** Present in a full export, absent in a shared deck. */
  scheduling?: {
    due: IsoDate;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: number;
    lastReviewedAt: IsoInstant | null;
  };
}

export interface DeckExport {
  /** Bumped when the shape changes; importers refuse what they cannot read. */
  formatVersion: 1;
  name: string;
  description?: string;
  exportedAt: IsoInstant;
  /** Set when the deck came from this app rather than a third party. */
  source?: string;
  subjectId?: Id;
  cards: DeckExportCard[];
}

// --- sync ------------------------------------------------------------------

export type SyncEntity =
  | "cards"
  | "reviewLogs"
  | "attempts"
  | "mistakes"
  | "questions"
  | "papers"
  | "plannedSessions"
  | "examDates"
  | "settings"
  | "streak";

export interface OutboxItem {
  id: Id;
  entity: SyncEntity;
  op: "upsert" | "delete";
  payload: unknown;
  queuedAt: IsoInstant;
  attempts: number;
  lastError?: string;
}
