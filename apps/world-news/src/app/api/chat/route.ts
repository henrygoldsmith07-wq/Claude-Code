import { NextResponse } from "next/server";

// Lightweight map-aware chat (“Marco”-style).
// Accepts the current viewport, visible points, hovered country and any open
// conflict so the model can answer questions grounded in what’s on the map.

interface ChatContext {
  region?: string;
  altitude?: number;
  country?: string;
  points?: { headline: string; location?: string; topic?: string }[];
  conflict?: string;
}

interface Body {
  message?: string;
  context?: ChatContext;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function buildSystem(ctx: ChatContext): string {
  const lines: string[] = [
    "You are Marco, a concise, impartial map-aware news assistant.",
    "You answer questions about what is happening in the region the user is currently looking at on a 3D world news globe.",
    "Be neutral, factual and short (2-5 sentences unless the user asks for more). Never invent events.",
  ];

  if (ctx.region) lines.push(`Current map centre / region focus: ${ctx.region}.`);
  if (typeof ctx.altitude === "number") {
    lines.push(`Camera altitude (relative): ${ctx.altitude.toFixed(2)} (higher = more of the world visible).`);
  }
  if (ctx.country) lines.push(`User is hovering or has selected: ${ctx.country}.`);
  if (ctx.conflict) lines.push(`An open conflict line is visible: ${ctx.conflict}.`);
  if (ctx.points && ctx.points.length > 0) {
    lines.push("Recent visible stories on the map (use these as primary context):");
    for (const p of ctx.points.slice(0, 12)) {
      lines.push(`- ${p.headline}${p.location ? ` (${p.location})` : ""}${p.topic ? ` [${p.topic}]` : ""}`);
    }
  } else {
    lines.push("No specific news points are currently visible in the viewport.");
  }
  lines.push("If the user asks about something outside the provided context, say so politely and stay helpful.");
  return lines.join("\n");
}

async function replyWithGroq(message: string, system: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function replyWithGemini(message: string, system: string): Promise<string | null> {
  // Minimal Gemini text-only call (no search tool needed for conversational follow-up).
  const key =
    process.env.GEMINI_API_KEY ||
    (process.env.GEMINI_API_KEYS ?? "").split(/[\s,]+/).find(Boolean);
  if (!key) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `${system}\n\nUser: ${message}`,
      config: { temperature: 0.4 },
    });
    return (response.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const ctx: ChatContext = body.context ?? {};
  const system = buildSystem(ctx);

  // Prefer Groq (fast + free), fall back to Gemini, then a static reply.
  let answer =
    (await replyWithGroq(message, system)) ||
    (await replyWithGemini(message, system));

  if (!answer) {
    answer =
      "I can answer questions about the stories currently visible on the map once a GROQ_API_KEY or GEMINI_API_KEY is configured. For now, try clicking a country for its full summary.";
  }

  return NextResponse.json({ answer });
}
