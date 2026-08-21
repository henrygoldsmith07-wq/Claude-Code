import { describe, expect, it } from "vitest";
import {
  CORPUS_BEHAVIOURS,
  CORPUS_RUBRIC_VERSION,
  CORPUS_METHODOLOGY,
  corpusToInternalBehaviours,
  internalToCorpusBehaviours,
  deriveConsensus,
  emptyCorpus,
  isCorpusImportValid,
  stripCorpusItemForStorage,
  anonymizeTranscriptTurns,
  validateCorpusImport,
  corpusItemFromDonation,
  type CorpusItem,
  type CorpusRating,
} from "@/domain/corpus";
import { donate, prepareDonation } from "@/domain/donation";

const NOW = "2026-08-20T10:00:00.000Z";

function item(overrides: Partial<CorpusItem> = {}): CorpusItem {
  return {
    id: "item-1",
    title: "Test transcript",
    transcript: [
      { turnId: "t0", index: 0, speaker: "user", text: "How was your weekend?" },
      { turnId: "t1", index: 1, speaker: "character", text: "Good, thanks. I went walking." },
    ],
    provenance: { kind: "researcher-entered", enteredAt: NOW },
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: NOW,
    ...overrides,
  };
}

function rating(raterId: string, behaviour: string, score: number, itemId = "item-1"): CorpusRating {
  return {
    id: `rating-${raterId}-${behaviour}`,
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
        evidence: [{ turnId: "t1", turnIndex: 1, speaker: "character", quote: "I went walking.", role: "support" }],
      },
    ],
  };
}

describe("corpus behaviour vocabulary", () => {
  it("defines exactly the 11 rated behaviours", () => {
    expect(CORPUS_BEHAVIOURS).toHaveLength(11);
    expect(CORPUS_BEHAVIOURS).toContain("active-listening");
    expect(CORPUS_BEHAVIOURS).toContain("observable-empathy");
    expect(CORPUS_BEHAVIOURS).toContain("domination");
    expect(CORPUS_BEHAVIOURS).toContain("missed-opportunities");
  });

  it("maps every corpus behaviour onto at least one internal key", () => {
    for (const behaviour of CORPUS_BEHAVIOURS) {
      expect(corpusToInternalBehaviours(behaviour).length, behaviour).toBeGreaterThan(0);
    }
  });

  it("round-trips through the reverse mapping", () => {
    for (const behaviour of CORPUS_BEHAVIOURS) {
      for (const key of corpusToInternalBehaviours(behaviour)) {
        expect(internalToCorpusBehaviours(key), `${behaviour} -> ${key}`).toContain(behaviour);
      }
    }
  });
});

describe("human import validation", () => {
  it("accepts a well-formed corpus payload", () => {
    const payload = emptyCorpus(NOW);
    payload.items.push(item());
    payload.ratings.push(rating("r1", "curiosity", 0.8), rating("r2", "curiosity", 0.75));
    expect(isCorpusImportValid(payload)).toBe(true);
  });

  it("rejects a rating that references an unknown item", () => {
    const payload = emptyCorpus(NOW);
    payload.ratings.push(rating("r1", "curiosity", 0.8, "missing-item"));
    const result = validateCorpusImport(payload);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("unknown item"))).toBe(true);
  });

  it("rejects an unknown behaviour name rather than silently mapping it", () => {
    const payload = emptyCorpus(NOW);
    payload.items.push(item());
    const r = rating("r1", "mind-reading", 0.9);
    payload.ratings.push(r);
    expect(isCorpusImportValid(payload)).toBe(false);
  });

  it("rejects scores outside 0-1 and confidences outside 1-5", () => {
    const payload = emptyCorpus(NOW);
    payload.items.push(item());
    payload.ratings.push(rating("r1", "curiosity", 1.4));
    expect(isCorpusImportValid(payload)).toBe(false);

    const payload2 = emptyCorpus(NOW);
    payload2.items.push(item());
    const r = rating("r1", "curiosity", 0.5);
    r.labels[0]!.confidence = 9 as never;
    payload2.ratings.push(r);
    expect(isCorpusImportValid(payload2)).toBe(false);
  });

  it("rejects a duplicate rating from the same rater for the same behaviour", () => {
    const payload = emptyCorpus(NOW);
    payload.items.push(item());
    payload.ratings.push(rating("r1", "curiosity", 0.8), rating("r1", "curiosity", 0.4));
    expect(isCorpusImportValid(payload)).toBe(false);
  });

  it("rejects a payload without provenance or rubric version", () => {
    const bad = { items: [{ id: "x", transcript: [] }], ratings: [] };
    expect(isCorpusImportValid(bad)).toBe(false);
  });

  it("never fabricates ratings to fill gaps — an unrated item stays unrated", () => {
    const payload = emptyCorpus(NOW);
    payload.items.push(item());
    // No ratings at all.
    expect(payload.ratings).toHaveLength(0);
    const consensus = deriveConsensus(item(), [], 0.25, undefined, NOW);
    expect(consensus).toHaveLength(0);
  });
});

describe("consensus derivation", () => {
  it("produces agreement consensus when two raters are within threshold", () => {
    const consensus = deriveConsensus(item(), [rating("r1", "curiosity", 0.8), rating("r2", "curiosity", 0.7)], 0.25, undefined, NOW);
    expect(consensus).toHaveLength(1);
    expect(consensus[0]?.method).toBe("agreement");
    expect(consensus[0]?.consensusScore).toBeCloseTo(0.75);
    expect(consensus[0]?.residualSpread).toBeCloseTo(0.1);
    expect(consensus[0]?.evidence.length).toBeGreaterThan(0);
  });

  it("refuses to average when raters disagree beyond threshold and no adjudicator exists", () => {
    const consensus = deriveConsensus(item(), [rating("r1", "curiosity", 0.9), rating("r2", "curiosity", 0.2)], 0.25, undefined, NOW);
    expect(consensus).toHaveLength(0);
  });

  it("marks disagreement for adjudication instead of inventing a number when an adjudicator is present", () => {
    const consensus = deriveConsensus(item(), [rating("r1", "curiosity", 0.9), rating("r2", "curiosity", 0.2)], 0.25, "adj-1", NOW);
    expect(consensus).toHaveLength(1);
    expect(consensus[0]?.method).toBe("adjudicated");
    expect(consensus[0]?.rationale).toContain("requires adjudication");
  });

  it("ignores excluded ratings", () => {
    const excluded = { ...rating("r1", "curiosity", 0.1), status: "excluded" as const };
    const consensus = deriveConsensus(item(), [excluded, rating("r2", "curiosity", 0.8)], 0.25, undefined, NOW);
    expect(consensus).toHaveLength(0);
  });

  it("does not produce consensus from a single rater", () => {
    const consensus = deriveConsensus(item(), [rating("r1", "curiosity", 0.8)], 0.25, undefined, NOW);
    expect(consensus).toHaveLength(0);
  });

  it("carries the rubric version into every consensus row", () => {
    const consensus = deriveConsensus(item(), [rating("r1", "curiosity", 0.8), rating("r2", "curiosity", 0.75)], 0.25, undefined, NOW);
    expect(consensus[0]?.rubricVersion).toBe(CORPUS_RUBRIC_VERSION);
  });
});

describe("privacy of the corpus", () => {
  it("records provenance and methodology with the data", () => {
    const corpus = emptyCorpus(NOW);
    expect(corpus.methodology).toBe(CORPUS_METHODOLOGY);
    expect(CORPUS_METHODOLOGY).toContain("opt-in");
    expect(CORPUS_METHODOLOGY.toLowerCase()).toContain("no ratings are fabricated");
  });

  it("strips identity fields from items on storage", () => {
    const dirty = item({
      provenance: { kind: "donated-transcript", donatedAt: NOW, consentVersion: "2026-08-14.1" },
    }) as CorpusItem & { userId?: string };
    dirty.userId = "user-123";
    const clean = stripCorpusItemForStorage(dirty);
    expect((clean as unknown as Record<string, unknown>).userId).toBeUndefined();
    expect(clean.provenance.kind).toBe("donated-transcript");
    expect(clean.provenance).not.toHaveProperty("userId");
  });

  it("anonymises redacted names throughout the transcript", () => {
    const turns = [
      { turnId: "t0", index: 0, speaker: "user" as const, text: "Marcus said the project slipped again." },
      { turnId: "t1", index: 1, speaker: "character" as const, text: "Marcus again? That is the third time." },
    ];
    const cleaned = anonymizeTranscriptTurns(turns, ["Marcus"]);
    expect(cleaned.every((t) => !t.text.includes("Marcus"))).toBe(true);
    expect(cleaned[0]?.text).toContain("[removed]");
  });

  it("builds a corpus item from a donation carrying consent, not identity", () => {
    const simulation = {
      id: "sim-1",
      userId: "user-1",
      scenarioId: "sc-1",
      scenario: { id: "sc-1", title: "Chat", context: "", skillIds: [], objective: "", difficulty: 3 as const, characters: [], branches: [], evaluationCriteria: [] },
      mode: "text" as const,
      startedAt: NOW,
      deliveredDifficulty: 3,
      assistLevel: "none" as const,
      turns: [
        { id: "t0", simulationId: "sim-1", index: 0, speaker: "user" as const, text: "Hello there.", createdAt: NOW },
        { id: "t1", simulationId: "sim-1", index: 1, speaker: "character" as const, characterId: "c1", text: "Hi.", createdAt: NOW },
      ],
    };
    const preview = prepareDonation(simulation);
    const donated = donate(preview, "donation-1", NOW);
    const corpusItem = corpusItemFromDonation(donated);
    expect(corpusItem.provenance.kind).toBe("donated-transcript");
    expect(JSON.stringify(corpusItem)).not.toContain("user-1");
    expect(JSON.stringify(corpusItem)).not.toContain("sim-1");
  });
});
