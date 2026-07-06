export type SubjectId = "chemistry" | "physics" | "biology" | "maths";

export interface Subject {
  id: SubjectId;
  name: string;
}

export interface Topic {
  id: string;
  subjectId: SubjectId;
  title: string;
}

export interface Flashcard {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  front: string;
  back: string;
  dueDate: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  lastReviewedAt: string | null;
}

export type RecallGrade = "again" | "hard" | "good" | "easy";

export interface QuizQuestion {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  score: number;
  total: number;
  completedAt: string;
}

export interface LessonSection {
  heading: string;
  explanation: string;
  checkQuestion: string;
  checkOptions: string[];
  correctIndex: number;
  checkExplanation: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  sketchDataUrl: string | null;
  audioDataUrl: string | null;
  tags: string[];
  subjectId: SubjectId | null;
  topicId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "doing" | "done";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  subtasks: Subtask[];
  links: string[];
  createdAt: string;
}

export interface MindMapNode {
  id: string;
  label: string;
}

export interface MindMapEdge {
  from: string;
  to: string;
  label: string;
}

export interface MindMap {
  topic: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export type SessionKind = "study" | "quiz" | "lesson" | "focus";

export interface TimeSession {
  id: string;
  kind: SessionKind;
  subjectId: SubjectId | null;
  startedAt: string;
  durationMs: number;
}

export interface QaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AnchorDocument {
  id: string;
  title: string;
  sourceText: string;
  createdAt: string;
}

export type PracticeFormat = "mcq" | "matching" | "fill-blank";

export interface PracticeItem {
  id: string;
  format: PracticeFormat;
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  pairs: { left: string; right: string }[] | null;
  answer: string | null;
  explanation: string;
}

export interface AudioScriptLine {
  speaker: "Host A" | "Host B";
  line: string;
}

export interface AudioOverview {
  topicId: string;
  script: AudioScriptLine[];
  audioDataUrl: string | null;
}

export type StudyPlanMode = "list" | "calendar";

export interface CalendarBlock {
  id: string;
  day: string;
  startHour: number;
  durationHours: number;
  title: string;
  subjectId: SubjectId | null;
  topicId: string | null;
}

export type MotivationTone = "encouraging" | "loss-aversion";

export interface MotivationalPrompt {
  tone: MotivationTone;
  message: string;
}

// A chained sequence of question/answer steps building toward an
// extended-response (6-mark style) answer — each step's question follows
// from the previous step's answer, e.g. "why does X happen?" -> "why does
// that underlying cause happen?" -> a compare/contrast step.
export interface ChainFlashcardStep {
  question: string;
  answer: string;
}

export interface ChainFlashcard {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  title: string;
  steps: ChainFlashcardStep[];
}
