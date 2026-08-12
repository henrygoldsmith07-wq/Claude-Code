import { confidenceGap, correctionIsFresh, effectiveMastery, stateFor } from "./mastery";
import { focusFatigue, scheduleFor, spacingScore, todayIso } from "./scheduling";
import { getSkill, requireSkill, unmetPrerequisites } from "./skills";
import type {
  Goal,
  Id,
  IsoDate,
  IsoInstant,
  Preference,
  Recommendation,
  RecommendationFactor,
  SessionStepKind,
  TrainingContext,
  UserSkillState,
} from "./types";

// ---------------------------------------------------------------------------
// The adaptive training engine.
//
// This is deliberately a transparent weighted model rather than a learned one.
// Three reasons: it must explain itself to the user in a sentence ("why this?"
// is a first-class UI affordance); it must behave sanely on day one with almost
// no data; and a black box that tells someone what to work on socially is a
// product I would not want to ship.
//
// The balance the brief asks for — weaknesses + goals + prerequisites + spaced
// practice + challenge + variety — is expressed as competing factors, several
// of which are deliberately negative. Fatigue and variety exist to stop the
// engine grinding a weakness into the ground, which is the classic failure of
// naive "always train your worst skill" designs.
// ---------------------------------------------------------------------------

export interface RecommendationInput {
  states: UserSkillState[];
  goals: Goal[];
  preference: Preference;
  /** Recent daily focuses, for variety and fatigue. */
  focusHistory: { skillId: Id; date: IsoDate }[];
  /** Recent evidence, newest first, used for "recent progress". */
  recentEvidence: { skillId: Id; performance: number; at: IsoInstant; kind: string }[];
  now: IsoInstant;
  /** Optional: restrict to a context the user says they are in today. */
  context?: TrainingContext;
}

const WEIGHTS: Record<RecommendationFactor, number> = {
  goalAlignment: 1.25,
  weakness: 0.9,
  prerequisite: 1.1,
  spacing: 0.85,
  confidenceGap: 0.55,
  variety: 0.4,
  challengeFit: 0.6,
  recentProgress: 0.45,
  contextRelevance: 0.5,
  fatigue: -1.0,
};

interface FactorValue {
  key: RecommendationFactor;
  value: number;
  note: string;
}

export function recommend(input: RecommendationInput, limit = 5): Recommendation[] {
  const { states, goals, preference, focusHistory, now } = input;
  const today = todayIso(new Date(now));
  const byId = new Map(states.map((state) => [state.skillId, state]));
  const masteryOf = (id: Id) => byId.get(id)?.mastery ?? 0;

  const goalSkills = new Set<Id>();
  for (const goal of goals) {
    if (goal.archivedAt) continue;
    for (const id of goal.skillIds) goalSkills.add(id);
  }

  // Prerequisite pressure: a skill blocking a goal skill inherits its urgency.
  const prerequisitePressure = new Map<Id, { weight: number; blocks: Id }>();
  for (const goalSkill of goalSkills) {
    for (const dep of unmetPrerequisites(goalSkill, masteryOf)) {
      const shortfall = Math.max(0, dep.minMastery - masteryOf(dep.requires)) / Math.max(dep.minMastery, 0.01);
      const existing = prerequisitePressure.get(dep.requires);
      if (!existing || existing.weight < shortfall) {
        prerequisitePressure.set(dep.requires, { weight: Math.min(1, shortfall), blocks: goalSkill });
      }
    }
  }

  const practisedDomains = new Set(
    focusHistory.filter((entry) => entry.date >= addDaysStr(today, -7)).map((entry) => getSkill(entry.skillId)?.domain),
  );

  const recommendations: Recommendation[] = states.map((state) => {
    const skill = requireSkill(state.skillId);
    const schedule = scheduleFor(state, now);
    const factors: FactorValue[] = [];

    // Goal alignment. The single strongest signal — people quit training that
    // has nothing to do with what they came for.
    const isGoal = goalSkills.has(skill.id);
    factors.push({
      key: "goalAlignment",
      value: isGoal ? 1 : 0.15,
      note: isGoal ? "One of your stated goals" : "Not directly tied to a current goal",
    });

    // Weakness, but bounded. Very low mastery on a very hard skill is not the
    // place to start; that is what the prerequisite factor is for.
    const eff = effectiveMastery(skill.id, masteryOf);
    const weakness = Math.min(1, (1 - eff) * (skill.baseDifficulty <= 3 ? 1 : 0.7));
    factors.push({
      key: "weakness",
      value: weakness,
      note: `Currently ${stateFor(state.mastery)}`,
    });

    // Prerequisite pressure.
    const pressure = prerequisitePressure.get(skill.id);
    factors.push({
      key: "prerequisite",
      value: pressure?.weight ?? 0,
      note: pressure ? `Underpins ${getSkill(pressure.blocks)?.name ?? pressure.blocks}` : "No blocked skills depend on this",
    });

    // Spaced practice.
    factors.push({
      key: "spacing",
      value: spacingScore(schedule),
      note: schedule.due
        ? `Not practised recently — retention around ${Math.round(schedule.retention * 100)}%`
        : "Recently practised",
    });

    // Confidence gap. Competent-but-uncomfortable is the most trainable state
    // there is: the behaviour exists, it just needs safe repetition.
    const gap = confidenceGap(state);
    factors.push({
      key: "confidenceGap",
      value: gap < -0.12 ? Math.min(1, -gap * 2.5) : 0,
      note: gap < -0.12 ? "You do this better than it feels" : "Confidence and skill are roughly in step",
    });

    // Variety across domains, so a week of training does not become a week of
    // one domain.
    const fresh = !practisedDomains.has(skill.domain);
    factors.push({
      key: "variety",
      value: fresh ? 1 : 0.2,
      note: fresh ? "A domain you have not touched this week" : "Same domain as recent sessions",
    });

    // Challenge fit: is the difficulty this skill demands close to what the
    // user is currently handling? Too far above and it is discouraging.
    const stretch = skill.baseDifficulty - state.difficultyTolerance;
    const challengeFit = stretch <= -2 ? 0.25 : stretch <= 1 ? 1 : stretch <= 2 ? 0.5 : 0.15;
    factors.push({
      key: "challengeFit",
      value: challengeFit,
      note: stretch > 2 ? "Currently a big step up" : "About the right level of stretch",
    });

    // Recent progress: reward momentum slightly, so improving skills get
    // consolidated rather than abandoned at 60%.
    const recent = input.recentEvidence.filter((e) => e.skillId === skill.id).slice(0, 3);
    const momentum = recent.length >= 2 ? avg(recent.map((e) => e.performance)) : 0;
    factors.push({
      key: "recentProgress",
      value: momentum > 0.6 ? 0.7 : momentum > 0 ? 0.3 : 0,
      note: momentum > 0.6 ? "Going well lately — worth consolidating" : "Little recent evidence",
    });

    // Contextual relevance to where the user actually spends time.
    const contexts = input.context ? [input.context] : preference.contexts;
    const relevant = contexts.some((c) => skill.contexts.includes(c));
    factors.push({
      key: "contextRelevance",
      value: relevant ? 1 : 0.2,
      note: relevant ? "Fits the settings you are in" : "Less relevant to your usual settings",
    });

    // Fatigue — negative weight.
    const fatigue = focusFatigue(focusHistory, skill.id, today);
    factors.push({
      key: "fatigue",
      value: fatigue,
      note: fatigue > 0 ? "Focused on this several times this week already" : "Not over-practised",
    });

    let score = factors.reduce((sum, factor) => sum + WEIGHTS[factor.key] * factor.value, 0);

    // A fresh user correction is respected: if they just told us they are fine
    // at this, stop putting it top of the list for a while.
    if (correctionIsFresh(state, now) && state.mastery > 0.6) score *= 0.5;

    return {
      skillId: skill.id,
      score,
      factors: factors.map((factor) => ({ ...factor, weight: WEIGHTS[factor.key] })),
      reason: explain(factors, skill.name),
      suggested: suggestStep(state, schedule.suggestedMode),
    };
  });

  return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
}

function suggestStep(state: UserSkillState, mode: "practise" | "apply" | "revisit"): SessionStepKind {
  if (state.attemptCount === 0) return "lesson";
  if (mode === "revisit") return "lesson";
  if (mode === "apply") return "challenge";
  return "simulation";
}

/**
 * One sentence, built from the two strongest positive factors and any active
 * brake. Users see this under every recommendation; it is the difference
 * between a training plan and an oracle.
 */
function explain(factors: FactorValue[], skillName: string): string {
  const ranked = [...factors]
    .filter((factor) => WEIGHTS[factor.key] > 0 && factor.value > 0.35)
    .sort((a, b) => WEIGHTS[b.key] * b.value - WEIGHTS[a.key] * a.value);
  const top = ranked.slice(0, 2).map((factor) => factor.note.toLowerCase());
  if (top.length === 0) return `${skillName} keeps your training varied.`;
  if (top.length === 1) return `${skillName}: ${top[0]}.`;
  return `${skillName}: ${top[0]}, and ${top[1]}.`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addDaysStr(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The one skill today is built around. Separated from `recommend` so the UI can
 * show the runners-up and let the user override — an engine that cannot be
 * overridden is a boss, not a coach.
 */
export function selectDailyFocus(input: RecommendationInput): Recommendation | null {
  const [top] = recommend(input, 3);
  return top ?? null;
}

/**
 * Difficulty to deliver next for a skill: sit just above what the user has
 * been handling, but never more than one step above, and step down after a bad
 * run. This is the knob that keeps practice uncomfortable but not defeating.
 */
export function nextDifficulty(state: UserSkillState, recentPerformance: number[]): 1 | 2 | 3 | 4 | 5 {
  const base = state.difficultyTolerance;
  const recent = recentPerformance.slice(0, 3);
  let target = base;
  if (recent.length >= 2) {
    const mean = avg(recent);
    if (mean >= 0.75) target = base + 1;
    else if (mean < 0.4) target = base - 1;
  }
  const clamped = Math.min(5, Math.max(1, Math.round(target)));
  return clamped as 1 | 2 | 3 | 4 | 5;
}

/**
 * Assistance decays as competence rises. Scaffolding that never comes off is
 * the mechanism by which training apps create dependence, so this is computed
 * from evidence rather than left to the user to remember to turn down.
 */
export function suggestedAssistLevel(state: UserSkillState): "full" | "partial" | "minimal" | "none" {
  if (state.attemptCount < 2 || state.mastery < 0.35) return "full";
  if (state.mastery < 0.55) return "partial";
  if (state.mastery < 0.75) return "minimal";
  return "none";
}
