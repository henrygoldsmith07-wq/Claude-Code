// ---------------------------------------------------------------------------
// Persona goals.
//
// Characters already have a style, a memory and an engagement level. What they
// have not had is a *want*. That absence is why the harder scenarios in the
// library are thinner than their titles: "raising a problem with two people who
// disagree" describes a disagreement in the context paragraph and then runs a
// conversation in which nobody is defending anything. The user can say the
// perfect thing or nothing at all and the room ends up in the same place.
//
// A goal fixes that by giving a character three things:
//
//   • something they are trying to get out of this conversation;
//   • how hard they will push for it, which decides how often they steer back;
//   • what would actually move them — or nothing, if the position is fixed.
//
// That last part is the one worth arguing about. Every goal being winnable
// would teach a comfortable lie: say the magic words and people come round.
// Some goals here therefore have no `movedBy` at all, and the skill being
// trained in those scenarios is recognising it and handling it well, which is
// the more common real situation and the one no practice tool covers.
//
// Concessions are matched lexically, in this file, with no model involved. That
// is a deliberate limit rather than an approximation of something better: the
// user is told in the debrief exactly which words moved someone, and a match
// they can read and disagree with is worth more than a model's private opinion
// about whether they were sufficiently empathetic.
// ---------------------------------------------------------------------------

import type { CharacterGoal, CharacterGoalState, GoalCue, Id, SimulatedCharacter } from "./types";

/** Words too common to carry meaning in a cue match. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "to", "of", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "its", "that", "this", "you", "your",
  "i", "me", "my", "we", "our", "they", "them", "their", "do", "does", "did", "so", "as",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Whether a user turn expresses one phrasing of a cue.
 *
 * All of the phrasing's significant words must appear in the turn, in any
 * order. Substring matching would be too brittle — "the pressure around that
 * deadline" should count as "deadline pressure" — and a single shared word
 * would be far too loose, so requiring all of them is the middle that behaves.
 */
export function matchesPhrasing(turn: string, phrasing: string): boolean {
  const needed = significantWords(phrasing);
  if (needed.length === 0) return false;
  const present = new Set(significantWords(turn));
  return needed.every((word) => present.has(word));
}

/** Which cue this turn meets, if any. The first match wins; cues are distinct needs. */
export function cueMetBy(turn: string, cues: readonly GoalCue[]): GoalCue | null {
  for (const cue of cues) {
    if (cue.phrasings.some((phrasing) => matchesPhrasing(turn, phrasing))) return cue;
  }
  return null;
}

export function newGoalState(goal: CharacterGoal): CharacterGoalState {
  return {
    goalId: goal.id,
    cuesMet: [],
    satisfied: false,
    /** Set on the turn the character concedes, so it is announced exactly once. */
    justConceded: false,
    pushes: 0,
  };
}

/**
 * Advances a character's goal in response to one user turn.
 *
 * A goal with no `movedBy` never advances. It still accumulates nothing rather
 * than being treated as unreachable-and-therefore-met, because "they did not
 * budge" is the honest outcome of that conversation and the debrief says so.
 */
export function advanceGoal(
  state: CharacterGoalState,
  goal: CharacterGoal,
  userTurn: string,
): CharacterGoalState {
  // Already moved: nothing further to track. `justConceded` is deliberately not
  // cleared here — it is cleared when the character actually takes their
  // concession turn (`applyPlan` in the simulator). In a group the person who
  // was just satisfied may not be the next to speak, and clearing it on the
  // next user turn would swallow the one moment the user worked for.
  if (state.satisfied) return state;
  if (!goal.movedBy) return state;

  const cue = cueMetBy(userTurn, goal.movedBy.cues);
  if (!cue || state.cuesMet.includes(cue.id)) return state;

  const cuesMet = [...state.cuesMet, cue.id];
  const satisfied = cuesMet.length >= goal.movedBy.required;
  return { ...state, cuesMet, satisfied, justConceded: satisfied };
}

/** Records that the character spent a turn pushing their goal. */
export function countPush(state: CharacterGoalState): CharacterGoalState {
  return { ...state, pushes: state.pushes + 1 };
}

/**
 * How strongly a character wants to steer the conversation back to their goal
 * right now, 0-1.
 *
 * Rises with intensity and with how long they have gone without making their
 * point, and collapses to zero once they have been satisfied — someone who got
 * what they wanted stops lobbying for it, which is the observable difference
 * that makes conceding feel like progress rather than a hidden flag.
 */
export function goalPressure(goal: CharacterGoal | undefined, state: CharacterGoalState | undefined): number {
  if (!goal || !state || state.satisfied) return 0;
  const progress = goal.movedBy ? state.cuesMet.length / Math.max(1, goal.movedBy.required) : 0;
  // Partial progress lowers the pressure: being half-heard is calming.
  const unmet = 1 - progress * 0.6;
  // A character who has not yet made their point at all pushes harder.
  const impatience = state.pushes === 0 ? 1.25 : 1;
  return Math.min(1, goal.intensity * unmet * impatience);
}

export interface GoalConflict {
  a: Id;
  b: Id;
  /** Both goals, for the debrief and for composing what they say to each other. */
  goalA: CharacterGoal;
  goalB: CharacterGoal;
}

/**
 * Pairs of characters whose goals are opposed *and* both still live.
 *
 * "Live" is the important half. Once one of them has been satisfied the
 * argument is over, so the room stops re-staging it — otherwise a user who
 * successfully brokered a compromise would watch the same two people keep
 * fighting about it, which reads as the app not having noticed.
 */
export function liveConflicts(
  characters: readonly SimulatedCharacter[],
  stateOf: (characterId: Id) => CharacterGoalState | undefined,
): GoalConflict[] {
  const conflicts: GoalConflict[] = [];
  for (let i = 0; i < characters.length; i += 1) {
    for (let j = i + 1; j < characters.length; j += 1) {
      const first = characters[i]!;
      const second = characters[j]!;
      const goalA = first.goal;
      const goalB = second.goal;
      if (!goalA || !goalB) continue;
      const opposed =
        (goalA.conflictsWith ?? []).includes(goalB.id) || (goalB.conflictsWith ?? []).includes(goalA.id);
      if (!opposed) continue;
      if (stateOf(first.id)?.satisfied || stateOf(second.id)?.satisfied) continue;
      conflicts.push({ a: first.id, b: second.id, goalA, goalB });
    }
  }
  return conflicts;
}

/** Whether this character is currently arguing with someone else in the room. */
export function inLiveConflict(characterId: Id, conflicts: readonly GoalConflict[]): boolean {
  return conflicts.some((conflict) => conflict.a === characterId || conflict.b === characterId);
}

export interface GoalOutcome {
  characterId: Id;
  characterName: string;
  /** What they wanted, revealed in the debrief whether or not the user found it. */
  want: string;
  moved: boolean;
  /** Whether this goal could have been moved at all. */
  movable: boolean;
  /** Labels of the needs the user actually met, in the order they met them. */
  met: string[];
  /** Labels of the needs left unmet. Empty when the goal was immovable. */
  unmet: string[];
  /** What changed, when they moved. */
  concession?: string;
}

/**
 * What happened to each character's goal, for the debrief.
 *
 * Deliberately *not* a behaviour score. Whether someone concedes depends on how
 * the scenario was written — how many cues, how obscure — at least as much as on
 * how well the user handled it, so feeding it into the mastery model would put
 * scenario design into the user's skill estimate and quietly reward easy
 * scenarios. It is reported as evidence, with the wants shown in full, and the
 * behaviour scores stay computed from the transcript as before.
 */
export function goalOutcomes(
  characters: readonly SimulatedCharacter[],
  stateOf: (characterId: Id) => CharacterGoalState | undefined,
): GoalOutcome[] {
  const outcomes: GoalOutcome[] = [];
  for (const character of characters) {
    const goal = character.goal;
    if (!goal) continue;
    const state = stateOf(character.id);
    const movedBy = goal.movedBy;
    const metIds = state?.cuesMet ?? [];
    const met = (movedBy?.cues ?? []).filter((cue) => metIds.includes(cue.id)).map((cue) => cue.label);
    const unmet = (movedBy?.cues ?? []).filter((cue) => !metIds.includes(cue.id)).map((cue) => cue.label);
    const moved = Boolean(state?.satisfied);

    outcomes.push({
      characterId: character.id,
      characterName: character.name,
      want: goal.want,
      moved,
      movable: Boolean(movedBy),
      met,
      unmet: movedBy ? unmet : [],
      ...(moved && movedBy ? { concession: movedBy.concession } : {}),
    });
  }
  return outcomes;
}

/**
 * One plain sentence per goal for the debrief.
 *
 * An immovable goal says so explicitly. A user who spent twenty minutes failing
 * to shift someone deserves to be told the position was fixed rather than left
 * to conclude they handled it badly — and a tool that lets them believe the
 * latter is teaching the wrong lesson about difficult conversations.
 */
export function describeOutcome(outcome: GoalOutcome): string {
  if (!outcome.movable) {
    return `${outcome.characterName} wanted ${outcome.want}. That position was fixed — nothing you could have said in this conversation would have changed it, and handling it without a win was the point.`;
  }
  if (outcome.moved) {
    const because = outcome.met.length > 0 ? ` once you ${joinList(outcome.met)}` : "";
    return `${outcome.characterName} wanted ${outcome.want}, and moved${because}. ${outcome.concession ?? ""}`.trim();
  }
  if (outcome.met.length > 0) {
    return `${outcome.characterName} wanted ${outcome.want}. You ${joinList(outcome.met)}, which got you part of the way; ${joinList(outcome.unmet)} was still missing.`;
  }
  return `${outcome.characterName} wanted ${outcome.want}. It never came up — they were waiting to hear ${joinList(outcome.unmet)}.`;
}

function joinList(items: readonly string[]): string {
  if (items.length === 0) return "nothing";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
