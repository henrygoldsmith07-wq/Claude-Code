import { stateFor, stateIsConfident } from "./mastery";
import { daysBetween, todayIso } from "./scheduling";
import { DOMAIN_LABELS, getSkill } from "./skills";
import type { DomainEvent } from "./events";
import type { ChallengeAttempt, Id, IsoDate, SkillDomain, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Progress.
//
// There is no overall score. A single "social ability" number would be the most
// engaging thing in the product and the most dishonest: the underlying skills
// are not commensurable, the measurement error is large, and one number invites
// exactly the self-evaluation the product is trying to move people away from.
//
// So progress is reported as separate, checkable quantities — counts of things
// done, and per-skill movement with the evidence attached. Where a number is an
// estimate rather than a count, it is labelled as one.
// ---------------------------------------------------------------------------

export interface ActivityCounts {
  simulations: number;
  challengesAttempted: number;
  challengesCompleted: number;
  reflections: number;
  lessons: number;
  sessions: number;
  skillsPractised: number;
}

export function countActivity(events: DomainEvent[], since?: IsoDate): ActivityCounts {
  const inWindow = since ? events.filter((event) => event.at.slice(0, 10) >= since) : events;
  const skills = new Set<Id>();
  let simulations = 0;
  let challengesAttempted = 0;
  let challengesCompleted = 0;
  let lessons = 0;
  let sessions = 0;

  for (const event of inWindow) {
    switch (event.kind) {
      case "simulation-evaluated":
        simulations += 1;
        event.skillIds.forEach((id) => skills.add(id));
        break;
      case "challenge-attempted":
        challengesAttempted += 1;
        if (event.outcome !== "no") challengesCompleted += 1;
        skills.add(event.skillId);
        break;
      case "lesson-read":
        lessons += 1;
        skills.add(event.skillId);
        break;
      case "session-completed":
        sessions += 1;
        break;
      default:
        break;
    }
  }

  return {
    simulations,
    challengesAttempted,
    challengesCompleted,
    reflections: inWindow.filter((event) => event.kind === "challenge-attempted").length,
    lessons,
    sessions,
    skillsPractised: skills.size,
  };
}

export interface ConsistencyStats {
  /** Distinct days with any training in the window. */
  activeDays: number;
  windowDays: number;
  /** Consecutive days up to today. Never used to punish — see gamification.ts. */
  currentStreak: number;
  longestStreak: number;
  /** Most common day of week for training, or null when there is not enough data. */
  usualDay: string | null;
}

export function consistency(events: DomainEvent[], now: string, windowDays = 28): ConsistencyStats {
  const today = todayIso(new Date(now));
  const days = new Set(
    events
      .map((event) => event.at.slice(0, 10))
      .filter((date) => daysBetween(date, today) <= windowDays && daysBetween(date, today) >= 0),
  );
  const sorted = [...days].sort();

  let longest = 0;
  let running = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    running = previous && daysBetween(previous, date) === 1 ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = date;
  }

  let current = 0;
  for (let offset = 0; ; offset += 1) {
    const date = shiftDate(today, -offset);
    if (days.has(date)) current += 1;
    else if (offset > 0) break;
    else continue;
  }

  const weekdayCounts = new Map<string, number>();
  for (const date of sorted) {
    const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
    weekdayCounts.set(label, (weekdayCounts.get(label) ?? 0) + 1);
  }
  const usual = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    activeDays: days.size,
    windowDays,
    currentStreak: current,
    longestStreak: longest,
    usualDay: usual && usual[1] >= 3 ? usual[0] : null,
  };
}

function shiftDate(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SkillProgress {
  skillId: Id;
  name: string;
  domain: SkillDomain;
  mastery: number;
  masteryDelta: number;
  confidence: number;
  confidenceDelta: number;
  state: ReturnType<typeof stateFor>;
  /** False when the app is still guessing — the UI must say so. */
  confidentEstimate: boolean;
  attempts: number;
  lastPractisedAt?: string;
  retention: number;
}

/**
 * Per-skill movement over a window, by re-folding the log to the window start
 * and comparing. This is why the event log exists.
 */
export function skillProgress(
  current: UserSkillState[],
  atWindowStart: UserSkillState[],
  minAttempts = 1,
): SkillProgress[] {
  const before = new Map(atWindowStart.map((state) => [state.skillId, state]));
  return current
    .filter((state) => state.attemptCount >= minAttempts)
    .map((state) => {
      const skill = getSkill(state.skillId);
      const previous = before.get(state.skillId);
      return {
        skillId: state.skillId,
        name: skill?.name ?? state.skillId,
        domain: skill?.domain ?? "conversation",
        mastery: state.mastery,
        masteryDelta: state.mastery - (previous?.mastery ?? state.mastery),
        confidence: state.confidence,
        confidenceDelta: state.confidence - (previous?.confidence ?? state.confidence),
        state: stateFor(state.mastery),
        confidentEstimate: stateIsConfident(state),
        attempts: state.attemptCount,
        lastPractisedAt: state.lastPractisedAt,
        retention: state.retentionEstimate,
      };
    })
    .sort((a, b) => Math.abs(b.masteryDelta) - Math.abs(a.masteryDelta));
}

export interface DifficultyTrend {
  skillId: Id;
  name: string;
  earlierAverage: number;
  recentAverage: number;
  samples: number;
  /** The sentence the brief asks for, or null when there is not enough data. */
  statement: string | null;
}

/**
 * Difficulty progression from the user's own 1-5 ratings. This is the metric
 * that most directly answers "is this working?", because it is reported by the
 * person doing the thing rather than inferred by the app.
 */
export function difficultyTrends(attempts: ChallengeAttempt[], minSamples = 4): DifficultyTrend[] {
  const bySkill = new Map<Id, ChallengeAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.perceivedDifficulty === undefined) continue;
    const list = bySkill.get(attempt.challenge.skillId) ?? [];
    list.push(attempt);
    bySkill.set(attempt.challenge.skillId, list);
  }

  const trends: DifficultyTrend[] = [];
  for (const [skillId, list] of bySkill) {
    if (list.length < minSamples) continue;
    const ordered = [...list].sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
    const half = Math.floor(ordered.length / 2);
    const earlier = ordered.slice(0, half);
    const recent = ordered.slice(half);
    const earlierAverage = mean(earlier.map((item) => item.perceivedDifficulty ?? 0));
    const recentAverage = mean(recent.map((item) => item.perceivedDifficulty ?? 0));
    const skill = getSkill(skillId);
    const drop = earlierAverage - recentAverage;
    trends.push({
      skillId,
      name: skill?.name ?? skillId,
      earlierAverage,
      recentAverage,
      samples: ordered.length,
      statement:
        Math.abs(drop) >= 0.7
          ? `${skill?.name ?? skillId} challenges that averaged ${earlierAverage.toFixed(1)}/5 now average ${recentAverage.toFixed(1)}/5 (${ordered.length} attempts).`
          : null,
    });
  }
  return trends.sort((a, b) => b.earlierAverage - b.recentAverage - (a.earlierAverage - a.recentAverage));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export interface DomainSummary {
  domain: SkillDomain;
  label: string;
  practised: number;
  total: number;
  averageMastery: number;
  /** Whether enough evidence exists to say anything at all about this domain. */
  hasEvidence: boolean;
}

export function domainSummaries(states: UserSkillState[]): DomainSummary[] {
  const byDomain = new Map<SkillDomain, UserSkillState[]>();
  for (const state of states) {
    const skill = getSkill(state.skillId);
    if (!skill) continue;
    const list = byDomain.get(skill.domain) ?? [];
    list.push(state);
    byDomain.set(skill.domain, list);
  }
  return [...byDomain.entries()].map(([domain, list]) => {
    const practised = list.filter((state) => state.attemptCount > 0);
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      practised: practised.length,
      total: list.length,
      averageMastery: practised.length ? mean(practised.map((state) => state.mastery)) : 0,
      hasEvidence: practised.length > 0,
    };
  });
}

/** Real-world practice frequency — the number the product is ultimately judged on. */
export function realWorldFrequency(attempts: ChallengeAttempt[], now: string, windowDays = 28): {
  attempts: number;
  perWeek: number;
  completionRate: number;
} {
  const today = todayIso(new Date(now));
  const recent = attempts.filter((attempt) => daysBetween(attempt.assignedAt.slice(0, 10), today) <= windowDays);
  const finished = recent.filter((attempt) => attempt.completedAt);
  return {
    attempts: recent.length,
    perWeek: Number(((recent.length / windowDays) * 7).toFixed(1)),
    completionRate: recent.length ? finished.length / recent.length : 0,
  };
}
