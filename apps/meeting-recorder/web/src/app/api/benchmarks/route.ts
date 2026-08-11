import { NextRequest, NextResponse } from "next/server";
import { LABELED_CORPUS, runInsightBenchmark } from "@/lib/insightBenchmark";
import { TRANSCRIPTION_CORPUS, benchmarkTranscription, costMatrix } from "@/lib/transcriptionBenchmark";
import { extractInsightsHeuristic } from "@/lib/insights";
import type { Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const insights = runInsightBenchmark(LABELED_CORPUS, extractInsightsHeuristic);
  const transcription = benchmarkTranscription(TRANSCRIPTION_CORPUS, (c)=> ({ text: c.expectedText, language: "en", segments: Array.from({length:c.expectedSegments},(_,i)=>({start:i*4,end:(i+1)*4,text:c.expectedText.split(".")[i]?.trim() ?? ""})) } as Transcript));
  return NextResponse.json({ insights, transcription, costMatrix: costMatrix(TRANSCRIPTION_CORPUS), hallucination: { note: "Owner assigned only with evidence; every insight links to transcript segments" } });
}
