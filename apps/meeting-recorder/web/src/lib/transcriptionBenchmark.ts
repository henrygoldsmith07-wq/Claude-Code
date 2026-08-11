/** Transcription provider benchmarks: WER + DER stubs + cost/latency matrix.
 * Real WER needs human transcripts; this harness is deterministic and extendable.
 */
import type { Transcript } from "./types";

export interface TranscriptionCase { id: string; title: string; bytes: number; expectedText: string; expectedSegments: number }

export function wer(hyp: string, ref: string): number {
  const h = hyp.toLowerCase().split(/\s+/).filter(Boolean);
  const r = ref.toLowerCase().split(/\s+/).filter(Boolean);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  const dp: number[][] = Array.from({ length: h.length+1 }, ()=> Array(r.length+1).fill(0));
  for (let i=0;i<=h.length;i++) dp[i][0]=i;
  for (let j=0;j<=r.length;j++) dp[0][j]=j;
  for (let i=1;i<=h.length;i++) for (let j=1;j<=r.length;j++) dp[i][j]= h[i-1]===r[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[h.length][r.length]/r.length;
}

export function benchmarkTranscription(cases: TranscriptionCase[], hypothesize: (c: TranscriptionCase)=> Transcript): { id: string; wer: number; segmentDelta: number; latencyMs?: number }[] {
  return cases.map((c)=>{
    const t0 = Date.now();
    const hyp = hypothesize(c);
    const latencyMs = Date.now()-t0;
    return { id: c.id, wer: wer(hyp.text, c.expectedText), segmentDelta: Math.abs(hyp.segments.length - c.expectedSegments), latencyMs };
  });
}

export const TRANSCRIPTION_CORPUS: TranscriptionCase[] = [
  { id: "tc-1", title: "Standup 5m", bytes: 2_300_000, expectedText: "Yesterday I shipped the auth fix. Today I will work on pagination. Blocked on design.", expectedSegments: 3 },
  { id: "tc-2", title: "Planning 20m", bytes: 12_000_000, expectedText: "We decided to launch in Berlin. Alice will draft the proposal by Friday.", expectedSegments: 4 },
];

export function costMatrix(cases: TranscriptionCase[]): { provider: string; centsPerMeeting: number }[] {
  return [
    { provider: "groq", centsPerMeeting: 1 },
    { provider: "chunked-groq", centsPerMeeting: 2 },
    { provider: "offline", centsPerMeeting: 0 },
  ].map((r)=> ({ ...r, centsPerMeeting: Math.round(r.centsPerMeeting * 10)/10 }));
}
