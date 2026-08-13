import { confidenceGap } from "./mastery";
import { daysBetween, scheduleFor } from "./scheduling";
import { getSkill } from "./skills";
import type { DomainEvent } from "./events";
import type { ChallengeAttempt, Id, Insight, IsoInstant, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// The insight engine.
//
// Every insight is a pattern with its evidence attached and a confidence that
// falls out of the sample size, not out of how interesting the sentence is.
//
// Two rules are enforced structurally rather than by careful writing:
//
//  * `possibleExplanation` is always hedged, and is a separate field from
//     `observation`, so the UI can render the two differently and the user can
//     always see which part is counted and which part is guessed.
//  * Nothing is emitted below a minimum sample. The most damaging thing an
//    analytics engine can do to someone working on social skills is tell them a
//    confident story about three data points.
// ---------------------------------------------------------------------------

const MIN_SAMPLES = 4;

export interface InsightInput {
  userId: Id;
  states: UserSkillState[];
  previousStates: UserSkillState[];
  attempts: ChallengeAttempt[];
  events: DomainEvent[];
  now: IsoInstant;
}

function confidenceFromSamples(samples: number, effect: number): number {
  // Grows with sample size and effect size, capped well below certainty —
  // nothing here is a controlled experiment.
  const sampleTerm = Math.min(1, samples / 12);
  const effectTerm = Math.min(1, Math.abs(effect) / 0.4);
  return Number((0.25 + 0.5 * sampleTerm * effectTerm).toFixed(2));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Group vs one-to-one difficulty — the comparison users most often ask about. */
function groupVsOneToOne(input: InsightInput): Insight | null {
  const rated = input.attempts.filter((attempt) => attempt.perceivedDifficulty !== undefined);
  const groupSkills = new Set(["group", "leadership"]);
  const group = rated.filter((attempt) => groupSkills.has(getSkill(attempt.challenge.skillId)?.domain ?? ""));
  const solo = rated.filter((attempt) => (getSkill(attempt.challenge.skillId)?.domain ?? "") === "conversation");
  if (group.length < MIN_SAMPLES || solo.length < MIN_SAMPLES) return null;

  const groupMean = mean(group.map((a) => a.perceivedDifficulty ?? 0));
  const soloMean = mean(solo.map((a) => a.perceivedDifficulty ?? 0));
  const gap = groupMean - soloMean;
  if (Math.abs(gap) < 0.6) return null;

  const harder = gap > 0 ? "group" : "one-to-one";
  return {
    id: `insight.group-vs-solo.${input.now.slice(0, 10)}`,
    userId: input.userId,
    observation: `${harder === "group" ? "Group" : "One-to-one"} challenges have been rated harder than the other kind.`,
    evidence: [
      `Group challenges: ${groupMean.toFixed(1)}/5 across ${group.length} attempts.`,
      `One-to-one challenges: ${soloMean.toFixed(1)}/5 across ${solo.length} attempts.`,
    ],
    confidence: confidenceFromSamples(group.length + solo.length, gap / 5),
    possibleExplanation:
      harder === "group"
        ? "One explanation is that group settings add timing pressure — finding the opening, not just knowing what to say. That is a different skill from the conversation itself."
        : "One explanation is that one-to-one conversations leave nowhere to hide: in a group the talking is shared out.",
    recommendedAction:
      harder === "group"
        ? "Worth a week weighted towards joining and contributing, at a difficulty one step below your usual."
        : "Worth a week weighted towards follow-up questions in one-to-one settings.",
    skillIds: [...new Set([...group, ...solo].map((a) => a.challenge.skillId))].slice(0, 4),
    kind: "interpretation",
    createdAt: input.now,
  };
}

/** Confidence moving faster than competence, or the reverse. */
function confidenceVsMastery(input: InsightInput): Insight[] {
  const previous = new Map(input.previousStates.map((state) => [state.skillId, state]));
  const insights: Insight[] = [];

  for (const state of input.states) {
    if (state.attemptCount < MIN_SAMPLES) continue;
    const before = previous.get(state.skillId);
    if (!before) continue;
    const masteryDelta = state.mastery - before.mastery;
    const confidenceDelta = state.confidence - before.confidence;
    const divergence = confidenceDelta - masteryDelta;
    if (Math.abs(divergence) < 0.12) continue;
    const skill = getSkill(state.skillId);
    if (!skill) continue;

    insights.push({
      id: `insight.conf-vs-mastery.${state.skillId}.${input.now.slice(0, 10)}`,
      userId: input.userId,
      observation:
        divergence > 0
          ? `Your comfort with ${skill.name.toLowerCase()} has risen faster than the measured behaviour.`
          : `Your measured ${skill.name.toLowerCase()} has improved faster than your comfort with it.`,
      evidence: [
        `Mastery estimate ${before.mastery.toFixed(2)} → ${state.mastery.toFixed(2)}.`,
        `Confidence estimate ${before.confidence.toFixed(2)} → ${state.confidence.toFixed(2)}.`,
        `${state.attemptCount} attempts recorded.`,
      ],
      confidence: confidenceFromSamples(state.attemptCount, divergence),
      possibleExplanation:
        divergence > 0
          ? "One explanation is that repetition has made the situation familiar before the specific behaviour has changed much — worth checking against a harder version."
          : "One explanation is that the behaviour is now reliable but has not yet been done often enough in real settings to feel routine. That gap usually closes with real-world attempts rather than more rehearsal.",
      recommendedAction:
        divergence > 0
          ? `Try ${skill.name.toLowerCase()} one difficulty step up and see whether it holds.`
          : `More real-world attempts at ${skill.name.toLowerCase()}, same difficulty — the evidence says you can do it.`,
      skillIds: [state.skillId],
      kind: "interpretation",
      createdAt: input.now,
    });
  }
  return insights.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
}

/** Simulation performance improving with repetition on the same skill. */
function simulationImprovement(input: InsightInput): Insight | null {
  const bySkill = new Map<Id, { at: string; performance: number }[]>();
  for (const event of input.events) {
    if (event.kind !== "simulation-evaluated") continue;
    for (const skillId of event.skillIds) {
      const list = bySkill.get(skillId) ?? [];
      list.push({ at: event.at, performance: event.performance });
      bySkill.set(skillId, list);
    }
  }

  for (const [skillId, list] of bySkill) {
    if (list.length < MIN_SAMPLES + 1) continue;
    const ordered = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const half = Math.floor(ordered.length / 2);
    const earlier = mean(ordered.slice(0, half).map((item) => item.performance));
    const later = mean(ordered.slice(half).map((item) => item.performance));
    const delta = later - earlier;
    if (delta < 0.1) continue;
    const skill = getSkill(skillId);
    if (!skill) continue;

    return {
      id: `insight.sim-improvement.${skillId}.${input.now.slice(0, 10)}`,
      userId: input.userId,
      observation: `Your ${skill.name.toLowerCase()} scores in practice conversations have risen with repetition.`,
      evidence: [
        `First half of ${ordered.length} simulations averaged ${(earlier * 100).toFixed(0)}%.`,
        `Second half averaged ${(later * 100).toFixed(0)}%.`,
      ],
      confidence: confidenceFromSamples(ordered.length, delta),
      possibleExplanation:
        "One explanation is genuine improvement. Another is familiarity with the scenario format — the way to tell them apart is a real-world attempt, which is why one is being suggested.",
      recommendedAction: `Take ${skill.name.toLowerCase()} into a real conversation this week and compare how it feels.`,
      skillIds: [skillId],
      kind: "interpretation",
      createdAt: input.now,
    };
  }
  return null;
}

/** A skill going stale. Stated as a count of days, not as a decline in ability. */
function decayWarnings(input: InsightInput): Insight[] {
  return input.states
    .filter((state) => state.attemptCount >= 2 && state.lastPractisedAt)
    .map((state) => ({ state, schedule: scheduleFor(state, input.now) }))
    .filter((entry) => entry.schedule.retention < 0.4 && entry.state.mastery > 0.5)
    .sort((a, b) => a.schedule.retention - b.schedule.retention)
    .slice(0, 2)
    .map(({ state, schedule }) => {
      const skill = getSkill(state.skillId);
      const days = Math.round(daysBetween(state.lastPractisedAt as string, input.now));
      return {
        id: `insight.decay.${state.skillId}.${input.now.slice(0, 10)}`,
        userId: input.userId,
        observation: `You have not practised ${skill?.name.toLowerCase() ?? state.skillId} for ${days} days.`,
        evidence: [
          `Last practised ${days} days ago.`,
          `${state.attemptCount} attempts on record; estimated retention ${(schedule.retention * 100).toFixed(0)}%.`,
        ],
        confidence: 0.55,
        possibleExplanation:
          "The retention figure is a model estimate, not a measurement — it assumes behaviours fade without use. It may well still be there.",
        recommendedAction: `One short real-world attempt would settle whether it needs re-practising.`,
        skillIds: [state.skillId],
        kind: "interpretation" as const,
        createdAt: input.now,
      };
    });
}

/** A plain count with no interpretation attached. Highest-trust insight kind. */
function practiceRhythm(input: InsightInput): Insight | null {
  const days = new Set(input.events.map((event) => event.at.slice(0, 10)));
  const recent = [...days].filter((date) => daysBetween(date, input.now) <= 28);
  if (recent.length < MIN_SAMPLES) return null;

  const weekdayCounts = new Map<number, number>();
  for (const date of recent) {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
  }
  const entries = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top || top[1] < 3) return null;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return {
    id: `insight.rhythm.${input.now.slice(0, 10)}`,
    userId: input.userId,
    observation: `Most of your training in the last four weeks happened on ${names[top[0]]}s (${top[1]} of ${recent.length} active days).`,
    evidence: [`${recent.length} active days in the last 28.`, `${top[1]} of them were ${names[top[0]]}s.`],
    confidence: 0.8,
    possibleExplanation: "This is a count of when you opened the app, nothing more.",
    recommendedAction: `Real-world challenges land better on days you are around people — worth checking that ${names[top[0]]} is one of those.`,
    skillIds: [],
    kind: "observation",
    createdAt: input.now,
  };
}

/**
 * Generate insights, best-supported first. Capped at four: an insights page
 * that scrolls stops being read, and the marginal insight is always the weakest.
 */
export function generateInsights(input: InsightInput, limit = 4): Insight[] {
  const candidates: Insight[] = [
    ...(groupVsOneToOne(input) ? [groupVsOneToOne(input) as Insight] : []),
    ...confidenceVsMastery(input),
    ...(simulationImprovement(input) ? [simulationImprovement(input) as Insight] : []),
    ...decayWarnings(input),
    ...(practiceRhythm(input) ? [practiceRhythm(input) as Insight] : []),
  ];

  return candidates
    .filter((insight) => insight.confidence >= 0.3)
    .sort((a, b) => {
      // Counted observations outrank interpretations at equal confidence.
      if (a.kind !== b.kind) return a.kind === "observation" ? -1 : 1;
      return b.confidence - a.confidence;
    })
    .slice(0, limit);
}

/** How the UI labels an insight's certainty. Deliberately blunt wording. */
export function confidenceLabel(insight: Insight): string {
  if (insight.kind === "observation") return "Counted from your activity";
  if (insight.confidence >= 0.6) return "Reasonably well supported";
  if (insight.confidence >= 0.45) return "Tentative — limited data";
  return "A guess from very little data";
}

/** Skills where confidence lags competence, for the "you can do this" nudge. */
export function underconfidentSkills(states: UserSkillState[], minAttempts = 3): UserSkillState[] {
  return states
    .filter((state) => state.attemptCount >= minAttempts && confidenceGap(state) < -0.15)
    .sort((a, b) => confidenceGap(a) - confidenceGap(b));
}
