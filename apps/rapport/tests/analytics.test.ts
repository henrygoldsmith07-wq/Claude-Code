import { describe, expect, it } from "vitest";
import { confidenceLabel, generateInsights, underconfidentSkills } from "@/domain/analytics";
import { analyse, createExperiment, EXPERIMENT_TEMPLATES, progressOf } from "@/domain/experiments";
import { consistency, countActivity, difficultyTrends, realWorldFrequency, skillProgress } from "@/domain/progress";
import { buildContext, newlyUnlocked, streakMessage, domainCoverage } from "@/domain/gamification";
import { analyseTurn, feedbackFor, withTurnShare, wordsFromTranscript } from "@/domain/voice";
import { initialSkillState } from "@/domain/mastery";
import { SKILLS } from "@/domain/skills";
import type { DomainEvent } from "@/domain/events";
import type { Challenge, ChallengeAttempt, ExperimentObservation } from "@/domain/types";

const NOW = "2026-03-20T09:00:00.000Z";
const at = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
const states = SKILLS.map((skill) => initialSkillState("u", skill.id, NOW));

function challenge(skillId: string, difficulty: 1 | 2 | 3 | 4 | 5): Challenge {
  return {
    id: `ch.${skillId}.${difficulty}`,
    skillId,
    difficulty,
    objective: "Do the thing.",
    context: "Anywhere.",
    completionCriteria: ["You did it"],
    reflectionPrompt: "How was it?",
    contexts: ["work"],
  };
}

function attempt(skillId: string, daysAgo: number, perceived: number): ChallengeAttempt {
  return {
    id: `a.${skillId}.${daysAgo}`,
    userId: "u",
    challengeId: `ch.${skillId}`,
    challenge: challenge(skillId, 3),
    assignedAt: at(daysAgo),
    completedAt: at(daysAgo),
    outcome: "yes",
    perceivedDifficulty: perceived,
  };
}

describe("insight engine", () => {
  it("emits nothing from a handful of data points", () => {
    const insights = generateInsights({
      userId: "u",
      states,
      previousStates: states,
      attempts: [attempt("conv.follow-up", 3, 4)],
      events: [],
      now: NOW,
    });
    expect(insights.length).toBe(0);
  });

  it("compares group and one-to-one difficulty once there is enough of each", () => {
    const attempts = [
      ...[5, 5, 4, 5].map((value, index) => attempt("grp.joining", index + 2, value)),
      ...[2, 2, 3, 2].map((value, index) => attempt("conv.follow-up", index + 8, value)),
    ];
    const insights = generateInsights({ userId: "u", states, previousStates: states, attempts, events: [], now: NOW });
    const found = insights.find((item) => item.id.includes("group-vs-solo"));
    expect(found).toBeDefined();
    expect(found!.evidence.length).toBe(2);
    expect(found!.possibleExplanation).toMatch(/one explanation/i);
    expect(found!.kind).toBe("interpretation");
  });

  it("hedges every interpretation and never claims causation", () => {
    const attempts = [
      ...[5, 5, 4, 5].map((value, index) => attempt("grp.joining", index + 2, value)),
      ...[2, 2, 3, 2].map((value, index) => attempt("conv.follow-up", index + 8, value)),
    ];
    const insights = generateInsights({ userId: "u", states, previousStates: states, attempts, events: [], now: NOW });
    for (const insight of insights) {
      if (insight.kind !== "interpretation") continue;
      expect(insight.possibleExplanation, insight.id).toMatch(/one explanation|may|might|could|possibly|estimate/i);
      expect(insight.possibleExplanation, insight.id).not.toMatch(/\bbecause you are\b|\bthis proves\b|\bcaused by your\b/i);
    }
  });

  it("scales confidence with sample size", () => {
    const small = [
      ...[5, 5, 4, 5].map((value, index) => attempt("grp.joining", index + 2, value)),
      ...[2, 2, 3, 2].map((value, index) => attempt("conv.follow-up", index + 8, value)),
    ];
    const large = [
      ...small,
      ...[5, 5, 5, 4, 5, 5].map((value, index) => attempt("grp.include", index + 12, value)),
      ...[2, 2, 2, 3, 2, 2].map((value, index) => attempt("conv.start", index + 18, value)),
    ];
    const findConfidence = (attempts: ChallengeAttempt[]) =>
      generateInsights({ userId: "u", states, previousStates: states, attempts, events: [], now: NOW })
        .find((item) => item.id.includes("group-vs-solo"))?.confidence ?? 0;
    expect(findConfidence(large)).toBeGreaterThan(findConfidence(small));
  });

  it("never reports certainty", () => {
    const attempts = [
      ...Array.from({ length: 20 }, (_, index) => attempt("grp.joining", index + 1, 5)),
      ...Array.from({ length: 20 }, (_, index) => attempt("conv.follow-up", index + 25, 1)),
    ];
    for (const insight of generateInsights({ userId: "u", states, previousStates: states, attempts, events: [], now: NOW })) {
      expect(insight.confidence).toBeLessThan(0.9);
    }
  });

  it("labels observations differently from interpretations", () => {
    expect(confidenceLabel({ kind: "observation", confidence: 0.8 } as never)).toMatch(/counted/i);
    expect(confidenceLabel({ kind: "interpretation", confidence: 0.35 } as never)).toMatch(/guess/i);
  });

  it("finds skills where confidence lags competence", () => {
    const gapped = states.map((state) =>
      state.skillId === "asrt.no" ? { ...state, attemptCount: 5, mastery: 0.75, confidence: 0.4 } : state,
    );
    expect(underconfidentSkills(gapped).map((state) => state.skillId)).toContain("asrt.no");
  });
});

describe("progress metrics", () => {
  const events: DomainEvent[] = [
    { kind: "lesson-read", at: at(5), lessonId: "l1", skillId: "conv.follow-up" },
    {
      kind: "simulation-evaluated",
      at: at(4),
      simulationId: "s1",
      skillIds: ["conv.follow-up"],
      performance: 0.6,
      difficulty: 3,
      reliability: 0.8,
      behaviours: [],
    },
    {
      kind: "challenge-attempted",
      at: at(3),
      attemptId: "a1",
      skillId: "conv.follow-up",
      outcome: "yes",
      difficulty: 3,
      performance: 0.8,
      reliability: 0.9,
    },
    { kind: "session-completed", at: at(3), sessionId: "sess1", focusSkillId: "conv.follow-up" },
  ];

  it("counts activity by kind", () => {
    const counts = countActivity(events);
    expect(counts.simulations).toBe(1);
    expect(counts.challengesAttempted).toBe(1);
    expect(counts.challengesCompleted).toBe(1);
    expect(counts.skillsPractised).toBe(1);
  });

  it("computes consistency without penalising gaps", () => {
    const stats = consistency(events, NOW);
    expect(stats.activeDays).toBe(3);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it("reports real-world frequency per week", () => {
    const frequency = realWorldFrequency([attempt("conv.follow-up", 3, 3), attempt("conv.start", 10, 2)], NOW);
    expect(frequency.attempts).toBe(2);
    expect(frequency.completionRate).toBe(1);
  });

  it("states difficulty trends in the user's own ratings", () => {
    const attempts = [
      attempt("conf.groups", 24, 5),
      attempt("conf.groups", 20, 5),
      attempt("conf.groups", 8, 3),
      attempt("conf.groups", 4, 3),
    ];
    const [trend] = difficultyTrends(attempts);
    expect(trend?.statement).toMatch(/5\.0\/5 now average 3\.0\/5/);
    expect(trend?.samples).toBe(4);
  });

  it("says nothing about difficulty until there is enough data", () => {
    expect(difficultyTrends([attempt("conf.groups", 3, 4)])).toEqual([]);
  });

  it("reports per-skill movement with an uncertainty flag", () => {
    const current = states.map((state) =>
      state.skillId === "conv.follow-up" ? { ...state, mastery: 0.6, attemptCount: 4 } : state,
    );
    const [top] = skillProgress(current, states);
    expect(top?.skillId).toBe("conv.follow-up");
    expect(top?.masteryDelta).toBeGreaterThan(0);
    expect(typeof top?.confidentEstimate).toBe("boolean");
  });
});

describe("gamification", () => {
  it("unlocks milestones from real-world evidence, not screen time", () => {
    const events: DomainEvent[] = [
      {
        kind: "challenge-attempted",
        at: at(1),
        attemptId: "a1",
        skillId: "conv.start",
        outcome: "yes",
        difficulty: 2,
        performance: 0.8,
        reliability: 0.9,
      },
    ];
    const unlocked = newlyUnlocked("u", buildContext(states, events), [], NOW);
    expect(unlocked.map((item) => item.key)).toContain("first-real-world");
  });

  it("never awards anything for merely opening the app", () => {
    const unlocked = newlyUnlocked("u", buildContext(states, []), [], NOW);
    expect(unlocked).toEqual([]);
  });

  it("does not re-award a held milestone", () => {
    const events: DomainEvent[] = [
      {
        kind: "challenge-attempted",
        at: at(1),
        attemptId: "a1",
        skillId: "conv.start",
        outcome: "yes",
        difficulty: 2,
        performance: 0.8,
        reliability: 0.9,
      },
    ];
    const context = buildContext(states, events);
    const first = newlyUnlocked("u", context, [], NOW);
    expect(newlyUnlocked("u", context, first, NOW)).toEqual([]);
  });

  it("has no loss framing in any streak message", () => {
    const messages = [streakMessage(0, 0), streakMessage(0, 5), streakMessage(1, 1), streakMessage(4, 6), streakMessage(9, 20)];
    for (const message of messages) {
      expect(message).not.toMatch(/lost|broken|missed|don't break|failed|streak ended/i);
    }
  });

  it("reports domain coverage rather than a completion score", () => {
    const coverage = domainCoverage(states);
    expect(coverage.length).toBe(10);
    for (const item of coverage) expect(item.total).toBeGreaterThan(0);
  });
});

describe("experiments", () => {
  const experiment = createExperiment("u", EXPERIMENT_TEMPLATES[0]!, NOW);
  const observation = (applied: boolean, value: number, index: number): ExperimentObservation => ({
    id: `o${index}`,
    experimentId: experiment.id,
    applied,
    value,
    createdAt: at(index),
  });

  it("refuses to conclude anything from too few occasions", () => {
    const result = analyse(experiment, [observation(true, 4, 1), observation(false, 3, 2)]);
    expect(result.sufficient).toBe(false);
    expect(result.summary).toMatch(/not enough/i);
    expect(result.caveat).toMatch(/nothing can be read/i);
  });

  it("reports a difference with both group sizes and a causation caveat", () => {
    const observations = [
      ...[4, 5, 4, 5].map((value, index) => observation(true, value, index)),
      ...[2, 3, 2].map((value, index) => observation(false, value, index + 10)),
    ];
    const result = analyse(experiment, observations);
    expect(result.sufficient).toBe(true);
    expect(result.applied.count).toBe(4);
    expect(result.notApplied.count).toBe(3);
    expect(result.summary).toMatch(/4 occasions/);
    expect(result.caveat).toMatch(/not that the change caused/i);
  });

  it("reports an unfavourable result honestly", () => {
    const observations = [
      ...[2, 2, 1].map((value, index) => observation(true, value, index)),
      ...[4, 5, 4].map((value, index) => observation(false, value, index + 10)),
    ];
    const result = analyse(experiment, observations);
    expect(result.recommendation).toMatch(/other way|real result/i);
  });

  it("tracks readiness for comparison", () => {
    const status = progressOf(experiment, [observation(true, 4, 1), observation(true, 3, 2)]);
    expect(status.ready).toBe(false);
  });
});

describe("voice metrics", () => {
  const words = (list: string[], msPerWord = 400) =>
    list.map((word, index) => ({ word, startMs: index * msPerWord, endMs: index * msPerWord + msPerWord - 50 }));

  it("measures pace, fillers and pauses only", () => {
    const metrics = analyseTurn(words(["so", "um", "I", "went", "to", "the", "thing", "yesterday"]));
    expect(metrics.wordCount).toBe(8);
    expect(metrics.wordsPerMinute).toBeGreaterThan(0);
    expect(metrics.fillerCount).toBeGreaterThanOrEqual(1);
    expect(Object.keys(metrics)).toEqual([
      "durationMs",
      "wordCount",
      "wordsPerMinute",
      "fillerCount",
      "fillerWords",
      "longPauseCount",
      "longestPauseMs",
    ]);
  });

  it("detects long pauses", () => {
    const spoken = [
      { word: "right", startMs: 0, endMs: 400 },
      { word: "so", startMs: 2600, endMs: 2900 },
    ];
    expect(analyseTurn(spoken).longPauseCount).toBe(1);
  });

  it("gives one actionable suggestion rather than a score", () => {
    const fast = analyseTurn(words(Array.from({ length: 40 }, () => "word"), 200));
    const feedback = feedbackFor([fast]);
    expect(feedback.observations.length).toBeGreaterThan(1);
    expect(feedback.suggestion).toBeTruthy();
    expect(feedback.suggestion).not.toMatch(/\b\d+\s*\/\s*10\b|score of/i);
  });

  it("says nothing when there is too little speech", () => {
    expect(feedbackFor([analyseTurn(words(["hi"]))]).suggestion).toBeNull();
  });

  it("computes turn share across the exchange", () => {
    const metrics = withTurnShare([analyseTurn(words(["one", "two", "three", "four"]))], 4);
    expect(metrics[0]?.turnShare).toBeCloseTo(0.5, 2);
  });

  it("synthesises timings when the browser gives none", () => {
    const synthesised = wordsFromTranscript("this is a test", 4000);
    expect(synthesised.length).toBe(4);
    expect(synthesised[3]?.endMs).toBe(4000);
  });
});
