/** Calendar linking + follow-up generation helpers. */
export function calendarLink(meeting: { title: string; createdAt: string; durationSec: number }, baseUrl: string): string {
  const start = new Date(meeting.createdAt);
  const end = new Date(start.getTime() + meeting.durationSec * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const text = encodeURIComponent(meeting.title);
  const details = encodeURIComponent(`Notes: ${baseUrl}/meeting/${encodeURIComponent(meeting.title)}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}
export function followUpEmail(meeting: { title: string }, actions: string[]): { subject: string; body: string } {
  const subject = `Follow-up: ${meeting.title}`;
  const body = ["Hi all,", "", "Actions:", ...actions.map(a => `- ${a}`), "", "Let me know if I missed anything."].join("\n");
  return { subject, body };
}
