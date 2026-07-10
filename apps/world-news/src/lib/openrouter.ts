import type { CountryNews, NewsPoint, TopicSummary } from "./gemini";
import { TOPICS } from "./gemini";
import { fetchScopeGeoNews } from "./gdelt";

// OpenRouter as the news source: instead of asking an LLM to invent the news
// (which would hallucinate), we fetch REAL geolocated articles from GDELT and
// use an OpenRouter model only to ORGANISE them into topic summaries + tagged
// points. So the model never fabricates — it only rewrites real data. Gated on
// OPENROUTER_API_KEY; callers fall back to Gemini when it's unset or fails.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

// The OpenRouter model that organises the GDELT articles. Defaults to a known
// free instruct model; override with the OPENROUTER_MODEL env var.
export function currentModel(): string {
  return process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
}

function stripFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start !== -1 && end > start ? body.slice(start, end + 1) : body.trim();
}

// Keep only well-formed topic rows, ordered by our canonical topic list.
function normaliseTopics(raw: unknown): TopicSummary[] {
  const byTopic = new Map<string, TopicSummary>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const row = item as { topic?: unknown; summary?: unknown; keyPoints?: unknown };
      const rawTopic = row.topic;
      const rawSummary = row.summary;
      if (typeof rawTopic !== "string" || typeof rawSummary !== "string") continue;
      const topic = TOPICS.find((t) => t.toLowerCase() === rawTopic.trim().toLowerCase());
      if (!topic || byTopic.has(topic) || !rawSummary.trim()) continue;
      const keyPoints = Array.isArray(row.keyPoints)
        ? row.keyPoints.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : [];
      byTopic.set(topic, { topic, summary: rawSummary.trim(), keyPoints });
    }
  }
  return TOPICS.map((t) => byTopic.get(t)).filter((r): r is TopicSummary => Boolean(r));
}

// Ask the model to organise the real GDELT points into topics + tags. Returns
// null on any failure so the caller can fall back.
async function organise(
  points: NewsPoint[],
  label: string,
): Promise<{ topics: TopicSummary[]; points: NewsPoint[] } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || points.length === 0) return null;

  const articles = points.map((p, i) => ({
    i,
    topic: p.topic,
    headline: p.headline,
    location: p.location,
  }));

  const prompt = `You are an impartial news editor. Below are REAL news articles about ${label}, each with an index, topic, headline and location. Organise them into a briefing — do NOT invent, add, or assume any news beyond what is listed; base every word only on these articles.

Group them into these topics: ${TOPICS.join(", ")}.

Return ONLY JSON (no prose, no markdown):
{
  "topics": [ { "topic": "<one of the topic names above>", "summary": "<2-4 sentence neutral summary drawn only from the listed headlines>", "keyPoints": ["<short factual bullet from the articles>"] } ],
  "points": [ { "i": <article index>, "tags": ["<2-4 short lowercase tags: people, orgs, places, themes>"] } ]
}
Only include a topic if there are articles for it. Use the SAME tag across related articles.

Articles:
${JSON.stringify(articles)}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        // Optional attribution headers OpenRouter recommends.
        "x-title": "World News Globe",
      },
      body: JSON.stringify({
        model: currentModel(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(stripFences(content)) as { topics?: unknown; points?: unknown };
    const topics = normaliseTopics(parsed.topics);

    const tagMap = new Map<number, string[]>();
    if (Array.isArray(parsed.points)) {
      for (const item of parsed.points) {
        const row = item as { i?: unknown; tags?: unknown };
        if (typeof row.i !== "number" || !Array.isArray(row.tags)) continue;
        tagMap.set(
          row.i,
          Array.from(
            new Set(
              row.tags
                .filter((t): t is string => typeof t === "string")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean),
            ),
          ).slice(0, 4),
        );
      }
    }
    const enriched = points.map((p, i) => ({ ...p, tags: tagMap.get(i) ?? p.tags }));
    return { topics, points: enriched };
  } catch {
    return null;
  }
}

// Produce a full CountryNews for a place using GDELT (real data) organised by
// the OpenRouter model. Returns null when OpenRouter is unconfigured or nothing
// usable comes back, so news.ts can fall back to Gemini.
export async function summariseViaOpenRouter(
  scope: "world" | "country",
  label: string,
  code: string,
  countryName?: string,
): Promise<CountryNews | null> {
  if (!openrouterConfigured()) return null;

  const { points, sources } = await fetchScopeGeoNews(countryName);
  if (points.length === 0) return null;

  const organised = await organise(points, label);
  if (!organised || organised.topics.length === 0) return null;

  const cc = scope === "country" ? code.toUpperCase() : "";
  const finalPoints = organised.points
    .map((p) => (cc ? { ...p, countryCode: cc } : p))
    .slice(0, 40);

  return {
    country: label,
    code,
    generatedAt: new Date().toISOString(),
    topics: organised.topics,
    sources,
    points: finalPoints,
    // Front-line geography can't be grounded from GDELT points, so war lines are
    // left to the Gemini path; keep them empty here rather than invent them.
    conflicts: [],
  };
}
