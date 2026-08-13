import { retentionHalfLifeDays } from "./mastery";
import { dependentsOf, requireSkill } from "./skills";
import type { Id, IsoDate, IsoInstant, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Spaced practice for behaviours.
//
// A flashcard scheduler assumes recall is the thing being trained and that a
// review is cheap and identical every time. Neither holds here: a social skill
// is a performance, its "review" costs real effort in the real world, and the
// evidence arrives noisy and late.
//
// So the schedule is derived rather than stored. A skill's priority is the
// product of how far retention has fallen, how much the user's goals need it,
// and how many other skills depend on it — with a hard rule that behavioural
// practice beats re-reading, and a cap on how often the same skill can be the
// day's focus. Reading the same lesson again is the failure mode this design
// exists to prevent.
// ---------------------------------------------------------------------------

export function todayIso(now: Date = new Date()): IsoDate {
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString();
  return iso.slice(0, 10);
}

export function daysBetween(from: IsoInstant | IsoDate, to: IsoInstant | IsoDate): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms / 86_400_000;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Retention below this is where a reminder is genuinely useful rather than nagging. */
export const REVIEW_THRESHOLD = 0.6;

export interface SchedulingInfo {
  skillId: Id;
  /** 0-1 current estimated retention. */
  retention: number;
  /** When retention is projected to cross the review threshold. */
  dueOn: IsoDate;
  /** True once due. */
  due: boolean;
  /** 0-1 urgency, combining lapse, dependency load and staleness. */
  priority: number;
  /** What kind of practice would help most. Reading is a last resort, not a default. */
  suggestedMode: "practise" | "apply" | "revisit";
}

/**
 * Project when a skill will need reinforcement. Never-practised skills are not
 * "due" — they are new, and the recommender treats those differently.
 */
export function scheduleFor(state: UserSkillState, now: IsoInstant): SchedulingInfo {
  const skill = requireSkill(state.skillId);
  const halfLife = retentionHalfLifeDays(state);

  if (!state.lastPractisedAt) {
    return {
      skillId: state.skillId,
      retention: 0,
      dueOn: todayIso(new Date(now)),
      due: false,
      priority: 0.35,
      suggestedMode: "practise",
    };
  }

  const elapsed = Math.max(0, daysBetween(state.lastPractisedAt, now));
  const retention = Math.pow(0.5, elapsed / halfLife);
  // Solve 0.5^(d/halfLife) = REVIEW_THRESHOLD for d.
  const daysToThreshold = (Math.log(REVIEW_THRESHOLD) / Math.log(0.5)) * halfLife;
  const dueOn = addDays(todayIso(new Date(state.lastPractisedAt)), Math.round(daysToThreshold));
  const due = retention < REVIEW_THRESHOLD;

  // Skills other skills depend on are worth keeping fresh: letting a
  // prerequisite lapse quietly degrades everything above it.
  const dependencyLoad = Math.min(1, dependentsOf(state.skillId).length / 4);
  const lapse = Math.min(1, Math.max(0, (REVIEW_THRESHOLD - retention) / REVIEW_THRESHOLD));
  const staleness = Math.min(1, elapsed / (halfLife * 3));
  const priority = clamp01(0.55 * lapse + 0.25 * dependencyLoad + 0.2 * staleness);

  // Mode: strong-but-stale skills need using, not re-teaching. Weak skills with
  // real attempts behind them need rehearsal. Only genuinely cold skills with
  // almost no evidence get sent back to the lesson.
  let suggestedMode: SchedulingInfo["suggestedMode"] = "practise";
  if (state.mastery >= 0.6) suggestedMode = "apply";
  else if (state.attemptCount === 0 && skill.baseDifficulty >= 3) suggestedMode = "revisit";

  return { skillId: state.skillId, retention, dueOn, due, priority, suggestedMode };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Due skills, most urgent first. */
export function dueSkills(states: UserSkillState[], now: IsoInstant): SchedulingInfo[] {
  return states
    .map((state) => scheduleFor(state, now))
    .filter((info) => info.due)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * How recently a skill has been the daily focus. The recommender uses this to
 * enforce variety: hammering one weakness day after day is how people quit.
 */
export function focusFatigue(focusHistory: { skillId: Id; date: IsoDate }[], skillId: Id, today: IsoDate): number {
  const recent = focusHistory.filter((entry) => daysBetween(entry.date, today) <= 7);
  if (recent.length === 0) return 0;
  const hits = recent.filter((entry) => entry.skillId === skillId).length;
  // Two focuses in a week is fine; four is fatigue.
  return clamp01((hits - 1) / 3);
}

/**
 * Spacing bonus for a skill: highest just after retention crosses the
 * threshold, and — crucially — not increasing without limit. A skill left for a
 * year is not four times more urgent than one left for three months; it is just
 * effectively new, and gets re-taught rather than "reviewed".
 */
export function spacingScore(info: SchedulingInfo): number {
  if (!info.due) return Math.max(0, 0.3 - info.retention * 0.3);
  const overdue = Math.min(1, (REVIEW_THRESHOLD - info.retention) / REVIEW_THRESHOLD);
  return 0.5 + 0.5 * overdue;
}
