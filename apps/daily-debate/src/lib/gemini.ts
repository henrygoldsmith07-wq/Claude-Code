import { GoogleGenAI, Type } from "@google/genai";
import type { DebateSide, DebateSummary, TopicSource, TurnScores } from "./types";

const MODEL = "gemini-2.5-flash";

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey: key });
}

function parseJson<T>(text: string | undefined): T {
  if (!text) throw new Error("Gemini did not return structured output");
  return JSON.parse(text) as T;
}

export interface GeneratedTopic {
  title: string;
  prompt: string;
  category: string;
  sources: TopicSource[];
}

const TOPIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, punchy title for the topic (under 10 words)." },
    prompt: {
      type: Type.STRING,
      description:
        "A one or two sentence debate proposition/question, phrased neutrally so it can be argued from either side.",
    },
    category: {
      type: Type.STRING,
      description: "One word/short phrase category, e.g. Technology, Ethics, Politics, Science, Economics.",
    },
    sources: {
      type: Type.ARRAY,
      description:
        "3-5 well-known, credible, real institutions or outlets (never invent deep-link URLs) whose reporting or research bears on this topic, each with the angle/data they're known for.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the real institution/outlet, e.g. Pew Research Center." },
          homepage: { type: Type.STRING, description: "Its real root homepage URL, e.g. https://www.pewresearch.org" },
          angle: { type: Type.STRING, description: "One sentence on what perspective or data this source is known for on the topic." },
        },
        required: ["name", "homepage", "angle"],
      },
    },
  },
  required: ["title", "prompt", "category", "sources"],
};

export async function generateDailyTopic(recentTitles: string[]): Promise<GeneratedTopic> {
  const ai = getClient();
  const avoid = recentTitles.length
    ? `Avoid repeating or closely resembling these recent topics: ${recentTitles.join("; ")}.`
    : "";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Pick today's debate topic for a daily critical-thinking app used by the general public. It should be genuinely debatable (reasonable people disagree), civically or intellectually meaningful, and not needlessly inflammatory or a pure culture-war flashpoint. Draw from technology, science, ethics, economics, education, or public policy. ${avoid} Ground it with 3-5 real, well-known, credible institutions (never fabricate a specific article URL — only real root homepages) relevant to the topic.`,
    config: { responseMimeType: "application/json", responseSchema: TOPIC_SCHEMA },
  });

  return parseJson<GeneratedTopic>(response.text);
}

export interface DebateTurnResult {
  aiMessage: string;
  scores: TurnScores;
  feedback: string;
}

const TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.OBJECT,
      description: "Score the user's most recent message only, each 0-10.",
      properties: {
        depth: { type: Type.INTEGER, description: "How thoroughly the point was developed, beyond a surface-level take." },
        evidence: { type: Type.INTEGER, description: "Use of concrete facts, examples, data, or credible reasoning to back the claim." },
        logic: { type: Type.INTEGER, description: "Internal consistency and validity of the argument's structure." },
        rebuttal: { type: Type.INTEGER, description: "How directly and effectively it engaged with the AI's prior challenge." },
        clarity: { type: Type.INTEGER, description: "How clearly and concisely the point was communicated." },
      },
      required: ["depth", "evidence", "logic", "rebuttal", "clarity"],
    },
    feedback: {
      type: Type.STRING,
      description: "One or two sentences of specific, constructive feedback on this response.",
    },
    aiMessage: {
      type: Type.STRING,
      description:
        "The AI opponent's next move: a sharp counter-argument, a probing follow-up question, or a challenge to a weak point — 2-4 sentences, arguing the opposite side from the user.",
    },
  },
  required: ["scores", "feedback", "aiMessage"],
};

export async function debateTurn(params: {
  topicTitle: string;
  topicPrompt: string;
  userSide: DebateSide;
  history: { role: "ai" | "user"; text: string }[];
  latestUserMessage: string;
}): Promise<DebateTurnResult> {
  const ai = getClient();
  const aiSide: DebateSide = params.userSide === "for" ? "against" : "for";

  const transcript = params.history
    .map((turn) => `${turn.role === "ai" ? "AI (opposing)" : "User"}: ${turn.text}`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are an AI debate opponent in a critical-thinking training app. Topic: "${params.topicTitle}" — ${params.topicPrompt}\nThe user is arguing the "${params.userSide}" side. You are arguing the "${aiSide}" side, and your job is to challenge the user's thinking as rigorously and fairly as possible so they sharpen their reasoning.\n\nTranscript so far:\n${transcript}\n\nUser's latest response: "${params.latestUserMessage}"\n\nScore that latest response, give brief feedback, and produce your next challenge.`,
    config: { responseMimeType: "application/json", responseSchema: TURN_SCHEMA },
  });

  return parseJson<DebateTurnResult>(response.text);
}

const OPENING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    aiMessage: { type: Type.STRING, description: "Opening argument, 2-4 sentences." },
  },
  required: ["aiMessage"],
};

export async function debateOpening(params: {
  topicTitle: string;
  topicPrompt: string;
  aiSide: DebateSide;
}): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Open a debate on "${params.topicTitle}" — ${params.topicPrompt}\nArgue the "${params.aiSide}" side in 2-4 sentences, stating a clear, specific opening claim (not a vague restatement of the prompt).`,
    config: { responseMimeType: "application/json", responseSchema: OPENING_SCHEMA },
  });

  return parseJson<{ aiMessage: string }>(response.text).aiMessage;
}

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallFeedback: { type: Type.STRING, description: "2-3 sentence overall assessment of the user's reasoning across the session." },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 short specific strengths." },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 short specific things to improve." },
  },
  required: ["overallFeedback", "strengths", "improvements"],
};

export async function summarizeSoloDebate(params: {
  topicTitle: string;
  transcript: string;
}): Promise<DebateSummary> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Here is a full debate practice transcript on "${params.topicTitle}":\n\n${params.transcript}\n\nGive the user a short overall assessment of their critical-thinking performance, with specific strengths and areas to improve.`,
    config: { responseMimeType: "application/json", responseSchema: SUMMARY_SCHEMA },
  });

  return parseJson<DebateSummary>(response.text);
}
