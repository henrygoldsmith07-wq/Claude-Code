/** Speaker diarisation (heuristic) + enrolment + correction + word-level confidence.
 * Groq Whisper has no speaker labels, so we cluster segments by pause/lexical cues
 * and let users name speakers. Enrolment stores speaker profiles; correction UI
 * updates the speakers map per segment.
 */
export interface SpeakerSegment { start: number; end: number; text: string; speaker: string | null; }
export interface SpeakerMap { [segmentIndex: number]: string }
export interface SpeakerProfile { id: string; name: string; sampleText?: string }

const SPEAKER_IDS = ["Speaker A","Speaker B","Speaker C","Speaker D"] as const;

export function heuristicDiarise(segments: { start: number; end: number; text: string }[]): SpeakerSegment[] {
  let curIdx = 0;
  return segments.map((s, i) => {
    const gap = i === 0 ? 0 : s.start - segments[i-1].end;
    const short = s.text.trim().length < 18;
    const ack = /^(yeah|yes|okay|right|sure|thanks|got it|cool)\b/i.test(s.text.trim());
    // Switch on long pause or short acknowledgement; cycle through 4 speakers.
    if (i>0 && (gap > 1.2 || (short && ack))) curIdx = (curIdx + 1) % SPEAKER_IDS.length;
    // Stay on same speaker for dense rapid turns unless ack.
    return { ...s, speaker: SPEAKER_IDS[curIdx] };
  });
}

export function applySpeakerNames(segments: SpeakerSegment[], names: Record<string,string>): SpeakerSegment[] {
  return segments.map(s => ({ ...s, speaker: s.speaker ? (names[s.speaker] ?? s.speaker) : null }));
}

export function applySpeakerMap(segments: { start: number; end: number; text: string }[], map: SpeakerMap): SpeakerSegment[] {
  return segments.map((s,i)=> ({ ...s, speaker: (map as Record<string,string>)[`segment-${i}`] ?? (map as Record<string,string>)[String(i)] ?? null }));
}

export function speakerCorrection(map: SpeakerMap, segmentIndex: number, speakerId: string): SpeakerMap {
  return { ...(map as Record<string,string>), [`segment-${segmentIndex}`]: speakerId } as SpeakerMap;
}

export function enrolSpeakers(profiles: SpeakerProfile[]): Record<string,string> {
  const m: Record<string,string> = {};
  profiles.forEach((p,i)=> { const id = SPEAKER_IDS[i] ?? `Speaker ${i+1}`; m[id]=p.name; });
  return m;
}

export function confidenceForSegment(text: string): number {
  const t = text.trim();
  if (t.length < 8) return 0.72;
  if (/\[inaudible\]|\(\?\)/i.test(t)) return 0.38;
  if (t.split(/\s+/).length < 4) return 0.66;
  return 0.91;
}

export function confidenceForWord(word: string, segmentConfidence: number): number {
  if (/\[inaudible\]|\(\?\)/i.test(word)) return 0.35;
  if (word.length <= 2) return Math.min(0.78, segmentConfidence);
  return segmentConfidence;
}
