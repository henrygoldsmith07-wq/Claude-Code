import { recomputeStates } from "./events";
import type { DomainEvent } from "./events";
import { selectDailyFocus } from "./recommender";
import type { RecommendationInput } from "./recommender";
import { getSkill } from "./skills";
import { difficultyTrends, countActivity } from "./progress";
import { scheduleFor } from "./scheduling";
import type { ChallengeAttempt, Id, IsoDate, UserSkillState, WeeklyReview } from "./types";

// ---------------------------------------------------------------------------
// Weekly review.
//
// Generated from the event log rather than accumulated during the week, so it
// is reproducible and so a week can be regenerated after a scoring change.
//
// The section that matters is "strongest evidence": one claim, with the counts
// behind it, about something that actually got better. Everything else in a
// weekly summary is context for that sentence — and if the week produced no
// evidence, the review says so rather than manufacturing encouragement.
// ---------------------------------------------------------------------------

export function weekStartFor(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day; // Monday-based week.
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface WeeklyReviewInput {
  userId: Id;
  events: DomainEvent[];
  attempts: ChallengeAttempt[];
  weekStart: IsoDate;
  /** Everything the recommender needs to justify next week's focus. */
  recommendation: Omit<RecommendationInput, "states" | "now">;
  now: string;
}

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const weekEnd = addDays(input.weekStart, 7);
  const before = input.events.filter((event) => event.at.slice(0, 10) < input.weekStart);
  const during = input.events.filter(
    (event) => event.at.slice(0, 10) >= input.weekStart && event.at.slice(0, 10) < weekEnd,
  );

  const statesBefore = recomputeStates(input.userId, before, `${input.weekStart}T00:00:00.000Z`);
  const statesAfter = recomputeStates(input.userId, [...before, ...during], input.now);
  const beforeById = new Map(statesBefore.map((state) => [state.skillId, state]));

  const counts = countActivity(during);
  const practised = practisedSkills(during);

  const movements = statesAfter
    .map((state) => {
      const previous = beforeById.get(state.skillId);
      return {
        state,
        masteryDelta: state.mastery - (previous?.mastery ?? state.mastery),
        confidenceDelta: state.confidence - (previous?.confidence ?? state.confidence),
        attemptsThisWeek: practised.find((entry) => entry.skillId === state.skillId)?.count ?? 0,
      };
    })
    .filter((entry) => entry.attemptsThisWeek > 0);

  const strongest = strongestEvidence(movements, during, input.attempts, input.weekStart, weekEnd);

  const needsReinforcement = statesAfter
    .filter((state) => state.attemptCount > 0)
    .map((state) => ({ state, schedule: scheduleFor(state, input.now) }))
    .filter((entry) => entry.schedule.due && entry.state.mastery < 0.7)
    .sort((a, b) => b.schedule.priority - a.schedule.priority)
    .slice(0, 3)
    .map((entry) => ({
      skillId: entry.state.skillId,
      reason: `Not practised since ${entry.state.lastPractisedAt?.slice(0, 10) ?? "onboarding"}; estimated retention ${(entry.schedule.retention * 100).toFixed(0)}%.`,
    }));

  const trends = difficultyTrends(
    input.attempts.filter((attempt) => attempt.assignedAt.slice(0, 10) < weekEnd),
    3,
  );

  const focus = selectDailyFocus({ ...input.recommendation, states: statesAfter, now: input.now });
  const focusSkill = focus ? getSkill(focus.skillId) : null;

  return {
    id: `review.${input.userId}.${input.weekStart}`,
    userId: input.userId,
    weekStart: input.weekStart,
    trainingCompleted: {
      sessions: counts.sessions,
      simulations: counts.simulations,
      challenges: counts.challengesAttempted,
      reflections: counts.reflections,
    },
    skillsPractised: practised,
    strongestEvidence: strongest,
    needsReinforcement,
    difficultyProgression: trends
      .filter((trend) => Math.abs(trend.earlierAverage - trend.recentAverage) >= 0.5)
      .slice(0, 3)
      .map((trend) => ({
        skillId: trend.skillId,
        from: Number(trend.earlierAverage.toFixed(1)),
        to: Number(trend.recentAverage.toFixed(1)),
      })),
    confidenceChanges: movements
      .filter((entry) => Math.abs(entry.confidenceDelta) >= 0.05)
      .sort((a, b) => Math.abs(b.confidenceDelta) - Math.abs(a.confidenceDelta))
      .slice(0, 3)
      .map((entry) => ({ skillId: entry.state.skillId, delta: Number(entry.confidenceDelta.toFixed(3)) })),
    nextFocus: {
      skillId: focus?.skillId ?? statesAfter[0]?.skillId ?? "conv.follow-up",
      reason: focus
        ? `${focus.reason} ${explainFactors(focus.factors)}`
        : `Starting with ${focusSkill?.name ?? "a foundational skill"}.`,
    },
    createdAt: input.now,
  };
}

function practisedSkills(events: DomainEvent[]): { skillId: Id; count: number }[] {
  const counts = new Map<Id, number>();
  for (const event of events) {
    const ids: Id[] =
      event.kind === "simulation-evaluated"
        ? event.skillIds
        : event.kind === "challenge-attempted" || event.kind === "exercise-completed" || event.kind === "lesson-read"
          ? [event.skillId]
          : [];
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skillId, count]) => ({ skillId, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * The week's single strongest claim. Prefers real-world evidence over
 * simulation evidence, and returns null rather than reaching for something when
 * the week did not produce any.
 */
function strongestEvidence(
  movements: { state: UserSkillState; masteryDelta: number; attemptsThisWeek: number }[],
  events: DomainEvent[],
  attempts: ChallengeAttempt[],
  weekStart: IsoDate,
  weekEnd: IsoDate,
): WeeklyReview["strongestEvidence"] {
  const realWorld = attempts.filter(
    (attempt) =>
      attempt.completedAt &&
      attempt.completedAt.slice(0, 10) >= weekStart &&
      attempt.completedAt.slice(0, 10) < weekEnd,
  );

  const candidates = movements
    .filter((entry) => entry.masteryDelta > 0.02)
    .sort((a, b) => b.masteryDelta - a.masteryDelta);

  const best = candidates.find((entry) =>
    realWorld.some((attempt) => attempt.challenge.skillId === entry.state.skillId),
  ) ?? candidates[0];

  if (!best) return null;

  const skill = getSkill(best.state.skillId);
  const skillAttempts = realWorld.filter((attempt) => attempt.challenge.skillId === best.state.skillId);
  const sims = events.filter(
    (event) => event.kind === "simulation-evaluated" && event.skillIds.includes(best.state.skillId),
  ).length;

  const evidence: string[] = [];
  if (skillAttempts.length > 0) {
    const rated = skillAttempts.filter((attempt) => attempt.perceivedDifficulty !== undefined);
    evidence.push(
      `${skillAttempts.length} real-world attempt${skillAttempts.length === 1 ? "" : "s"} completed this week.`,
    );
    if (rated.length > 0) {
      const average = rated.reduce((sum, item) => sum + (item.perceivedDifficulty ?? 0), 0) / rated.length;
      evidence.push(`You rated them ${average.toFixed(1)}/5 for difficulty.`);
    }
  }
  if (sims > 0) evidence.push(`${sims} practice conversation${sims === 1 ? "" : "s"} on this skill.`);
  evidence.push(`Mastery estimate moved ${best.masteryDelta >= 0 ? "+" : ""}${best.masteryDelta.toFixed(2)}.`);

  return {
    skillId: best.state.skillId,
    statement:
      skillAttempts.length > 0
        ? `${skill?.name ?? best.state.skillId}: you did this in real conversations, not just in practice.`
        : `${skill?.name ?? best.state.skillId}: improving in practice — a real-world attempt would confirm it.`,
    evidence,
  };
}

function explainFactors(factors: { key: string; weight: number; value: number; note: string }[]): string {
  const top = factors
    .filter((factor) => factor.weight > 0)
    .sort((a, b) => b.weight * b.value - a.weight * a.value)
    .slice(0, 2)
    .map((factor) => factor.note.toLowerCase());
  return top.length ? `Chosen because: ${top.join("; ")}.` : "";
}

/** Is a review for the previous week due? Reviews are generated, never nagged about. */
export function reviewDue(reviews: WeeklyReview[], today: IsoDate): IsoDate | null {
  const lastWeek = weekStartFor(addDays(today, -7));
  if (reviews.some((review) => review.weekStart === lastWeek)) return null;
  return lastWeek;
}
