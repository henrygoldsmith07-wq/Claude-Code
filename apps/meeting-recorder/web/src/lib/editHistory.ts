/** Transcript edit history + undo (client-safe). */
import type { Transcript, TranscriptSegment } from "./types";

export interface EditRecord { at: string; segmentIndex: number; before: string; after: string }

export function applyEdit(transcript: Transcript, idx: number, newText: string): { transcript: Transcript; record: EditRecord } {
  const before = transcript.segments[idx]?.text ?? "";
  const segs: TranscriptSegment[] = transcript.segments.map((s,i)=> i===idx ? { ...s, text: newText } : s);
  const next: Transcript = { ...transcript, text: segs.map((s)=>s.text).join(" "), segments: segs };
  const record: EditRecord = { at: new Date().toISOString(), segmentIndex: idx, before, after: newText };
  return { transcript: next, record };
}

export function undoEdit(transcript: Transcript, record: EditRecord): Transcript {
  const segs: TranscriptSegment[] = transcript.segments.map((s,i)=> i===record.segmentIndex ? { ...s, text: record.before } : s);
  return { ...transcript, text: segs.map((s)=>s.text).join(" "), segments: segs };
}

export function historyToLog(records: EditRecord[]): string {
  return records.map((r)=> `${r.at} #${r.segmentIndex}: ${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`).join("\n");
}
