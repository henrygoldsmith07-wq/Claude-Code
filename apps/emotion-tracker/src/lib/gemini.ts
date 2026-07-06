import { FunctionCallingConfigMode, GoogleGenAI, Type } from "@google/genai";
import type { Message, ReflectionSummary } from "./types";

const MODEL = "gemini-2.5-flash";
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

function getClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("No Gemini API key provided. Add your own key to continue the reflection.");
  }
  return new GoogleGenAI({ apiKey: key });
}

const ASK_TOOL = {
  name: "ask_followup",
  description:
    "Ask exactly one more probing question to help the user go deeper into what they actually feel and why, before any conclusions are drawn.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "A single, specific, non-leading follow-up question, grounded in what the user just said.",
      },
    },
    required: ["question"],
  },
};

const CONCLUDE_TOOL = {
  name: "conclude_reflection",
  description:
    "Conclude the reflection once enough has been explored, and give a grounded, non-self-serving summary.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      coreEmotion: {
        type: Type.STRING,
        description:
          "The deeper emotion beneath the surface feeling the user first named (e.g. hurt, fear, shame, insecurity, grief) — not just the initial label like 'anger'.",
      },
      underlyingTriggers: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Specific things that actually triggered the feeling, as uncovered in the conversation.",
      },
      possibleBiases: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              description:
                "Name of the cognitive distortion or bias, e.g. 'self-serving bias', 'moral licensing', 'mind-reading', 'catastrophizing', 'all-or-nothing thinking'.",
            },
            description: { type: Type.STRING, description: "How it showed up in what the user said." },
          },
          required: ["type", "description"],
        },
        description: "Only include biases that actually showed up. Return an empty array if none did.",
      },
      otherPerspective: {
        type: Type.STRING,
        description:
          "A fair articulation of how the other person(s) involved might see the situation, even if it's uncomfortable for the user to hear.",
      },
      balancedAssessment: {
        type: Type.STRING,
        description:
          "An honest, non-flattering-by-default assessment of the situation, including where the user may share responsibility. Do not validate retaliatory or rash conclusions even if the user was genuinely wronged.",
      },
      cautionFlags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          "Any rash, retaliatory, or high-stakes decisions the user mentioned wanting to make that are worth pausing on before acting. Empty array if none.",
      },
      suggestedNextSteps: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Concrete, level-headed next steps for processing the emotion and deciding what to do next.",
      },
    },
    required: [
      "coreEmotion",
      "underlyingTriggers",
      "possibleBiases",
      "otherPerspective",
      "balancedAssessment",
      "cautionFlags",
      "suggestedNextSteps",
    ],
  },
};

function buildSystemPrompt(questionsAskedSoFar: number): string {
  const remaining = Math.max(0, MIN_QUESTIONS - questionsAskedSoFar);
  return `You are a rigorous, compassionate reflection guide inside an emotion-tracking app. Your job is NOT to comfort or validate — it is to help the user actually understand what they feel and why, so they act deliberately instead of rashly.

Rules:
1. Never simply affirm the user's initial framing of a situation as correct. People in the grip of strong emotion routinely misjudge blame, motive, and proportion — your job is to test their account, not echo it back to them.
2. If the situation is vague, ask about the concrete facts first. Then dig underneath the named emotion — anger is very often a cover for hurt, fear, shame, humiliation, or insecurity. Find what's actually underneath; don't stop at the first label.
3. Explicitly consider whether the user is partly in the wrong, exaggerating, or reasoning in a self-serving way — even if they were also wronged by someone else. Being wronged does not make every subsequent judgment or reaction correct. For example: a partner treating someone badly does NOT mean that partner "deserved" to be cheated on, and it does not automatically justify any retaliatory act the user is considering. Call this out directly and plainly if something like it comes up — do not let it pass unchallenged.
4. Watch for and name cognitive distortions when they appear: mind-reading, catastrophizing, all-or-nothing thinking, moral licensing ("they wronged me so I'm entitled to X"), and self-serving attribution.
5. Ask exactly one question per turn, using the ask_followup function. Keep each question specific to what the user just said — never generic or templated. Never ask more than ${MAX_QUESTIONS} questions in total across the whole reflection.
6. So far you have asked ${questionsAskedSoFar} question(s). ${
    remaining > 0
      ? `You must ask at least ${remaining} more question(s) before concluding — do not call conclude_reflection yet.`
      : `You have asked enough to conclude once you genuinely have enough to give an honest, examined account — call conclude_reflection instead of asking another question when that point is reached. Do not interrogate past the point of diminishing returns, and do not conclude just because the user seems to want validation.`
  }
7. In the final summary, be honest even when it's unflattering to the user. Do not tell them what they want to hear. Name caution flags for any rash or retaliatory decision they've mentioned wanting to make.
8. You must always respond by calling exactly one of the two available functions — never respond with plain text.`;
}

function toGeminiContents(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export type ReflectStep =
  | { step: "question"; question: string }
  | { step: "summary"; summary: ReflectionSummary };

export async function getNextReflectionStep(messages: Message[], apiKey?: string): Promise<ReflectStep> {
  const ai = getClient(apiKey);
  const questionsAskedSoFar = messages.filter((m) => m.role === "assistant").length;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: buildSystemPrompt(questionsAskedSoFar),
      tools: [{ functionDeclarations: [ASK_TOOL, CONCLUDE_TOOL] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["ask_followup", "conclude_reflection"],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call || !call.name) {
    throw new Error("Gemini did not return a structured response");
  }

  if (call.name === "ask_followup") {
    const args = call.args as { question: string };
    return { step: "question", question: args.question };
  }

  return { step: "summary", summary: call.args as unknown as ReflectionSummary };
}
