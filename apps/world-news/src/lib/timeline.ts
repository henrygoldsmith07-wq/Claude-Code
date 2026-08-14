// Timeline reconstruction: when it happened, not when it was posted.
//
// A feed sorted by publication time is a timeline of *journalism*, not of
// events. "Officials confirmed on Tuesday that the plant closed last month" is
// one story with two dates in it, and sorting it by its timestamp files it
// under Tuesday — which is when someone wrote it down, not when anything
// happened. Every downstream question ("what changed since yesterday?", "how
// long did this take?", "did anyone report this at the time?") inherits the
// error.
//
// So this module separates two clocks:
//
//   occurredAt        when the event took place, resolved from the language
//   firstReportedAt   when the earliest source published
//
// and reports the gap between them. A large gap is not noise — it is the
// finding. An event first reported four days late was, for four days, a thing
// that happened to people with nobody covering it, and that is exactly the
// coverage gap the product claims to surface.
//
// Where sources disagree about when something happened, the disagreement is
// recorded rather than averaged away. An average of two contradictory dates is
// a date on which nobody says anything happened.
//
// Pure + deterministic. No network. All arithmetic in UTC.

import type { ArticleLike } from "./clustering";

// ---------------------------------------------------------------------------
// Precision
// ---------------------------------------------------------------------------

export type TimePrecision = "exact" | "day" | "week" | "month" | "unknown";

/** Half-width of the uncertainty window implied by each precision, in hours. */
const PRECISION_WINDOW: Record<TimePrecision, number> = {
  exact: 1,
  day: 12,
  week: 84,
  month: 360,
  unknown: Number.POSITIVE_INFINITY,
};

const DAY_MS = 86_400_000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// ---------------------------------------------------------------------------
// Resolving time expressions
// ---------------------------------------------------------------------------

export interface ResolvedTime {
  at: string; // ISO
  precision: TimePrecision;
  /** The phrase that produced it, so a reader can see the reasoning. */
  phrase: string;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Most recent occurrence of a weekday at or before `fromMs`.
 *
 * "on Tuesday" in a Wednesday story means yesterday, not next week: news
 * copy refers backwards unless it says otherwise.
 */
function previousWeekday(fromMs: number, weekday: number): number {
  const base = startOfUtcDay(fromMs);
  const current = new Date(base).getUTCDay();
  const back = (current - weekday + 7) % 7;
  return base - back * DAY_MS;
}

/**
 * Resolve a relative or absolute date expression against publication time.
 *
 * Returns null rather than guessing when there is no time expression: an
 * absent date and a wrong date are very different failures, and only one of
 * them is recoverable by a reader.
 */
export function resolveTimeExpression(text: string, publishedAt?: string): ResolvedTime | null {
  if (!publishedAt) return null;
  const pubMs = Date.parse(publishedAt);
  if (Number.isNaN(pubMs)) return null;
  const lower = text.toLowerCase();

  // --- Absolute: ISO ---------------------------------------------------------
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const at = Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    if (!Number.isNaN(at)) return { at: new Date(at).toISOString(), precision: "day", phrase: isoMatch[0] };
  }

  // --- Absolute: "3 March" / "March 3" --------------------------------------
  const monthNames = MONTHS.join("|");
  const dayMonth = lower.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\b`));
  const monthDay = lower.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})\\b`));
  if (dayMonth || monthDay) {
    const day = dayMonth ? +dayMonth[1] : +monthDay![2];
    const month = MONTHS.indexOf(dayMonth ? dayMonth[2] : monthDay![1]);
    if (day >= 1 && day <= 31 && month >= 0) {
      const year = new Date(pubMs).getUTCFullYear();
      let at = Date.UTC(year, month, day);
      // A date more than a week ahead of publication must be last year's.
      if (at > pubMs + 7 * DAY_MS) at = Date.UTC(year - 1, month, day);
      return { at: new Date(at).toISOString(), precision: "day", phrase: (dayMonth ?? monthDay)![0] };
    }
  }

  // --- Relative: explicit offsets -------------------------------------------
  const daysAgo = lower.match(/\b(\d{1,2})\s+days?\s+ago\b/);
  if (daysAgo) {
    return { at: new Date(startOfUtcDay(pubMs) - +daysAgo[1] * DAY_MS).toISOString(), precision: "day", phrase: daysAgo[0] };
  }
  const weeksAgo = lower.match(/\b(\d{1,2})\s+weeks?\s+ago\b/);
  if (weeksAgo) {
    return { at: new Date(startOfUtcDay(pubMs) - +weeksAgo[1] * 7 * DAY_MS).toISOString(), precision: "week", phrase: weeksAgo[0] };
  }

  if (/\byesterday\b/.test(lower)) {
    return { at: new Date(startOfUtcDay(pubMs) - DAY_MS).toISOString(), precision: "day", phrase: "yesterday" };
  }
  if (/\b(today|this morning|this afternoon|this evening|tonight)\b/.test(lower)) {
    const phrase = lower.match(/\b(today|this morning|this afternoon|this evening|tonight)\b/)![0];
    return { at: new Date(startOfUtcDay(pubMs)).toISOString(), precision: "day", phrase };
  }
  if (/\blast night\b/.test(lower)) {
    return { at: new Date(startOfUtcDay(pubMs) - DAY_MS).toISOString(), precision: "day", phrase: "last night" };
  }

  // --- Relative: weekdays ---------------------------------------------------
  const lastWeekday = lower.match(new RegExp(`\\blast\\s+(${WEEKDAYS.join("|")})\\b`));
  if (lastWeekday) {
    let at = previousWeekday(pubMs, WEEKDAYS.indexOf(lastWeekday[1]));
    // "last Tuesday" said on a Wednesday means the Tuesday before yesterday's.
    if (at > startOfUtcDay(pubMs) - 6 * DAY_MS) at -= 7 * DAY_MS;
    return { at: new Date(at).toISOString(), precision: "day", phrase: lastWeekday[0] };
  }
  const onWeekday = lower.match(new RegExp(`\\b(?:on\\s+)?(${WEEKDAYS.join("|")})\\b`));
  if (onWeekday) {
    const at = previousWeekday(pubMs, WEEKDAYS.indexOf(onWeekday[1]));
    return { at: new Date(at).toISOString(), precision: "day", phrase: onWeekday[0] };
  }

  // --- Coarse ---------------------------------------------------------------
  if (/\blast week\b/.test(lower)) {
    return { at: new Date(startOfUtcDay(pubMs) - 7 * DAY_MS).toISOString(), precision: "week", phrase: "last week" };
  }
  if (/\blast month\b/.test(lower)) {
    return { at: new Date(startOfUtcDay(pubMs) - 30 * DAY_MS).toISOString(), precision: "month", phrase: "last month" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Event time
// ---------------------------------------------------------------------------

export interface TimeEstimate {
  /** Best estimate of when the event happened. */
  occurredAt?: string;
  precision: TimePrecision;
  /** Earliest publication among the sources. */
  firstReportedAt?: string;
  /** Hours between occurrence and first report; negative is impossible and never emitted. */
  reportingLagHours?: number;
  /** Sources placing the event at materially different times. */
  contradictions: { publisher: string; at: string; phrase: string }[];
  /** How the estimate was reached. */
  basis: string[];
}

/**
 * Establish when an event happened from a set of reports about it.
 *
 * The estimate is the *earliest* well-supported occurrence time rather than a
 * mean. Events happen at a moment and are then described with decreasing
 * precision as they recede, so the earliest specific account is usually the
 * closest to the truth, and averaging it with a later vague one drags the
 * estimate away from any time anybody claimed.
 *
 * When no source dates the event, publication time is used as an upper bound
 * and the precision says so — the event happened at or before this, which is
 * weaker than "it happened then" and is labelled as such.
 */
export function estimateEventTime(articles: ArticleLike[]): TimeEstimate {
  const basis: string[] = [];
  const dated = articles
    .map((a) => {
      const r = resolveTimeExpression(a.title, a.publishedAt);
      return r ? { publisher: a.publisher ?? "unknown", ...r } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const published = articles
    .map((a) => (a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN))
    .filter((n) => !Number.isNaN(n));
  const firstReportedAt = published.length ? new Date(Math.min(...published)).toISOString() : undefined;

  if (dated.length === 0) {
    if (!firstReportedAt) {
      return { precision: "unknown", contradictions: [], basis: ["No source carries a date, and none is timestamped."] };
    }
    basis.push("No source states when it happened; the earliest report bounds it from above.");
    return {
      occurredAt: firstReportedAt,
      precision: "unknown",
      firstReportedAt,
      contradictions: [],
      basis,
    };
  }

  // Earliest well-supported account wins; see the note above on not averaging.
  const sorted = [...dated].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const chosen = sorted[0];
  const chosenMs = Date.parse(chosen.at);

  const contradictions = sorted
    .slice(1)
    .filter((d) => {
      const window = Math.max(PRECISION_WINDOW[d.precision], PRECISION_WINDOW[chosen.precision]);
      return Math.abs(Date.parse(d.at) - chosenMs) > window * 3_600_000;
    })
    .map((d) => ({ publisher: d.publisher, at: d.at, phrase: d.phrase }));

  basis.push(`${chosen.publisher} places it at "${chosen.phrase}"`);
  if (dated.length > 1) basis.push(`${dated.length} sources carry a date`);
  if (contradictions.length) {
    basis.push(`${contradictions.length} source(s) place it elsewhere — shown rather than reconciled`);
  }

  const lagMs = firstReportedAt ? Date.parse(firstReportedAt) - chosenMs : Number.NaN;
  // A negative lag means a source dated the event after the first report of it,
  // which is a contradiction rather than a lag; suppress rather than display.
  const reportingLagHours = Number.isNaN(lagMs) || lagMs < 0 ? undefined : Math.round(lagMs / 3_600_000);

  return {
    occurredAt: chosen.at,
    precision: chosen.precision,
    firstReportedAt,
    reportingLagHours,
    contradictions,
    basis,
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  at: string;
  label: string;
  /** Whether this row is something happening or something being published. */
  kind: "occurrence" | "report" | "correction";
  precision: TimePrecision;
  publisher?: string;
  /** Set on the first report of the event. */
  isFirstReport?: boolean;
}

export interface ReconstructedTimeline {
  entries: TimelineEntry[];
  estimate: TimeEstimate;
  /** Stated plainly when reporting lagged the event by more than a day. */
  lagNote?: string;
  note: string;
}

/**
 * Build a timeline that keeps the two clocks visibly separate.
 *
 * Occurrence rows and report rows are interleaved in time but labelled by
 * kind, so a reader can see both "the plant closed on the 3rd" and "the first
 * report of it appeared on the 7th" without the interface having to choose
 * which of those is *the* date.
 */
export function reconstructTimeline(articles: ArticleLike[]): ReconstructedTimeline {
  const estimate = estimateEventTime(articles);
  const entries: TimelineEntry[] = [];

  if (estimate.occurredAt && estimate.precision !== "unknown") {
    entries.push({
      at: estimate.occurredAt,
      label: "Event occurred",
      kind: "occurrence",
      precision: estimate.precision,
    });
  }

  const byTime = [...articles]
    .filter((a) => a.publishedAt)
    .sort((a, b) => Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!));

  byTime.forEach((a, i) => {
    entries.push({
      at: a.publishedAt!,
      label: a.title,
      kind: "report",
      precision: "exact",
      publisher: a.publisher,
      isFirstReport: i === 0,
    });
  });

  for (const c of estimate.contradictions) {
    entries.push({
      at: c.at,
      label: `${c.publisher} places the event at "${c.phrase}"`,
      kind: "occurrence",
      precision: "day",
      publisher: c.publisher,
    });
  }

  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.kind.localeCompare(b.kind));

  const lag = estimate.reportingLagHours;
  const lagNote =
    lag !== undefined && lag >= 24
      ? `First reported ${Math.round(lag / 24)} day(s) after it happened — for that period the event was uncovered.`
      : undefined;

  const note =
    estimate.precision === "unknown"
      ? "No source states when this happened; the timeline shows publication times only."
      : estimate.contradictions.length > 0
        ? `Sources disagree about when this happened; all versions are shown.`
        : `Event time resolved from source wording; publication times shown separately.`;

  return { entries, estimate, lagNote, note };
}

export const TIMELINE_METHODOLOGY =
  "Event times are resolved from the words a source uses ('on Tuesday', 'last month') against that " +
  "source's publication timestamp, and are kept separate from publication times throughout. Where " +
  "sources place an event at different times, every version is shown rather than averaged — a mean of " +
  "two contradictory dates is a date on which nobody says anything happened. Where no source dates the " +
  "event, publication is used only as an upper bound and labelled as unknown precision.";
