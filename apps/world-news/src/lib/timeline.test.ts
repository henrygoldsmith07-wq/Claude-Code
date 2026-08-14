import { describe, expect, it } from "vitest";
import { estimateEventTime, reconstructTimeline, resolveTimeExpression } from "./timeline";
import type { ArticleLike } from "./clustering";

/** 2026-04-15 is a Wednesday. */
const WED = "2026-04-15T09:00:00.000Z";

function art(id: string, publisher: string, title: string, publishedAt?: string): ArticleLike {
  return { id, title, url: `https://${publisher}/${id}`, publisher, tags: [], publishedAt };
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

describe("time expressions", () => {
  it("resolves 'yesterday' against publication", () => {
    expect(day(resolveTimeExpression("Plant closed yesterday", WED)!.at)).toBe("2026-04-14");
  });

  it("reads a weekday as the most recent one before publication", () => {
    // Wednesday story saying "on Tuesday" means yesterday, not next week.
    expect(day(resolveTimeExpression("Ministers met on Tuesday", WED)!.at)).toBe("2026-04-14");
    expect(day(resolveTimeExpression("Ministers met on Monday", WED)!.at)).toBe("2026-04-13");
  });

  it("pushes 'last <weekday>' back a further week", () => {
    expect(day(resolveTimeExpression("Ministers met last Tuesday", WED)!.at)).toBe("2026-04-07");
  });

  it("resolves explicit offsets", () => {
    expect(day(resolveTimeExpression("The vote was held 3 days ago", WED)!.at)).toBe("2026-04-12");
    expect(day(resolveTimeExpression("Filed 2 weeks ago", WED)!.at)).toBe("2026-04-01");
  });

  it("reads absolute dates and marks day precision", () => {
    const r = resolveTimeExpression("The treaty was signed on 3 March", WED)!;
    expect(day(r.at)).toBe("2026-03-03");
    expect(r.precision).toBe("day");
    expect(day(resolveTimeExpression("Signed 2026-01-09 in Geneva", WED)!.at)).toBe("2026-01-09");
  });

  it("rolls an absolute date back a year when it would be in the future", () => {
    const r = resolveTimeExpression("Agreed in December", "2026-02-01T00:00:00.000Z");
    // "December" alone carries no day, so nothing should be claimed.
    expect(r).toBeNull();
    const dated = resolveTimeExpression("Agreed on 20 December", "2026-02-01T00:00:00.000Z")!;
    expect(day(dated.at)).toBe("2025-12-20");
  });

  it("marks coarse expressions with coarse precision", () => {
    expect(resolveTimeExpression("Announced last week", WED)!.precision).toBe("week");
    expect(resolveTimeExpression("Announced last month", WED)!.precision).toBe("month");
  });

  it("returns null rather than guessing when there is no date", () => {
    expect(resolveTimeExpression("Parliament approves the budget", WED)).toBeNull();
    expect(resolveTimeExpression("Plant closed yesterday", undefined)).toBeNull();
  });
});

describe("event time", () => {
  it("separates when it happened from when it was reported", () => {
    const e = estimateEventTime([
      art("a", "reuters.com", "Plant closed last Tuesday, ministry says", WED),
    ]);
    expect(day(e.occurredAt!)).toBe("2026-04-07");
    expect(day(e.firstReportedAt!)).toBe("2026-04-15");
    expect(e.reportingLagHours).toBe(8 * 24 + 9);
  });

  it("records disagreement about the date instead of averaging it", () => {
    // An average of the 7th and the 14th is the 10th, a day on which nobody
    // says anything happened.
    const e = estimateEventTime([
      art("a", "reuters.com", "Strike began last Tuesday", WED),
      art("b", "bbc.co.uk", "Strike began yesterday", WED),
    ]);
    expect(day(e.occurredAt!)).toBe("2026-04-07");
    expect(e.contradictions).toHaveLength(1);
    expect(e.contradictions[0].publisher).toBe("bbc.co.uk");
    expect(e.basis.join(" ")).toContain("shown rather than reconciled");
  });

  it("does not treat a coarse and a precise date as contradicting", () => {
    // "last week" and "last Tuesday" are consistent, not conflicting.
    const e = estimateEventTime([
      art("a", "reuters.com", "Talks collapsed last week", WED),
      art("b", "bbc.co.uk", "Talks collapsed last Tuesday", WED),
    ]);
    expect(e.contradictions).toHaveLength(0);
  });

  it("falls back to publication as an upper bound and says the precision is unknown", () => {
    const e = estimateEventTime([art("a", "bbc.co.uk", "Parliament approves the budget", WED)]);
    expect(e.precision).toBe("unknown");
    expect(e.occurredAt).toBe(WED);
    expect(e.basis[0]).toContain("bounds it from above");
  });

  it("reports unknown when nothing is dated at all", () => {
    const e = estimateEventTime([art("a", "bbc.co.uk", "Parliament approves the budget")]);
    expect(e.precision).toBe("unknown");
    expect(e.occurredAt).toBeUndefined();
  });

  it("suppresses an impossible negative reporting lag", () => {
    // A source dating the event after the first report of it is a
    // contradiction, not a lag, and must not surface as one.
    const e = estimateEventTime([
      art("a", "reuters.com", "Vote scheduled", "2026-04-10T09:00:00.000Z"),
      art("b", "bbc.co.uk", "Vote held yesterday", WED),
    ]);
    expect(e.reportingLagHours).toBeUndefined();
  });
});

describe("timeline", () => {
  it("labels occurrence and report rows separately", () => {
    const t = reconstructTimeline([
      art("a", "reuters.com", "Mine closed last Tuesday", WED),
      art("b", "bbc.co.uk", "Mine closure confirmed", "2026-04-16T09:00:00.000Z"),
    ]);
    const kinds = t.entries.map((e) => e.kind);
    expect(kinds).toContain("occurrence");
    expect(kinds).toContain("report");
    expect(t.entries[0].kind).toBe("occurrence");
    expect(t.entries.find((e) => e.isFirstReport)?.publisher).toBe("reuters.com");
  });

  it("names a long reporting lag as the finding it is", () => {
    const t = reconstructTimeline([art("a", "reuters.com", "Village flooded last month", WED)]);
    expect(t.lagNote).toContain("after it happened");
    expect(t.lagNote).toContain("uncovered");
  });

  it("does not flag a lag when reporting was same-day", () => {
    const t = reconstructTimeline([art("a", "reuters.com", "Explosion reported today", WED)]);
    expect(t.lagNote).toBeUndefined();
  });

  it("shows publication times only when nothing is dated", () => {
    const t = reconstructTimeline([art("a", "bbc.co.uk", "Budget approved", WED)]);
    expect(t.note).toContain("publication times only");
    expect(t.entries.every((e) => e.kind === "report")).toBe(true);
  });
});
