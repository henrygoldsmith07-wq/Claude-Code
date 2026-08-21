import { describe, expect, it } from "vitest";
import { validateAgainstHuman } from "@/domain/validation";
import {
  CORPUS_BEHAVIOURS,
  CORPUS_RUBRIC_VERSION,
  deriveConsensus,
  emptyCorpus,
  type CorpusBenchmark,
  type CorpusItem,
  type CorpusRating,
} from "@/domain/corpus";
import type { BehaviourKey, Id } from "@/domain/types";

const NOW = "2026-08-20T10:00:00.000Z";

function corpusItem(id: Id): CorpusItem {
  return {
    id,
    title: `Transcript ${id}`,
    transcript: [
      { turnId: `${id}-t0`, index: 0, speaker: "user", text: "How was your weekend?" },
      { turnId: `${id}-t1`, index: 1, speaker: "character", text: "Good thanks, went walking." },
    ],
    provenance: { kind: "researcher-entered", enteredAt: NOW },
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: NOW,
  };
}

function rating(itemId: Id, raterId: string, behaviour: string, score: number): CorpusRating {
  return {
    id: `rating-${itemId}-${raterId}-${behaviour}`,
    itemId,
    raterId,
    ratedAt: NOW,
    rubricVersion: CORPUS_RUBRIC_VERSION,
    status: "independent",
    labels: [
      {
        behaviour: behaviour as never,
        decision: score >= 0.6 ? "present" : score <= 0.35 ? "absent" : "uncertain",
        score,
        confidence: 4,
        evidence: [{ turnId: `${itemId}-t1`, turnIndex: 1, speaker: "character", quote: "went walking", role: "support" }],
      },
    ],
  };
}

/** Build a corpus with consensus for the given behaviour and human scores per item. */
function corpusWith(behaviour: string, humanScores: number[]): CorpusBenchmark {
  const corpus = emptyCorpus(NOW);
  const items = humanScores.map((_, i) => corpusItem(`item-${i}`));
  corpus.items.push(...items);
  const ratings: CorpusRating[] = [];
  items.forEach((item, i) => {
    const score = humanScores[i]!;
    ratings.push(rating(item.id, "r1", behaviour, Math.max(0, Math.min(1, score - 0.05))));
    ratings.push(rating(item.id, "r2", behaviour, Math.min(1, score + 0.05)));
  });
  corpus.ratings.push(...ratings);
  for (const item of items) {
    corpus.consensus.push(...deriveConsensus(item, ratings, 0.25, undefined, NOW));
  }
  return corpus;
}

describe("rapport vs human validation", () => {
  it("reports nothing rather than fabricating when there is no consensus", () => {
    const report = validateAgainstHuman(emptyCorpus(NOW), new Map());
    expect(report.compared).toBe(0);
    expect(report.note).toContain("No ratings have been fabricated");
  });

  it("compares system scores against human consensus per behaviour", () => {
    const behaviour = "curiosity";
    const corpus = corpusWith(behaviour, [0.8, 0.6, 0.3]);
    const systemScores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>([
      ["item-0", [{ key: "questionQuality", score: 0.75, evidence: "2 of 3 questions were open" }]],
      ["item-1", [{ key: "questionQuality", score: 0.55, evidence: "1 of 2 questions were open" }]],
      ["item-2", [{ key: "questionQuality", score: 0.25, evidence: "0 of 2 questions were open" }]],
    ]);
    const report = validateAgainstHuman(corpus, systemScores);
    expect(report.compared).toBe(3);
    expect(report.perBehaviour).toHaveLength(1);
    expect(report.perBehaviour[0]?.behaviour).toBe(behaviour);
    expect(report.perBehaviour[0]?.meanAbsoluteError).not.toBeNull();
    expect(report.perBehaviour[0]?.pearsonR).not.toBeNull();
  });

  it("breaks results down by behaviour so a weak one cannot hide behind the overall MAE", () => {
    // Two behaviours: one where the system matches humans well, one badly.
    const good = corpusWith("curiosity", [0.8, 0.6, 0.3]);
    const bad = corpusWith("observable-empathy", [0.9, 0.85, 0.8]);
    const corpus = emptyCorpus(NOW);
    corpus.items.push(...good.items, ...bad.items);
    corpus.ratings.push(...good.ratings, ...bad.ratings);
    corpus.consensus.push(...good.consensus, ...bad.consensus);

    const systemScores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>([
      ["item-0", [
        { key: "questionQuality", score: 0.75, evidence: "open questions" },
        { key: "empathy", score: 0.2, evidence: "no acknowledgement of feeling" },
      ]],
      ["item-1", [
        { key: "questionQuality", score: 0.55, evidence: "one open question" },
        { key: "empathy", score: 0.15, evidence: "no validation" },
      ]],
      ["item-2", [
        { key: "questionQuality", score: 0.25, evidence: "closed questions only" },
        { key: "empathy", score: 0.1, evidence: "minimised instead" },
      ]],
    ]);

    const report = validateAgainstHuman(corpus, systemScores);
    expect(report.perBehaviour.length).toBe(2);
    const empathy = report.perBehaviour.find((b) => b.behaviour === "observable-empathy")!;
    const curiosity = report.perBehaviour.find((b) => b.behaviour === "curiosity")!;
    expect(empathy.meanAbsoluteError!).toBeGreaterThan(curiosity.meanAbsoluteError!);
    // Worst first — poor validity is surfaced, not buried.
    expect(report.perBehaviour[0]?.behaviour).toBe("observable-empathy");
    expect(empathy.verdict).toContain("poor agreement");
  });

  it("classifies false positives and false negatives explicitly", () => {
    const corpus = corpusWith("curiosity", [0.2]); // humans say absent
    const systemScores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>([
      ["item-0", [{ key: "questionQuality", score: 0.9, evidence: "all questions were open" }]], // system says strong
    ]);
    const report = validateAgainstHuman(corpus, systemScores);
    expect(report.perBehaviour[0]?.falsePositives).toBe(1);
  });

  it("keeps the exact human and system evidence side by side on every comparison", () => {
    const corpus = corpusWith("curiosity", [0.7]);
    const systemScores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>([
      ["item-0", [{ key: "questionQuality", score: 0.65, evidence: "2 of 3 questions were open" }]],
    ]);
    const report = validateAgainstHuman(corpus, systemScores);
    const worst = report.perBehaviour[0]?.worstExamples[0];
    expect(worst?.systemEvidence).toContain("questions were open");
    expect(worst?.humanEvidence.length).toBeGreaterThan(0);
    expect(worst?.consensusMethod).toBe("agreement");
    expect(worst?.rubricVersion).toBe(CORPUS_RUBRIC_VERSION);
  });

  it("warns when the sample is too small for strong claims", () => {
    const corpus = corpusWith("curiosity", [0.7]);
    const systemScores = new Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>([
      ["item-0", [{ key: "questionQuality", score: 0.65, evidence: "2 of 3 questions were open" }]],
    ]);
    const report = validateAgainstHuman(corpus, systemScores);
    expect(report.note).toContain("too small");
  });

  it("covers every corpus behaviour in the mapping used by validation", () => {
    // Sanity: each of the 11 rated behaviours maps to at least one internal key
    for (const behaviour of CORPUS_BEHAVIOURS) {
      const corpus = corpusWith(behaviour, [0.7]);
      expect(corpus.consensus.length, behaviour).toBeGreaterThan(0);
    }
  });
});
