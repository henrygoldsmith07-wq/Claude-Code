/** Email follow-up integration helpers. */
import type { Meeting } from "./types";

export function mailtoForFollowUp(meeting: Meeting, actions: { text: string; owner: string | null }[]): string {
  const subject = encodeURIComponent(`Follow-up: ${meeting.title}`);
  const lines = ["Hi all,","",`Actions from ${meeting.title}:`, ...actions.map((a)=>`- ${a.text}${a.owner?` (owner: ${a.owner})`:""}`), "", `Recording: ${meeting.shareId}`, "", "Let me know if I missed anything."];
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:?subject=${subject}&body=${body}`;
}

export function icsForMeeting(meeting: Meeting, opts: { location?: string } = {}): string {
  const start = new Date(meeting.createdAt);
  const end = new Date(start.getTime() + meeting.durationSec * 1000);
  const fmt = (d: Date)=> d.toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
  const uid = `${meeting.shareId}@meeting-recorder`;
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Meeting Recorder//EN","BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${meeting.title.replace(/[,;\\]/g,"\\$&")}`,
    ...(opts.location ? [`LOCATION:${opts.location}`] : []),
    `DESCRIPTION:Recording ${meeting.shareId}`,
    "END:VEVENT","END:VCALENDAR",
  ].join("\r\n");
}
