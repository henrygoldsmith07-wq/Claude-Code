/** Speaker diarisation (heuristic) + naming. Groq Whisper has no speaker labels, so we cluster segments by pause/lexical cues and let users name speakers. */
export interface SpeakerSegment { start: number; end: number; text: string; speaker: string | null; }
export interface SpeakerMap { [segmentIndex: number]: string }

export function heuristicDiarise(segments: { start: number; end: number; text: string }[]): SpeakerSegment[] {
  let cur = "Speaker A";
  return segments.map((s, i) => {
    const gap = i === 0 ? 0 : s.start - segments[i-1].end;
    const short = s.text.trim().length < 18;
    if (gap > 1.2 || (short && /^(yeah|yes|okay|right|sure|thanks)/i.test(s.text))) {
      cur = cur === "Speaker A" ? "Speaker B" : "Speaker A";
    }
    return { ...s, speaker: cur };
  });
}

export function applySpeakerNames(segments: SpeakerSegment[], names: Record<string,string>): SpeakerSegment[] {
  return segments.map(s => ({ ...s, speaker: s.speaker ? (names[s.speaker] || s.speaker) : null }));
}

export function confidenceForSegment(text: string): number {
  const t = text.trim();
  if (t.length < 8) return 0.72;
  if (/\[inaudible\]|\(\?\)/i.test(t)) return 0.38;
  if (t.split(/\s+/).length < 4) return 0.66;
  return 0.91;
}
