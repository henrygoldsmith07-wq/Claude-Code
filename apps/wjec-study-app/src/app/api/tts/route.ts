import { NextResponse } from "next/server";
import { synthesizeSpeech, HOST_VOICE_IDS } from "@/lib/elevenlabs";
import { checkRateLimit } from "@/lib/rateLimit";
import type { AudioScriptLine } from "@/lib/types";

// Each script line is a separate paid ElevenLabs request, so bound the number
// of lines and total characters to keep one request from fanning out into many.
const MAX_SCRIPT_LINES = 60;
const MAX_SCRIPT_CHARS = 10_000;

export async function POST(request: Request) {
  // Fans out to the paid ElevenLabs API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "tts", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  let body: { script?: AudioScriptLine[]; elevenLabsKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.script) || body.script.length === 0) {
    return NextResponse.json({ error: "script is required" }, { status: 400 });
  }
  if (body.script.length > MAX_SCRIPT_LINES) {
    return NextResponse.json(
      { error: `script must have at most ${MAX_SCRIPT_LINES} lines` },
      { status: 400 },
    );
  }
  const totalChars = body.script.reduce((sum, line) => sum + (line?.line?.length ?? 0), 0);
  if (totalChars > MAX_SCRIPT_CHARS) {
    return NextResponse.json(
      { error: `script must be under ${MAX_SCRIPT_CHARS} characters total` },
      { status: 400 },
    );
  }
  if (!body.elevenLabsKey) {
    return NextResponse.json({ error: "An ElevenLabs API key is required" }, { status: 400 });
  }

  try {
    const buffers: Buffer[] = [];
    for (const line of body.script) {
      const voiceId = HOST_VOICE_IDS[line.speaker] ?? HOST_VOICE_IDS["Host A"];
      const audio = await synthesizeSpeech(line.line, voiceId, body.elevenLabsKey);
      buffers.push(Buffer.from(audio));
    }
    const combined = Buffer.concat(buffers);
    return NextResponse.json({ audioBase64: combined.toString("base64") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech synthesis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
