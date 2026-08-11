import { required, optional } from "./env";
import type { Transcript, TranscriptSegment } from "./types";
import { transcribeChunked } from "./providers";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/** Groq rejects files above ~25MB on the free tier / 100MB on dev tier. */
export const GROQ_MAX_BYTES = 100 * 1024 * 1024;

interface GroqVerboseResponse {
  text: string;
  language?: string;
  segments?: { start: number; end: number; text: string }[];
}

async function transcribeOnce(bytes: Uint8Array, filename: string, mimeType: string): Promise<Transcript> {
  const model = optional("GROQ_TRANSCRIBE_MODEL", "whisper-large-v3");
  const form = new FormData();
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  form.append("file", new Blob([ab], { type: mimeType }), filename);
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("GROQ_API_KEY")}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq transcription failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  const data = (await res.json()) as GroqVerboseResponse;
  const segments: TranscriptSegment[] = (data.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }));
  return { language: data.language, text: data.text.trim(), segments };
}

/** Transcribe with chunk-and-stitch for long recordings. */
export async function transcribe(bytes: Uint8Array, filename: string, mimeType: string): Promise<Transcript> {
  if (bytes.byteLength <= GROQ_MAX_BYTES) return transcribeOnce(bytes, filename, mimeType);
  return transcribeChunked(bytes, transcribeOnce, { mimeType, filename });
}

export { transcribeOnce };
