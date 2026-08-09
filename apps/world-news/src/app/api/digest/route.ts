import { NextResponse } from "next/server";

/**
 * Simple AI Daily Digest for the places the user follows / has pinned.
 * Body: { places: string[] }  // country names or pin labels
 * Returns a short neutral summary suitable for email/text.
 */

interface Body {
  places?: string[];
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function generateDigest(places: string[]): Promise<string> {
  const list = places.slice(0, 12).join(", ");
  const prompt = `You are an impartial news editor. Write a short, neutral daily digest (4-8 short paragraphs or bullet groups) covering the most important recent developments for these places the reader follows: ${list}.

Rules:
- Stick to verifiable recent events. If you have no specific knowledge for a place, say so briefly.
- Neutral tone, no opinion or loaded language.
- Group by place or by theme if that is clearer.
- Keep the whole digest under 400 words.

Return only the digest text, no preamble.`;

  // Prefer Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${groqKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.3,
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      /* fall through */
    }
  }

  // Gemini fallback
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (process.env.GEMINI_API_KEYS ?? "").split(/[\s,]+/).find(Boolean);
  if (geminiKey) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { temperature: 0.3 },
      });
      const text = (response.text ?? "").trim();
      if (text) return text;
    } catch {
      /* fall through */
    }
  }

  return `Daily digest for: ${list}.\n\nConfigure GROQ_API_KEY or GEMINI_API_KEY to generate a live summary of the places you follow.`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const places = Array.isArray(body.places)
    ? body.places.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];

  if (places.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one place name in places[]" },
      { status: 400 },
    );
  }

  const digest = await generateDigest(places);
  return NextResponse.json({
    digest,
    generatedAt: new Date().toISOString(),
    places,
  });
}
