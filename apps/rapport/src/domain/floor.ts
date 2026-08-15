import type { Id, Simulation, SimulationScenario, SimulatedCharacter } from "./types";
import { STYLE_PROFILES, type CharacterMemory } from "./simulator";
import { addressee, namesAddressed, type Participant } from "./addressing";
import { goalPressure, inLiveConflict, liveConflicts } from "./goals";

export { addressee, namesAddressed };
export type { Participant };

// ---------------------------------------------------------------------------
// Floor management: who speaks next, and whether the user is let in.
//
// The one-to-one simulator has an invariant that quietly does the user a
// favour — after every user turn, the character replies. The floor comes back
// automatically, so the only thing being trained is what to *say* when you
// already have it.
//
// In a group that invariant is false, and its absence is the entire skill.
// Three people talking will carry on without a fourth indefinitely; nobody is
// obliged to notice you have not spoken. Getting into a conversation is a
// separate competence from doing well once you are in it, and it cannot be
// trained by a simulator that hands over the floor on a timer.
//
// So this module can genuinely exclude the user. Characters bid for the turn,
// bids are won on style and engagement, and at higher difficulty they will hold
// several turns among themselves without addressing anybody. The user has to
// take the floor rather than wait for it.
//
// Two guards stop that becoming hostile rather than hard:
//
//   * Exclusion is bounded by difficulty. At difficulty 1 the floor always
//     returns; at 5 it can be held for four turns. A simulation nobody can
//     enter teaches helplessness, not assertiveness.
//   * Self-selection is scored as a success, not punished as an interruption.
//     The evaluator credits a user who breaks in — see `interruption.ts`.
//
// Deterministic given its rng. No I/O.
// ---------------------------------------------------------------------------

export interface FloorSnapshot {
  /** Who spoke last, or null at the start. */
  lastSpeaker: Participant | null;
  /** Character turns since the user last spoke. The exclusion counter. */
  consecutiveCharacterTurns: number;
  /** Turns since each participant last spoke; absent means they never have. */
  turnsSince: Record<string, number>;
  /** Share of all turns taken by the user, 0-1. */
  userTurnShare: number;
  /** Who the most recent turn addressed by name, when it addressed anyone. */
  addressedByLast: Participant | null;
  /** Characters who have not spoken at all. */
  silent: Id[];
}

/** Derive the floor state from a transcript. Nothing is stored. */
export function floorSnapshot(simulation: Simulation): FloorSnapshot {
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  const characters = simulation.scenario.characters;
  const lastIndexOf = new Map<Participant, number>();

  let consecutive = 0;
  let userTurns = 0;

  turns.forEach((turn, i) => {
    const who: Participant = turn.speaker === "user" ? "user" : (turn.characterId ?? "user");
    lastIndexOf.set(who, i);
    if (turn.speaker === "user") {
      userTurns += 1;
      consecutive = 0;
    } else {
      consecutive += 1;
    }
  });

  const turnsSince: Record<string, number> = {};
  for (const [who, index] of lastIndexOf) {
    turnsSince[who] = turns.length - 1 - index;
  }

  const last = turns[turns.length - 1];
  const lastSpeaker: Participant | null = last
    ? last.speaker === "user"
      ? "user"
      : (last.characterId ?? null)
    : null;

  return {
    lastSpeaker,
    consecutiveCharacterTurns: consecutive,
    turnsSince,
    userTurnShare: turns.length === 0 ? 0 : userTurns / turns.length,
    addressedByLast: last ? addressee(last.text, simulation.scenario, last.speaker === "user") : null,
    silent: characters.filter((c) => !lastIndexOf.has(c.id)).map((c) => c.id),
  };
}

// ---------------------------------------------------------------------------
// Bidding
// ---------------------------------------------------------------------------

export interface FloorBid {
  characterId: Id;
  /** Relative weight, not a probability — the winner is drawn proportionally. */
  weight: number;
  reasons: string[];
}

/**
 * How much each character wants the next turn.
 *
 * The weights encode the social physics the user has to read: talkative people
 * take more turns, engaged people take more turns, and somebody who has just
 * spoken twice is less likely to go again. A user who wants to hear from the
 * quiet one will have to bring them in by name, which is exactly the behaviour
 * `contribution`-style scoring rewards.
 */
export function bidsFor(
  scenario: SimulationScenario,
  memories: Map<Id, CharacterMemory>,
  snapshot: FloorSnapshot,
  difficulty: number,
): FloorBid[] {
  const hardness = (difficulty - 1) / 4;
  const conflicts = liveConflicts(scenario.characters, (id) => memories.get(id)?.goalState);

  return scenario.characters.map((character) => {
    const profile = STYLE_PROFILES[character.style];
    const memory = memories.get(character.id);
    const engagement = memory?.engagement ?? 0.5;
    const reasons: string[] = [];

    // Talkativeness is the base rate: a long typical reply means a person who
    // takes the floor often, not just one who holds it longer.
    let weight = 0.2 + (profile.replyLength / 40) * 0.6;
    reasons.push(`${character.style} style`);

    if (snapshot.addressedByLast === character.id) {
      weight += 2.5;
      reasons.push("was addressed by name");
    }

    weight *= 0.5 + engagement;
    if (engagement > 0.65) reasons.push("engaged");
    else if (engagement < 0.35) reasons.push("disengaged");

    if (snapshot.lastSpeaker === character.id) {
      weight *= 0.35;
      reasons.push("just spoke");
    }

    const since = snapshot.turnsSince[character.id];
    if (since === undefined) {
      // Never spoken. Nudged up so a group does not silently lose a member,
      // but not enough to guarantee it — a quiet person really can stay quiet.
      weight *= 1.25;
      reasons.push("has not spoken yet");
    } else if (since >= 4) {
      weight *= 1.2;
      reasons.push("quiet for several turns");
    }

    // Harder settings favour the dominant voices, which is what makes getting
    // a word in genuinely difficult rather than merely slower.
    weight *= 1 + hardness * (profile.replyLength > 24 ? 0.5 : -0.25);

    // Someone with an unmet agenda takes the floor more, and two people in a
    // live disagreement take it from each other.
    //
    // This is what turns "a discussion where two people disagree" from a
    // context paragraph into something happening in the room: the argument runs
    // whether or not the user joins, and the user's job is to get into it. The
    // effect is bounded because `maxConsecutiveCharacterTurns` still caps how
    // long the group can go without the user — an argument the user cannot
    // interrupt is a cutscene, not practice.
    const pressure = goalPressure(character.goal, memory?.goalState);
    if (pressure > 0) {
      weight *= 1 + pressure * 0.8;
      reasons.push("has a point to make");
      if (inLiveConflict(character.id, conflicts) && snapshot.lastSpeaker !== character.id) {
        const opponentJustSpoke = conflicts.some(
          (conflict) =>
            (conflict.a === character.id && conflict.b === snapshot.lastSpeaker) ||
            (conflict.b === character.id && conflict.a === snapshot.lastSpeaker),
        );
        if (opponentJustSpoke) {
          weight *= 2.2;
          reasons.push("answering back");
        }
      }
    }

    return { characterId: character.id, weight: Math.max(0.01, weight), reasons: reasons.slice(0, 3) };
  });
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export type NextSpeaker =
  | { speaker: "user"; invited: true; invitedBy: Id; reason: string }
  | { speaker: "user"; invited: false; reason: string }
  | { speaker: Id; invited: false; reason: string; bids: FloorBid[] };

/**
 * How long the group will run without addressing the user, by difficulty.
 *
 * At 1 the floor always comes straight back, which keeps the existing
 * one-to-one scenarios behaving as they always have. The ceiling of four is a
 * judgement: beyond that a user who has not yet learned to break in has no way
 * back into the conversation, and the session stops teaching anything.
 */
export function maxConsecutiveCharacterTurns(difficulty: number): number {
  if (difficulty < 1.75) return 1;
  if (difficulty < 3) return 2;
  if (difficulty < 4.25) return 3;
  return 4;
}

/**
 * Choose who speaks next.
 *
 * The order of checks is the social order: a direct question is answered, a
 * group that has run long enough turns back to the user, someone with high
 * reciprocity may hand over unprompted, and otherwise the floor is contested.
 */
export function nextSpeaker(
  scenario: SimulationScenario,
  memories: Map<Id, CharacterMemory>,
  snapshot: FloorSnapshot,
  difficulty: number,
  rng: () => number,
): NextSpeaker {
  const characters = scenario.characters;
  if (characters.length === 0) {
    return { speaker: "user", invited: false, reason: "No characters in this scenario." };
  }

  // The user was asked something directly.
  if (snapshot.addressedByLast === "user" && snapshot.lastSpeaker !== "user") {
    const asker =
      typeof snapshot.lastSpeaker === "string" && snapshot.lastSpeaker !== "user"
        ? snapshot.lastSpeaker
        : (characters[0]?.id ?? "");
    return { speaker: "user", invited: true, invitedBy: asker, reason: "You were asked directly." };
  }

  // Somebody was named. They answer — this is not a bid they can lose.
  //
  // Deliberately deterministic: bringing a quiet person in by name is the
  // headline skill of a group conversation, and it is only trainable if it
  // reliably works. A user who says "Sam, what do you think?" and gets Priya
  // has been taught that naming people does nothing.
  if (snapshot.addressedByLast !== null && snapshot.addressedByLast !== "user") {
    const named = characters.find((c) => c.id === snapshot.addressedByLast);
    if (named && named.id !== snapshot.lastSpeaker) {
      return { speaker: named.id, invited: false, reason: `${named.name} was asked directly.`, bids: [] };
    }
  }

  // The group has held the floor as long as this difficulty allows.
  if (snapshot.consecutiveCharacterTurns >= maxConsecutiveCharacterTurns(difficulty)) {
    return {
      speaker: "user",
      invited: false,
      reason: "The group has been talking among themselves — it is on you to come in.",
    };
  }

  // The user just spoke: someone picks it up.
  // Otherwise a character may hand over, based on how much they reciprocate.
  if (snapshot.lastSpeaker !== "user" && snapshot.lastSpeaker !== null) {
    const holder = characters.find((c) => c.id === snapshot.lastSpeaker);
    const engagement = memories.get(snapshot.lastSpeaker as Id)?.engagement ?? 0.5;
    const handOver = holder
      ? holder.reciprocity * (0.4 + engagement * 0.6) * (1 - ((difficulty - 1) / 4) * 0.7)
      : 0;
    if (rng() < handOver) {
      return { speaker: "user", invited: true, invitedBy: holder!.id, reason: `${holder!.name} brings you in.` };
    }
  }

  const bids = bidsFor(scenario, memories, snapshot, difficulty);
  const winner = drawWeighted(bids, rng);
  const chosen = characters.find((c) => c.id === winner.characterId)!;
  return {
    speaker: winner.characterId,
    invited: false,
    reason: `${chosen.name} takes the turn (${winner.reasons.join(", ")}).`,
    bids,
  };
}

function drawWeighted(bids: FloorBid[], rng: () => number): FloorBid {
  const total = bids.reduce((sum, bid) => sum + bid.weight, 0);
  let point = rng() * total;
  for (const bid of bids) {
    point -= bid.weight;
    if (point <= 0) return bid;
  }
  return bids[bids.length - 1] ?? { characterId: "", weight: 0, reasons: [] };
}

// ---------------------------------------------------------------------------
// Participation
// ---------------------------------------------------------------------------

export interface ParticipationSummary {
  /** Share of turns taken by the user. */
  userShare: number;
  /** Share of turns per character. */
  characterShares: { characterId: Id; name: string; share: number }[];
  /** Characters the user never addressed by name. */
  neverAddressed: { characterId: Id; name: string }[];
  /** How evenly the user spread attention across characters, 0-1. */
  attentionBalance: number;
  /** Longest run of character turns the user did not break into. */
  longestExclusion: number;
}

/**
 * Who actually got to speak, and who the user spoke to.
 *
 * `attentionBalance` is the number that makes "you only ever talked to one of
 * them" visible. It is computed over characters the user addressed by name,
 * because that is the only attention signal a transcript reliably carries —
 * looking at someone is not in the data, and pretending otherwise would invent
 * evidence.
 */
export function participation(simulation: Simulation): ParticipationSummary {
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  const characters = simulation.scenario.characters;
  const total = turns.length || 1;

  const counts = new Map<Id, number>();
  const addressedCounts = new Map<Id, number>();
  let userTurns = 0;
  let run = 0;
  let longestExclusion = 0;

  for (const turn of turns) {
    if (turn.speaker === "user") {
      userTurns += 1;
      longestExclusion = Math.max(longestExclusion, run);
      run = 0;
      for (const id of namesAddressed(turn.text, simulation.scenario)) {
        addressedCounts.set(id, (addressedCounts.get(id) ?? 0) + 1);
      }
    } else {
      run += 1;
      if (turn.characterId) counts.set(turn.characterId, (counts.get(turn.characterId) ?? 0) + 1);
    }
  }
  longestExclusion = Math.max(longestExclusion, run);

  const addressedTotal = [...addressedCounts.values()].reduce((a, b) => a + b, 0);
  const shares = characters.map((c) => (addressedCounts.get(c.id) ?? 0) / (addressedTotal || 1));
  // 1 when attention is spread evenly, 0 when it all went to one person.
  const attentionBalance =
    characters.length <= 1 || addressedTotal === 0
      ? 1
      : 1 - (Math.max(...shares) - 1 / characters.length) / (1 - 1 / characters.length);

  return {
    userShare: userTurns / total,
    characterShares: characters.map((c) => ({
      characterId: c.id,
      name: c.name,
      share: (counts.get(c.id) ?? 0) / total,
    })),
    neverAddressed: characters
      .filter((c) => !addressedCounts.has(c.id))
      .map((c) => ({ characterId: c.id, name: c.name })),
    attentionBalance: Math.max(0, Math.min(1, attentionBalance)),
    longestExclusion,
  };
}

/** True when this scenario trains group behaviour rather than one-to-one. */
export function isMultiParty(scenario: SimulationScenario): boolean {
  return scenario.characters.length > 1;
}

export function characterById(scenario: SimulationScenario, id: Id): SimulatedCharacter | undefined {
  return scenario.characters.find((c) => c.id === id);
}
