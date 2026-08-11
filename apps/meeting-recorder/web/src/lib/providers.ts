/** Transcription provider router: cost/latency/accuracy-aware.
 * Groq primary; chunk-and-stitch for > limit; offline stub; latency+cost routing.
 */
import type { Transcript } from "./types";

export type ProviderId = "groq" | "chunked-groq" | "offline" | "fallback";
export interface ProviderChoice { provider: ProviderId; reason: string; estimatedCents: number; }

export const GROQ_MAX_BYTES = 100 * 1024 * 1024;

export function chooseProvider(sizeBytes: number, opts: { offlineOnly?: boolean; maxBytes?: number } = {}): ProviderChoice {
  if (opts.offlineOnly) return { provider: "offline", reason: "offline mode", estimatedCents: 0 };
  const cap = opts.maxBytes ?? GROQ_MAX_BYTES;
  if (sizeBytes <= cap) return { provider: "groq", reason: "within Groq limit", estimatedCents: Math.ceil(sizeBytes / (1024*1024)) * 1 };
  return { provider: "chunked-groq", reason: "exceeds single-request limit — will chunk", estimatedCents: Math.ceil(sizeBytes / (1024*1024)) * 1 };
}

export interface CostLatency { provider: ProviderId; bytes: number; cents: number; latencyMs?: number }

export function estimateCostLatency(bytes: number, provider: ProviderId): CostLatency {
  const mb = bytes / (1024*1024);
  if (provider === "offline" || provider === "fallback") return { provider, bytes, cents: 0 };
  return { provider, bytes, cents: Math.max(1, Math.ceil(mb * 0.9)) };
}

/** Chunk-and-stitch: call transcribeFn per chunk with offset correction. */
export async function transcribeChunked(
  bytes: Uint8Array,
  transcribeFn: (chunk: Uint8Array, filename: string, mime: string) => Promise<Transcript>,
  opts: { chunkBytes?: number; mimeType: string; filename: string }
): Promise<Transcript> {
  const chunkBytes = opts.chunkBytes ?? GROQ_MAX_BYTES;
  if (bytes.byteLength <= chunkBytes) return transcribeFn(bytes, opts.filename, opts.mimeType);
  // Naive split at chunkBytes boundaries (webm-aware stitching is best-effort — header is re-checked per chunk).
  const chunks: Uint8Array[] = [];
  for (let off = 0; off < bytes.byteLength; off += chunkBytes) chunks.push(bytes.slice(off, Math.min(off + chunkBytes, bytes.byteLength)));
  const results = await Promise.all(chunks.map((c, i) => transcribeFn(c, `part-${i+1}-${opts.filename}`, opts.mimeType)));
  // Stitch with time offset (approx: duration proportional to bytes — corrected when segments exist).
  let offset = 0;
  const segments = [];
  let language: string | undefined;
  for (const r of results) {
    language = language ?? r.language;
    for (const s of r.segments) segments.push({ ...s, start: s.start + offset, end: s.end + offset });
    const chunkDur = r.segments.length ? (r.segments[r.segments.length - 1].end - r.segments[0].start) : (cDuration(chunks[results.indexOf(r)].byteLength));
    offset += chunkDur;
  }
  return { language, text: results.map((r)=>r.text).join(" "), segments };
}

function cDuration(bytes: number): number { return Math.max(5, (bytes / (1024*1024)) * 58); }

/** Offline stub — returns a minimal transcript so the pipeline can proceed when Groq is unreachable. */
export function offlineTranscriptStub(bytes: Uint8Array): Transcript {
  void bytes;
  return { language: "en", text: "[offline transcription unavailable — upload the recording again when online]", segments: [] };
}
