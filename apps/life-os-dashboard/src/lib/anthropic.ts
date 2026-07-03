import Anthropic from "@anthropic-ai/sdk";
import type { CoachBriefing } from "./types";

const MODEL = "claude-sonnet-5";

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("No Anthropic API key provided. Add your own key in the AI Coach panel.");
  }
  return new Anthropic({ apiKey: key });
}

const OUTPUT_TOOL = {
  name: "emit_coach_briefing",
  description: "Return a personalized daily coaching briefing grounded in the user's tracked data.",
  input_schema: {
    type: "object" as const,
    properties: {
      dailyFocus: {
        type: "string",
        description: "One sentence: the single most impactful thing to focus on today.",
      },
      wins: {
        type: "array",
        items: { type: "string" },
        description: "1-3 short, specific recent wins worth acknowledging, drawn from the data.",
      },
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            domain: { type: "string", description: "e.g. Sleep, Finance, Habits" },
            observation: { type: "string", description: "One sentence, grounded in the actual numbers given." },
            action: { type: "string", description: "One concrete, small next action." },
          },
          required: ["domain", "observation", "action"],
        },
      },
      motivation: {
        type: "string",
        description: "One short, genuine, non-cheesy line to close on.",
      },
    },
    required: ["dailyFocus", "wins", "insights", "motivation"],
  },
};

export async function generateCoachBriefing(
  summary: string,
  apiKey?: string,
): Promise<Omit<CoachBriefing, "generatedAt">> {
  const anthropic = getClient(apiKey);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Here is a snapshot of someone's self-tracked life data across finance, habits, routines, health & nutrition, sleep, hormesis, goals, meditation, study, relationships, self-improvement, and mental health:\n\n${summary}\n\nAct as a thoughtful, non-judgmental life coach. Identify what's working, what's being neglected, and the single highest-leverage focus for today. Ground every insight in the actual data given — never invent numbers. Skip domains with no data rather than guessing.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }

  return toolUse.input as Omit<CoachBriefing, "generatedAt">;
}
