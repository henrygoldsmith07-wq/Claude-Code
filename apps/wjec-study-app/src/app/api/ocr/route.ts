import { NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Cap decoded image size at ~8 MB. base64 inflates by ~4/3, so we compare
// against the raw string length rather than decoding untrusted input first.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

export async function POST(request: Request) {
  // Calls the paid Anthropic vision API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "ocr", limit: 15, windowMs: 60_000 });
  if (limited) return limited;

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
  if (body.imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: `Image is too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)} MB)` },
      { status: 413 },
    );
  }

  try {
    const text = await extractTextFromImage(body.imageBase64, body.mediaType, body.apiKey);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
