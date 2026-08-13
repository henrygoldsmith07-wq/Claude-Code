/**
 * Timezone-aware calendar maths.
 *
 * Every analytic window in Pulse is expressed in the *user's local* calendar,
 * because "how do I study in the evening" is a question about wall-clock time,
 * not about UTC. Getting this wrong silently shifts an hour of behaviour into
 * the wrong bucket twice a year, so all conversions go through here and are
 * covered by DST tests.
 *
 * Implemented on `Intl.DateTimeFormat` only — no timezone database dependency.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Throws on an unknown IANA zone, so bad connector config fails loudly at the boundary. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    formatterFor(timeZone).format(0);
  } catch {
    throw new Error(`Unknown IANA time zone: ${timeZone}`);
  }
}

export function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`Missing ${type} for zone ${timeZone}`);
    return Number(found.value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

/** Calendar date (YYYY-MM-DD) the instant falls on, in the given zone. */
export function localDate(instantMs: number, timeZone: string): string {
  const p = zonedParts(instantMs, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight (0..1439). On DST days this is wall-clock, as intended. */
export function localMinutes(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  return p.hour * 60 + p.minute;
}

/** Offset of the zone from UTC at that instant, in minutes (east positive). */
export function utcOffsetMinutes(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Round to the minute: zone offsets are never finer, and ms drift would leak in.
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60_000);
}

/** 0 = Sunday .. 6 = Saturday, in local terms. */
export function localDayOfWeek(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(dateISO: string): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(dateISO);
  if (!m) throw new Error(`Expected YYYY-MM-DD, received: ${dateISO}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * UTC instant of local midnight on `dateISO`.
 *
 * Two-pass offset correction, then a forward scan: in zones that skip midnight
 * on the spring-forward day (e.g. America/Santiago) the first valid wall-clock
 * time of that date is 01:00, so we walk forward rather than silently return
 * the previous day.
 */
export function localDayStart(dateISO: string, timeZone: string): number {
  const { year, month, day } = parseLocalDate(dateISO);
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = naive - utcOffsetMinutes(naive, timeZone) * 60_000;
  guess = naive - utcOffsetMinutes(guess, timeZone) * 60_000;

  if (localDate(guess, timeZone) === dateISO && localMinutes(guess, timeZone) === 0) return guess;

  for (let step = 0; step <= 6; step += 1) {
    const candidate = guess + step * 3_600_000;
    if (localDate(candidate, timeZone) === dateISO) {
      // Snap back to the earliest instant that is still on this local date.
      let earliest = candidate;
      while (localDate(earliest - 60_000, timeZone) === dateISO) earliest -= 60_000;
      return earliest;
    }
  }
  return guess;
}

/** Exclusive end of the local day — DST-aware, so this is 23h or 25h long as required. */
export function localDayEnd(dateISO: string, timeZone: string): number {
  return localDayStart(addDays(dateISO, 1), timeZone);
}

/** Real elapsed hours in a local day. 23 or 25 on transition days. */
export function localDayLengthHours(dateISO: string, timeZone: string): number {
  return (localDayEnd(dateISO, timeZone) - localDayStart(dateISO, timeZone)) / 3_600_000;
}

export function addDays(dateISO: string, days: number): string {
  const { year, month, day } = parseLocalDate(dateISO);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseLocalDate(fromISO);
  const b = parseLocalDate(toISO);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}

/** Inclusive range of local dates. */
export function eachLocalDate(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const span = daysBetween(fromISO, toISO);
  for (let i = 0; i <= span; i += 1) out.push(addDays(fromISO, i));
  return out;
}

/** ISO week key (YYYY-Www) — the unit the weekly brief is built on. */
export function isoWeekKey(dateISO: string): string {
  const { year, month, day } = parseLocalDate(dateISO);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${pad(isoYear, 4)}-W${pad(week)}`;
}

/** Monday of the ISO week containing `dateISO`. */
export function startOfIsoWeek(dateISO: string): string {
  const { year, month, day } = parseLocalDate(dateISO);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7;
  return addDays(dateISO, -dayNum);
}

export function toInstant(value: string | number | Date): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Unparseable timestamp: ${value}`);
  return ms;
}

export function toIsoInstant(instantMs: number): string {
  return new Date(instantMs).toISOString();
}
