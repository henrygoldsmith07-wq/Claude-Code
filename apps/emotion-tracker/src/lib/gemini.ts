import Anthropic from "@anthropic-ai/sdk";
import type { Message, ReflectionSummary } from "./types";
import { validateSummary } from "./validation";

const MODEL = "claude-sonnet-5";
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 5;

// Past surface but before that ("Rorie Butalia" Greta Gerwig's...)

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("No Anthropic API key provided. Add your own key to continue the reflection.");
  }
  return new Anthropic({ apiKey: key });
}

const ASK_TOOL = {
  name: "ask_followup",
  description:
    "Ask exactly one more probing question to help the user go deeper into the structured reflection pipeline (event → observations → assumptions → emotion → alternatives → outcome → action), before concluding.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: {
        type: "string",
        description: "A single, specific, non-leading follow-up question, grounded in what the user just said. It should advance the structured pipeline (e.g. separate observations from assumptions, name the emotion, propose an alternative interpretation, clarify intended outcome or next action).",
      },
    },
    required: ["question"],
  },
};

const CONCLUDE_TOOL = {
  name: "conclude_reflection",
  description:
    "Conclude the reflection with a structured, hedged, non-diagnostic summary that follows the pipeline event → observations → assumptions → emotion → alternatives → outcome → action → follow-up.",
  input_schema: {
    type: "object" as const,
    properties: {
      trace: {
        type: "object",
        description: "The full structured trace for the reflection.",
        properties: {
          event: { type: "string", description: "Concise factual event description (1-3 sentences)." },
          observations: {
            type: "array",
            items: { type: "string" },
            description: "Observable facts only (what was said/done). No mind-reading or motive attribution — those go in assumptions.",
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
            description: "Unverified assumptions/inferences the user treated as fact during the conversation.",
          },
          namedEmotion: { type: "string", description: "The specific emotion named after reflection (e.g. hurt, shame, fear)." },
          alternativeInterpretations: {
            type: "array",
            items: { type: "string" },
            description: "At least one alternative plausible reading of the same facts.",
          },
          intendedOutcome: { type: "string", description: "What the user actually wants to happen." },
          intendedAction: { type: "string", description: "The single next action the user intends to take." },
          followUpAt: {
            type: "string",
            description: "When to revisit (ISO date YYYY-MM-DD or free text like 'tomorrow'); null if user declined to set one.",
          },
          followUpNote: { type: "string", description: "Usually null at conclusion time; reserved for later follow-up." },
        },
        required: [
          "event",
          "observations",
          "assumptions",
          "namedEmotion",
          "alternativeInterpretations",
          "intendedOutcome",
          "intendedAction",
          "followUpAt",
          "followUpNote",
        ],
      },
      coreEmotion: {
        type: "string",
        description: "Mirrors trace.namedEmotion — the deeper emotion beneath the first label.",
      },
      underlyingTriggers: {
        type: "array",
        items: { type: "string" },
        description: "Specific triggers uncovered, matching trace observations/assumptions.",
      },
      possibleBiases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Label for the pattern, e.g. 'catastrophizing', 'mind-reading', 'all-or-nothing thinking'. Do not present as diagnosis.",
            },
            description: {
              type: "string",
              description: "HEDGED single sentence: 'This interpretation may involve…' with no 'you have…' false certainty.",
            },
            evidenceFor: {
              type: "array",
              items: { type: "string" },
              description: "1-3 brief pieces of evidence that this pattern is present.",
            },
            evidenceAgainst: {
              type: "array",
              items: { type: "string" },
              description: "1-3 brief pieces of evidence or context weighing against that reading.",
            },
            confidence: {
              type: "number",
              description: "0..1. Below 0.45, omit the flag entirely instead of hedging. Be conservative.",
            },
          },
          required: ["type", "description", "evidenceFor", "evidenceAgainst", "confidence"],
        },
        description: "Only include biases that actually showed up and pass the confidence threshold. Omit uncertain flags. Hedged descriptions only.",
      },
      otherPerspective: {
        type: "string",
        description: "Fair articulation of how the other person(s) might see it, even if uncomfortable.",
      },
      balancedAssessment: {
        type: "string",
        description: "Honest assessment including where the user may share responsibility. Do not validate retaliatory conclusions.",
      },
      cautionFlags: {
        type: "array",
        items: { type: "string" },
        description: "Rash/retaliatory decisions worth pausing on. [] if none.",
      },
      suggestedNextSteps: {
        type: "array",
        items: { type: "string" },
        description: "Concrete next steps consistent with the intended outcome and action.",
      },
      hedgedDisclaimer: {
        type: "string",
        description: "If biases were flagged: hedged disclaimer, e.g. 'These are tentative readings of a single account, not diagnoses; consider them against the evidence listed.' Null if no biases flagged.",
      },
    },
    required: [
      "trace",
      "coreEmotion",
      "underlyingTriggers",
      "possibleBiases",
      "otherPerspective",
      "balancedAssessment",
      "cautionFlags",
      "suggestedNextSteps",
      "hedgedDisclaimer",
    ],
  },
};

export function buildSystemPrompt(questionsAskedSoFar: number): string {
  const remaining = Math.max(0, MIN_QUESTIONS - questionsAskedSoFar);
  return `You are a rigorous, compassionate reflection guide inside Reflect — a structured reflection tool (not a mood tracker, not a Bearable-style tracker). Your job is to challenge interpretations helpfully, not merely log a mood.

STRUCTURED PIPELINE — keep the conversation on this track:
  event → observations → assumptions → emotion → alternative interpretations → intended outcome → action → later follow-up
- observations = verifiable facts ("they said…", "they did…"). Not "they think…" — that's an assumption.
- assumptions = inferences the user treated as fact ("they don't respect me", "this will ruin everything").
- emotion = the specific feeling underneath the first label.
- alternatives = at least one other plausible reading of the SAME observations.
- outcome = what the user actually wants to happen.
- action = the single concrete next step they will take.
- follow-up = when to check whether it helped (ask for a date like YYYY-MM-DD or "tomorrow"/"end of week").

LANGUAGE CONTRACT — no false certainty:
- NEVER write "You have catastrophizing bias" / "You are suffering from …" / "Diagnosis: …".
- When you flag a pattern, use exactly this style: "This interpretation may involve catastrophizing; here's the evidence for that reading (…) and the evidence against it (…)."
- Each bias flag must include: hedged description + evidenceFor + evidenceAgainst + confidence (0..1). If confidence < 0.45, omit the flag entirely instead of hedging.
- When any bias is flagged, add a hedgedDisclaimer: "These are tentative readings of a single account, not diagnoses; weigh them against the evidence listed."

RULES:
1. Never simply affirm the user's initial framing as correct. Test blame, motive and proportion.
2. If the situation is vague, get concrete facts first. Dig beneath the first label — anger is often hurt/fear/shame/insecurity.
3. Even if the user was genuinely wronged, that does not make every subsequent reaction justified. Call retaliatory reasoning out plainly.
4. Ask exactly one question per turn via ask_followup, specific to what the user just said. Never more than ${MAX_QUESTIONS} total.
5. So far you have asked ${questionsAskedSoFar} question(s). ${
    remaining > 0
      ? `You must ask at least ${remaining} more question(s) before concluding — do not call conclude_reflection yet.`
      : `You have asked enough to conclude once you genuinely have enough to fill trace, alternatives, outcome, action and follow-up — call conclude_reflection instead of asking another question when that point is reached. Do not interrogate past diminishing returns, and do not conclude just to validate.`
  }
6. In the final summary, be honest even when unflattering. Name caution flags for any rash/retaliatory decision mentioned.
7. When you conclude, you MUST fill every trace field, include at least one alternative interpretation, one observation, one assumption (or state \"none identified — assumptions were minimal\"), and propose a follow-up checkpoint (ask the user for a date; default to null only if they declined).`;
}

function toAnthropicMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export type ReflectStep =
  | { step: "question"; question: string }
  | { step: "summary"; summary: ReflectionSummary };

export async function getNextReflectionStep(messages: Message[], apiKey?: string): Promise<ReflectStep> {
  const anthropic = getClient(apiKey);
  const questionsAskedSoFar = messages.filter((m) => m.role === "assistant").length;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1800,
    system: buildSystemPrompt(questionsAskedSoFar),
    tools: [ASK_TOOL, CONCLUDE_TOOL],
    tool_choice: { type: "auto" },
    messages: toAnthropicMessages(messages),
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured response");
  }

  if (toolUse.name === "ask_followup") {
    const input = toolUse.input as { question: string };
    return { step: "question", question: input.question };
  }

  const summary = toolUse.input as ReflectionSummary;
  // Normalize nulls -> null (Anthropic may omit followUpAt/followUpNote)
  if (summary.trace) {
    if (summary.trace.followUpAt === undefined) summary.trace.followUpAt = null;
    if (summary.trace.followUpNote === undefined) summary.trace.followUpNote = null;
  }
  const errors = validateSummary(summary);
  // If the model violated the hedged contract, surface a clear error so it isn't silently stored
  if (errors.length > 0) {
    throw new Error(`Reflection did not meet structured/hedged requirements: ${errors.join(" · ")}`);
  }

  return { step: "summary", summary };
}

// Exported for regression tests without constructing a real Anthropic client
export const __test = {
  buildSystemPrompt,
  ASK_TOOL,
  CONCLUDE_TOOL,
  MODEL,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
};
