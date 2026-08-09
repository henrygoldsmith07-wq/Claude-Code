import type { Id, Question } from "@/domain/types";
import { biologyQuestions } from "./questions/biology";
import { chemistryQuestions } from "./questions/chemistry";
import { mathsQuestions } from "./questions/maths";
import { physicsQuestions } from "./questions/physics";

export { seedCards, seedCardsForTopic, makeCloze } from "./seed-cards";

/** The authored question bank. Uploaded and AI-generated questions live in
 *  IndexedDB alongside these and are treated identically everywhere else. */
export const seedQuestions: Question[] = [
  ...mathsQuestions,
  ...biologyQuestions,
  ...chemistryQuestions,
  ...physicsQuestions,
];

export function seedQuestionsForSubject(subjectId: Id): Question[] {
  return seedQuestions.filter((q) => q.subjectId === subjectId);
}

export function seedQuestionsForTopic(topicId: Id): Question[] {
  return seedQuestions.filter((q) => q.topicIds.includes(topicId));
}
