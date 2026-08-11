/** Word-level confidence + audio↔transcript alignment helpers. */
import type { TranscriptSegment } from "./types";

export interface WordTiming { word: string; start: number; end: number; confidence: number }

export function confidenceForWord(word: string, segmentConfidence: number): number {
  if (/\[inaudible\]|\(\?\)/i.test(word)) return 0.35;
  if (word.length <= 2) return Math.min(0.78, segmentConfidence);
  return segmentConfidence;
}

export function segmentToWords(seg: TranscriptSegment, segmentConfidence: number): WordTiming[] {
  const words = seg.text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const dur = Math.max(0.2, seg.end - seg.start);
  const per = dur / words.length;
  return words.map((w, i) => ({
    word: w,
    start: seg.start + i * per,
    end: seg.start + (i + 1) * per,
    confidence: confidenceForWord(w, segmentConfidence),
  }));
}

export function transcriptToWords(segments: TranscriptSegment[], confidenceForSegment: (t: string)=>number): WordTiming[] {
  return segments.flatMap((s) => segmentToWords(s, confidenceForSegment(s.text)));
}

export function wordAtTime(words: WordTiming[], t: number): WordTiming | null {
  for (const w of words) if (t >= w.start && t < w.end) return w;
  return null;
}

export function segmentAtTime(segments: TranscriptSegment[], t: number): number {
  for (let i=segments.length-1;i>=0;i--) if (t >= segments[i].start) return i;
  return -1;
}
