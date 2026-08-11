/** Decision/action history + unresolved-action detector. */
import type { Insights, ActionItem, Decision } from "./insights";

export interface HistoryEntry { meetingId: string; title: string; createdAt: string; decisions: Decision[]; actions: ActionItem[] }

export function groupByRecurringKey(meetings: { recurringKey?: string | null; shareId: string; title: string; createdAt: string; insights?: Insights | null }[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  for (const m of meetings) {
    if (!m.recurringKey) continue;
    const key = m.recurringKey;
    const arr = map.get(key) ?? [];
    arr.push({ meetingId: m.shareId, title: m.title, createdAt: m.createdAt, decisions: m.insights?.decisions ?? [], actions: m.insights?.actions ?? [] });
    map.set(key, arr);
  }
  for (const [, arr] of map) arr.sort((a,b)=> +new Date(a.createdAt) - +new Date(b.createdAt));
  return map;
}

export function unresolvedActions(history: HistoryEntry[], currentMeetingId: string): ActionItem[] {
  const idx = history.findIndex((h)=>h.meetingId===currentMeetingId);
  if (idx<=0) return [];
  const prev = history.slice(0, idx).flatMap((h)=>h.actions);
  const curTexts = new Set(history[idx].decisions.map((d)=>d.text.toLowerCase()).concat(history[idx].actions.map((a)=>a.text.toLowerCase())));
  return prev.filter((a)=> !curTexts.has(a.text.toLowerCase()));
}

export function decisionHistory(history: HistoryEntry[]): Decision[] {
  return history.flatMap((h)=>h.decisions);
}
