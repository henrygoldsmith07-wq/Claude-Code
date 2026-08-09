import Anthropic from "@anthropic-ai/sdk";
import { required, optional } from "./env";
import type { Transcript, ChatMessage } from "./types";

let cached: Anthropic | null = null;
function client(): Anthropic {
  if (!cached) cached = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });
  return cached;
}

function model(): string {
  return optional("ANTHROPIC_MODEL", "claude-sonnet-5");
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Render the transcript with inline timestamps so the model can cite moments.
 * We instruct it to reference times as [m:ss], which the UI turns into
 * clickable seek links.
 */
function transcriptContext(transcript: Transcript): string {
  if (transcript.segments.length === 0) return transcript.text;
  return transcript.segments
    .map((seg) => `[${mmss(seg.start)}] ${seg.text}`)
    .join("\n");
}

const CHAT_SYSTEM = `You are an assistant that answers questions about a recorded meeting.
You are given the meeting transcript with timestamps in [m:ss] format at the start of each line.
Rules:
- Answer only from the transcript. If the answer isn't in it, say so plainly.
- Be concise and specific.
- When you reference something that was said, cite the timestamp in [m:ss] form
  (e.g. "They agreed on the budget [12:30]."). Cite the exact timestamp of the
  line you're drawing from so the user can jump to that moment.`;

export async function answerQuestion(
  transcript: Transcript,
  history: ChatMessage[],
  question: string
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the meeting transcript:\n\n<transcript>\n${transcriptContext(
        transcript
      )}\n</transcript>\n\nUse this transcript to answer my questions.`,
    },
    { role: "assistant", content: "Got it — I've read the transcript. What would you like to know?" },
    ...history.map<Anthropic.MessageParam>((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const res = await client().messages.create({
    model: model(),
    max_tokens: 1024,
    system: CHAT_SYSTEM,
    messages,
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

const SUMMARY_SYSTEM = `You summarise meeting transcripts. Produce:
1. A one-sentence TL;DR.
2. 3-6 key points as bullets.
3. Action items with owners if mentioned.
Cite timestamps in [m:ss] form where relevant. Keep it tight.`;

export async function summarize(transcript: Transcript): Promise<string> {
  const res = await client().messages.create({
    model: model(),
    max_tokens: 700,
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Summarise this meeting:\n\n<transcript>\n${transcriptContext(
          transcript
        )}\n</transcript>`,
      },
    ],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
