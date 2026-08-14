import { describe, expect, it } from "vitest";
import {
  agreementBetween,
  assertBenchmarkable,
  benchmarkEligibility,
  corpusStats,
  emptyCorpus,
  goldGroupsFrom,
  resolveLabels,
  GUIDELINES_VERSION,
  type Corpus,
} from "./corpus";
import {
  citationPrecision,
  claimBenchmarkEligibility,
  emptyClaimVerificationSet,
  invalidLabels,
  type ClaimVerificationSet,
} from "./claimVerification";
import { CLAIM_VERIFICATION_SET, CLUSTERING_CORPUS } from "./corpusData";

function article(id: string, publisher = "reuters.com", language = "en") {
  return {
    id,
    url: `https://${publisher}/${id}`,
    title: `Headline ${id}`,
    publisher,
    language,
    fetchedAt: "2026-08-14T00:00:00.000Z",
  };
}

function label(articleId: string, eventKey: string | null, annotatorId: string) {
  return {
    articleId,
    eventKey,
    annotatorId,
    at: "2026-08-14T00:00:00.000Z",
    guidelinesVersion: GUIDELINES_VERSION,
    confidence: "high" as const,
  };
}

function corpusWith(articles: string[], labels: ReturnType<typeof label>[]): Corpus {
  return {
    ...emptyCorpus("human-labelled"),
    annotators: [
      { id: "ann-a", role: "annotator" },
      { id: "ann-b", role: "annotator" },
      { id: "adj", role: "adjudicator" },
    ],
    articles: articles.map((a) => article(a)),
    labels,
  };
}

describe("shipped corpora", () => {
  it("are empty, and say so rather than implying data", () => {
    const stats = corpusStats(CLUSTERING_CORPUS);
    expect(stats.articles).toBe(0);
    expect(stats.summary).toContain("Nothing can be scored against it yet");
    expect(CLAIM_VERIFICATION_SET.citations).toHaveLength(0);
  });

  it("refuse to be reported as benchmarks while empty", () => {
    expect(benchmarkEligibility(CLUSTERING_CORPUS).eligible).toBe(false);
    expect(claimBenchmarkEligibility(CLAIM_VERIFICATION_SET).eligible).toBe(false);
    expect(() => assertBenchmarkable(CLUSTERING_CORPUS)).toThrow(/not reportable/);
  });
});

describe("label resolution", () => {
  it("marks an article agreed when both annotators match", () => {
    const c = corpusWith(["a1"], [label("a1", "e1", "ann-a"), label("a1", "e1", "ann-b")]);
    expect(resolveLabels(c)[0].state).toBe("agreed");
  });

  it("marks an article contested rather than picking a side", () => {
    const c = corpusWith(["a1"], [label("a1", "e1", "ann-a"), label("a1", "e2", "ann-b")]);
    const r = resolveLabels(c)[0];
    expect(r.state).toBe("contested");
    expect(r.eventKey).toBeNull();
  });

  it("marks a single-annotator article under-labelled", () => {
    const c = corpusWith(["a1"], [label("a1", "e1", "ann-a")]);
    expect(resolveLabels(c)[0].state).toBe("under-labelled");
  });

  it("lets an adjudicator settle a contested article", () => {
    const c = corpusWith(["a1"], [label("a1", "e1", "ann-a"), label("a1", "e2", "ann-b")]);
    c.adjudications = [
      { articleId: "a1", eventKey: "e1", by: "adj", at: "2026-08-14T01:00:00.000Z", note: "Both cover the same vote." },
    ];
    const r = resolveLabels(c)[0];
    expect(r.state).toBe("adjudicated");
    expect(r.eventKey).toBe("e1");
  });

  it("excludes contested articles from the ground-truth groups", () => {
    const c = corpusWith(
      ["a1", "a2", "a3"],
      [
        label("a1", "e1", "ann-a"), label("a1", "e1", "ann-b"),
        label("a2", "e1", "ann-a"), label("a2", "e1", "ann-b"),
        label("a3", "e1", "ann-a"), label("a3", "e2", "ann-b"), // contested
      ],
    );
    const groups = goldGroupsFrom(c);
    expect(groups).toEqual([["a1", "a2"]]);
  });
});

describe("agreement", () => {
  it("reports perfect agreement as kappa 1", () => {
    const c = corpusWith(
      ["a1", "a2", "a3"],
      [
        label("a1", "e1", "ann-a"), label("a1", "e1", "ann-b"),
        label("a2", "e1", "ann-a"), label("a2", "e1", "ann-b"),
        label("a3", "e2", "ann-a"), label("a3", "e2", "ann-b"),
      ],
    );
    const r = agreementBetween(c, "ann-a", "ann-b");
    expect(r.kappa).toBe(1);
    expect(r.interpretation).toContain("Strong agreement");
  });

  it("does not let high raw agreement on mostly-unrelated pairs pass as good", () => {
    // Both annotators say "different" to nearly everything, so raw agreement is
    // high while the one judgement that mattered is a disagreement. Kappa is
    // what catches that, which is why it is the reported number.
    const ids = ["a1", "a2", "a3", "a4", "a5"];
    const c = corpusWith(ids, [
      ...ids.map((id, i) => label(id, `e${i}`, "ann-a")),
      ...ids.map((id, i) => label(id, i === 1 ? "e0" : `e${i}`, "ann-b")),
    ]);
    const r = agreementBetween(c, "ann-a", "ann-b");
    expect(r.observed).toBeGreaterThan(0.85);
    expect(r.kappa).toBeLessThan(0.6);
    expect(r.interpretation).not.toContain("Strong");
  });

  it("says agreement cannot be measured without overlap", () => {
    const c = corpusWith(["a1", "a2"], [label("a1", "e1", "ann-a"), label("a2", "e2", "ann-b")]);
    expect(agreementBetween(c, "ann-a", "ann-b").pairs).toBe(0);
  });
});

describe("eligibility gate", () => {
  it("blocks a synthetic corpus however large", () => {
    const c: Corpus = {
      ...emptyCorpus("synthetic"),
      annotators: [{ id: "a", role: "annotator" }, { id: "b", role: "annotator" }],
      articles: Array.from({ length: 500 }, (_, i) => article(`a${i}`)),
      labels: Array.from({ length: 500 }, (_, i) => label(`a${i}`, `e${i}`, "a"))
        .concat(Array.from({ length: 500 }, (_, i) => label(`a${i}`, `e${i}`, "b"))),
    };
    const e = benchmarkEligibility(c, 200);
    expect(e.eligible).toBe(false);
    expect(e.reasons.join(" ")).toContain("synthetic");
  });

  it("passes a real corpus that meets every condition", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `a${i}`);
    const c = corpusWith(ids, [
      ...ids.map((id, i) => label(id, `e${i % 3}`, "ann-a")),
      ...ids.map((id, i) => label(id, `e${i % 3}`, "ann-b")),
    ]);
    expect(benchmarkEligibility(c, 10).eligible).toBe(true);
  });
});

describe("claim verification", () => {
  function setWith(labels: ClaimVerificationSet["labels"]): ClaimVerificationSet {
    return {
      ...emptyClaimVerificationSet("human-labelled"),
      annotators: [{ id: "x", role: "annotator" }, { id: "y", role: "annotator" }],
      citations: [
        { id: "c1", claim: "Forty were killed", citedUrl: "https://reuters.com/1", citedTitle: "Raid kills forty", citedPublisher: "reuters.com" },
        { id: "c2", claim: "The bridge reopened", citedUrl: "https://bbc.co.uk/2", citedTitle: "Traffic update", citedPublisher: "bbc.co.uk" },
      ],
      labels,
    };
  }

  const judged = (citationId: string, verdict: ClaimVerificationSet["labels"][number]["verdict"], who: string, quote?: string) => ({
    citationId, verdict, quote, annotatorId: who, at: "2026-08-14T00:00:00.000Z", guidelinesVersion: GUIDELINES_VERSION,
  });

  it("rejects a 'supported' verdict with no quote to check", () => {
    const problems = invalidLabels(setWith([judged("c1", "supported", "x")]));
    expect(problems).toHaveLength(1);
    expect(problems[0].problem).toContain("verbatim quote");
  });

  it("accepts a quoted verdict", () => {
    expect(invalidLabels(setWith([judged("c1", "supported", "x", "forty people were killed")]))).toHaveLength(0);
  });

  it("flags a label pointing at a citation that is not in the set", () => {
    const problems = invalidLabels(setWith([judged("nope", "not-addressed", "x")]));
    expect(problems[0].problem).toContain("not in the set");
  });

  it("scores only citations the annotators agree on", () => {
    const set = setWith([
      judged("c1", "supported", "x", "forty people were killed"),
      judged("c1", "supported", "y", "forty people were killed"),
      judged("c2", "supported", "x", "the bridge reopened"),
      judged("c2", "not-addressed", "y"), // disagreement — excluded
    ]);
    const r = citationPrecision(set);
    expect(r.judged).toBe(1);
    expect(r.precision).toBe(1);
  });

  it("counts a contradicting citation against precision", () => {
    const set = setWith([
      judged("c1", "supported", "x", "forty killed"), judged("c1", "supported", "y", "forty killed"),
      judged("c2", "contradicted", "x", "the bridge remains closed"),
      judged("c2", "contradicted", "y", "the bridge remains closed"),
    ]);
    const r = citationPrecision(set);
    expect(r.precision).toBe(0.5);
    expect(r.note).toContain("1 contradict");
  });

  it("counts partial support as half rather than as a clean citation", () => {
    const set = setWith([
      judged("c1", "partially-supported", "x", "dozens were killed"),
      judged("c1", "partially-supported", "y", "dozens were killed"),
    ]);
    expect(citationPrecision(set).precision).toBe(0.5);
  });

  it("excludes unreachable pages from the score", () => {
    const set = setWith([
      judged("c1", "supported", "x", "forty killed"), judged("c1", "supported", "y", "forty killed"),
      judged("c2", "unreachable", "x"), judged("c2", "unreachable", "y"),
    ]);
    const r = citationPrecision(set);
    expect(r.unreachable).toBe(1);
    expect(r.precision).toBe(1);
  });

  it("computes nothing from an empty set", () => {
    const r = citationPrecision(emptyClaimVerificationSet());
    expect(r.judged).toBe(0);
    expect(r.note).toContain("cannot be computed");
  });
});
