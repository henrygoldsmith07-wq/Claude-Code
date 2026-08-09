import type { Id, Question } from "@/domain/types";
import { biologyQuestions } from "./questions/biology";
import { biologyExtraQuestions } from "./questions/biology-extra";
import { chemistryQuestions } from "./questions/chemistry";
import { chemistryExtraQuestions } from "./questions/chemistry-extra";
import { mathsQuestions } from "./questions/maths";
import { mathsExtraQuestions } from "./questions/maths-extra";
import { physicsQuestions } from "./questions/physics";
import { physicsExtraQuestions } from "./questions/physics-extra";

export { seedCards, seedCardsForTopic, makeCloze } from "./seed-cards";

/** The authored question bank. Uploaded and AI-generated questions live in
 *  IndexedDB alongside these and are treated identically everywhere else. */
export const seedQuestions: Question[] = [
  ...mathsQuestions,
  ...mathsExtraQuestions,
  ...biologyQuestions,
  ...biologyExtraQuestions,
  ...chemistryQuestions,
  ...chemistryExtraQuestions,
  ...physicsQuestions,
  ...physicsExtraQuestions,
];

export function seedQuestionsForSubject(subjectId: Id): Question[] {
  return seedQuestions.filter((q) => q.subjectId === subjectId);
}

export function seedQuestionsForTopic(topicId: Id): Question[] {
  return seedQuestions.filter((q) => q.topicIds.includes(topicId));
}
