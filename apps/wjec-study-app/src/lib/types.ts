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
