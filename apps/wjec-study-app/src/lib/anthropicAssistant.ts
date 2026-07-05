import Anthropic from "@anthropic-ai/sdk";
import type { PracticeFormat } from "./types";

const MODEL = "claude-sonnet-5";

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("No Anthropic API key provided. Add your own key in the settings bar.");
  }
  return new Anthropic({ apiKey: key });
}

export interface QaHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function answerQuestion(
  question: string,
  history: QaHistoryMessage[],
  mode: "direct" | "guided",
  anchorText: string | null,
  apiKey?: string,
): Promise<string> {
  const anthropic = getClient(apiKey);

  const system =
    mode === "guided"
      ? "You are a patient WJEC/Eduqas A-level tutor. Break your answer down step by step, building understanding incrementally rather than jumping straight to the final answer. Keep each step short."
      : "You are a WJEC/Eduqas A-level tutor. Answer clearly and concisely.";

  const anchorPrefix = anchorText
    ? `Answer only using the following source material — if it doesn't contain the answer, say so rather than using outside knowledge:\n\n"""\n${anchorText.slice(0, 12000)}\n"""\n\n`
    : "";

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: `${anchorPrefix}${question}` },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }
  return textBlock.text;
}

export interface GeneratedMindMap {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string }[];
}

const MIND_MAP_TOOL = {
  name: "emit_mind_map",
  description: "Return a mind map of concepts and how they connect.",
  input_schema: {
    type: "object" as const,
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Short stable identifier, e.g. 'n1'." },
            label: { type: "string", description: "Short concept label (2-5 words)." },
          },
          required: ["id", "label"],
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { type: "string", description: "Source node id." },
            to: { type: "string", description: "Target node id." },
            label: { type: "string", description: "Short phrase describing the relationship." },
          },
          required: ["from", "to", "label"],
        },
      },
    },
    required: ["nodes", "edges"],
  },
};

export async function generateMindMap(
  subjectContext: string,
  sourceText: string,
  apiKey?: string,
): Promise<GeneratedMindMap> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [MIND_MAP_TOOL],
    tool_choice: { type: "tool", name: MIND_MAP_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Build a mind map (10-18 nodes) for a WJEC/Eduqas A-level ${subjectContext} student from the following notes/topic, showing how the concepts connect:\n\n"""\n${sourceText.slice(0, 8000)}\n"""`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  return toolUse.input as GeneratedMindMap;
}

export interface GeneratedPracticeItem {
  format: PracticeFormat;
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  pairs: { left: string; right: string }[] | null;
  answer: string | null;
  explanation: string;
}

const PRACTICE_TEST_TOOL = {
  name: "emit_practice_test",
  description: "Return a multi-format practice test.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["mcq", "matching", "fill-blank"] },
            prompt: {
              type: "string",
              description:
                "For mcq/fill-blank: the question (fill-blank should contain a blank like ____). For matching: a short instruction like 'Match each term to its definition.'",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "mcq only: exactly 4 options.",
            },
            correctIndex: { type: "integer", description: "mcq only: 0-based correct index." },
            pairs: {
              type: "array",
              items: {
                type: "object",
                properties: { left: { type: "string" }, right: { type: "string" } },
                required: ["left", "right"],
              },
              description: "matching only: 4-6 term/definition pairs.",
            },
            answer: { type: "string", description: "fill-blank only: the exact correct answer." },
            explanation: { type: "string", description: "Brief explanation shown after answering." },
          },
          required: ["format", "prompt", "explanation"],
        },
      },
    },
    required: ["items"],
  },
};

export async function generatePracticeTest(
  subjectName: string,
  topicTitle: string,
  formats: PracticeFormat[],
  count: number,
  apiKey?: string,
): Promise<GeneratedPracticeItem[]> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3072,
    tools: [PRACTICE_TEST_TOOL],
    tool_choice: { type: "tool", name: PRACTICE_TEST_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write a ${count}-item practice test for a WJEC/Eduqas A-level ${subjectName} student on "${topicTitle}", using only these formats: ${formats.join(", ")}. Distribute items roughly evenly across the requested formats. Each item must be answerable from its own prompt at A-level depth.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  const items = (toolUse.input as { items: GeneratedPracticeItem[] }).items;
  return items.map((item) => ({
    format: item.format,
    prompt: item.prompt,
    options: item.options ?? null,
    correctIndex: item.correctIndex ?? null,
    pairs: item.pairs ?? null,
    answer: item.answer ?? null,
    explanation: item.explanation,
  }));
}

export interface GeneratedAudioLine {
  speaker: "Host A" | "Host B";
  line: string;
}

const AUDIO_SCRIPT_TOOL = {
  name: "emit_audio_script",
  description: "Return a two-host podcast-style script summarizing a topic.",
  input_schema: {
    type: "object" as const,
    properties: {
      script: {
        type: "array",
        items: {
          type: "object",
          properties: {
            speaker: { type: "string", enum: ["Host A", "Host B"] },
            line: { type: "string", description: "One or two sentences of dialogue." },
          },
          required: ["speaker", "line"],
        },
      },
    },
    required: ["script"],
  },
};

export async function generateAudioScript(
  subjectName: string,
  topicTitle: string,
  apiKey?: string,
): Promise<GeneratedAudioLine[]> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [AUDIO_SCRIPT_TOOL],
    tool_choice: { type: "tool", name: AUDIO_SCRIPT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write a friendly, conversational two-host podcast script (12-20 lines, alternating naturally) where "Host A" and "Host B" discuss and summarize the WJEC/Eduqas A-level ${subjectName} topic "${topicTitle}" for a student revising it. Keep it accurate and exam-relevant, not just chit-chat.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }
  return (toolUse.input as { script: GeneratedAudioLine[] }).script;
}

export async function extractTextFromImage(
  imageBase64: string,
  mediaType: string,
  apiKey?: string,
): Promise<string> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Transcribe all text visible in this image (handwritten or printed) into clean, readable digital text. Preserve structure like headings and bullet points where evident. Return only the transcribed text, no commentary.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }
  return textBlock.text;
}
