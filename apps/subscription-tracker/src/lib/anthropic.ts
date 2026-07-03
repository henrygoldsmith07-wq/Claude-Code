import Anthropic from "@anthropic-ai/sdk";
import type { Subscription } from "./types";

const MODEL = "claude-sonnet-5";

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("No Anthropic API key provided. Add your own key in the AI insights panel.");
  }
  return new Anthropic({ apiKey: key });
}

export interface CancellationSuggestion {
  subscriptionName: string;
  reason: string;
}

const OUTPUT_TOOL = {
  name: "emit_cancellation_suggestions",
  description: "Return subscriptions worth reviewing for cancellation or downgrade.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subscriptionName: { type: "string" },
            reason: {
              type: "string",
              description: "One sentence explaining why this is worth reviewing.",
            },
          },
          required: ["subscriptionName", "reason"],
        },
      },
    },
    required: ["suggestions"],
  },
};

export async function suggestCancellations(
  subscriptions: Subscription[],
  apiKey?: string,
): Promise<CancellationSuggestion[]> {
  const anthropic = getClient(apiKey);

  const summary = subscriptions
    .filter((s) => s.active)
    .map((s) => {
      const priceChanged = s.priceHistory.length > 1;
      return `- ${s.name} (${s.category}): $${(s.amountCents / 100).toFixed(2)}/${s.billingCycle}${priceChanged ? ", price has changed since first added" : ""}`;
    })
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Here is a person's active subscriptions:\n\n${summary}\n\nBased on category overlap, price increases, and typical usage patterns, suggest which ones are worth reviewing for cancellation or downgrade. Only suggest ones with a clear reason (duplicate category, price hike, commonly-forgotten service type). If nothing stands out, return an empty list.`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured output");
  }

  return (toolUse.input as { suggestions: CancellationSuggestion[] }).suggestions;
}
