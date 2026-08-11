/** Privacy controls, retention, local-only mode, deletion/export. */
export type RetentionPolicy = { days: number | null; autoDelete: boolean };
export const DEFAULT_RETENTION: RetentionPolicy = { days: 90, autoDelete: false };

export function retentionDeadline(createdAt: string, policy: RetentionPolicy): string | null {
  if (policy.days === null) return null;
  const d = new Date(createdAt);
  d.setDate(d.getDate() + policy.days);
  return d.toISOString();
}

export function isExpired(createdAt: string, policy: RetentionPolicy): boolean {
  const dl = retentionDeadline(createdAt, policy);
  return dl !== null && new Date(dl).getTime() < Date.now();
}

export type PrivacyMode = "cloud" | "local-only";
export function localOnlyNotice(mode: PrivacyMode): string | null {
  if (mode === "local-only") return "Local-only mode: recording will not be uploaded. Export locally if needed.";
  return null;
}

export function exportMeeting(m: { title: string; transcript: { text: string; segments: { start: number; text: string }[] } | null; summary: string | null }): string {
  return JSON.stringify(m, null, 2);
}

export function exportMarkdown(m: { title: string; transcript: { text: string; segments: { start: number; text: string }[] } | null; summary: string | null }): string {
  const lines = [`# ${m.title}`, ""];
  if (m.summary) { lines.push(m.summary, ""); }
  if (m.transcript) {
    lines.push("## Transcript", "");
    for (const s of m.transcript.segments) lines.push(`[${Math.floor(s.start)}s] ${s.text}`);
  }
  return lines.join("\n");
}

export function shouldAutoDelete(createdAt: string, policy: RetentionPolicy): boolean {
  return policy.autoDelete && isExpired(createdAt, policy);
}

export function expiredMeetings(meetings: { createdAt: string }[], policy: RetentionPolicy): number {
  return meetings.filter((m)=> isExpired(m.createdAt, policy)).length;
}
