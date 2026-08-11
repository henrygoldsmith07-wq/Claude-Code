/** Due-date extraction with evidence — never infers without textual evidence. */
import type { Transcript, TranscriptSegment } from "./types";

export interface DueDate { raw: string; normalized: string | null; evidence: { segmentIndex: number; start: number; text: string } }

const DUE_RE = /\b(by|due|before|until)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|EOD|end of day|\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b/gi;

export function extractDueDates(transcript: Transcript): DueDate[] {
  const out: DueDate[] = [];
  transcript.segments.forEach((seg, i) => {
    DUE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DUE_RE.exec(seg.text)) !== null) {
      out.push({ raw: m[0], normalized: normalizeDue(m[2] ?? m[0]), evidence: { segmentIndex: i, start: seg.start, text: seg.text } });
    }
  });
  return out;
}

function normalizeDue(raw: string): string | null {
  const r = raw.trim().toLowerCase();
  if (r === "tomorrow" || r === "eod" || r === "end of day") return r;
  if (/^\d{1,2}[\/\-]\d{1,2}/.test(r)) return r;
  return r;
}

export function dueHintForSegment(seg: TranscriptSegment, idx: number, start: number): DueDate | null {
  DUE_RE.lastIndex = 0;
  const m = DUE_RE.exec(seg.text);
  if (!m) return null;
  return { raw: m[0], normalized: normalizeDue(m[2] ?? m[0]), evidence: { segmentIndex: idx, start, text: seg.text } };
}
