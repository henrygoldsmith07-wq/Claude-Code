import type { CountryNews, NewsPoint, TopicSummary } from "./gemini";
import { TOPICS } from "./gemini";
import { fetchScopeGeoNews } from "./gdelt";
import { buildSourceMix, inferSourceAttribution, type StoryCluster } from "./storyModel";

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

// Minimal cluster from GDELT points (no LLM story detail; used as a fallback so
// the repositioned UI still has stories even on the OpenRouter path).
function clustersFromPoints(points: NewsPoint[]): StoryCluster[] {
  // Tag-based clustering: points sharing a tag become one story.
  const tagGroups = new Map<string, NewsPoint[]>();
  const untagged: NewsPoint[] = [];
  for (const p of points) {
    if (p.tags.length === 0) untagged.push(p);
    else {
      const key = p.tags[0];
      const g = tagGroups.get(key) ?? [];
      g.push(p);
      tagGroups.set(key, g);
    }
  }
  const stories: StoryCluster[] = [];
  let id = 0;
  for (const [tag, group] of tagGroups) {
    if (stories.length >= 6) break;
    const head = group[0];
    const attributions = group.slice(0, 4).map((g) => inferSourceAttribution(`https://gdelt.example/${id}`, g.headline));
    stories.push({
      id: `cluster-${tag}-${id++}`,
      headline: head.headline,
      topic: head.topic || "Politics",
      summary: group.map((g) => g.headline).join(" · ").slice(0, 400),
      keyPoints: group.slice(0, 3).map((g) => g.headline),
      location: head.location ? { label: head.location, lat: head.lat, lng: head.lng, countryCode: head.countryCode || undefined } : undefined,
      sources: attributions,
      sourceMix: buildSourceMix(attributions),
      primarySources: [],
      timeline: [],
      conflictingClaims: [],
      widelyAgreedFacts: [],
      uncertainty: ["Awaiting full source comparison (GDELT-based cluster)."],
      corrections: [],
      coverageGaps: ["GDELT clustering is heuristic; see Gemini refresh for full what/where/who/differ breakdown."],
    });
  }
  // If still few clusters, add untagged topics
  if (stories.length < 2 && untagged.length > 0) {
    for (const p of untagged.slice(0, 2)) {
      const a = inferSourceAttribution(`https://gdelt.example/untagged-${id}`, p.headline);
      stories.push({
        id: `cluster-untagged-${id++}`,
        headline: p.headline,
        topic: p.topic || "Politics",
        summary: p.headline,
        keyPoints: [],
        location: p.location ? { label: p.location, lat: p.lat, lng: p.lng } : undefined,
        sources: [a],
        sourceMix: buildSourceMix([a]),
        primarySources: [],
        timeline: [],
        conflictingClaims: [],
        widelyAgreedFacts: [],
        uncertainty: [],
        corrections: [],
        coverageGaps: [],
      });
    }
  }
  return stories.slice(0, 8);
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

  const gcSources = sources.length ? sources : finalPoints.slice(0, 8).map((p) => ({ url: `https://gdelt.example/${encodeURIComponent(p.headline)}`, title: p.headline }));
  const stories = clustersFromPoints(finalPoints);
  // Use real gc sources as the page sources; keep clusters' placeholder sources separate.

  return {
    country: label,
    code,
    generatedAt: new Date().toISOString(),
    topics: organised.topics,
    sources: gcSources.slice(0, 24),
    points: finalPoints,
    conflicts: [],
    stories,
    meta: {
      widelyAgreedFacts: [],
      uncertainty: ["This is a GDELT-grounded clustering; the grounded Gemini refresh adds timeline, conflicting claims and coverage gaps."],
      coverageGaps: ["Primary sources and perspective mix require the grounded refresh."],
      corrections: [],
      whatChangedSinceYesterday: null,
    },
  };
}
