import { describe, it, expect } from "vitest";
import {
  canonicalUrl,
  dedupeArticles,
  hammingDistance,
  independentSourceCount,
  isWire,
  originalityFor,
  simhash,
} from "./dedup";
import { checkTranslation } from "./translationQuality";
import type { ArticleLike } from "./clustering";

const art = (id: string, title: string, url: string, publisher: string, publishedAt?: string): ArticleLike => ({
  id, title, url, publisher, publishedAt, tags: [],
});

describe("canonicalUrl", () => {
  it("strips tracking parameters, AMP paths and mobile subdomains", () => {
    const a = canonicalUrl("https://www.bbc.co.uk/news/story-1?utm_source=twitter&fbclid=x");
    const b = canonicalUrl("https://amp.bbc.co.uk/news/story-1/amp");
    const c = canonicalUrl("https://m.bbc.co.uk/news/story-1/");
    expect(a).toBe("bbc.co.uk/news/story-1");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("keeps parameters that identify content", () => {
    expect(canonicalUrl("https://example.com/read?id=42&utm_medium=email")).toBe("example.com/read?id=42");
  });
});

describe("simhash", () => {
  it("puts near-identical text close together and different text far apart", () => {
    const a = simhash("Israel and Hamas agree to extend Gaza ceasefire");
    const b = simhash("Israel, Hamas agree to extend Gaza ceasefire");
    const c = simhash("Tokyo stocks close higher on technology gains");
    expect(hammingDistance(a, b)).toBeLessThan(hammingDistance(a, c));
  });
});

describe("dedupeArticles", () => {
  it("collapses URL variants of one article", () => {
    const r = dedupeArticles([
      art("a", "Ceasefire extended", "https://bbc.co.uk/news/1", "bbc.co.uk", "2026-01-14T09:00:00Z"),
      art("b", "Ceasefire extended", "https://amp.bbc.co.uk/news/1?utm_source=x", "bbc.co.uk", "2026-01-14T10:00:00Z"),
    ]);
    expect(r.kept).toHaveLength(1);
    expect(r.removed[0].canonicalOf).toBe("a");
  });

  it("collapses syndicated re-runs across mastheads", () => {
    const r = dedupeArticles([
      art("wire", "Israel and Hamas agree to extend Gaza ceasefire", "https://reuters.com/1", "reuters.com", "2026-01-14T09:00:00Z"),
      art("run1", "Israel and Hamas agree to extend Gaza ceasefire", "https://thestar.com/2", "thestar.com", "2026-01-14T11:00:00Z"),
      art("run2", "Israel and Hamas agree to extend the Gaza ceasefire", "https://smh.com.au/3", "smh.com.au", "2026-01-14T12:00:00Z"),
    ]);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0].id).toBe("wire");
    expect(r.duplicateGroups.get("wire")).toHaveLength(2);
  });

  it("keeps genuinely different reports of the same event", () => {
    const r = dedupeArticles([
      art("a", "Gaza ceasefire extended as mediators push for lasting deal", "https://bbc.co.uk/a", "bbc.co.uk"),
      art("b", "Cabinet approves two-week extension of Gaza ceasefire", "https://haaretz.com/b", "haaretz.com"),
    ]);
    expect(r.kept).toHaveLength(2);
  });

  it("prefers the earliest copy as canonical regardless of input order", () => {
    const r = dedupeArticles([
      art("late", "Rates held at four percent", "https://x.test/late", "x.test", "2026-02-06T14:00:00Z"),
      art("early", "Rates held at four percent", "https://y.test/early", "reuters.com", "2026-02-06T12:00:00Z"),
    ]);
    expect(r.kept[0].id).toBe("early");
  });
});

describe("originality", () => {
  it("marks the wire as original and the carriers as syndicated", () => {
    const members = [
      art("wire", "Central bank holds rates at four percent", "https://reuters.com/1", "reuters.com", "2026-02-06T12:00:00Z"),
      art("carry", "Central bank holds rates at four percent (Reuters)", "https://thestar.com/2", "thestar.com", "2026-02-06T15:00:00Z"),
    ];
    const v = originalityFor(members);
    expect(v.find((x) => x.id === "wire")!.originality).toBe("original");
    expect(v.find((x) => x.id === "carry")!.originality).toBe("syndicated");
  });

  it("recognises primary official publication", () => {
    const v = originalityFor([
      art("gov", "Government launches AI Safety Institute", "https://gov.uk/news/1", "gov.uk", "2026-03-05T09:30:00Z"),
    ]);
    expect(v[0].score).toBeGreaterThan(60);
    expect(v[0].reasons.join(" ")).toMatch(/Primary/);
  });

  it("counts independent accounts rather than article rows", () => {
    const members = [
      art("wire", "Cloud outage disrupts banks and airlines", "https://reuters.com/1", "reuters.com", "2026-06-03T13:20:00Z"),
      art("carry", "Cloud outage disrupts banks and airlines (Reuters)", "https://star.test/2", "star.test", "2026-06-03T14:00:00Z"),
    ];
    const groups = new Map([["wire", ["dup1", "dup2", "dup3"]]]);
    const c = independentSourceCount(members, groups);
    expect(c.articles).toBe(5);
    expect(c.independent).toBe(1);
    expect(c.note).toMatch(/single source/i);
  });

  it("identifies wire publishers", () => {
    expect(isWire("reuters.com")).toBe(true);
    expect(isWire("apnews.com")).toBe(true);
    expect(isWire("theguardian.com")).toBe(false);
  });
});

describe("translation quality", () => {
  it("passes a faithful translation", () => {
    const r = checkTranslation("La BCE maintient ses taux a 3,25 %", "The ECB holds its rates at 3.25%");
    expect(r.usable).toBe(true);
    expect(r.flags).toHaveLength(0);
  });

  it("flags an unchanged passthrough", () => {
    const src = "Die EZB belasst den Leitzins bei 3,25 Prozent";
    expect(checkTranslation(src, src).flags).toContain("passthrough");
  });

  it("flags a dropped or altered figure", () => {
    const r = checkTranslation("Zentralbank hebt Zinsen um 50 Basispunkte an", "Central bank raises rates by 15 basis points");
    expect(r.flags).toContain("number-mismatch");
    expect(r.usable).toBe(false);
  });

  it("flags a lost named actor", () => {
    const r = checkTranslation("Die EZB und die NATO treffen sich in Bruessel", "They are meeting somewhere");
    expect(r.flags).toContain("entity-loss");
  });

  it("flags leftover source script", () => {
    const r = checkTranslation("Дроновий удар по Києву", "Дроновий удар по Kyiv today");
    expect(r.flags).toContain("script-residue");
  });

  it("flags assistant framing", () => {
    const r = checkTranslation("La BCE maintient ses taux", "Here is the translation: The ECB holds its rates");
    expect(r.flags).toContain("meta-text");
  });
});
