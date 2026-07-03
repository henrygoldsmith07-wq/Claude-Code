import { formatCents } from "./money";
import type { Subscription } from "./types";

function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

export function buildRenewalsIcs(subscriptions: Subscription[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Subscription Tracker//EN"];

  for (const sub of subscriptions.filter((s) => s.active && !s.archived)) {
    const date = toIcsDate(sub.nextRenewalDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${sub.id}@subscription-tracker`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${date}`,
      `SUMMARY:${sub.name} renews (${formatCents(sub.amountCents, sub.currencyCode)})`,
      `RRULE:FREQ=${sub.billingCycle === "yearly" ? "YEARLY" : sub.billingCycle === "weekly" ? "WEEKLY" : "MONTHLY"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(ics: string, filename: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
