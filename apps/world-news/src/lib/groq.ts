import type { NewsPoint } from "./gemini";

// Groq (console.groq.com) — free, fast inference over open models via an
// OpenAI-compatible API. We use it to enrich the real GDELT news points with
// short tags (and a tidier headline) so related stories can be linked. Groq
// can't browse the web, so it only ever rewrites/labels the GDELT data — it
// never invents news. Gated on GROQ_API_KEY; a no-op if unset or on error.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

interface EnrichedRow {
  i: number;
  headline?: string;
  tags?: string[];
}

// Add tags (and optionally a cleaner headline) to a batch of points. Returns
// the points unchanged if Groq isn't configured or anything goes wrong.
export async function enrichPointsWithGroq(points: NewsPoint[]): Promise<NewsPoint[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key || points.length === 0) return points;

  const items = points.map((p, i) => ({
    i,
    headline: p.headline,
    location: p.location,
    topic: p.topic,
  }));

  const prompt = `For each news item below, return 2-4 short lowercase tags (key people, organisations, places, or themes) and, if the headline is messy, a cleaner neutral one. Use the SAME tag across items about the same event so related stories can be linked. Respond ONLY with JSON: {"items":[{"i":<index>,"headline":"<optional cleaned headline>","tags":["tag1","tag2"]}]}.

Items:
${JSON.stringify(items)}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return points;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return points;
    const parsed = JSON.parse(content) as { items?: EnrichedRow[] };
    const rows = Array.isArray(parsed.items) ? parsed.items : [];

    const out = points.map((p) => ({ ...p }));
    for (const row of rows) {
      const p = out[row.i];
      if (!p) continue;
      if (Array.isArray(row.tags)) {
        p.tags = Array.from(
          new Set(
            row.tags
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 4);
      }
      if (typeof row.headline === "string" && row.headline.trim()) {
        p.headline = row.headline.trim();
      }
    }
    return out;
  } catch {
    return points;
  }
}
