/** Hallucination + grounding benchmarks (offline, deterministic). */
import { hallucinationRate } from "./meetingMemory";
import { hallucinationCheck } from "./insights";
import type { Transcript } from "./types";
import type { Insights } from "./insights";

export function benchmarkGrounding(transcript: Transcript, insights: Insights): { hallucinatedOwners: number; missingEvidence: number; rate: number } {
  const issues = hallucinationCheck(insights, transcript);
  const hallucinatedOwners = issues.filter(i=>i.includes("owner")).length;
  const missingEvidence = issues.filter(i=>i.includes("evidence")).length;
  const rate = hallucinationRate([...insights.decisions, ...insights.actions], transcript.text);
  return { hallucinatedOwners, missingEvidence, rate };
}
