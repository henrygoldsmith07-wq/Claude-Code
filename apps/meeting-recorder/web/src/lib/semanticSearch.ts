/** Semantic + cross-meeting search (deterministic, local).
 * Uses n-gram Jaccard + recency as a lightweight semantic proxy; swap in embeddings later.
 */
import type { Meeting, Transcript } from "./types";

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w)=>w.length>2));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size===0 || b.size===0) return 0;
  let inter=0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SearchHit { meeting: Meeting; score: number; snippet: string }
export interface CrossMeetingHit extends SearchHit { crossMeetingCount: number }

export function semanticSearch(meetings: Meeting[], query: string, limit = 20): SearchHit[] {
  const qTokens = tokens(query);
  if (qTokens.size===0) return [];
  const scored = meetings.map((m)=>{
    const hay = `${m.title} ${m.summary ?? ""} ${m.transcript?.text ?? ""}`;
    const score = jaccard(qTokens, tokens(hay));
    const snippet = (m.transcript?.text ?? m.summary ?? m.title).slice(0, 160);
    return { meeting: m, score, snippet };
  }).filter((h)=>h.score>0).sort((a,b)=> b.score - a.score).slice(0, limit);
  return scored;
}

export function crossMeetingSearch(meetings: Meeting[], query: string): CrossMeetingHit[] {
  const hits = semanticSearch(meetings, query, 50);
  const crossMeetingCount = hits.length;
  return hits.map((h)=> ({ ...h, crossMeetingCount }));
}

export function searchTranscriptSemantic(transcript: Transcript, query: string, limit=10): { segmentIndex: number; text: string; score: number }[] {
  const qTokens = tokens(query);
  return transcript.segments.map((s,i)=> ({ segmentIndex: i, text: s.text, score: jaccard(qTokens, tokens(s.text)) }))
    .filter((h)=>h.score>0).sort((a,b)=> b.score-a.score).slice(0, limit);
}
