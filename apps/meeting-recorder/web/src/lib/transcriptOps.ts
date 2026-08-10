/** Searchable / editable transcript helpers + integrity. */
import type { Transcript, TranscriptSegment } from "./types";

export function searchTranscript(transcript: Transcript, query: string): TranscriptSegment[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return transcript.segments.filter(s => s.text.toLowerCase().includes(q));
}

export function editTranscript(transcript: Transcript, idx: number, newText: string): Transcript {
  const segs = transcript.segments.map((s,i) => i === idx ? { ...s, text: newText } : s);
  return { ...transcript, text: segs.map(s=>s.text).join(" "), segments: segs };
}

export function transcriptIntegrity(transcript: Transcript): string[] {
  const issues: string[] = [];
  transcript.segments.forEach((s,i) => {
    if (s.end <= s.start) issues.push(`segment ${i}: end <= start`);
    if (i>0 && s.start < transcript.segments[i-1].end - 0.05) issues.push(`segment ${i}: overlaps previous`);
    if (!s.text.trim()) issues.push(`segment ${i}: empty text`);
  });
  return issues;
}

export function recordingIntegrityCheck(bytes: Uint8Array, expectedMime: string): { ok: boolean; reason?: string } {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty file" };
  if (bytes.byteLength < 1024) return { ok: false, reason: "file too small — truncated?" };
  const header = bytes.slice(0, 4);
  const isWebm = header[0]===0x1A && header[1]===0x45 && header[2]===0xDF && header[3]===0xA3;
  const isMp4 = bytes.slice(4,8).toString()==="ftyp";
  if (expectedMime.includes("webm") && !isWebm && bytes.byteLength> 5000) return { ok: false, reason: "webm header mismatch — may be corrupted" };
  return { ok: true };
}
