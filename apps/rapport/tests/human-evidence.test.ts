import { describe, expect, it } from "vitest";
import {
  detectRaterDisagreements,
  emptyHumanEvidence,
  humanVsSystemAgreement,
  interRaterReliability,
  reconcileDisagreements,
  resolveAdjudication,
  raterConfidenceSummary,
  scoreCalibration,
  transferReports,
  type HumanEvidenceState,
} from "@/domain/human-evidence";

const base: HumanEvidenceState = {
  ...emptyHumanEvidence(),
  raters: [
    { id: "r1", displayName: "Rater one", role: "rater", createdAt: "2026-08-01T00:00:00.000Z", active: true },
    { id: "r2", displayName: "Rater two", role: "rater", createdAt: "2026-08-01T00:00:00.000Z", active: true },
    { id: "adj", displayName: "Adjudicator", role: "adjudicator", createdAt: "2026-08-01T00:00:00.000Z", active: true },
  ],
  items: [
    {
      id: "item-1",
      title: "Meeting response",
      kind: "simulation-evaluation",
      source: "researcher-entered",
      occurredAt: "2026-08-01T00:00:00.000Z",
      skillIds: ["listening"],
      systemScores: [
        { key: "listening", score: 0.8, evidence: "System counted one follow-up", reliable: true },
        { key: "clarity", score: 0.2, evidence: "System found an incomplete answer", reliable: true },
      ],
    },
  ],
  ratings: [
    {
      id: "rating-1",
      itemId: "item-1",
      raterId: "r1",
      ratedAt: "2026-08-02T00:00:00.000Z",
      status: "independent",
      labels: [{ key: "listening", decision: "absent", score: 0.2, confidence: 4, evidence: ["They changed topic before answering."] }],
    },
    {
      id: "rating-2",
      itemId: "item-1",
      raterId: "r2",
      ratedAt: "2026-08-02T01:00:00.000Z",
      status: "independent",
      labels: [{ key: "listening", decision: "absent", score: 0.8, confidence: 3, evidence: ["They asked one relevant follow-up, but did not answer the point."] }],
    },
  ],
};

describe("human evidence workflow", () => {
  it("stores disagreement with its raters and exact rating ids", () => {
    const disagreements = detectRaterDisagreements(base, 0.25, "2026-08-03T00:00:00.000Z");
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0]?.ratingIds).toEqual(["rating-1", "rating-2"]);
    expect(disagreements[0]?.spread).toBeCloseTo(0.6);
  });

  it("keeps an adjudication as a separate audit record", () => {
    const state = reconcileDisagreements(base, 0.25, "2026-08-03T00:00:00.000Z");
    const disagreement = state.disagreements[0]!;
    const resolved = resolveAdjudication(state, {
      disagreementId: disagreement.id,
      itemId: disagreement.itemId,
      behaviourKey: disagreement.behaviourKey,
      selectedDecision: "present",
      selectedScore: 0.6,
      adjudicatorId: "adj",
      exactEvidence: ["The follow-up was relevant, but the first answer was missed."],
      rationale: "Both observations are valid; use the middle score.",
      createdAt: "2026-08-04T00:00:00.000Z",
    });
    expect(resolved.adjudications).toHaveLength(1);
    expect(resolved.disagreements[0]?.status).toBe("resolved");
    expect(resolved.disagreements[0]?.adjudicationId).toContain("adjudication:");
  });

  it("reports human-vs-system errors, confidence and calibration", () => {
    const report = humanVsSystemAgreement(base);
    expect(report.compared).toBe(1);
    expect(report.falsePositiveCount).toBe(1);
    expect(report.comparisons[0]?.humanEvidence).toContain("They changed topic before answering.");
    expect(raterConfidenceSummary(base).mean).toBeCloseTo(3.5);
    expect(scoreCalibration(base).find((bucket) => bucket.label === "60–85%")?.count).toBe(1);
  });

  it("exposes inter-rater agreement independently of system agreement", () => {
    const report = interRaterReliability(base);
    expect(report.items).toBe(1);
    expect(report.meanAbsScoreDisagreement).toBeCloseTo(0.6);
    expect(report.cohenKappa).toBeNull();
  });

  it("summarises real-world transfer outcomes", () => {
    const state: HumanEvidenceState = {
      ...emptyHumanEvidence(),
      studies: [{
        id: "study-1",
        title: "Ask one follow-up in a real conversation",
        skillId: "listening",
        targetMeasure: "follow-up used",
        baselinePracticeScore: 0.4,
        status: "active",
        plannedAt: "2026-08-01T00:00:00.000Z",
      }],
      outcomes: [{
        id: "outcome-1",
        studyId: "study-1",
        skillId: "listening",
        challengeTitle: "Ask one follow-up",
        outcome: "yes",
        completed: true,
        comfort: 3,
        followUpScore: 0.7,
        exactEvidence: ["I asked about the point they had just made."],
        occurredAt: "2026-08-05T00:00:00.000Z",
        createdAt: "2026-08-05T00:00:00.000Z",
      }],
      raters: [], items: [], ratings: [], disagreements: [], adjudications: [],
    };
    const report = transferReports(state)[0]!;
    expect(report.completionRate).toBe(1);
    expect(report.scoreGain).toBeCloseTo(0.3);
    expect(report.evidenceCount).toBe(1);
  });
});
