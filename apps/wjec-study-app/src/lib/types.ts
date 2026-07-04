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
  repetitions: number;
  easinessFactor: number;
  intervalDays: number;
  dueDate: string;
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
