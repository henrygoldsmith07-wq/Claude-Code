import Anthropic from "@anthropic-ai/sdk";
import type { EpisodeOutputs } from "./types";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const OUTPUT_TOOL = {
  name: "emit_episode_outputs",
  description: "Return the repurposed content generated from a podcast transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      blogPost: {
        type: "string",
        description: "A publish-ready blog post (600-900 words) adapted from the episode.",
      },
      showNotes: {
        type: "string",
        description: "Concise show notes summarizing the episode for a podcast directory.",
      },
      socialSnippets: {
        type: "array",
        items: { type: "string" },
        description: "5-8 standalone quotable snippets suitable for social posts.",
      },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", description: "mm:ss estimate" },
            title: { type: "string" },
          },
          required: ["timestamp", "title"],
        },
        description: "Chapter markers inferred from topic shifts in the transcript.",
      },
    },
    required: ["blogPost", "showNotes", "socialSnippets", "chapters"],
  },
};

export async function generateEpisodeOutputs(
  title: string,
  transcript: string,
): Promise<EpisodeOutputs> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Repurpose this podcast episode titled "${title}" into a blog post, show notes, social snippets, and chapters.\n\nTranscript:\n${transcript}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }

  return toolUse.input as EpisodeOutputs;
}
