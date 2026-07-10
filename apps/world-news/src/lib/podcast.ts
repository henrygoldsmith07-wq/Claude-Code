import type { CountryNews } from "./gemini";

// A NotebookLM-style two-host audio briefing generated from an already-fetched
// news summary. We turn the neutral topic summaries into a short, natural
// conversation between two hosts that the browser reads aloud with two voices.
// Groq (free, fast) writes the script when configured; otherwise we fall back
// to a deterministic local script so the feature always works — and we never
// spend Gemini quota on it.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export type Speaker = "Host" | "Cohost";

export interface PodcastLine {
  speaker: Speaker;
  text: string;
}

export interface Podcast {
  title: string;
  lines: PodcastLine[];
}

// Compact the summary into the raw material the script is built from.
function briefText(news: CountryNews): string {
  return news.topics
    .map((t) => {
      const points = t.keyPoints.length ? ` Key points: ${t.keyPoints.join("; ")}.` : "";
      return `${t.topic}: ${t.summary}${points}`;
    })
    .join("\n");
}

function buildScriptPrompt(news: CountryNews): string {
  const scope =
    news.code === "world" ? "the most important news around the world" : `recent news from ${news.country}`;
  return `You are scripting a short, lively two-host audio news briefing (podcast style, like NotebookLM's audio overview) about ${scope}.

Two hosts: "Host" (Alex) and "Cohost" (Sam). They talk naturally — reacting, asking each other short questions, handing off — but stay strictly impartial and factual. Do NOT invent any facts, numbers, names, or events beyond the brief below. If outlets disagree, note it neutrally.

Brief:
${briefText(news)}

Write 8 to 16 short spoken turns that flow as a conversation: a quick intro, the main stories, and a brief sign-off. Keep each turn to 1-2 sentences of plain spoken language (no stage directions, no markdown).

Respond ONLY with JSON: {"lines":[{"speaker":"Host"|"Cohost","text":"..."}]}`;
}

// Ask Groq to write the conversational script. Returns null if Groq isn't
// configured or anything goes wrong, so the caller can fall back.
async function generateWithGroq(news: CountryNews): Promise<PodcastLine[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: buildScriptPrompt(news) }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { lines?: unknown };
    return normaliseLines(parsed.lines);
  } catch {
    return null;
  }
}

// Keep only well-formed, non-empty lines with a valid speaker.
function normaliseLines(raw: unknown): PodcastLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: PodcastLine[] = [];
  for (const item of raw) {
    const l = item as { speaker?: unknown; text?: unknown };
    if (typeof l?.text !== "string" || !l.text.trim()) continue;
    const speaker: Speaker = String(l.speaker).toLowerCase().startsWith("co") ? "Cohost" : "Host";
    lines.push({ speaker, text: l.text.trim() });
    if (lines.length >= 30) break;
  }
  return lines.length >= 2 ? lines : null;
}

// Deterministic fallback: alternate the two hosts across the topic summaries so
// there's always a listenable briefing even without Groq.
function localScript(news: CountryNews): PodcastLine[] {
  const where = news.code === "world" ? "around the world" : news.country;
  const lines: PodcastLine[] = [
    { speaker: "Host", text: `Welcome to your World News briefing. Here's what's happening ${where}.` },
    { speaker: "Cohost", text: "Let's run through it, topic by topic — impartially, just the facts." },
  ];
  let speaker: Speaker = "Host";
  for (const t of news.topics) {
    lines.push({ speaker, text: `On ${t.topic.toLowerCase()}: ${t.summary}` });
    speaker = speaker === "Host" ? "Cohost" : "Host";
    const kp = t.keyPoints[0];
    if (kp) {
      lines.push({ speaker, text: `One thing to note there — ${kp}.` });
      speaker = speaker === "Host" ? "Cohost" : "Host";
    }
  }
  lines.push({ speaker: "Cohost", text: "That's the briefing. Check the sources below to read deeper." });
  return lines;
}

// Produce the podcast script for a news summary: Groq-written if possible,
// otherwise a deterministic local one. Never throws.
export async function generatePodcast(news: CountryNews): Promise<Podcast> {
  const title = news.code === "world" ? "Around the World" : news.country;
  if (news.topics.length === 0) {
    return { title, lines: [{ speaker: "Host", text: `No significant recent news to brief on for ${title}.` }] };
  }
  const groq = await generateWithGroq(news);
  return { title, lines: groq ?? localScript(news) };
}
