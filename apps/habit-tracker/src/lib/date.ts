/**
 * Local-calendar date helpers, all working on "YYYY-MM-DD" strings.
 *
 * Everything here is deliberately timezone-safe in the way that matters for a
 * habit log: the *local* calendar day is the unit, not an instant. Parsing and
 * formatting go through the local components of a Date, so "today" is the day
 * the person is living in, whatever the machine's timezone is.
 */

const pad = (value: number): string => String(value).padStart(2, "0");

/** The local calendar day of `date`, as "YYYY-MM-DD". */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today, in the local calendar. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Parses "YYYY-MM-DD" as a *local* date (never UTC). */
export function parseISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** Adds `n` days to a local date, crossing month and year boundaries safely. */
export function addDays(iso: string, n: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + n);
  return toISODate(date);
}

/** The Sunday that starts the week containing `iso` (weeks run Sunday-Saturday). */
export function startOfWeekISO(iso: string): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() - date.getDay());
  return toISODate(date);
}

/** `count` consecutive days ending at `endISO` (inclusive), oldest first. */
export function lastNDays(count: number, endISO: string): string[] {
  const days: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDays(endISO, -offset));
  }
  return days;
}
