import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("No Anthropic API key provided. Add your own key in the settings bar.");
  }
  return new Anthropic({ apiKey: key });
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GeneratedLessonSection {
  heading: string;
  explanation: string;
  checkQuestion: string;
  checkOptions: string[];
  correctIndex: number;
  checkExplanation: string;
}

const FLASHCARD_TOOL = {
  name: "emit_flashcards",
  description: "Return flashcards for active-recall revision of an A-level topic.",
  input_schema: {
    type: "object" as const,
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: {
              type: "string",
              description: "A single, specific question or prompt testing one fact or idea.",
            },
            back: {
              type: "string",
              description: "The concise, exam-accurate answer.",
            },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["cards"],
  },
};

const QUIZ_TOOL = {
  name: "emit_quiz_questions",
  description: "Return multiple-choice quiz questions for an A-level topic.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Exactly 4 plausible options, in the order they should be shown.",
            },
            correctIndex: {
              type: "integer",
              description: "0-based index of the correct option within `options`.",
            },
            explanation: {
              type: "string",
              description: "One or two sentences explaining why the correct answer is right.",
            },
          },
          required: ["question", "options", "correctIndex", "explanation"],
        },
      },
    },
    required: ["questions"],
  },
};

const LESSON_TOOL = {
  name: "emit_lesson",
  description: "Return an interactive lesson teaching an A-level topic in short sections.",
  input_schema: {
    type: "object" as const,
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "Short heading for this section." },
            explanation: {
              type: "string",
              description:
                "2-4 sentences teaching one sub-idea at A-level depth, building on earlier sections.",
            },
            checkQuestion: {
              type: "string",
              description:
                "A quick check-your-understanding question testing the sub-idea just explained in this section.",
            },
            checkOptions: {
              type: "array",
              items: { type: "string" },
              description: "Exactly 4 plausible options, in the order they should be shown.",
            },
            correctIndex: {
              type: "integer",
              description: "0-based index of the correct option within checkOptions.",
            },
            checkExplanation: {
              type: "string",
              description: "One or two sentences explaining why the correct option is right.",
            },
          },
          required: [
            "heading",
            "explanation",
            "checkQuestion",
            "checkOptions",
            "correctIndex",
            "checkExplanation",
          ],
        },
      },
    },
    required: ["sections"],
  },
};

export async function generateFlashcards(
  subjectName: string,
  topicTitle: string,
  count: number,
  apiKey?: string,
): Promise<GeneratedFlashcard[]> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [FLASHCARD_TOOL],
    tool_choice: { type: "tool", name: FLASHCARD_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write ${count} flashcards for a WJEC/Eduqas A-level ${subjectName} student revising the topic "${topicTitle}". Each card should test one discrete, specific fact, definition, mechanism, or calculation step at A-level depth — not a vague overview. Vary between definitions, cause/effect, and "explain why" style prompts so recall isn't just pattern-matching a single phrasing.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  return (toolUse.input as { cards: GeneratedFlashcard[] }).cards;
}

export async function generateQuizQuestions(
  subjectName: string,
  topicTitle: string,
  count: number,
  apiKey?: string,
): Promise<GeneratedQuizQuestion[]> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [QUIZ_TOOL],
    tool_choice: { type: "tool", name: QUIZ_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write ${count} multiple-choice quiz questions for a WJEC/Eduqas A-level student testing the topic "${topicTitle}" (subject: ${subjectName}). Each question needs exactly 4 options with one clearly correct answer and 3 plausible distractors based on common misconceptions. Include a short explanation of the correct answer so the student gets useful feedback immediately after answering.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  return (toolUse.input as { questions: GeneratedQuizQuestion[] }).questions;
}

export async function generateLesson(
  subjectName: string,
  topicTitle: string,
  apiKey?: string,
): Promise<GeneratedLessonSection[]> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [LESSON_TOOL],
    tool_choice: { type: "tool", name: LESSON_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write a short interactive lesson teaching a WJEC/Eduqas A-level ${subjectName} student the topic "${topicTitle}", as 4-6 sections. Each section should teach one sub-idea building on the previous ones, at A-level depth, then check understanding with a 4-option multiple-choice question testing that specific sub-idea (one clearly correct option, three plausible distractors based on common misconceptions). Keep explanations concise and concrete (use a worked example or specific instance where useful) rather than a vague overview.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  return (toolUse.input as { sections: GeneratedLessonSection[] }).sections;
}
