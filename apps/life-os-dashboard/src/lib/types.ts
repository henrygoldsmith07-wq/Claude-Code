// Finance
export type TxnType = "income" | "expense";
export interface Transaction {
  id: string;
  type: TxnType;
  amountCents: number;
  category: string;
  date: string;
  note: string;
}
export interface FinanceBudget {
  id: string;
  category: string;
  monthlyLimitCents: number;
}
export interface NetWorthSnapshot {
  id: string;
  date: string;
  amountCents: number;
}

// Habits
export type HabitFrequency = "daily" | "weekly";
export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  archived: boolean;
  createdAt: string;
}
export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
}

// Routines
export type RoutineTime = "morning" | "afternoon" | "evening";
export interface Routine {
  id: string;
  name: string;
  timeOfDay: RoutineTime;
  steps: string[];
  createdAt: string;
}
export interface RoutineLog {
  id: string;
  routineId: string;
  date: string;
  completedStepIndexes: number[];
}

// Health & nutrition
export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export interface MealLog {
  id: string;
  date: string;
  mealType: MealType;
  calories: number;
  proteinG: number;
  notes: string;
}
export interface WaterLog {
  id: string;
  date: string;
  ml: number;
}
export interface HealthTargets {
  calories: number;
  proteinG: number;
  waterMl: number;
}

// Sleep
export interface SleepEntry {
  id: string;
  date: string;
  bedTime: string;
  wakeTime: string;
  durationHours: number;
  quality: number;
}

// Hormesis
export type HormesisType =
  | "cold_shower"
  | "ice_bath"
  | "sauna"
  | "fasting"
  | "exercise"
  | "sun_exposure"
  | "breathwork";
export interface HormesisEntry {
  id: string;
  date: string;
  type: HormesisType;
  durationMin: number;
  intensity: number;
  notes: string;
}

// Goals
export interface Milestone {
  id: string;
  label: string;
  done: boolean;
}
export type GoalDomain =
  | "finance"
  | "health"
  | "career"
  | "relationships"
  | "personal"
  | "other";
export type GoalStatus = "active" | "done" | "abandoned";
export interface Goal {
  id: string;
  title: string;
  domain: GoalDomain;
  targetDate: string | null;
  status: GoalStatus;
  milestones: Milestone[];
  createdAt: string;
}

// Meditation
export interface MeditationSession {
  id: string;
  date: string;
  type: string;
  durationMin: number;
  notes: string;
}

// Study
export interface StudySession {
  id: string;
  date: string;
  subject: string;
  durationMin: number;
  focusRating: number;
  notes: string;
}

// Relationships
export interface Contact {
  id: string;
  name: string;
  relation: string;
  lastContactedDate: string | null;
  reachOutFrequencyDays: number;
  notes: string;
}

// Self-improvement
export type LearningType = "book" | "course" | "skill" | "article";
export type LearningStatus = "planned" | "in_progress" | "done";
export interface LearningItem {
  id: string;
  type: LearningType;
  title: string;
  status: LearningStatus;
  progressPct: number;
  rating: number | null;
  notes: string;
}

// Mental health
export interface MoodEntry {
  id: string;
  date: string;
  mood: number;
  stress: number;
  notes: string;
}
export interface GratitudeEntry {
  id: string;
  date: string;
  items: string[];
}
export interface JournalEntry {
  id: string;
  date: string;
  content: string;
}

// AI coach
export interface CoachInsight {
  domain: string;
  observation: string;
  action: string;
}
export interface CoachBriefing {
  generatedAt: string;
  dailyFocus: string;
  wins: string[];
  insights: CoachInsight[];
  motivation: string;
}
