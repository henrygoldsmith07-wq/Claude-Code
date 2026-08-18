import type { Id, Question } from "@/domain/types";
import { biologyQuestions } from "./questions/biology";
import { biologyAqaQuestions } from "./questions/biology-aqa";
import { biologyAqaExtraQuestions } from "./questions/biology-aqa-extra";
import { biologyExtraQuestions } from "./questions/biology-extra";
import { chemistryQuestions } from "./questions/chemistry";
import { chemistryAqaQuestions } from "./questions/chemistry-aqa";
import { chemistryAqaExtraQuestions } from "./questions/chemistry-aqa-extra";
import { chemistryExtraQuestions } from "./questions/chemistry-extra";
import { mathsQuestions } from "./questions/maths";
import { mathsAqaQuestions } from "./questions/maths-aqa";
import { mathsAqaExtraQuestions } from "./questions/maths-aqa-extra";
import { mathsExtraQuestions } from "./questions/maths-extra";
import { physicsQuestions } from "./questions/physics";
import { physicsAqaQuestions } from "./questions/physics-aqa";
import { physicsAqaExtraQuestions } from "./questions/physics-aqa-extra";
import { physicsExtraQuestions } from "./questions/physics-extra";
import { authenticExpansionQuestions } from "./questions/massive-authentic";
import { gcseExpansionQuestions } from "./questions/gcse-expansion";
import { edexcelExpansionQuestions } from "./questions/edexcel-expansion";
import { dataExpansionQuestions } from "./questions/data-expansion";

export { seedCards, seedCardsForTopic, makeCloze } from "./seed-cards";

/** The authored question bank. Uploaded and AI-generated questions live in
 *  IndexedDB alongside these and are treated identically everywhere else. */
export const seedQuestions: Question[] = [
  ...authenticExpansionQuestions,
  ...gcseExpansionQuestions,
  ...edexcelExpansionQuestions,
  ...dataExpansionQuestions,
  ...mathsQuestions,
  ...mathsExtraQuestions,
  ...biologyQuestions,
  ...biologyExtraQuestions,
  ...chemistryQuestions,
  ...chemistryExtraQuestions,
  ...physicsQuestions,
  ...physicsExtraQuestions,
  ...biologyAqaQuestions,
  ...biologyAqaExtraQuestions,
  ...chemistryAqaQuestions,
  ...chemistryAqaExtraQuestions,
  ...mathsAqaQuestions,
  ...mathsAqaExtraQuestions,
  ...physicsAqaQuestions,
  ...physicsAqaExtraQuestions,
];

export { authenticExpansionQuestions };
export { gcseExpansionQuestions };
export { edexcelExpansionQuestions };
export { dataExpansionQuestions };

export function seedQuestionsForSubject(subjectId: Id): Question[] {
  return seedQuestions.filter((q) => q.subjectId === subjectId);
}

export function seedQuestionsForTopic(topicId: Id): Question[] {
  return seedQuestions.filter((q) => q.topicIds.includes(topicId));
}
