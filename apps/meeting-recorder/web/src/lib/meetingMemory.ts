/** Searchable meeting memory + cost controls + provider fallback + semantic hooks. */
import type { Meeting } from "./types";

export function searchMeetings(meetings: Meeting[], query: string): Meeting[] {
  const q = query.trim().toLowerCase();
  if (!q) return meetings;
  return meetings.filter(m =>
    m.title.toLowerCase().includes(q) ||
    (m.transcript?.text.toLowerCase().includes(q)) ||
    (m.summary?.toLowerCase().includes(q))
  );
}

export interface CostEstimate { minutes: number; groqCents: number; anthropicCents: number; }
export function estimateCost(durationSec: number, transcriptChars: number): CostEstimate {
  const minutes = Math.ceil(durationSec/60);
  return { minutes, groqCents: Math.round(minutes*0.5), anthropicCents: Math.round(transcriptChars/1000) };
}

export type Provider = "groq" | "chunked-groq" | "offline" | "fallback";
export function pickTranscriptionProvider(sizeBytes: number, maxBytes: number): Provider {
  if (sizeBytes > maxBytes) return "chunked-groq";
  return "groq";
}

/** Hallucination benchmark harness: compare generated insights against transcript n-grams. */
export function hallucinationRate(insights: { text: string }[], transcriptText: string): number {
  if (insights.length===0) return 0;
  const low = transcriptText.toLowerCase();
  let bad=0;
  for (const i of insights) {
    const snippet = i.text.slice(0, 24).toLowerCase();
    if (!low.includes(snippet)) bad++;
  }
  return bad/insights.length;
}

/** Lightweight semantic ranking (overlaps with lib/semanticSearch — kept for compat). */
export function rankedMeetings(meetings: Meeting[], query: string): Meeting[] {
  const q = query.trim().toLowerCase(); if (!q) return meetings;
  return [...meetings].sort((a,b)=>{
    const sa = (a.title + " " + (a.transcript?.text ?? "")).toLowerCase().includes(q) ? 1 : 0;
    const sb = (b.title + " " + (b.transcript?.text ?? "")).toLowerCase().includes(q) ? 1 : 0;
    return sb - sa;
  });
}
