import { NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/anthropicAssistant";

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: Request) {
  let body: { imageBase64?: string; mediaType?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }
  if (!body.mediaType || !VALID_MEDIA_TYPES.includes(body.mediaType)) {
    return NextResponse.json({ error: "Unsupported or missing mediaType" }, { status: 400 });
  }

  try {
    const text = await extractTextFromImage(body.imageBase64, body.mediaType, body.apiKey);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
