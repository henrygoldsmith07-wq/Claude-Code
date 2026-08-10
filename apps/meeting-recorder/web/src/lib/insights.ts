/** Evidence-linked insight engine: decisions, actions, owners.
 * Pure heuristics + prompt helpers. Every insight must link to transcript segments.
 * Owner is assigned ONLY when the transcript names them near the action.
 */
import type { Transcript } from "./types";

export interface InsightEvidence { segmentIndex: number; start: number; text: string; }
export interface Decision { id: string; text: string; evidence: InsightEvidence[]; confidence: number; }
export interface ActionItem { id: string; text: string; owner: string | null; ownerEvidence: InsightEvidence | null; evidence: InsightEvidence[]; dueHint: string | null; confidence: number; }
export interface Insights { decisions: Decision[]; actions: ActionItem[]; generatedAt: string; }

function nearestSegment(transcript: Transcript, needle: string): InsightEvidence | null {
  const idx = transcript.segments.findIndex(s => s.text.toLowerCase().includes(needle.toLowerCase().slice(0, 24)));
  if (idx === -1) return null;
  const s = transcript.segments[idx];
  return { segmentIndex: idx, start: s.start, text: s.text };
}

const DECISION_HINTS = [/we decided/i, /agreed to/i, /decision[:\s]/i, /will go with/i, /approved/i, /chosen/i];
const ACTION_HINTS = [/will (\w+)/i, /to do[:\s]/i, /action item/i, /follow up/i, /assign/i, /owner/i];
const OWNER_RE = /\b([A-Z][a-z]+)\s+will\b/;

export function extractInsightsHeuristic(transcript: Transcript): Insights {
  const decisions: Decision[] = [];
  const actions: ActionItem[] = [];
  transcript.segments.forEach((seg, i) => {
    if (DECISION_HINTS.some(r => r.test(seg.text))) {
      decisions.push({ id: `d-${i}`, text: seg.text.slice(0, 180), evidence: [{ segmentIndex: i, start: seg.start, text: seg.text }], confidence: 0.62 });
    }
    if (ACTION_HINTS.some(r => r.test(seg.text))) {
      const m = seg.text.match(OWNER_RE);
      const owner = m ? m[1] : null;
      // Only keep owner if evidence nearby — heuristic already enforces it (owner must appear in same segment).
      actions.push({ id: `a-${i}`, text: seg.text.slice(0, 180), owner, ownerEvidence: owner ? { segmentIndex: i, start: seg.start, text: seg.text } : null, evidence: [{ segmentIndex: i, start: seg.start, text: seg.text }], dueHint: null, confidence: owner ? 0.7 : 0.55 });
    }
  });
  return { decisions, actions, generatedAt: new Date().toISOString() };
}

export function hallucinationCheck(insights: Insights, transcript: Transcript): string[] {
  const issues: string[] = [];
  const full = transcript.segments.map(s => s.text.toLowerCase()).join(" ");
  for (const d of insights.decisions) {
    for (const e of d.evidence) if (!full.includes(e.text.slice(0, 20).toLowerCase())) issues.push(`Decision ${d.id} evidence not in transcript`);
  }
  for (const a of insights.actions) {
    if (a.owner && !a.ownerEvidence) issues.push(`Action ${a.id} owner ${a.owner} has no evidence`);
    for (const e of a.evidence) if (!full.includes(e.text.slice(0, 20).toLowerCase())) issues.push(`Action ${a.id} evidence not in transcript`);
  }
  return issues;
}

export function insightSummaryForPrompt(transcript: Transcript): string {
  return transcript.segments.map((s,i) => `[${i}:${Math.floor(s.start)}s] ${s.text}`).join("\n");
}
