import type {
  CommunicationStyle,
  Id,
  SimulatedCharacter,
  Simulation,
  SimulationScenario,
  SimulationTurn,
} from "./types";
import { namesAddressed } from "./addressing";

// ---------------------------------------------------------------------------
// The character engine.
//
// A simulator that always meets the user halfway teaches nothing: the skill
// being trained is carrying a conversation with someone who is not helping. So
// characters have an `openness` (how much they volunteer) and a `reciprocity`
// (how often they ask back), and a quiet, distracted character genuinely will
// leave the user with almost nothing to work with.
//
// Two hard rules:
//
//  * Styles are communication behaviours, never demographics. "Quiet" describes
//    turn length and volunteering, and nothing else. There is no mechanism here
//    by which a character's identity can drive their behaviour, because
//    identity is not modelled at all.
//  * Characters are consistent. Facts they have stated are tracked and reused;
//    a character who mentioned a sister does not later have no siblings. This
//    is what makes "remembering details" a trainable skill rather than a
//    lottery.
//
// This module is the deterministic engine: it drives the fallback simulation
// when no model is configured, and when one is, it still owns character state,
// difficulty drift and the decision about when to end. The model writes the
// words; the engine decides what kind of turn it is.
// ---------------------------------------------------------------------------

export interface StyleProfile {
  style: CommunicationStyle;
  /** Words in a typical reply. */
  replyLength: number;
  /** 0-1 chance of volunteering a new detail unprompted. */
  volunteering: number;
  /** 0-1 chance of asking the user a question back. */
  asksBack: number;
  /** 0-1 chance of interrupting or changing topic abruptly. */
  disruption: number;
  /** How the style is described to the user before they start. */
  description: string;
}

export const STYLE_PROFILES: Record<CommunicationStyle, StyleProfile> = {
  talkative: {
    style: "talkative",
    replyLength: 45,
    volunteering: 0.9,
    asksBack: 0.25,
    disruption: 0.35,
    description: "Talks a lot and changes topic quickly. Practise finding a way in and holding your share.",
  },
  quiet: {
    style: "quiet",
    replyLength: 8,
    volunteering: 0.15,
    asksBack: 0.15,
    disruption: 0.05,
    description: "Gives short answers. Practise finding a detail worth following without it becoming an interview.",
  },
  distracted: {
    style: "distracted",
    replyLength: 14,
    volunteering: 0.3,
    asksBack: 0.1,
    disruption: 0.4,
    description: "Half-present and easily pulled away. Practise keeping a thread and reading when to stop.",
  },
  friendly: {
    style: "friendly",
    replyLength: 26,
    volunteering: 0.7,
    asksBack: 0.65,
    disruption: 0.05,
    description: "Warm and forthcoming. A good place to practise something new.",
  },
  direct: {
    style: "direct",
    replyLength: 18,
    volunteering: 0.4,
    asksBack: 0.3,
    disruption: 0.2,
    description: "Blunt and to the point. Practise not reading brevity as hostility.",
  },
  uncertain: {
    style: "uncertain",
    replyLength: 20,
    volunteering: 0.35,
    asksBack: 0.4,
    disruption: 0.1,
    description: "Hedges and defers. Practise making space without steamrolling.",
  },
  enthusiastic: {
    style: "enthusiastic",
    replyLength: 34,
    volunteering: 0.8,
    asksBack: 0.5,
    disruption: 0.15,
    description: "Keen and high-energy. Practise matching energy without losing your own thread.",
  },
};

/** What the character has established so far. The source of conversational consistency. */
export interface CharacterMemory {
  characterId: Id;
  /** Facts the character has stated in this conversation, in order. */
  statedFacts: string[];
  /** Topics already covered, so the character does not re-introduce them. */
  coveredTopics: string[];
  /** Facts the *user* has shared. A friendly character will refer back to these. */
  learnedAboutUser: string[];
  /** 0-1 how engaged the character currently is. Moves in response to the user. */
  engagement: number;
  /**
   * What the *other* characters have said in front of this one.
   *
   * In a group, people can refer to each other — "like Sam was saying" — and a
   * character who cannot do that gives away that they are a separate bot that
   * happens to share a room. Kept per-character rather than globally because
   * someone who joined late genuinely did not hear the earlier part.
   */
  heardFromOthers: { characterId: Id; gist: string }[];
  /** Times the user has addressed this character by name. */
  timesAddressed: number;
  /** User turns since this character was last addressed; drives being left out. */
  turnsSinceAddressed: number;
}

export function newMemory(character: SimulatedCharacter): CharacterMemory {
  return {
    characterId: character.id,
    statedFacts: [],
    coveredTopics: [],
    learnedAboutUser: [],
    engagement: 0.5,
    heardFromOthers: [],
    timesAddressed: 0,
    turnsSinceAddressed: 0,
  };
}

export type TurnIntent =
  | "answer-short"
  | "answer-with-detail"
  | "volunteer"
  | "ask-back"
  | "deflect"
  | "change-topic"
  | "wind-down";

export interface TurnPlan {
  intent: TurnIntent;
  /** Target reply length in words; the AI path is told this and the fallback obeys it. */
  targetWords: number;
  /** A fact from the character's background to introduce, if the intent calls for one. */
  factToIntroduce?: string;
  /** A user fact to refer back to, demonstrating that the character remembers. */
  callback?: string;
  /** Difficulty actually being delivered this turn, 1-5. */
  difficulty: number;
}

/**
 * Engagement responds to what the user does — a good follow-up opens a
 * character up, three questions in a row closes them down. This is the feedback
 * loop that makes the simulation feel like a conversation rather than a form.
 */
export function updateEngagement(
  memory: CharacterMemory,
  userTurn: string,
  previousCharacterTurn: string | null,
  context: EngagementContext = {},
): CharacterMemory {
  const lower = userTurn.toLowerCase();
  let delta = 0;

  if (previousCharacterTurn) {
    const shared = sharedWords(userTurn, previousCharacterTurn);
    if (shared >= 2) delta += 0.12;
    else if (shared === 0 && userTurn.trim().length > 20) delta -= 0.08;
  }
  if (lower.includes("?")) delta += 0.05;
  if (/\b(so you|sounds like|that makes sense|no wonder)\b/.test(lower)) delta += 0.1;
  if (userTurn.trim().split(/\s+/).length <= 3) delta -= 0.06;
  if ((userTurn.match(/\?/g) ?? []).length >= 2) delta -= 0.05;

  // In a group, a turn aimed at somebody else is not a turn aimed at you.
  //
  // The one-to-one version applied the full engagement change to every
  // character, which quietly made attention free: the user could talk only to
  // Alex all session and Sam would warm up exactly as much. Being ignored has
  // to cost something or "include the quiet one" is advice with no mechanism
  // behind it.
  const inGroup = context.groupSize !== undefined && context.groupSize > 1;
  const addressedSomeone = context.addressedAnyone ?? false;
  const addressed = context.addressed ?? true;
  let timesAddressed = memory.timesAddressed;
  let turnsSinceAddressed = memory.turnsSinceAddressed;

  if (inGroup) {
    if (addressed) {
      timesAddressed += 1;
      turnsSinceAddressed = 0;
    } else {
      turnsSinceAddressed += 1;
      // A turn aimed at a named someone else lands as being passed over;
      // a turn addressed to the room still counts, just for less.
      delta = addressedSomeone ? delta * 0.15 - 0.05 : delta * 0.5;
      if (turnsSinceAddressed >= 4) delta -= 0.04;
    }
  }

  const learned = /\b(i|i'm|im|i've|ive|my)\b/i.test(userTurn) && userTurn.split(/\s+/).length > 6
    ? [...memory.learnedAboutUser, condense(userTurn)]
    : memory.learnedAboutUser;

  return {
    ...memory,
    engagement: Math.min(1, Math.max(0, memory.engagement + delta)),
    learnedAboutUser: learned.slice(-6),
    timesAddressed,
    turnsSinceAddressed,
  };
}

/** How a user turn relates to this particular character. Absent means one-to-one. */
export interface EngagementContext {
  /** Whether this user turn addressed this character. */
  addressed?: boolean;
  /** Whether the turn named anyone at all — being passed over stings more than a general remark. */
  addressedAnyone?: boolean;
  /** Characters in the scenario. 1 or undefined restores the one-to-one behaviour exactly. */
  groupSize?: number;
}

function sharedWords(a: string, b: string): number {
  const wordsOf = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3),
    );
  const first = wordsOf(a);
  const second = wordsOf(b);
  let count = 0;
  for (const word of first) if (second.has(word)) count += 1;
  return count;
}

function condense(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}…`;
}

/**
 * Decide what kind of turn the character takes next.
 *
 * Difficulty drifts within a session rather than being fixed: a conversation
 * that is uniformly hard is discouraging and one that is uniformly easy is
 * useless. The pattern is a gentle rise with an easier stretch after the user
 * has had a run of hard turns — which is roughly how real conversations feel
 * when they are going well.
 */
export function planTurn(
  character: SimulatedCharacter,
  memory: CharacterMemory,
  turnIndex: number,
  baseDifficulty: number,
  rng: () => number,
): TurnPlan {
  const profile = STYLE_PROFILES[character.style];
  const difficulty = driftedDifficulty(baseDifficulty, turnIndex);
  // Harder settings suppress the character's helpfulness.
  const hardness = (difficulty - 1) / 4;
  const volunteering = profile.volunteering * character.openness * (1 - hardness * 0.55) * (0.6 + memory.engagement * 0.8);
  const asksBack = profile.asksBack * character.reciprocity * (1 - hardness * 0.6) * (0.5 + memory.engagement);

  const roll = rng();
  const unusedFacts = character.background.filter((fact) => !memory.statedFacts.includes(fact));
  const callback = memory.learnedAboutUser.length > 0 && memory.engagement > 0.55 && rng() < 0.3
    ? memory.learnedAboutUser[memory.learnedAboutUser.length - 1]
    : undefined;

  let intent: TurnIntent;
  if (turnIndex >= 12 || (memory.engagement < 0.2 && turnIndex > 6)) intent = "wind-down";
  else if (roll < asksBack) intent = "ask-back";
  else if (roll < asksBack + volunteering && unusedFacts.length > 0) intent = "volunteer";
  else if (roll < asksBack + volunteering + profile.disruption * hardness) intent = "change-topic";
  else if (memory.engagement < 0.35) intent = "deflect";
  else if (profile.replyLength > 24) intent = "answer-with-detail";
  else intent = "answer-short";

  const lengthJitter = 0.75 + rng() * 0.5;
  const targetWords = Math.round(
    profile.replyLength * lengthJitter * (intent === "answer-short" ? 0.6 : 1) * (intent === "volunteer" ? 1.3 : 1),
  );

  return {
    intent,
    targetWords: Math.max(4, targetWords),
    factToIntroduce: intent === "volunteer" ? unusedFacts[0] : undefined,
    callback,
    difficulty,
  };
}

/**
 * Difficulty over the course of a conversation: starts a little below the
 * target, rises, and eases off around turn 8 so the session does not end on its
 * hardest moment.
 */
export function driftedDifficulty(base: number, turnIndex: number): number {
  const ramp = Math.min(1, turnIndex / 6);
  const relief = turnIndex > 8 ? -0.4 : 0;
  return Math.min(5, Math.max(1, base - 0.6 + ramp * 1.1 + relief));
}

/** Deterministic PRNG so a scenario replays identically for tests and for the user. */
export function seededRng(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    hash >>>= 0;
    return hash / 4294967296;
  };
}

// --- Deterministic reply generation ----------------------------------------
//
// Used when no model is configured. These are templates driven by the plan, and
// they are honest about what they are: short, plausible, consistent. They are
// good enough to practise the mechanics of turn-taking against, which is what
// the offline mode promises — no more.

const ACKNOWLEDGEMENTS = ["Yeah.", "Mm.", "Right.", "Pretty much.", "Sort of."];
const DEFLECTIONS = [
  "Not much to say about it really.",
  "It's fine.",
  "Yeah, it's been alright.",
  "Hard to explain.",
];

export function composeReply(
  character: SimulatedCharacter,
  memory: CharacterMemory,
  plan: TurnPlan,
  lastUserTurn: string | null,
  rng: () => number,
): string {
  const pick = <T,>(items: T[]): T | undefined => items[Math.floor(rng() * items.length)];
  const topic = lastUserTurn ? keyPhrase(lastUserTurn) : null;

  switch (plan.intent) {
    case "ask-back": {
      const base = topic ? `Yeah, a bit. What about you — ${questionAbout(topic)}?` : "What about you?";
      return plan.callback ? `${base} You mentioned ${trimFact(plan.callback)} before.` : base;
    }
    case "volunteer": {
      const fact = plan.factToIntroduce ?? pick(character.background) ?? "";
      return topic ? `Yeah — ${fact} ${interestAside(character, rng)}` : `${fact} ${interestAside(character, rng)}`;
    }
    case "change-topic": {
      const interest = pick(character.interests) ?? "something else";
      return `Anyway — did you hear about ${interest}?`;
    }
    case "deflect":
      return pick(DEFLECTIONS) ?? "It's fine.";
    case "wind-down":
      return "I should get going in a minute, but it's been good talking.";
    case "answer-with-detail": {
      const fact = plan.factToIntroduce ?? pick(character.background) ?? "";
      return topic ? `About ${topic}, yeah. ${fact}` : fact || "Yeah, it's been busy.";
    }
    case "answer-short":
    default:
      return topic ? `${pick(ACKNOWLEDGEMENTS) ?? "Yeah."} ${capitalise(topic)}, yeah.`.trim() : pick(ACKNOWLEDGEMENTS) ?? "Yeah.";
  }
}

function interestAside(character: SimulatedCharacter, rng: () => number): string {
  const interest = character.interests[Math.floor(rng() * character.interests.length)];
  return interest ? `Been meaning to get back into ${interest}, actually.` : "";
}

function keyPhrase(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
  return words[words.length - 1] ?? null;
}

function questionAbout(topic: string): string {
  return `how's the ${topic} side of things`;
}

function trimFact(fact: string): string {
  const words = fact.split(/\s+/).slice(0, 8).join(" ");
  return words.toLowerCase();
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rebuild every character's memory from a transcript. Keeps state derivable rather than stored. */
export function rebuildMemory(simulation: Simulation): Map<Id, CharacterMemory> {
  const memories = new Map<Id, CharacterMemory>(
    simulation.scenario.characters.map((character) => [character.id, newMemory(character)]),
  );
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  let lastCharacterTurn: SimulationTurn | null = null;

  const groupSize = simulation.scenario.characters.length;

  for (const turn of turns) {
    if (turn.speaker === "character" && turn.characterId) {
      const speakerId = turn.characterId;
      const memory = memories.get(speakerId);
      if (memory) {
        memories.set(speakerId, {
          ...memory,
          statedFacts: [...memory.statedFacts, ...factsIn(turn.text, simulation.scenario, speakerId)],
          coveredTopics: [...memory.coveredTopics, ...(keyPhrase(turn.text) ? [keyPhrase(turn.text) as string] : [])],
        });
      }
      // Everyone else in the room heard it.
      for (const [id, other] of memories) {
        if (id === speakerId) continue;
        memories.set(id, {
          ...other,
          heardFromOthers: [...other.heardFromOthers, { characterId: speakerId, gist: condense(turn.text) }].slice(-8),
        });
      }
      lastCharacterTurn = turn;
    } else if (turn.speaker === "user") {
      const named = namesAddressed(turn.text, simulation.scenario);
      for (const [id, memory] of memories) {
        memories.set(
          id,
          updateEngagement(memory, turn.text, lastCharacterTurn?.text ?? null, {
            // With nobody named, a turn in a group is addressed to the room:
            // treat it as reaching whoever spoke last rather than nobody.
            addressed: named.length > 0 ? named.includes(id) : lastCharacterTurn?.characterId === id,
            addressedAnyone: named.length > 0,
            groupSize,
          }),
        );
      }
    }
  }
  return memories;
}

function factsIn(text: string, scenario: SimulationScenario, characterId: Id): string[] {
  const character = scenario.characters.find((item) => item.id === characterId);
  if (!character) return [];
  return character.background.filter((fact) => text.includes(fact.slice(0, Math.min(20, fact.length))));
}

/** Ends when the character winds down, the objective is met, or the turn budget runs out. */
export function shouldEnd(simulation: Simulation, maxTurns = 16): boolean {
  if (simulation.endedAt) return true;
  if (simulation.turns.length >= maxTurns) return true;
  const last = simulation.turns[simulation.turns.length - 1];
  return Boolean(last && last.speaker === "character" && /should get going|been good talking/i.test(last.text));
}
