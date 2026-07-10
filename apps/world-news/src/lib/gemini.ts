import { GoogleGenAI } from "@google/genai";

// gemini-2.0-flash reliably returns grounded JSON with Google Search and has a
// generous free-tier daily quota (~200 requests/day). gemini-2.5-flash-lite was
// tried for its larger quota but frequently returned empty grounded responses,
// so summaries came back blank. With per-day caching + snapshots each place is
// generated at most once a day, so 200/day is ample.
const MODEL = "gemini-2.0-flash";

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

// A single geolocated news item, plotted as a dot on the maps.
export interface NewsPoint {
  topic: string;
  headline: string;
  location: string;
  lat: number;
  lng: number;
  // ISO 3166-1 alpha-2 of the country the item is in ("" if unknown). Used to
  // relate news across countries when hovering.
  countryCode: string;
  // Short lowercase tags (entities/themes) that let related items be linked.
  tags: string[];
}

// An active conflict / front line, drawn as a multi-point line in war-map mode.
// `path` is an ordered list of [lat, lng] points tracing the front's geography.
export interface ConflictLine {
  label: string;
  path: [number, number][];
}

export interface CountryNews {
  country: string;
  code: string;
  generatedAt: string;
  topics: TopicSummary[];
  sources: NewsSource[];
  points: NewsPoint[];
  conflicts: ConflictLine[];
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
  ],
  "points": [
    { "topic": "<one of the topic names above>", "headline": "<short headline of a specific news item>", "location": "<city or region name>", "lat": <decimal latitude>, "lng": <decimal longitude>, "countryCode": "<ISO 3166-1 alpha-2 country code>", "tags": ["<2-4 short lowercase tags: key people, organisations, or themes>"] }
  ],
  "conflicts": [
    { "label": "<short name of an active conflict / front line>", "path": [[<lat>, <lng>], [<lat>, <lng>], [<lat>, <lng>]] }
  ]
}
Each summary should be 2-4 sentences with 2-4 keyPoints. For "points", give 5-12 specific, geolocatable news items within ${countryName}, each with the approximate real coordinates of the city/region it concerns, its ISO country code, and 2-4 lowercase tags (shared tags should link related stories). For "conflicts", only include active armed conflicts or front lines relevant to ${countryName}; trace each front line in detail as an ordered "path" of 8-20 [lat, lng] points closely following its real geography (not a straight line). Use [] if there are none. If there is no meaningful recent news for ${countryName} at all, return {"topics": [], "points": [], "conflicts": []}.`;
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
  ],
  "points": [
    { "topic": "<one of the topic names above>", "headline": "<short headline of a specific news item>", "location": "<city or region name>", "lat": <decimal latitude>, "lng": <decimal longitude>, "countryCode": "<ISO 3166-1 alpha-2 country code>", "tags": ["<2-4 short lowercase tags: key people, organisations, or themes>"] }
  ],
  "conflicts": [
    { "label": "<short name of an active conflict / front line>", "path": [[<lat>, <lng>], [<lat>, <lng>], [<lat>, <lng>]] }
  ]
}
Each summary should be 2-4 sentences with 2-4 keyPoints. For "points", give 10-20 specific, geolocatable news items from around the world spread across different regions, each with the approximate real coordinates of the city/region it concerns, its ISO country code, and 2-4 lowercase tags (use the SAME tag on stories that are part of the same event or theme so related news can be linked). For "conflicts", include the major active armed conflicts / front lines worldwide; trace each front line in detail as an ordered "path" of 8-20 [lat, lng] points closely following its real geography (not a straight line). Use [] if none.`;
}

// Pull a JSON object out of the model's text, tolerating stray prose or code
// fences the model may add despite instructions.
function extractJson(text: string): {
  topics: TopicSummary[];
  points: NewsPoint[];
  conflicts: ConflictLine[];
} {
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  const parsed = JSON.parse(candidate) as {
    topics?: unknown;
    points?: unknown;
    conflicts?: unknown;
  };
  return {
    topics: Array.isArray(parsed.topics) ? (parsed.topics as TopicSummary[]) : [],
    points: Array.isArray(parsed.points) ? (parsed.points as NewsPoint[]) : [],
    conflicts: Array.isArray(parsed.conflicts) ? (parsed.conflicts as ConflictLine[]) : [],
  };
}

const isFiniteNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const inLatRange = (n: number) => n >= -90 && n <= 90;
const inLngRange = (n: number) => n >= -180 && n <= 180;

// Keep only well-formed points with valid coordinates, tagged to a known topic.
function normalisePoints(raw: NewsPoint[]): NewsPoint[] {
  const points: NewsPoint[] = [];
  for (const p of raw) {
    if (!p || typeof p.headline !== "string" || !p.headline.trim()) continue;
    if (!isFiniteNum(p.lat) || !isFiniteNum(p.lng)) continue;
    if (!inLatRange(p.lat) || !inLngRange(p.lng)) continue;
    const topic =
      TOPICS.find((t) => t.toLowerCase() === String(p.topic).trim().toLowerCase()) ?? "";
    const tags = Array.isArray(p.tags)
      ? Array.from(
          new Set(
            p.tags
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 5)
      : [];
    const countryCode =
      typeof p.countryCode === "string" && /^[A-Za-z]{2}$/.test(p.countryCode.trim())
        ? p.countryCode.trim().toUpperCase()
        : "";
    points.push({
      topic,
      headline: p.headline.trim(),
      location: typeof p.location === "string" ? p.location.trim() : "",
      lat: p.lat,
      lng: p.lng,
      countryCode,
      tags,
    });
  }
  return points.slice(0, 40);
}

// Keep only conflict lines with a valid multi-point coordinate path.
function normaliseConflicts(raw: unknown[]): ConflictLine[] {
  const conflicts: ConflictLine[] = [];
  for (const item of raw) {
    const c = item as { label?: unknown; path?: unknown };
    if (!c || typeof c.label !== "string" || !c.label.trim()) continue;
    if (!Array.isArray(c.path)) continue;
    const path: [number, number][] = [];
    for (const pt of c.path) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const [lat, lng] = pt as [unknown, unknown];
      if (!isFiniteNum(lat) || !isFiniteNum(lng)) continue;
      if (!inLatRange(lat) || !inLngRange(lng)) continue;
      path.push([lat, lng]);
      if (path.length >= 24) break;
    }
    if (path.length < 2) continue;
    conflicts.push({ label: c.label.trim(), path });
  }
  return conflicts.slice(0, 20);
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
  let points: NewsPoint[] = [];
  let conflicts: ConflictLine[] = [];
  try {
    const parsed = extractJson(text);
    topics = normaliseTopics(parsed.topics);
    points = normalisePoints(parsed.points);
    conflicts = normaliseConflicts(parsed.conflicts);
  } catch {
    // Grounded responses occasionally wrap JSON in commentary we can't parse;
    // fall back to empty lists so the page renders an empty state.
    topics = [];
    points = [];
    conflicts = [];
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
    points,
    conflicts,
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
