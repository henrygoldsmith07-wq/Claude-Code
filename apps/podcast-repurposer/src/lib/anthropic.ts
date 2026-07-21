import Anthropic from "@anthropic-ai/sdk";
import type { EpisodeOutputs } from "./types";

const MODEL = "claude-sonnet-4-20250514";

function getClient(apiKey?: string): Anthropic {
  const key = apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "No Anthropic API key. Set ANTHROPIC_API_KEY on the server or paste a key in the form.",
    );
  }
  return new Anthropic({ apiKey: key });
}

const OUTPUT_TOOL = {
  name: "emit_episode_outputs",
  description: "Return the repurposed content generated from a podcast transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      blogPost: {
        type: "string",
        description:
          "A publish-ready blog post (600-900 words) adapted from the episode. Use clear structure with short paragraphs and subheadings where natural.",
      },
      showNotes: {
        type: "string",
        description:
          "Concise show notes summarizing the episode for a podcast directory. Bullet-friendly, scannable.",
      },
      socialSnippets: {
        type: "array",
        items: { type: "string" },
        description: "5-8 standalone quotable snippets suitable for social posts (Twitter/X, LinkedIn).",
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
  apiKey?: string,
): Promise<EpisodeOutputs> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `You are an expert podcast producer and content marketer. Repurpose this podcast episode into high-quality, ready-to-publish assets.\n\nEpisode title: "${title}"\n\nTranscript:\n${transcript}\n\nGuidelines:\n- Blog post should stand alone for someone who never heard the episode.\n- Show notes should be tight and directory-friendly.\n- Social snippets must be quotable without needing context.\n- Chapter timestamps are best-effort estimates from conversational flow.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }

  return toolUse.input as EpisodeOutputs;
}
