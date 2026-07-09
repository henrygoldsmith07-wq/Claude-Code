import { GoogleGenAI } from "@google/genai";

// gemini-2.5-flash-lite supports Google Search grounding and has the largest
// free-tier daily quota (~1,000 requests/day), so casual browsing is very
// unlikely to exhaust it.
const MODEL = "gemini-2.5-flash-lite";

// Fixed topic set every country summary is organised into. Kept stable so the
// UI can render consistent sections regardless of what Gemini returns.
export const TOPICS = [
  "Politics",
  "Economy & Business",
  "World & Conflict",
  "Science & Health",
  "Technology",
  "Society & Culture",
  "Sport",
] as const;

export type Topic = (typeof TOPICS)[number];

export interface TopicSummary {
  topic: string;
  summary: string;
  keyPoints: string[];
}

export interface NewsSource {
  title: string;
  url: string;
}

export interface CountryNews {
  country: string;
  code: string;
  generatedAt: string;
  topics: TopicSummary[];
  sources: NewsSource[];
}

// Raised when GEMINI_API_KEY isn't configured, so callers can render a clear
// "add your key" state instead of a 500.
export class MissingApiKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured.");
    this.name = "MissingApiKeyError";
  }
}

// Raised when Gemini returns 429 (quota / rate limit) so the page can show a
// clear "try again shortly" message instead of a generic failure.
export class RateLimitError extends Error {
  constructor() {
    super("Gemini rate limit or quota exceeded.");
    this.name = "RateLimitError";
  }
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey });
}

function buildPrompt(countryName: string): string {
  return `You are an impartial international news editor. Using Google Search, find the most important and recent news about ${countryName} (focus on roughly the last 7 days).

Summarise it, organised into these topics: ${TOPICS.join(", ")}.

Editorial rules — this must be strictly neutral:
- Write in a plain, factual, non-partisan tone. No loaded or emotive language.
- Present multiple sides of contested issues. Where credible outlets disagree, say so explicitly and attribute claims ("the government says…", "opposition figures argue…") rather than asserting one side as fact.
- Prefer verifiable, recent developments over speculation or opinion.
- Only include a topic if there is genuinely noteworthy recent news for it. Omit topics with nothing to report rather than padding.

Return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:
{
  "topics": [
    { "topic": "<one of the topic names above>", "summary": "<2-4 sentence neutral summary>", "keyPoints": ["<short factual bullet>", "..."] }
  ]
}
Each summary should be 2-4 sentences. Provide 2-4 keyPoints per topic. If there is no meaningful recent news for ${countryName} at all, return {"topics": []}.`;
}

function buildWorldPrompt(): string {
  return `You are an impartial international news editor. Using Google Search, find the most important news happening around the world right now (focus on roughly the last 7 days). Prioritise globally significant developments across multiple regions, not just one country.

Summarise it, organised into these topics: ${TOPICS.join(", ")}.

Editorial rules — this must be strictly neutral:
- Write in a plain, factual, non-partisan tone. No loaded or emotive language.
- Present multiple sides of contested issues. Where credible outlets disagree, say so explicitly and attribute claims rather than asserting one side as fact.
- Prefer verifiable, recent developments over speculation or opinion.
- Draw from different parts of the world; don't over-index on a single country.
- Only include a topic if there is genuinely noteworthy recent news for it.

Return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:
{
  "topics": [
    { "topic": "<one of the topic names above>", "summary": "<2-4 sentence neutral summary>", "keyPoints": ["<short factual bullet>", "..."] }
  ]
}
Each summary should be 2-4 sentences. Provide 2-4 keyPoints per topic.`;
}

// Pull a JSON object out of the model's text, tolerating stray prose or code
// fences the model may add despite instructions.
function extractJson(text: string): { topics: TopicSummary[] } {
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  const parsed = JSON.parse(candidate) as { topics?: unknown };
  const topics = Array.isArray(parsed.topics) ? (parsed.topics as TopicSummary[]) : [];
  return { topics };
}

// Normalise/validate model output into clean TopicSummary rows, dropping
// anything malformed and ordering by our canonical topic list.
function normaliseTopics(raw: TopicSummary[]): TopicSummary[] {
  const byTopic = new Map<string, TopicSummary>();
  for (const row of raw) {
    if (!row || typeof row.topic !== "string" || typeof row.summary !== "string") continue;
    const topic = TOPICS.find((t) => t.toLowerCase() === row.topic.trim().toLowerCase());
    if (!topic || byTopic.has(topic)) continue;
    const keyPoints = Array.isArray(row.keyPoints)
      ? row.keyPoints.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    if (!row.summary.trim()) continue;
    byTopic.set(topic, { topic, summary: row.summary.trim(), keyPoints });
  }
  return TOPICS.map((t) => byTopic.get(t)).filter((r): r is TopicSummary => Boolean(r));
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

// Extract the real, de-duplicated source links Google Search grounded the
// answer on. These make the summary verifiable.
function extractSources(chunks: GroundingChunk[] | undefined): NewsSource[] {
  if (!chunks) return [];
  const seen = new Set<string>();
  const sources: NewsSource[] = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: chunk.web?.title || url });
  }
  return sources;
}

// Run a grounded prompt and shape the result into topic summaries + sources.
// Shared by the country and world summarisers. Throws MissingApiKeyError if the
// key is unset, or RateLimitError on a 429.
async function runSummary(
  prompt: string,
  label: string,
  code: string,
): Promise<CountryNews> {
  const ai = getClient();

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });
  } catch (error) {
    // Surface quota/rate-limit (429) as a typed error so the UI can explain it.
    if ((error as { status?: number })?.status === 429) throw new RateLimitError();
    throw error;
  }

  const text = response.text ?? "";
  let topics: TopicSummary[] = [];
  try {
    topics = normaliseTopics(extractJson(text).topics);
  } catch {
    // Grounded responses occasionally wrap JSON in commentary we can't parse;
    // fall back to an empty topic list so the page renders an empty state.
    topics = [];
  }

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as
    | GroundingChunk[]
    | undefined;

  return {
    country: label,
    code,
    generatedAt: new Date().toISOString(),
    topics,
    sources: extractSources(chunks),
  };
}

// Search + summarise current news for one country, split into topics, with the
// grounding sources attached.
export function summariseCountryNews(countryName: string, code: string): Promise<CountryNews> {
  return runSummary(buildPrompt(countryName), countryName, code);
}

// Search + summarise the most important news worldwide, split into topics.
export function summariseWorldNews(): Promise<CountryNews> {
  return runSummary(buildWorldPrompt(), "Around the World", "world");
}
