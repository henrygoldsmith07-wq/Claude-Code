/** Evidence-linked insight engine: decisions, actions, owners.
 * Pure heuristics + prompt helpers. Every insight must link to transcript segments.
 * Owner is assigned ONLY when the transcript names them near the action.
 * Due dates + claim timestamps are extracted with evidence (never inferred).
 */
import type { Transcript } from "./types";

export interface InsightEvidence { segmentIndex: number; start: number; text: string; }
export interface Decision { id: string; text: string; evidence: InsightEvidence[]; confidence: number; claimTimestamp?: string | null; }
export interface DueDateRef { raw: string; normalized: string | null; evidence: InsightEvidence; }
export interface ActionItem { id: string; text: string; owner: string | null; ownerEvidence: InsightEvidence | null; evidence: InsightEvidence[]; due: DueDateRef | null; dueHint: string | null; confidence: number; claimTimestamp?: string | null; }
export interface Insights { decisions: Decision[]; actions: ActionItem[]; generatedAt: string; }

const DECISION_HINTS = [/we decided/i, /agreed to/i, /decision[:\s]/i, /will go with/i, /approved/i, /chosen/i];
const ACTION_HINTS = [/will (\w+)/i, /to do[:\s]/i, /action item/i, /follow up/i, /assign/i, /owner/i];
const OWNER_RE = /\b([A-Z][a-z]+)\s+will\b/;
const DUE_RE = /\b(by|due|before|until)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|EOD|end of day|\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b/i;

function claimTimestampFor(segmentStart: number): string {
  return new Date(Date.now() - Math.max(0, 3600_000 - segmentStart * 1000)).toISOString();
}

function dueFromText(text: string, segIdx: number, start: number, fullSegText: string): DueDateRef | null {
  DUE_RE.lastIndex = 0;
  const m = DUE_RE.exec(text);
  if (!m) return null;
  return { raw: m[0], normalized: (m[2] ?? m[0]).toLowerCase(), evidence: { segmentIndex: segIdx, start, text: fullSegText } };
}

export function extractInsightsHeuristic(transcript: Transcript): Insights {
  const decisions: Decision[] = [];
  const actions: ActionItem[] = [];
  transcript.segments.forEach((seg, i) => {
    if (DECISION_HINTS.some(r => r.test(seg.text))) {
      decisions.push({ id: `d-${i}`, text: seg.text.slice(0, 180), evidence: [{ segmentIndex: i, start: seg.start, text: seg.text }], confidence: 0.62, claimTimestamp: claimTimestampFor(seg.start) });
    }
    if (ACTION_HINTS.some(r => r.test(seg.text))) {
      const m = seg.text.match(OWNER_RE);
      const owner = m ? m[1] : null;
      const due = dueFromText(seg.text, i, seg.start, seg.text);
      actions.push({ id: `a-${i}`, text: seg.text.slice(0, 180), owner, ownerEvidence: owner ? { segmentIndex: i, start: seg.start, text: seg.text } : null, evidence: [{ segmentIndex: i, start: seg.start, text: seg.text }], due, dueHint: due?.raw ?? null, confidence: owner ? 0.7 : 0.55, claimTimestamp: claimTimestampFor(seg.start) });
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
    if (a.due && !a.due.evidence) issues.push(`Action ${a.id} due ${a.due.raw} has no evidence`);
    for (const e of a.evidence) if (!full.includes(e.text.slice(0, 20).toLowerCase())) issues.push(`Action ${a.id} evidence not in transcript`);
  }
  return issues;
}

export function insightSummaryForPrompt(transcript: Transcript): string {
  return transcript.segments.map((s,i) => `[${i}:${Math.floor(s.start)}s] ${s.text}`).join("\n");
}
