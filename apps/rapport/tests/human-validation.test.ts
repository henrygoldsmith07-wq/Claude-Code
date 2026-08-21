import { describe, expect, it } from "vitest";
import {
  activeRubricBehaviours,
  applyRubricChanges,
  assembleCorpus,
  auditRaterIndependence,
  benchmarkReliability,
  corpusCoverage,
  DEFAULT_MIN_CORPUS_ITEMS,
  DEFAULT_MIN_ITEMS_PER_BEHAVIOUR,
  emptyRubricLedger,
  humanValidationReport,
  isBehaviourInRubric,
  rateability,
  recommendRubricChanges,
  resolveConsensus,
  unrateableBehaviours,
  type RubricLedger,
} from "@/domain/human-validation";
import {
  CORPUS_BEHAVIOURS,
  CORPUS_RUBRIC_VERSION,
  emptyCorpus,
  type CorpusBenchmark,
  type CorpusItem,
  type CorpusRating,
} from "@/domain/corpus";
import type { BehaviourKey, Id } from "@/domain/types";

const NOW = "2026-08-21T10:00:00.000Z";
const N = DEFAULT_MIN_ITEMS_PER_BEHAVIOUR;

function item(id: Id): CorpusItem {
  return {
    id,
    title: `Transcript ${id}`,
    transcript: [
      { turnId: `${id}-t0`, index: 0, speaker: "user", text: "How was your weekend?" },
      { turnId: `${id}-t1`, index: 1, speaker: "character", text: "Good thanks. I went walking." },
    ],
    provenance: { kind: "researcher-entered", enteredAt: NOW },
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: NOW,
  };
}

interface LabelSpec {
  behaviour: string;
  a: number;
  b: number;
}

function rating(itemId: Id, raterId: string, labels: LabelSpec[], overrides: Partial<CorpusRating> = {}): CorpusRating {
  return {
    id: `rating-${itemId}-${raterId}-${labels.map((l) => l.behaviour).join("-")}`,
    itemId,
    raterId,
    ratedAt: NOW,
    rubricVersion: CORPUS_RUBRIC_VERSION,
    status: "independent",
    labels: labels.map((label) => ({
      behaviour: label.behaviour as never,
      decision: label.a >= 0.6 ? ("present" as const) : label.a <= 0.35 ? ("absent" as const) : ("uncertain" as const),
      score: label.a,
      confidence: 4 as const,
      evidence: [{ turnId: `${itemId}-t1`, turnIndex: 1, speaker: "character" as const, quote: "I went walking.", role: "support" as const }],
    })),
    ...overrides,
  };
}

/** n items, each independently labelled by rater-a (spec.a) and rater-b (spec.b). */
function corpusWith(count: number, scoresFor: (index: number) => LabelSpec[]): CorpusBenchmark {
  const corpus = emptyCorpus(NOW);
  for (let i = 0; i < count; i++) corpus.items.push(item(`item-${i}`));
  for (let i = 0; i < count; i++) {
    const specs = scoresFor(i);
    corpus.ratings.push(
      rating(`item-${i}`, "rater-a", specs),
      rating(`item-${i}`, "rater-b", specs.map((s) => ({ behaviour: s.behaviour, a: s.b, b: s.b }))),
    );
  }
  return corpus;
}

// Humans agree: same category, near-identical scores.
const AGREE = (i: number): LabelSpec[] => [{ behaviour: "follow-up-quality", a: 0.7 + (i % 2) * 0.05, b: 0.75 + (i % 2) * 0.05 }];
// Humans cannot agree at all: opposite categories, maximum spread.
const DISPUTE = (i: number): LabelSpec[] => [
  { behaviour: "observable-empathy", a: i % 2 === 0 ? 0.9 : 0.15, b: i % 2 === 0 ? 0.15 : 0.9 },
];
// Borderline: same category, scores half a band apart.
const DRIFT = (): LabelSpec[] => [{ behaviour: "curiosity", a: 0.65, b: 0.85 }];

describe("corpus assembly", () => {
  it("accepts a valid payload with its ratings intact and none invented", () => {
    const source = corpusWith(2, AGREE);
    const result = assembleCorpus(source, NOW);
    expect(result.accepted).toBe(true);
    expect(result.corpus.items).toHaveLength(2);
    expect(result.corpus.ratings).toHaveLength(4);
    expect(result.corpus.consensus).toHaveLength(0);
  });

  it("refuses an invalid payload whole rather than importing the good half", () => {
    const source = corpusWith(2, AGREE);
    (source.ratings[0] as unknown as { itemId: string }).itemId = "missing-item";
    const result = assembleCorpus(source, NOW);
    expect(result.accepted).toBe(false);
    expect(result.corpus.items).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("corpus coverage", () => {
  it("counts double-rated items and leaves under-labelled behaviours visible", () => {
    const corpus = corpusWith(4, (i) => [...AGREE(i), ...DRIFT()]);
    // One behaviour carried by a single rater on one item.
    corpus.ratings.push(rating("item-0", "rater-c", [{ behaviour: "domination", a: 0.2, b: 0.2 }]));
    const coverage = corpusCoverage(corpus, {});
    expect(coverage.activeItems).toBe(4);
    expect(coverage.doubleRatedItems).toBe(4);
    const domination = coverage.perBehaviour.find((b) => b.behaviour === "domination")!;
    expect(domination.singleRaterItems).toBe(1);
    expect(domination.doubleRatedItems).toBe(0);
    const drift = coverage.perBehaviour.find((b) => b.behaviour === "curiosity")!;
    expect(drift.doubleRatedItems).toBe(4);
    expect(drift.share).toBe(1);
  });

  it("meets the size gate only past the configured minimum of double-rated items", () => {
    const corpus = corpusWith(5, AGREE);
    expect(corpusCoverage(corpus, { minCorpusItems: 5 }).meetsSizeGate).toBe(true);
    expect(corpusCoverage(corpus, { minCorpusItems: 6 }).meetsSizeGate).toBe(false);
    expect(corpusCoverage(corpus, {}).note).toContain("Gaps stay gaps");
  });

  it("defaults to a 100-item gate for a reportable check", () => {
    const corpus = corpusWith(N, AGREE);
    const coverage = corpusCoverage(corpus, { minCorpusItems: DEFAULT_MIN_CORPUS_ITEMS });
    expect(coverage.minCorpusItems).toBe(DEFAULT_MIN_CORPUS_ITEMS);
    expect(coverage.meetsSizeGate).toBe(false);
  });
});

describe("independence audit", () => {
  it("flags one-rater behaviours as gaps, never as references", () => {
    const corpus = corpusWith(1, AGREE);
    corpus.ratings.push(rating("item-0", "rater-c", [{ behaviour: "domination", a: 0.2, b: 0.2 }]));
    const issues = auditRaterIndependence(corpus);
    expect(issues.some((issue) => issue.message.includes("domination") && issue.message.includes("gap"))).toBe(true);
  });

  it("flags the same rater labelling one behaviour twice on an item", () => {
    const corpus = corpusWith(1, AGREE);
    corpus.ratings.push(rating("item-0", "rater-a", [{ behaviour: "follow-up-quality", a: 0.5, b: 0.5 }]));
    const issues = auditRaterIndependence(corpus);
    expect(issues.filter((issue) => issue.raterId === "rater-a" && issue.message.includes("more than once"))).toHaveLength(1);
  });

  it("passes a cleanly double-marked corpus", () => {
    expect(auditRaterIndependence(corpusWith(2, AGREE))).toHaveLength(0);
  });

  it("ignores excluded ratings when counting raters", () => {
    const corpus = corpusWith(1, AGREE);
    corpus.ratings.push(rating("item-0", "rater-zzz", [{ behaviour: "curiosity", a: 0.9, b: 0.9 }], { status: "excluded" }));
    expect(auditRaterIndependence(corpus)).toHaveLength(0);
  });
});

describe("inter-rater reliability measured per behaviour", () => {
  it("separates a behaviour humans agree on from one they do not", () => {
    const corpus = corpusWith(N, (i) => [...AGREE(i), ...DISPUTE(i)]);
    const report = benchmarkReliability(corpus);
    expect(report.overall.items).toBeGreaterThan(0);

    const agreed = report.perBehaviour.find((b) => b.behaviour === "follow-up-quality")!;
    const disputed = report.perBehaviour.find((b) => b.behaviour === "observable-empathy")!;
    expect(agreed.meanAbsDisagreement!).toBeLessThan(0.06);
    expect(disputed.meanAbsDisagreement!).toBeGreaterThan(0.6);
    expect(agreed.verdict).toContain("reliable");
    expect(disputed.verdict).toContain("weak");
    expect(report.perBehaviour[0]?.behaviour).toBe("observable-empathy");
  });

  it("excludes ratings marked excluded from the measurement", () => {
    const corpus = corpusWith(3, AGREE);
    corpus.ratings.push(rating("item-0", "rater-x", [{ behaviour: "follow-up-quality", a: 0.05, b: 0.05 }], { status: "excluded" }));
    const agreed = benchmarkReliability(corpus).perBehaviour.find((b) => b.behaviour === "follow-up-quality")!;
    expect(agreed.meanAbsDisagreement!).toBeLessThan(0.06);
  });
});

describe("consensus resolution", () => {
  it("resolves within-threshold disagreement by taking the mean", () => {
    const resolution = resolveConsensus(corpusWith(1, AGREE), 0.25, undefined, NOW);
    expect(resolution.consensus).toHaveLength(1);
    expect(resolution.consensus[0]?.method).toBe("agreement");
    expect(resolution.consensus[0]?.consensusScore).toBeCloseTo(0.725);
    expect(resolution.unresolved).toHaveLength(0);
  });

  it("leaves beyond-threshold disagreement unresolved instead of averaging silently", () => {
    const resolution = resolveConsensus(corpusWith(1, DISPUTE), 0.25, undefined, NOW);
    expect(resolution.consensus).toHaveLength(0);
    expect(resolution.unresolved).toHaveLength(1);
    expect(resolution.unresolved[0]?.spread).toBeGreaterThan(0.25);
    expect(resolution.note).toContain("need adjudication");
  });

  it("records adjudicated consensus without deleting either human label", () => {
    const corpus = corpusWith(1, DISPUTE);
    const resolution = resolveConsensus(corpus, 0.25, "adj-1", NOW);
    const row = resolution.consensus.find((c) => c.method === "adjudicated");
    expect(row?.adjudicatorId).toBe("adj-1");
    expect(row?.rationale).toContain("requires adjudication");
    expect(resolution.unresolved).toHaveLength(1);
    expect(corpus.ratings).toHaveLength(2);
  });
});

describe("rateability — can humans rate this behaviour at all?", () => {
  it("names behaviours humans themselves cannot rate reliably", () => {
    const corpus = corpusWith(N, (i) => [...AGREE(i), ...DISPUTE(i)]);
    const rows = rateability(benchmarkReliability(corpus).perBehaviour, N);
    const unrateable = unrateableBehaviours(rows);
    expect(unrateable.map((r) => r.behaviour)).toEqual(["observable-empathy"]);
    expect(unrateable[0]?.usableAsReference).toBe(false);
    expect(unrateable[0]?.reasons.join(" ")).toContain("κ");

    const reliable = rows.find((r) => r.behaviour === "follow-up-quality")!;
    expect(reliable.rateability).toBe("reliable");
    expect(reliable.usableAsReference).toBe(true);
  });

  it("calls a fuzzy-but-consistent rubric moderate, not weak", () => {
    const corpus = corpusWith(N, (i) => [...AGREE(i), ...DRIFT()]);
    const rows = rateability(benchmarkReliability(corpus).perBehaviour, N);
    const drift = rows.find((r) => r.behaviour === "curiosity")!;
    expect(drift.rateability).toBe("moderate");
    expect(drift.usableAsReference).toBe(false);
  });

  it("withholds judgement on small samples instead of calling them weak or strong", () => {
    const corpus = corpusWith(4, (i) => [...AGREE(i), ...DISPUTE(i)]);
    const rows = rateability(benchmarkReliability(corpus).perBehaviour, N);
    expect(rows.every((r) => r.rateability === "insufficient-sample")).toBe(true);
    expect(unrateableBehaviours(rows)).toHaveLength(0);
  });
});

describe("rubric governance — remove or redesign weak rubrics", () => {
  const fullCorpus = () => corpusWith(N, (i) => [...AGREE(i), ...DISPUTE(i), ...DRIFT()]);

  it("recommends removal for unrateable, redesign for moderate, keep for reliable", () => {
    const recommendations = recommendRubricChanges(rateability(benchmarkReliability(fullCorpus()).perBehaviour, N));
    const byBehaviour = new Map(recommendations.map((r) => [r.behaviour, r]));
    expect(byBehaviour.get("observable-empathy")?.action).toBe("remove");
    expect(byBehaviour.get("curiosity")?.action).toBe("redesign");
    expect(byBehaviour.get("follow-up-quality")?.action).toBe("keep");
    expect(recommendations[0]?.action).toBe("remove");
  });

  it("applies a revision: version bump, evidence recorded, old ratings untouched", () => {
    const corpus = fullCorpus();
    const reliabilityRows = benchmarkReliability(corpus).perBehaviour;
    const recommendations = recommendRubricChanges(rateability(reliabilityRows, N));
    const { ledger, revision } = applyRubricChanges(emptyRubricLedger(), recommendations, "Empathy could not be rated consistently by trained humans.", reliabilityRows, NOW);

    expect(revision?.removed).toEqual(["observable-empathy"]);
    expect(revision?.redesigned.map((r) => r.behaviour)).toEqual(["curiosity"]);
    expect(revision?.evidence.every((e) => e.cohenKappa !== null || e.meanAbsDisagreement !== null)).toBe(true);
    expect(ledger.currentVersion).not.toBe(CORPUS_RUBRIC_VERSION);
    expect(ledger.revisions).toHaveLength(1);
    expect(corpus.ratings.every((r) => r.rubricVersion === CORPUS_RUBRIC_VERSION)).toBe(true);
  });

  it("drops removed behaviours from the active rubric but keeps everything else", () => {
    const ledger: RubricLedger = {
      currentVersion: CORPUS_RUBRIC_VERSION.replace(/1$/, "2"),
      revisions: [
        {
          id: "rev-1",
          createdAt: NOW,
          previousVersion: CORPUS_RUBRIC_VERSION,
          newVersion: CORPUS_RUBRIC_VERSION.replace(/1$/, "2"),
          removed: ["observable-empathy"],
          redesigned: [],
          rationale: "test",
          evidence: [],
        },
      ],
    };
    expect(isBehaviourInRubric(ledger, "observable-empathy")).toBe(false);
    expect(isBehaviourInRubric(ledger, "curiosity")).toBe(true);
    expect(activeRubricBehaviours(ledger)).toHaveLength(CORPUS_BEHAVIOURS.length - 1);
  });

  it("changes nothing when no recommendation warrants a revision", () => {
    const reliabilityRows = benchmarkReliability(corpusWith(4, AGREE)).perBehaviour;
    const recommendations = recommendRubricChanges(rateability(reliabilityRows, N));
    const { revision } = applyRubricChanges(emptyRubricLedger(), recommendations, "nothing to change", reliabilityRows, NOW);
    expect(revision).toBeNull();
  });
});

describe("the composed human-validation report", () => {
  function systemScoresFor(corpus: CorpusBenchmark): Map<Id, { key: BehaviourKey; score: number; evidence: string }[]> {
    const scores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>();
    for (const corpusItem of corpus.items) {
      scores.set(corpusItem.id, [
        { key: "followUpQuality", score: 0.72, evidence: "two open follow-ups building on prior answers" },
        { key: "empathy", score: 0.85, evidence: "validation phrases counted" },
      ]);
    }
    return scores;
  }

  it("validates reliable behaviours and excludes unrateable ones from the reference set", () => {
    const corpus = corpusWith(N, (i) => [...AGREE(i), ...DISPUTE(i)]);
    const report = humanValidationReport({
      corpus,
      systemScores: systemScoresFor(corpus),
      adjudicatorId: "adj-1",
      minItemsPerBehaviour: N,
      minCorpusItems: DEFAULT_MIN_CORPUS_ITEMS,
      now: NOW,
    });

    expect(report.coverage.doubleRatedItems).toBe(N);
    // Adjudicated consensus for the disputed behaviour exists...
    expect(report.consensus.consensus.some((c) => c.behaviour === "observable-empathy" && c.method === "adjudicated")).toBe(true);
    // ...but it is named unrateable and kept out of the system comparison.
    expect(report.unrateable.map((r) => r.behaviour)).toEqual(["observable-empathy"]);
    expect(report.validation?.perBehaviour.some((b) => b.behaviour === "observable-empathy")).toBe(false);

    const validated = report.validation?.perBehaviour.find((b) => b.behaviour === "follow-up-quality");
    expect(validated).toBeDefined();
    expect(validated!.meanAbsoluteError).not.toBeNull();
    expect(report.note).toContain("cannot rate");
  });

  it("skips the system comparison when no system scores are supplied", () => {
    const report = humanValidationReport({
      corpus: corpusWith(4, AGREE),
      minItemsPerBehaviour: 4,
      now: NOW,
    });
    expect(report.validation).toBeNull();
    expect(report.note).toContain("system comparison skipped");
  });

  it("keeps ledger-removed rubric behaviours out of the reference set too", () => {
    const base = corpusWith(N, (i) => [...AGREE(i), ...DISPUTE(i)]);
    const reliabilityRows = benchmarkReliability(base).perBehaviour;
    const recommendations = recommendRubricChanges(rateability(reliabilityRows, N));
    const { ledger } = applyRubricChanges(emptyRubricLedger(), recommendations, "weak rubrics", reliabilityRows, NOW);

    const report = humanValidationReport({
      corpus: base,
      ledger,
      systemScores: systemScoresFor(base),
      adjudicatorId: "adj-1",
      minItemsPerBehaviour: N,
      now: NOW,
    });
    expect(report.rubric.removed).toContain("observable-empathy");
    expect(report.consensus.consensus.some((c) => c.behaviour === "observable-empathy")).toBe(true);
    expect(report.validation?.perBehaviour.some((b) => b.behaviour === "observable-empathy")).toBe(false);
  });
});
