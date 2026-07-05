import type { RecallGrade } from "./types";

// XP rewards are weighted toward genuine retrieval effort: grading a card
// "again" still earns a little (showing up and trying counts), but far less
// than a confident recall, so the incentive lines up with the spacing
// effect rather than encouraging rushed grading.
export const XP_PER_CARD_GRADE: Record<RecallGrade, number> = {
  again: 1,
  hard: 3,
  good: 5,
  easy: 6,
};

export const XP_PER_QUIZ_CORRECT = 4;
export const XP_PER_LESSON_SECTION = 3;
export const XP_LESSON_COMPLETE_BONUS = 10;
export const XP_PER_STUDY_DAY = 5;
export const XP_PER_LEVEL = 200;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(xp: number): number {
  return xp % XP_PER_LEVEL;
}

export interface BadgeStats {
  totalReviews: number;
  longestStreak: number;
  perfectQuiz: boolean;
  hasCardsInAllSubjects: boolean;
  lessonsCompletedCount: number;
  anyTopicMastered: boolean;
  level: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
}

export function computeBadges(stats: BadgeStats): Badge[] {
  return [
    {
      id: "first-steps",
      name: "First Steps",
      description: "Review your first flashcard.",
      earned: stats.totalReviews >= 1,
    },
    {
      id: "century-club",
      name: "Century Club",
      description: "Review 100 flashcards.",
      earned: stats.totalReviews >= 100,
    },
    {
      id: "quiz-whiz",
      name: "Quiz Whiz",
      description: "Score 100% on a quiz.",
      earned: stats.perfectQuiz,
    },
    {
      id: "topic-master",
      name: "Topic Master",
      description: "Fully master a topic.",
      earned: stats.anyTopicMastered,
    },
    {
      id: "all-rounder",
      name: "All-Rounder",
      description: "Start all four subjects.",
      earned: stats.hasCardsInAllSubjects,
    },
    {
      id: "bookworm",
      name: "Bookworm",
      description: "Complete 5 lessons.",
      earned: stats.lessonsCompletedCount >= 5,
    },
    {
      id: "week-streak",
      name: "Week Streak",
      description: "Study 7 days in a row.",
      earned: stats.longestStreak >= 7,
    },
    {
      id: "level-5",
      name: "Level 5 Scholar",
      description: "Reach level 5.",
      earned: stats.level >= 5,
    },
  ];
}
