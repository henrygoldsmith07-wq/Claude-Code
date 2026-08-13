import { stateFor } from "./mastery";
import { DOMAIN_LABELS, getSkill } from "./skills";
import type { DomainEvent } from "./events";
import type { Achievement, Id, IsoInstant, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Restrained gamification.
//
// Rules this module is built to enforce:
//
//  * Nothing is ever lost. There is no streak that breaks, no decay of points,
//    no "you've lost your progress". A missed day is a missed day.
//  * Milestones are tied to behaviour that indicates real transfer — real-world
//    attempts, skills used in more than one context — rather than to time spent
//    in the app. Nothing here rewards opening it.
//  * There is no leaderboard and no social comparison, because the product's
//    entire premise is that other people's reactions are not the measure.
//
// The streak below counts, but is described as a rhythm and is never used as a
// loss-framed prompt. `streakMessage` deliberately has no downside branch.
// ---------------------------------------------------------------------------

export interface MilestoneDefinition {
  key: string;
  label: string;
  description: string;
  /** Evaluated against the user's whole history. */
  test: (context: MilestoneContext) => boolean;
}

export interface MilestoneContext {
  states: UserSkillState[];
  events: DomainEvent[];
  realWorldAttempts: number;
  completedChallenges: number;
  simulations: number;
  distinctSkills: number;
  distinctDomains: number;
  activeDays: number;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    key: "first-real-world",
    label: "First real attempt",
    description: "You took something out of the app and into a real conversation.",
    test: (c) => c.completedChallenges >= 1,
  },
  {
    key: "five-real-world",
    label: "Five real attempts",
    description: "Five challenges completed outside the app.",
    test: (c) => c.completedChallenges >= 5,
  },
  {
    key: "twenty-real-world",
    label: "Twenty real attempts",
    description: "Twenty real-world attempts. This is where transfer usually starts showing up.",
    test: (c) => c.completedChallenges >= 20,
  },
  {
    key: "first-simulation",
    label: "First practice conversation",
    description: "You rehearsed a conversation before having it.",
    test: (c) => c.simulations >= 1,
  },
  {
    key: "three-domains",
    label: "Three domains",
    description: "You have practised across three different areas of communication.",
    test: (c) => c.distinctDomains >= 3,
  },
  {
    key: "first-strong",
    label: "First skill at strong",
    description: "One skill has enough evidence behind it to be called strong.",
    test: (c) => c.states.some((state) => state.attemptCount >= 4 && stateFor(state.mastery) === "strong"),
  },
  {
    key: "unassisted",
    label: "Practised without prompts",
    description: "You completed a practice conversation with assistance turned off.",
    test: (c) =>
      c.events.some(
        (event) => event.kind === "simulation-evaluated" && event.performance >= 0.6 && event.difficulty >= 4,
      ),
  },
  {
    key: "hard-challenge",
    label: "A difficult one, done",
    description: "You completed a level 5 challenge.",
    test: (c) =>
      c.events.some((event) => event.kind === "challenge-attempted" && event.difficulty >= 5 && event.outcome !== "no"),
  },
  {
    key: "month-of-practice",
    label: "A month of practice",
    description: "Training on twenty separate days.",
    test: (c) => c.activeDays >= 20,
  },
  {
    key: "own-experiment",
    label: "Ran an experiment",
    description: "You tested a change to your own communication and reviewed the result.",
    test: (c) => c.events.some((event) => event.kind === "session-completed") && c.realWorldAttempts >= 3,
  },
];

export function buildContext(states: UserSkillState[], events: DomainEvent[]): MilestoneContext {
  const challengeEvents = events.filter(
    (event): event is Extract<DomainEvent, { kind: "challenge-attempted" }> => event.kind === "challenge-attempted",
  );
  const skills = new Set<Id>();
  for (const event of events) {
    if (event.kind === "simulation-evaluated") event.skillIds.forEach((id) => skills.add(id));
    if (event.kind === "challenge-attempted" || event.kind === "exercise-completed") skills.add(event.skillId);
  }
  const domains = new Set(
    [...skills].map((id) => getSkill(id)?.domain).filter((domain): domain is NonNullable<typeof domain> => Boolean(domain)),
  );

  return {
    states,
    events,
    realWorldAttempts: challengeEvents.length,
    completedChallenges: challengeEvents.filter((event) => event.outcome !== "no").length,
    simulations: events.filter((event) => event.kind === "simulation-evaluated").length,
    distinctSkills: skills.size,
    distinctDomains: domains.size,
    activeDays: new Set(events.map((event) => event.at.slice(0, 10))).size,
  };
}

/** Milestones newly reached since the last check. Nothing is ever removed. */
export function newlyUnlocked(
  userId: Id,
  context: MilestoneContext,
  existing: Achievement[],
  now: IsoInstant,
): Achievement[] {
  const held = new Set(existing.map((item) => item.key));
  return MILESTONES.filter((milestone) => !held.has(milestone.key) && milestone.test(context)).map((milestone) => ({
    id: `ach.${userId}.${milestone.key}`,
    userId,
    key: milestone.key,
    label: milestone.label,
    description: milestone.description,
    unlockedAt: now,
  }));
}

/**
 * Skill-tree completion per domain. Presented as coverage — how much of the
 * area has been touched — rather than as a percentage of "social ability".
 */
export function domainCoverage(states: UserSkillState[]): { domain: string; label: string; practised: number; total: number }[] {
  const counts = new Map<string, { practised: number; total: number }>();
  for (const state of states) {
    const skill = getSkill(state.skillId);
    if (!skill) continue;
    const entry = counts.get(skill.domain) ?? { practised: 0, total: 0 };
    entry.total += 1;
    if (state.attemptCount > 0) entry.practised += 1;
    counts.set(skill.domain, entry);
  }
  return [...counts.entries()].map(([domain, entry]) => ({
    domain,
    label: DOMAIN_LABELS[domain as keyof typeof DOMAIN_LABELS] ?? domain,
    ...entry,
  }));
}

/**
 * Streak copy. Every branch is neutral or positive: there is deliberately no
 * "you broke your streak" path, because loss framing is the mechanic this
 * product refuses to use.
 */
export function streakMessage(currentStreak: number, activeDaysInWindow: number): string {
  if (currentStreak >= 7) return `${currentStreak} days in a row. Worth easing off if it starts feeling like an obligation.`;
  if (currentStreak >= 3) return `${currentStreak} days running.`;
  if (currentStreak >= 1) return "Trained today.";
  if (activeDaysInWindow >= 8) return `${activeDaysInWindow} days of practice this month.`;
  if (activeDaysInWindow > 0) return `${activeDaysInWindow} day${activeDaysInWindow === 1 ? "" : "s"} of practice this month.`;
  return "Nothing logged yet — a five-minute session is a fine start.";
}

/** Skill level for display: the band plus the evidence count behind it. */
export function skillLevelLabel(state: UserSkillState): string {
  if (state.attemptCount === 0) return "Not started";
  const band = stateFor(state.mastery);
  return `${band.charAt(0).toUpperCase()}${band.slice(1)} · ${state.attemptCount} session${state.attemptCount === 1 ? "" : "s"}`;
}
