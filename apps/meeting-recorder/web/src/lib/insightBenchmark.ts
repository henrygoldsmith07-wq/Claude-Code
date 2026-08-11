/** Human-labelled meeting benchmark: decision/action precision/recall, owner hallucination, evidence coverage.
 * Dataset is intentionally small + auditable; expand with real labelled meetings over time.
 */
import type { Transcript } from "./types";
import { hallucinationCheck } from "./insights";
import type { Insights } from "./insights";

export interface LabeledInsight { text: string; evidenceStart?: number; owner?: string | null; dueHint?: string | null }
export interface LabeledMeeting {
  id: string;
  title: string;
  transcript: Transcript;
  expected: { decisions: LabeledInsight[]; actions: LabeledInsight[] };
}

function norm(s: string): string { return s.toLowerCase().replace(/\s+/g," ").trim(); }
function overlap(a: string, b: string): boolean { const na=norm(a), nb=norm(b); return na.includes(nb.slice(0,24)) || nb.includes(na.slice(0,24)); }

export interface PR { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number }

export function prFor(kind: "decisions"|"actions", predicted: LabeledInsight[], expected: LabeledInsight[]): PR {
  let tp=0, fp=0; const matchedExpected = new Set<number>();
  for (const p of predicted) {
    const hit = expected.findIndex((e,i)=> !matchedExpected.has(i) && overlap(p.text, e.text));
    if (hit !== -1) { tp++; matchedExpected.add(hit); } else fp++;
  }
  const fn = expected.length - matchedExpected.size;
  const precision = tp+fp===0 ? (expected.length===0?1:0) : tp/(tp+fp);
  const recall = tp+fn===0 ? 1 : tp/(tp+fn);
  const f1 = precision+recall===0 ? 0 : 2*precision*recall/(precision+recall);
  void kind;
  return { precision, recall, f1, tp, fp, fn };
}

export interface BenchmarkResult {
  decisions: PR;
  actions: PR;
  ownerHallucination: number;
  missingEvidence: number;
  evidenceCoverage: number; // fraction of predicted insights whose evidence text is in transcript
}

export function benchmarkInsights(transcript: Transcript, insights: Insights, expected: LabeledMeeting["expected"]): BenchmarkResult {
  const predDec: LabeledInsight[] = insights.decisions.map((d)=>({ text: d.text }));
  const predAct: LabeledInsight[] = insights.actions.map((a)=>({ text: a.text, owner: a.owner }));
  const decisions = prFor("decisions", predDec, expected.decisions);
  const actions = prFor("actions", predAct, expected.actions);
  const issues = hallucinationCheck(insights, transcript);
  const ownerHallucination = issues.filter((i)=>i.includes("owner")).length;
  const missingEvidence = issues.filter((i)=>i.includes("evidence")).length;
  const totalPred = insights.decisions.length + insights.actions.length;
  const bad = missingEvidence; // proxy
  const evidenceCoverage = totalPred===0 ? 1 : 1 - bad/Math.max(1,totalPred);
  return { decisions, actions, ownerHallucination, missingEvidence, evidenceCoverage };
}

// --- Synthetic labelled corpus (deterministic, small) ---
export const LABELED_CORPUS: LabeledMeeting[] = [
  {
    id: "lab-1",
    title: "Q3 planning",
    transcript: { text: "We decided to launch in Berlin. Alice will draft the proposal. Bob will follow up by Friday.", segments: [
      { start: 0, end: 4, text: "We decided to launch in Berlin." },
      { start: 4, end: 9, text: "Alice will draft the proposal." },
      { start: 9, end: 14, text: "Bob will follow up by Friday." },
    ]},
    expected: { decisions: [{ text: "launch in Berlin" }], actions: [{ text: "draft the proposal", owner: "Alice" }, { text: "follow up", owner: "Bob", dueHint: "Friday" }] },
  },
  {
    id: "lab-2",
    title: "Retro",
    transcript: { text: "We agreed to cut standup to 10 minutes. Follow up on the outage.", segments: [
      { start: 0, end: 5, text: "We agreed to cut standup to 10 minutes." },
      { start: 5, end: 10, text: "Follow up on the outage." },
    ]},
    expected: { decisions: [{ text: "cut standup to 10 minutes" }], actions: [{ text: "Follow up on the outage" }] },
  },
];

export function runInsightBenchmark(entries: LabeledMeeting[], extract: (t: Transcript)=> Insights): { id: string; result: BenchmarkResult }[] {
  return entries.map((e)=>({ id: e.id, result: benchmarkInsights(e.transcript, extract(e.transcript), e.expected) }));
}
