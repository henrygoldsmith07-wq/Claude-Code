import { describe, expect, it } from "vitest";
import {
  reconstructSyndication,
  summariseSyndication,
  wireCreditIn,
  wireOutlet,
  VIRTUAL_ORIGIN_PREFIX,
} from "./syndication";
import type { ArticleLike } from "./clustering";

/** Minimal article; `at` is hours after an arbitrary fixed epoch. */
function art(id: string, publisher: string, title: string, at?: number): ArticleLike {
  return {
    id,
    title,
    url: `https://${publisher}/${id}`,
    publisher,
    tags: [],
    publishedAt: at === undefined ? undefined : new Date(Date.UTC(2026, 1, 3, 6 + at)).toISOString(),
  };
}

describe("wire credit detection", () => {
  it("reads a wire from a credit position", () => {
    expect(wireCreditIn("Floods displace thousands in the delta (Reuters)")?.id).toBe("reuters");
    expect(wireCreditIn("Reuters — Floods displace thousands")?.id).toBe("reuters");
    expect(wireCreditIn("Floods displace thousands / AFP")?.id).toBe("afp");
    expect(wireCreditIn("Cabinet resigns, via Associated Press")?.id).toBe("ap");
    expect(wireCreditIn("Additional reporting by Reuters on the talks")?.id).toBe("reuters");
  });

  it("does not treat a story about a wire as a story from it", () => {
    // The single most likely false positive: the wire is the subject, not the source.
    expect(wireCreditIn("Thomson Reuters posts higher quarterly profit")).toBeNull();
    expect(wireCreditIn("Bloomberg terminal outage hits trading desks")).toBeNull();
  });

  it("does not match a wire alias inside an unrelated word", () => {
    expect(wireCreditIn("Grape harvest begins early in Apulia")).toBeNull();
  });

  it("identifies an outlet that is itself a wire", () => {
    expect(wireOutlet("reuters.com")?.id).toBe("reuters");
    expect(wireOutlet("https://www.apnews.com/article/x")?.id).toBe("ap");
    expect(wireOutlet("bbc.co.uk")).toBeNull();
  });
});

describe("chain reconstruction", () => {
  it("roots carriers at the wire copy present in the set", () => {
    const set = [
      art("wire", "reuters.com", "Central bank holds rates at 4.5%", 0),
      art("a", "thehindu.com", "Central bank holds rates at 4.5%", 1),
      art("b", "straitstimes.com", "Central bank holds rates at 4.5%", 2),
    ];
    const g = reconstructSyndication(set);
    expect(g.origins).toBe(1);
    expect(g.originOf.get("a")).toBe("wire");
    expect(g.originOf.get("b")).toBe("wire");
    expect(g.chains[0].wire?.id).toBe("reuters");
    expect(g.chains[0].carriers).toBe(2);
  });

  it("roots credited carriers at a virtual wire when the wire's copy is absent", () => {
    // The case that keeps corroboration honest: nobody in the set is Reuters,
    // but everybody says they got it from Reuters.
    const set = [
      art("a", "nation.africa", "Rebels withdraw from the border town (Reuters)", 0),
      art("b", "dawn.com", "Rebels pull back from border town (Reuters)", 1),
      art("c", "bangkokpost.com", "Rebels withdraw from border town (Reuters)", 2),
    ];
    const g = reconstructSyndication(set);
    expect(g.origins).toBe(1);
    expect(g.chains[0].originId).toBe(`${VIRTUAL_ORIGIN_PREFIX}reuters`);
    expect(g.chains[0].inferredOrigin).toBe(true);
    expect(g.chains[0].carriers).toBe(3);
  });

  it("keeps genuinely separate reports as separate origins", () => {
    const set = [
      art("a", "lemonde.fr", "Un accord sur les retraites divise le parlement", 0),
      art("b", "thehindu.com", "Monsoon floods close three districts", 1),
      art("c", "elpais.com", "Se aprueba el presupuesto regional", 2),
    ];
    const g = reconstructSyndication(set);
    expect(g.origins).toBe(3);
    expect(g.note).toContain("no syndication detected");
  });

  it("distinguishes two wires covering the same event as two origins", () => {
    // Reuters and AP both filing is genuine corroboration; collapsing them
    // would under-count independence just as badly as over-counting it.
    const set = [
      art("r", "reuters.com", "Volcano erupts on the northern island", 0),
      art("p", "apnews.com", "Eruption forces evacuation of northern island", 1),
      art("x", "nzherald.co.nz", "Volcano erupts on the northern island", 2),
    ];
    const g = reconstructSyndication(set);
    expect(g.origins).toBe(2);
    expect(g.originOf.get("x")).toBe("r");
  });

  it("prefers an explicit credit over a closer textual match", () => {
    // `b` reads more like `a`, but says it came from AFP. The statement wins.
    const set = [
      art("a", "cnn.com", "Rescue teams reach the stranded village", 0),
      art("b", "news24.com", "Rescue teams reach the stranded village (AFP)", 1),
    ];
    const g = reconstructSyndication(set);
    const member = g.chains.flatMap((c) => c.members).find((m) => m.id === "b")!;
    expect(member.relation).toBe("credited");
    expect(g.originOf.get("b")).toBe(`${VIRTUAL_ORIGIN_PREFIX}afp`);
  });

  it("grades a reworded derivation as a rewrite rather than a re-run", () => {
    const set = [
      art("a", "reuters.com", "Parliament approves the budget after long debate", 0),
      art("b", "theguardian.com", "Parliament approves budget following lengthy debate", 1),
    ];
    const g = reconstructSyndication(set);
    const b = g.chains.flatMap((c) => c.members).find((m) => m.id === "b")!;
    expect(["verbatim", "rewrite"]).toContain(b.relation);
    expect(g.origins).toBe(1);
  });

  it("refuses to assert a direction between undated, merely-similar reports", () => {
    // Without timestamps there is no way to know who rewrote whom, and
    // inventing an edge would fabricate a dependency that may not exist.
    const set = [
      art("a", "elmundo.es", "El gobierno anuncia una reforma fiscal amplia"),
      art("b", "clarin.com", "El gobierno anuncia una reforma tributaria"),
    ];
    const g = reconstructSyndication(set);
    expect(g.origins).toBe(2);
  });

  it("still links undated reports when the text is effectively identical", () => {
    const set = [
      art("a", "elmundo.es", "El gobierno anuncia una reforma fiscal amplia"),
      art("b", "clarin.com", "El gobierno anuncia una reforma fiscal amplia"),
    ];
    expect(reconstructSyndication(set).origins).toBe(1);
  });

  it("never lets a report derive from one published after it", () => {
    const set = [
      art("late", "bbc.co.uk", "Talks collapse without agreement", 5),
      art("early", "reuters.com", "Talks collapse without agreement", 0),
    ];
    const g = reconstructSyndication(set);
    expect(g.originOf.get("late")).toBe("early");
    expect(g.originOf.get("early")).toBe("early");
  });

  it("handles an empty set without inventing a chain", () => {
    const g = reconstructSyndication([]);
    expect(g.origins).toBe(0);
    expect(g.chains).toEqual([]);
  });
});

describe("reader-facing summary", () => {
  it("leads with the origin count, not the article count", () => {
    const set = [
      art("wire", "reuters.com", "Ceasefire holds for a second day", 0),
      art("a", "dawn.com", "Ceasefire holds for a second day", 1),
      art("b", "nation.africa", "Ceasefire holds for a second day", 2),
      art("c", "smh.com.au", "Ceasefire holds for a second day", 3),
    ];
    const s = summariseSyndication(set);
    expect(s.origins).toBe(1);
    expect(s.headline).toBe("1 original report, carried by 3 other outlet(s).");
    expect(s.syndicatedChains[0].carriers).toBe(3);
  });
});
