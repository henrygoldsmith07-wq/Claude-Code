/** Meeting templates + recurring continuity: what changed since last meeting, carryover. */
export type MeetingTemplate = { id: string; name: string; agenda: string[]; defaultTitle?: string };
export const TEMPLATES: MeetingTemplate[] = [
  { id: "standup", name: "Standup", agenda: ["Yesterday", "Today", "Blockers"] },
  { id: "1-1", name: "1:1", agenda: ["Wins", "Challenges", "Growth", "Actions"] },
  { id: "planning", name: "Planning", agenda: ["Goal", "Scope", "Risks", "Actions & owners"] },
  { id: "retro", name: "Retro", agenda: ["Went well", "Didn't", "Change next time", "Actions"] },
  { id: "client", name: "Client", agenda: ["Context", "Needs", "Decisions", "Next steps"] },
];

export function continuity(recurringKey: string | null, meetings: { shareId: string; title: string; createdAt: string }[]): { previousId: string | null } {
  if (!recurringKey) return { previousId: null };
  const sorted = [...meetings].sort((a,b)=> +new Date(b.createdAt) - +new Date(a.createdAt));
  return { previousId: sorted[1]?.shareId ?? null };
}

export function whatChanged(current: { text: string }, previous: { text: string }): string[] {
  const cur = new Set(current.text.toLowerCase().split(/\s+/));
  const prev = new Set(previous.text.toLowerCase().split(/\s+/));
  const added: string[] = [];
  for (const w of cur) if (!prev.has(w) && w.length>4) added.push(w);
  return added.slice(0, 20);
}

export function followUpDraft(meeting: { title: string; transcript: { text: string } | null }, actions: { text: string; owner: string | null }[]): string {
  const lines = [`Subject: Follow-up — ${meeting.title}`, "", "Hi all,", "", "Summary of actions:"];
  for (const a of actions) lines.push(`- ${a.text}${a.owner ? ` (owner: ${a.owner})` : ""}`);
  lines.push("", "Let me know if anything is missing.");
  return lines.join("\n");
}
