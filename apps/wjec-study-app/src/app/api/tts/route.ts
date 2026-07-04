import { NextResponse } from "next/server";
import { synthesizeSpeech, HOST_VOICE_IDS } from "@/lib/elevenlabs";
import type { AudioScriptLine } from "@/lib/types";

export async function POST(request: Request) {
  let body: { script?: AudioScriptLine[]; elevenLabsKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.script) || body.script.length === 0) {
    return NextResponse.json({ error: "script is required" }, { status: 400 });
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
