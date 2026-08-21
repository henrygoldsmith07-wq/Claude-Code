import { BEHAVIOUR_KEYS, MULTI_PARTY_BEHAVIOURS } from "./types";
import { addressee, namesAddressed } from "./addressing";
import { participation } from "./floor";
import { summariseInterruptions } from "./interruption";
import { behaviourLabel } from "./behaviours";
import type {
  BehaviourKey,
  BehaviourScore,
  EvidenceSpan,
  Exercise,
  Id,
  Simulation,
  SimulationEvaluation,
  SimulationTurn,
} from "./types";

// ---------------------------------------------------------------------------
// Simulation evaluation.
//
// The naive design is to hand a transcript to a model and ask for a score out
// of ten. That produces numbers that are unstable across runs, uncalibrated
// across users, and impossible to defend when someone asks "why a six?".
//
// So scoring is done here, from countable features of the transcript: how many
// replies referenced the previous turn, how many questions were open, how the
// speaking share split. Every score ships with the count that produced it, and
// a score computed from too little material is marked unreliable and excluded
// from mastery updates entirely.
//
// The model's job (see src/ai/tasks.ts) is to phrase the feedback and pick
// quotable moments — language, not measurement.
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "so", "then", "than", "that", "this", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "our",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "have", "has", "had",
  "of", "to", "in", "on", "for", "with", "at", "by", "from", "up", "about", "into", "over", "after",
  "just", "really", "very", "quite", "bit", "like", "yeah", "yes", "no", "ok", "okay", "well", "oh",
  "what", "how", "why", "when", "where", "who", "which", "not", "get", "got", "would", "could", "should",
]);

const OPEN_QUESTION_STARTERS = ["what", "how", "which", "why", "tell me", "what's", "how's"];

const REFLECTION_MARKERS = [
  "so you", "sounds like", "so it", "you're saying", "youre saying", "it seems like", "so that means",
  "if i've got that right", "if i understand",
];
const VALIDATION_MARKERS = [
  "that makes sense", "makes sense", "of course you", "no wonder", "i'd be", "id be", "that sounds",
  "fair enough", "understandable", "i can see why",
];
const ACKNOWLEDGEMENT_MARKERS = [
  "i hear you", "i get that", "i understand", "thanks for telling me", "right, i see", "okay, i see",
  "got it", "i see what you mean",
];
const MINIMISING_MARKERS = ["at least", "could be worse", "it's not that bad", "you'll be fine", "don't worry about it"];
/** Things the other person says that invite acknowledgement of a feeling. */
const EMOTIONAL_CUE_MARKERS = [
  "not great", "struggling", "stressed", "annoyed", "frustrated", "upset", "gutted", "worried",
  "passed over", "turned down", "rejected", "exhausted", "fed up", "hard week", "difficult", "rough",
  "let down", "anxious about", "dreading", "furious", "hurt",
];
const TRANSITION_MARKERS = [
  "that reminds me", "speaking of", "on that note", "before i forget", "while we're on", "which reminds",
  "changing tack", "on the subject of",
];
const ASSERTIVE_MARKERS = ["i think", "i'd like", "id like", "i want", "i can't", "i cant", "i won't", "i wont", "i'd prefer", "i disagree", "i'm not able", "im not able", "no,"];
const HEDGE_MARKERS = ["sorry", "maybe", "sort of", "kind of", "i guess", "possibly", "i mean", "just wondering", "if that's ok", "if thats ok", "no worries if"];
const FILLERS = ["um", "uh", "erm", "like", "you know", "basically", "literally", "sort of", "kind of"];
/** Marks a turn as being about the speaker's own experience. */
const FIRST_PERSON = /\b(i|i'm|im|i've|ive|i'd|id|my|mine|mine's|me|we|we've|our|ours|us)\b/i;

/**
 * Crude suffix stripping so "walked", "walking" and "walks" count as the same
 * topic. A real stemmer would be more accurate, but the failure mode here is
 * asymmetric: missing a match wrongly tells someone they changed the subject
 * when they did not, and that is the more damaging error.
 */
function stem(word: string): string {
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

/** Content words in a string, lower-cased, stemmed and de-duplicated. */
function contentWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem);
  return new Set(words);
}

/**
 * Openers that point back at what was just said without repeating any of its
 * words. "That sounds like the right way to do it" is a reply to the previous
 * turn by any human reading, and word overlap alone scores it as a topic change.
 */
const ANAPHORIC_MARKERS = [
  "that sounds", "that's", "thats", "that must", "that would", "that does", "it sounds", "it does",
  "sounds like", "so you", "so it", "yeah, that", "makes sense", "same here", "i can see why",
  "no wonder", "fair enough",
];

const DEMONSTRATIVES = /\b(that|this|those|these|them|then|there)\b/i;

/**
 * A short question cannot introduce a new subject without naming one. "Which
 * part?" and "How long have you done that?" are continuations by construction,
 * and scoring them as topic changes because they reuse no vocabulary is simply
 * wrong.
 */
function isElliptical(text: string): boolean {
  if (!isQuestion(text)) return false;
  const words = wordCount(text);
  if (words > 7) return false;
  return DEMONSTRATIVES.test(text) || contentWords(text).size <= 1;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function containsAny(text: string, markers: string[]): boolean {
  return markers.some((marker) => markerRegex(marker).test(text));
}

function countAny(text: string, markers: string[]): number {
  return markers.reduce((total, marker) => {
    return total + (text.match(markerRegex(marker, true))?.length ?? 0);
  }, 0);
}

function markerRegex(marker: string, global = false): RegExp {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, global ? "gi" : "i");
}

function isQuestion(text: string): boolean {
  return text.trim().includes("?");
}

function questionCount(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function questionKinds(text: string): { open: number; closed: number; total: number } {
  const segments = text
    .split("?")
    .slice(0, -1)
    .map((segment) => segment.trim().replace(/^[^a-z]+/i, ""))
    .filter(Boolean);
  let open = 0;
  let closed = 0;
  for (const segment of segments) {
    const isOpen = OPEN_QUESTION_STARTERS.some((starter) => {
      const pattern = new RegExp(`^${starter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|['’])`, "i");
      return pattern.test(segment);
    });
    if (isOpen) open += 1;
    else closed += 1;
  }
  return { open, closed, total: open + closed };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface TranscriptFeatures {
  /** Ordered transcript retained internally so evidence spans can point back to exact turns. */
  turns: SimulationTurn[];
  userTurns: SimulationTurn[];
  characterTurns: SimulationTurn[];
  userWords: number;
  characterWords: number;
  /** User replies that picked up something from the recent character turns. */
  referencingReplies: number;
  /** Replies where the character had actually said something to pick up on. */
  judgeableReplies: number;
  /** Character turns that invited acknowledgement of a feeling. */
  emotionalCues: number;
  reflections: number;
  acknowledgements: number;
  openQuestions: number;
  closedQuestions: number;
  stackedQuestions: number;
  /** Consecutive user questions with nothing offered in between. */
  questionRuns: number;
  disclosures: number;
  validations: number;
  minimisings: number;
  signalledTransitions: number;
  unsignalledTransitions: number;
  assertiveStatements: number;
  hedges: number;
  fillers: number;
  averageReplyWords: number;
  longestReplyWords: number;
  // --- Group only. Zero and meaningless in a one-to-one transcript. ---
  /** Characters in the scenario. 1 means the multi-party behaviours do not apply. */
  characterCount: number;
  /** Characters the user addressed by name at least once. */
  charactersAddressed: number;
  /** User turn ids that named a participant, for replay evidence. */
  addressedTurnIds: Id[];
  /** How evenly the user spread named attention, 0-1. */
  attentionBalance: number;
  /** Characters who never spoke and were never brought in by the user. */
  leftOut: number;
  /** Times the user took the floor uninvited. */
  selfSelections: number;
  /** Stretches where the group held the floor and the user could have come in. */
  entryOpportunities: number;
  /** Interruption facts are only populated as far as the transcript supports. */
  interruptionEvents: ReturnType<typeof summariseInterruptions>["events"];
  timesCutOff: number;
  timesCuttingOff: number;
  reclaims: number;
  overlapUnavailable: boolean;
}

export function extractFeatures(simulation: Simulation): TranscriptFeatures {
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  const userTurns = turns.filter((turn) => turn.speaker === "user");
  const characterTurns = turns.filter((turn) => turn.speaker === "character");

  let referencingReplies = 0;
  let judgeableReplies = 0;
  let reflections = 0;
  let acknowledgements = 0;
  let openQuestions = 0;
  let closedQuestions = 0;
  let stackedQuestions = 0;
  let questionRuns = 0;
  let disclosures = 0;
  let validations = 0;
  let minimisings = 0;
  let signalledTransitions = 0;
  let unsignalledTransitions = 0;
  let assertiveStatements = 0;
  let hedges = 0;
  let fillers = 0;

  let consecutiveQuestions = 0;
  const emotionalCues = characterTurns.filter((turn) => containsAny(turn.text, EMOTIONAL_CUE_MARKERS)).length;
  const interruptionSummary = summariseInterruptions(simulation);

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    if (!turn || turn.speaker !== "user") continue;
    // Reference is judged against the last two character turns, not just the
    // most recent one. People routinely pick up a detail from a turn or two
    // back, and a two-word "Mm." from the character would otherwise make the
    // user's reply look like a topic change.
    const previous = findPrevious(turns, i, "character");
    const context = previousCharacterWords(turns, i, 2);
    const text = turn.text;

    // A reply can only be judged for relevance if the character actually gave
    // something to pick up on. Two words of "Mm." is not material, and marking
    // the user down for not referencing it would be measuring the simulator.
    if (previous && context.size >= 2) judgeableReplies += 1;

    if (previous) {
      const shared = overlap(contentWords(text), context);
      const anaphoric = containsAny(text, ANAPHORIC_MARKERS) || isElliptical(text);
      if (context.size >= 2 && (shared >= 0.15 || anaphoric)) referencingReplies += 1;
      else if (!isQuestion(text) || wordCount(text) > 4) {
        // A reply with no shared content is a topic move. Signalled ones are a
        // skill; unsignalled ones are what makes people feel unheard.
        //
        // Continuing your *own* previous thread is neither: it may well be
        // over-talking, but it is not a topic change, and counting it as one
        // would double-penalise the same behaviour under two headings.
        const ownPrevious = findPrevious(turns, i, "user");
        const continuesOwnThread =
          ownPrevious !== null && overlap(contentWords(text), contentWords(ownPrevious.text)) >= 0.12;
        if (containsAny(text, TRANSITION_MARKERS)) signalledTransitions += 1;
        else if (!continuesOwnThread && shared < 0.05 && wordCount(text) > 5) unsignalledTransitions += 1;
      }
    }

    if (containsAny(text, REFLECTION_MARKERS)) reflections += 1;
    if (containsAny(text, ACKNOWLEDGEMENT_MARKERS)) acknowledgements += 1;
    if (containsAny(text, VALIDATION_MARKERS)) validations += 1;
    if (containsAny(text, MINIMISING_MARKERS)) minimisings += 1;
    if (containsAny(text, ASSERTIVE_MARKERS)) assertiveStatements += 1;
    hedges += countAny(text, HEDGE_MARKERS);
    fillers += countAny(text, FILLERS);

    const questions = questionCount(text);
    if (questions > 0) {
      const kinds = questionKinds(text);
      openQuestions += kinds.open;
      closedQuestions += kinds.closed;
      if (questions >= 2) stackedQuestions += 1;
      consecutiveQuestions += 1;
      if (consecutiveQuestions >= 3) questionRuns += 1;
    } else {
      consecutiveQuestions = 0;
    }

    // Offering something about yourself is counted whether or not the same turn
    // also asks a question. Reciprocity is about whether anything came back
    // across the exchange, and "here's mine — what about yours?" is one of the
    // most common shapes a balanced turn takes.
    if (FIRST_PERSON.test(text) && wordCount(text) >= 5) disclosures += 1;
  }

  const userWords = userTurns.reduce((sum, turn) => sum + wordCount(turn.text), 0);
  const characterWords = characterTurns.reduce((sum, turn) => sum + wordCount(turn.text), 0);
  const replyLengths = userTurns.map((turn) => wordCount(turn.text));

  return {
    turns,
    userTurns,
    characterTurns,
    userWords,
    characterWords,
    referencingReplies,
    judgeableReplies,
    emotionalCues,
    reflections,
    acknowledgements,
    openQuestions,
    closedQuestions,
    stackedQuestions,
    questionRuns,
    disclosures,
    validations,
    minimisings,
    signalledTransitions,
    unsignalledTransitions,
    assertiveStatements,
    hedges,
    fillers,
    averageReplyWords: replyLengths.length ? replyLengths.reduce((a, b) => a + b, 0) / replyLengths.length : 0,
    longestReplyWords: replyLengths.length ? Math.max(...replyLengths) : 0,
    interruptionEvents: interruptionSummary.events,
    timesCutOff: interruptionSummary.timesCutOff,
    timesCuttingOff: interruptionSummary.timesCuttingOff,
    reclaims: interruptionSummary.reclaims,
    overlapUnavailable: interruptionSummary.overlapUnavailable,
    ...groupFeatures(simulation),
  };
}

/**
 * The countable parts of a group conversation.
 *
 * Everything here is derived from names in the transcript and from who spoke
 * when, because that is all a transcript honestly contains. Attention in a real
 * room is mostly gaze, and none of it reaches this data — so "you looked at one
 * person the whole time" is not a claim this evaluator is entitled to make, and
 * it does not make it.
 */
function groupFeatures(simulation: Simulation): Pick<
  TranscriptFeatures,
  "characterCount" | "charactersAddressed" | "addressedTurnIds" | "attentionBalance" | "leftOut" | "selfSelections" | "entryOpportunities"
> {
  const characters = simulation.scenario.characters;
  const summary = participation(simulation);
  const interruptions = summariseInterruptions(simulation);
  const spoke = new Set(
    simulation.turns.filter((t) => t.speaker === "character" && t.characterId).map((t) => t.characterId as Id),
  );
  const addressed = new Set(
    simulation.turns
      .filter((t) => t.speaker === "user")
      .flatMap((t) => namesAddressed(t.text, simulation.scenario)),
  );
  const addressedTurnIds = simulation.turns
    .filter((turn) => turn.speaker === "user" && namesAddressed(turn.text, simulation.scenario).length > 0)
    .map((turn) => turn.id);

  // A stretch where the group held the floor and did *not* hand it over.
  //
  // The obvious version — count every run of two or more character turns — is
  // wrong, and wrong in the direction that blames the user: if the group talks
  // twice and then asks the user a direct question, they were invited, and
  // answering is not a failure to break in. Only runs that end without an
  // invitation actually tested whether the user could take a turn.
  const ordered = [...simulation.turns].sort((a, b) => a.index - b.index);
  let entryOpportunities = 0;
  let run: SimulationTurn[] = [];
  const closeRun = () => {
    const last = run[run.length - 1];
    if (run.length >= 2 && last && addressee(last.text, simulation.scenario, false) !== "user") {
      entryOpportunities += 1;
    }
    run = [];
  };
  for (const turn of ordered) {
    if (turn.speaker === "character") run.push(turn);
    else closeRun();
  }
  closeRun();

  return {
    characterCount: characters.length,
    charactersAddressed: addressed.size,
    addressedTurnIds,
    attentionBalance: summary.attentionBalance,
    leftOut: characters.filter((c) => !spoke.has(c.id) && !addressed.has(c.id)).length,
    selfSelections: interruptions.selfSelections,
    entryOpportunities,
  };
}

/** Content words from the last `count` character turns before `index`. */
function previousCharacterWords(turns: SimulationTurn[], index: number, count: number): Set<string> {
  const words = new Set<string>();
  let found = 0;
  for (let i = index - 1; i >= 0 && found < count; i -= 1) {
    const turn = turns[i];
    if (!turn || turn.speaker !== "character") continue;
    found += 1;
    for (const word of contentWords(turn.text)) words.add(word);
  }
  return words;
}

function findPrevious(turns: SimulationTurn[], index: number, speaker: "user" | "character"): SimulationTurn | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn && turn.speaker === speaker) return turn;
  }
  return null;
}

/** Minimum user turns before a behaviour can be judged at all. */
const RELIABILITY_MIN_TURNS: Record<BehaviourKey, number> = {
  relevance: 2,
  listening: 3,
  followUpQuality: 3,
  reciprocity: 4,
  clarity: 2,
  assertiveness: 2,
  empathy: 3,
  topicTransitions: 4,
  questionQuality: 2,
  contribution: 2,
  interruptionHandling: 2,
  inclusion: 3,
  floorEntry: 3,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Gaming-adjusted scoring: detect 8 score-gaming strategies and penalise the
 * affected behaviours. Penalties are capped and behaviour-specific — gaming
 * the metric should not raise a score, even when the countable feature that
 * the gaming exploits would otherwise look good.
 *
 * This runs inline (rather than via a separate module) so the evaluator's
 * deterministic path cannot be bypassed by a caller who forgets a wrapper.
 */
function gamingPenaltyFor(key: BehaviourKey, f: TranscriptFeatures, simulation: { scenario: { characters: { name: string }[] }; turns: { speaker: "user" | "character"; text: string }[] }): number {
  const turns = f.userTurns.length;
  if (turns === 0) return 0;

  let penalty = 0;

  // --- Excessive questions: penalise questionQuality / reciprocity when asking too much
  const totalQ = f.openQuestions + f.closedQuestions;
  const perTurnQ = turns > 0 ? totalQ / turns : 0;
  if ((key === "questionQuality" || key === "reciprocity" || key === "followUpQuality") && perTurnQ > 1.0 && totalQ >= 4) {
    const severity = Math.min(1, (perTurnQ - 0.8) / 0.9);
    penalty = Math.max(penalty, severity * 0.35);
  }
  if ((key === "questionQuality" || key === "reciprocity") && f.stackedQuestions > 0 && totalQ >= 3) {
    const stackSeverity = Math.min(1, f.stackedQuestions / Math.max(1, totalQ * 0.5));
    penalty = Math.max(penalty, stackSeverity * 0.3);
  }

  // --- Repetitive acknowledgements: same phrase repeated
  if ((key === "listening" || key === "empathy") && f.acknowledgements >= 3) {
    // Count repeated ack phrases across user turns
    const ackMarkers = ["i hear you", "i get that", "i understand", "thanks for telling me", "got it", "i see what you mean"];
    const counts = new Map<string, number>();
    for (const turn of f.userTurns) {
      const lower = turn.text.toLowerCase();
      for (const m of ackMarkers) if (lower.includes(m)) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const maxRep = Math.max(...[...counts.values()], 0);
    if (maxRep >= 3) penalty = Math.max(penalty, Math.min(0.35, maxRep * 0.12));
    else if (f.acknowledgements / Math.max(1, turns) > 0.7) penalty = Math.max(penalty, 0.2);
  }

  // --- Unnatural name repetition
  if ((key === "inclusion" || key === "listening") && simulation.scenario.characters.length > 0) {
    let totalNames = 0;
    for (const turn of f.userTurns) {
      for (const ch of simulation.scenario.characters) {
        const re = new RegExp(`\\b${ch.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        totalNames += (turn.text.match(re) ?? []).length;
      }
    }
    if (totalNames >= 4 && totalNames / Math.max(1, turns) > 0.6) penalty = Math.max(penalty, Math.min(0.3, totalNames * 0.07));
  }

  // --- Formulaic empathy: validations without emotional opportunity, or repeated validation phrase
  if (key === "empathy" && f.validations > 0) {
    const withoutOpp = f.emotionalCues === 0 && f.validations >= 2;
    if (withoutOpp) penalty = Math.max(penalty, Math.min(0.35, f.validations * 0.12));
    // Repeated validation phrase check
    const valMarkers = ["that makes sense", "makes sense", "of course you", "no wonder", "that sounds"];
    const counts = new Map<string, number>();
    for (const turn of f.userTurns) {
      const lower = turn.text.toLowerCase();
      for (const m of valMarkers) if (lower.includes(m)) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const maxRep = Math.max(...[...counts.values()], 0);
    if (maxRep >= 3) penalty = Math.max(penalty, Math.min(0.35, maxRep * 0.12));
  }

  // --- Unnaturally short responses (< =3 words in >40% of turns)
  if ((key === "clarity" || key === "reciprocity" || key === "contribution") && turns >= 3) {
    const shorts = f.userTurns.filter((t) => t.text.trim().split(/\s+/).filter(Boolean).length <= 3).length;
    const ratio = shorts / turns;
    if (ratio > 0.4 && f.averageReplyWords < 8) penalty = Math.max(penalty, Math.min(0.3, ratio * 0.5));
  }

  // --- Mechanical mirroring: high overlap but low acknowledgements/reflections (copy without uptake)
  if ((key === "relevance" || key === "listening") && f.referencingReplies >= 2 && f.acknowledgements === 0 && f.reflections === 0 && f.validations === 0) {
    // If referencing is high purely via word overlap with no reflective language, treat as potential mirroring
    // Check for exact word copy of >=2 content words in short replies
    // Simplified: referencing with no acknowledgement = mechanical suspicion, but only penalise if replies are very short (<10 words)
    const shortWithOverlap = f.userTurns.filter((t) => t.text.trim().split(/\s+/).length < 10).length;
    if (shortWithOverlap >= 2 && f.referencingReplies / Math.max(1, f.judgeableReplies) > 0.6) {
      const mechanical = Math.min(1, shortWithOverlap / 3);
      penalty = Math.max(penalty, mechanical * 0.25);
    }
  }

  // --- Forced topic references: same rare topic word repeated >=4 times
  if ((key === "relevance" || key === "topicTransitions") && turns >= 3) {
    const allText = f.userTurns.map((t) => t.text.toLowerCase()).join(" ");
    const words = allText.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 5);
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    const maxRep = Math.max(...[...freq.values()], 0);
    if (maxRep >= 4 && f.referencingReplies >= 2) penalty = Math.max(penalty, Math.min(0.25, (maxRep - 3) * 0.1));
  }

  // --- Artificial conversational balance: exactly 1:1 questions:disclosures with templated disclosures (5-8 words)
  if ((key === "reciprocity" || key === "contribution") && turns >= 4) {
    const totalQ2 = f.openQuestions + f.closedQuestions;
    const disc = f.disclosures;
    if (totalQ2 >= 3 && totalQ2 === disc) {
      const shortDisc = f.userTurns.filter((t) => /\b(i|i'm|im|i've|my)\b/i.test(t.text) && t.text.trim().split(/\s+/).length <= 8 && t.text.trim().split(/\s+/).length >= 5).length;
      if (shortDisc / Math.max(1, disc) > 0.5) penalty = Math.max(penalty, 0.28);
    }
  }

  return clamp01(penalty);
}

/** Score one behaviour from the features, with the counts that justify it and gaming resistance. */
function scoreBehaviour(key: BehaviourKey, f: TranscriptFeatures, simulation?: Simulation): BehaviourScore {
  const score = scoreBehaviourBase(key, f);
  // Apply gaming penalty where a simulation is available to derive pattern context
  let penalty = 0;
  if (simulation) {
    penalty = gamingPenaltyFor(key, f, simulation as never);
    if (penalty > 0) {
      const penalised = clamp01(score.score - penalty);
      const evidence = penalty > 0.15 ? `${score.evidence} — pattern flagged as score-gaming, penalised` : score.evidence;
      return { ...score, score: Number(penalised.toFixed(3)), evidence, evidenceSpans: evidenceSpansFor(key, f, score) };
    }
  }
  return { ...score, evidenceSpans: evidenceSpansFor(key, f, score) };
}

function scoreBehaviourBase(key: BehaviourKey, f: TranscriptFeatures): BehaviourScore {
  const turns = f.userTurns.length;
  const reliable = turns >= RELIABILITY_MIN_TURNS[key];
  const denom = Math.max(1, turns);

  switch (key) {
    case "relevance": {
      const judgeable = f.judgeableReplies;
      const ratio = judgeable === 0 ? 0 : f.referencingReplies / judgeable;
      return build(
        key,
        clamp01(ratio / 0.7),
        `${f.referencingReplies} of ${judgeable} replies picked up something they had said`,
        // Needs at least two replies where the character gave something to work with.
        reliable && judgeable >= 2,
        // Capped: a missing reference is a softer signal than an active move
        // like minimising someone's feelings, and should lose the tie-break to it.
        Math.min(0.5, f.unsignalledTransitions * 0.25),
      );
    }
    case "listening": {
      // Uptake, not vocabulary: reflecting, acknowledging, or asking about
      // something they said. Showing it in half your turns is full marks —
      // reflecting every turn would be strange rather than excellent.
      const uptake = f.reflections + f.acknowledgements + f.validations + Math.min(f.referencingReplies, f.openQuestions + f.closedQuestions);
      return build(
        key,
        clamp01(uptake / (denom * 0.5)),
        `${uptake} acknowledgement, reflection or relevant question${uptake === 1 ? "" : "s"} across ${turns} replies`,
        reliable,
      );
    }
    case "followUpQuality": {
      const followUps = Math.min(f.openQuestions, f.referencingReplies);
      const ratio = followUps / Math.max(1, f.openQuestions + f.closedQuestions);
      const volume = clamp01((f.openQuestions + f.closedQuestions) / Math.max(2, turns * 0.4));
      return build(
        key,
        clamp01(ratio * 0.7 + volume * 0.3),
        `${followUps} question${followUps === 1 ? "" : "s"} followed a detail they had just mentioned`,
        reliable,
      );
    }
    case "reciprocity": {
      const questions = f.openQuestions + f.closedQuestions;
      const balance = questions + f.disclosures === 0 ? 0 : 1 - Math.abs(questions - f.disclosures) / (questions + f.disclosures);
      const penalty = f.questionRuns * 0.15;
      return build(
        key,
        clamp01(balance - penalty),
        `${questions} question${questions === 1 ? "" : "s"} against ${f.disclosures} thing${f.disclosures === 1 ? "" : "s"} you offered about yourself`,
        reliable,
        Math.min(1, f.questionRuns * 0.5),
      );
    }
    case "clarity": {
      const lengthFit = f.averageReplyWords === 0 ? 0 : gaussianFit(f.averageReplyWords, 22, 16);
      const fillerRate = f.fillers / Math.max(1, f.userWords / 100);
      const fillerPenalty = clamp01(fillerRate / 12);
      const rambling = f.longestReplyWords > 110 ? 0.15 : 0;
      // Consistently long turns are an active habit, not an absence.
      const overlong = f.averageReplyWords > 60 || rambling > 0;
      return build(
        key,
        clamp01(lengthFit - fillerPenalty * 0.4 - rambling),
        `Replies averaged ${Math.round(f.averageReplyWords)} words; ${f.fillers} filler${f.fillers === 1 ? "" : "s"} across the conversation`,
        reliable,
        overlong ? 0.6 : 0,
      );
    }
    case "assertiveness": {
      const rate = f.assertiveStatements / denom;
      const hedgeRate = f.hedges / denom;
      return build(
        key,
        clamp01(rate / 0.5 - clamp01(hedgeRate / 2.2) * 0.5),
        `${f.assertiveStatements} clear statement${f.assertiveStatements === 1 ? "" : "s"} of your own position, ${f.hedges} hedge${f.hedges === 1 ? "" : "s"}`,
        reliable,
        hedgeRate >= 2 ? 1 : 0,
      );
    }
    case "empathy": {
      const positives = f.validations + f.reflections * 0.5;
      const ratio = positives / Math.max(1, denom * 0.4);
      // Empathy is only judgeable when the other person put something there to
      // acknowledge. Scoring it in a cheerful exchange about a holiday would be
      // measuring nothing.
      const opportunity = f.emotionalCues > 0 || f.minimisings > 0 || f.validations > 0;
      return build(
        key,
        clamp01(ratio - f.minimisings * 0.25),
        `${f.validations} acknowledgement${f.validations === 1 ? "" : "s"} of how they felt across ${f.emotionalCues} moment${f.emotionalCues === 1 ? "" : "s"} that invited one${f.minimisings > 0 ? `, and ${f.minimisings} that skipped past it` : ""}`,
        reliable && opportunity,
        Math.min(1, f.minimisings * 0.5),
      );
    }
    case "topicTransitions": {
      const total = f.signalledTransitions + f.unsignalledTransitions;
      if (total === 0) return build(key, 0.6, "0 topic changes — the conversation stayed on one thread", false);
      return build(
        key,
        clamp01(f.signalledTransitions / total),
        `${f.signalledTransitions} of ${total} topic change${total === 1 ? "" : "s"} were bridged rather than jumped`,
        reliable,
      );
    }
    case "questionQuality": {
      const total = f.openQuestions + f.closedQuestions;
      if (total === 0) return build(key, 0.1, `0 questions asked across ${turns} replies`, turns >= 3);
      const openRatio = f.openQuestions / total;
      const stackPenalty = clamp01(f.stackedQuestions / total) * 0.3;
      return build(
        key,
        clamp01(openRatio - stackPenalty),
        `${f.openQuestions} of ${total} questions were open`,
        reliable,
      );
    }
    case "contribution": {
      const total = f.userWords + f.characterWords;
      if (total === 0) return build(key, 0, "Nothing said yet", false);
      const share = f.userWords / total;
      // Best around an even split; both silence and monologue are penalised.
      // The tolerance is deliberately tight — at 90% of the words, "roughly
      // even" is not a defensible reading.
      return build(
        key,
        clamp01(gaussianFit(share, 0.48, 0.22)),
        `You spoke about ${Math.round(share * 100)}% of the words`,
        reliable,
        share > 0.78 || share < 0.18 ? 1 : 0,
      );
    }
    case "interruptionHandling": {
      if (f.overlapUnavailable && f.selfSelections === 0) {
        return build(
          key,
          0.5,
          "Overlapping speech was not measurable in this text transcript",
          false,
        );
      }
      if (f.interruptionEvents.length === 0) {
        return build(key, 0.5, "No interruption opportunity was captured", false);
      }
      const positive = f.reclaims + f.selfSelections;
      const negative = f.timesCuttingOff + Math.max(0, f.timesCutOff - f.reclaims);
      const opportunities = positive + negative;
      const score = opportunities === 0 ? 0.5 : positive / opportunities;
      return build(
        key,
        score,
        `${f.reclaims} calm reclaim${f.reclaims === 1 ? "" : "s"}, ${f.timesCuttingOff} cut-off${f.timesCuttingOff === 1 ? "" : "s"} caused, ${f.timesCutOff} time${f.timesCutOff === 1 ? "" : "s"} cut off`,
        reliable && opportunities > 0,
        f.timesCuttingOff > 0 ? Math.min(1, f.timesCuttingOff * 0.5) : 0,
      );
    }
    case "inclusion": {
      // Only reachable for group scenarios; scoreTranscript filters it out
      // otherwise. Guarded anyway so a direct call cannot invent a score.
      if (f.characterCount <= 1) return build(key, 0, "Not a group conversation", false);
      if (f.charactersAddressed === 0) {
        return build(
          key,
          0.05,
          `You did not bring in any of the ${f.characterCount} others by name`,
          reliable,
          1,
        );
      }
      const reach = f.charactersAddressed / f.characterCount;
      // Reach matters more than evenness: naming three people unevenly beats
      // naming one person perfectly evenly.
      const score = reach * 0.65 + f.attentionBalance * 0.35;
      return build(
        key,
        clamp01(score),
        `You brought in ${f.charactersAddressed} of ${f.characterCount} by name` +
          (f.leftOut > 0 ? `; ${f.leftOut} never spoke and were never asked` : ""),
        reliable,
        f.leftOut > 0 ? 0.8 : 0,
      );
    }
    case "floorEntry": {
      if (f.characterCount <= 1) return build(key, 0, "Not a group conversation", false);
      if (f.entryOpportunities === 0) {
        // The group always handed the floor over, so nothing was demonstrated
        // either way. Unreliable rather than a low score.
        return build(key, 0.5, "The group never talked among themselves long enough to require breaking in", false);
      }
      const taken = Math.min(f.selfSelections, f.entryOpportunities);
      return build(
        key,
        clamp01(taken / f.entryOpportunities),
        `You came in unprompted ${taken} of ${f.entryOpportunities} time(s) the group had the floor`,
        reliable,
        taken === 0 ? 0 : 0,
      );
    }
    default:
      return build(key, 0, "", false);
  }
}

function span(turn: SimulationTurn, role: EvidenceSpan["role"]): EvidenceSpan {
  return {
    turnId: turn.id,
    turnIndex: turn.index,
    speaker: turn.speaker,
    quote: turn.text.trim(),
    role,
  };
}

function uniqueSpans(spans: EvidenceSpan[]): EvidenceSpan[] {
  const seen = new Set<string>();
  return spans.filter((item) => {
    const key = `${item.turnId}:${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function indexOfTurn(turn: SimulationTurn, f: TranscriptFeatures): number {
  return f.turns.findIndex((candidate) => candidate.id === turn.id);
}

function previousCharacterFor(turn: SimulationTurn, f: TranscriptFeatures): SimulationTurn | null {
  const index = indexOfTurn(turn, f);
  return index < 0 ? null : findPrevious(f.turns, index, "character");
}

function referencesCharacter(turn: SimulationTurn, f: TranscriptFeatures): boolean {
  const index = indexOfTurn(turn, f);
  if (index < 0) return false;
  const previous = findPrevious(f.turns, index, "character");
  const context = previousCharacterWords(f.turns, index, 2);
  if (!previous || context.size < 2) return false;
  return overlap(contentWords(turn.text), context) >= 0.15 || containsAny(turn.text, ANAPHORIC_MARKERS) || isElliptical(turn.text);
}

function hasJudgeableContext(turn: SimulationTurn, f: TranscriptFeatures): boolean {
  const index = indexOfTurn(turn, f);
  return index >= 0 && previousCharacterWords(f.turns, index, 2).size >= 2;
}

function continuesOwnThread(turn: SimulationTurn, f: TranscriptFeatures): boolean {
  const index = indexOfTurn(turn, f);
  const previous = index < 0 ? null : findPrevious(f.turns, index, "user");
  return previous !== null && overlap(contentWords(turn.text), contentWords(previous.text)) >= 0.12;
}

function evidenceSpansFor(key: BehaviourKey, f: TranscriptFeatures, score: BehaviourScore): EvidenceSpan[] {
  const support: EvidenceSpan[] = [];
  const missed: EvidenceSpan[] = [];
  const users = f.userTurns;
  const add = (target: EvidenceSpan[], turn: SimulationTurn | undefined, role: EvidenceSpan["role"]) => {
    if (turn) target.push(span(turn, role));
  };

  switch (key) {
    case "relevance":
      users.forEach((turn) => add(referencesCharacter(turn, f) ? support : missed, hasJudgeableContext(turn, f) ? turn : undefined, referencesCharacter(turn, f) ? "support" : "missed-opportunity"));
      break;
    case "listening":
      users.forEach((turn) => {
        const takenIn = referencesCharacter(turn, f) || containsAny(turn.text, REFLECTION_MARKERS) || containsAny(turn.text, ACKNOWLEDGEMENT_MARKERS) || containsAny(turn.text, VALIDATION_MARKERS);
        add(takenIn ? support : missed, hasJudgeableContext(turn, f) ? turn : undefined, takenIn ? "support" : "missed-opportunity");
      });
      break;
    case "followUpQuality":
      users.forEach((turn) => {
        const kind = questionKinds(turn.text);
        const good = kind.open > 0 && referencesCharacter(turn, f);
        add(good ? support : missed, kind.total > 0 ? turn : undefined, good ? "support" : "missed-opportunity");
      });
      break;
    case "reciprocity":
      users.forEach((turn) => {
        if (FIRST_PERSON.test(turn.text) && wordCount(turn.text) >= 5) add(support, turn, "support");
        else if (questionKinds(turn.text).total > 0 && f.questionRuns > 0) add(missed, turn, "missed-opportunity");
      });
      break;
    case "clarity":
      users.forEach((turn) => {
        const long = wordCount(turn.text) > 60;
        const hasFillers = countAny(turn.text, FILLERS) > 0;
        add(long || hasFillers ? missed : support, turn, long || hasFillers ? "missed-opportunity" : "support");
      });
      break;
    case "assertiveness":
      users.forEach((turn) => {
        const clear = containsAny(turn.text, ASSERTIVE_MARKERS);
        const hedged = countAny(turn.text, HEDGE_MARKERS) > 0;
        if (clear && !hedged) add(support, turn, "support");
        else if (hedged) add(missed, turn, "missed-opportunity");
      });
      break;
    case "empathy":
      users.forEach((turn) => {
        const previous = previousCharacterFor(turn, f);
        const emotional = previous !== null && containsAny(previous.text, EMOTIONAL_CUE_MARKERS);
        const response = containsAny(turn.text, VALIDATION_MARKERS) || containsAny(turn.text, REFLECTION_MARKERS);
        if (response) add(support, turn, "support");
        else if (emotional || containsAny(turn.text, MINIMISING_MARKERS)) add(missed, turn, "missed-opportunity");
      });
      break;
    case "topicTransitions":
      users.forEach((turn) => {
        if (containsAny(turn.text, TRANSITION_MARKERS)) add(support, turn, "support");
        else if (!referencesCharacter(turn, f) && !continuesOwnThread(turn, f) && wordCount(turn.text) > 5) add(missed, turn, "missed-opportunity");
      });
      break;
    case "questionQuality":
      users.forEach((turn) => {
        const kind = questionKinds(turn.text);
        if (kind.open > 0 && kind.total === 1) add(support, turn, "support");
        else if (kind.total > 0) add(missed, turn, "missed-opportunity");
      });
      break;
    case "contribution": {
      const share = f.userWords / Math.max(1, f.userWords + f.characterWords);
      const candidate = users.find((turn) => wordCount(turn.text) >= 5);
      if (share >= 0.18 && share <= 0.78) add(support, candidate, "support");
      if (share > 0.78 || share < 0.18) add(missed, users.reduce((longest, turn) => wordCount(turn.text) > wordCount(longest?.text ?? "") ? turn : longest, users[0]), "missed-opportunity");
      break;
    }
    case "interruptionHandling":
      for (const event of f.interruptionEvents) {
        const turn = f.turns.find((candidate) => candidate.index === event.turnIndex);
        const positive = event.kind === "self-selection" || (event.kind === "cut-off" && f.reclaims > 0);
        add(positive ? support : missed, turn, positive ? "support" : "missed-opportunity");
      }
      break;
    case "inclusion":
      users.forEach((turn) => add(f.addressedTurnIds.includes(turn.id) ? support : missed, turn, f.addressedTurnIds.includes(turn.id) ? "support" : "missed-opportunity"));
      break;
    case "floorEntry":
      for (const event of f.interruptionEvents.filter((item) => item.kind === "self-selection")) {
        const turn = f.turns.find((candidate) => candidate.index === event.turnIndex);
        add(support, turn, "support");
      }
      if (support.length === 0) add(missed, f.characterTurns[f.characterTurns.length - 1], "missed-opportunity");
      break;
    default:
      break;
  }

  const selected = uniqueSpans([...support.slice(0, 3), ...missed.slice(0, 3)]);
  if (selected.length > 0 || !score.reliable) return selected;
  const fallback = users[0] ?? f.characterTurns[0];
  return fallback ? [span(fallback, score.score >= 0.55 ? "support" : "missed-opportunity")] : [];
}

function build(key: BehaviourKey, score: number, evidence: string, reliable: boolean, severity = 0): BehaviourScore {
  return { key, score: Number(clamp01(score).toFixed(3)), evidence, reliable, severity: clamp01(severity) };
}

/** 1 at the ideal, falling off smoothly. Used where both too little and too much are wrong. */
function gaussianFit(value: number, ideal: number, tolerance: number): number {
  const z = (value - ideal) / tolerance;
  return Math.exp(-0.5 * z * z);
}

export function scoreTranscript(simulation: Simulation): BehaviourScore[] {
  const features = extractFeatures(simulation);
  const focus = new Set(simulation.scenario.evaluationCriteria);
  const multiParty = simulation.scenario.characters.length > 1;
  return BEHAVIOUR_KEYS.filter((key) => {
    // A one-to-one conversation cannot display a group behaviour, so it does
    // not get to produce evidence about one — in either direction.
    if (!multiParty && MULTI_PARTY_BEHAVIOURS.includes(key)) return false;
    return focus.size === 0 || focus.has(key);
  }).map((key) => scoreBehaviour(key, features, simulation));
}

/** Overall performance for the mastery engine: reliable scores only, or null. */
export function performanceFrom(scores: BehaviourScore[]): { performance: number; reliability: number } | null {
  const reliable = scores.filter((score) => score.reliable);
  if (reliable.length === 0) return null;
  const performance = reliable.reduce((sum, score) => sum + score.score, 0) / reliable.length;
  const reliability = Math.min(1, reliable.length / Math.max(3, scores.length * 0.6));
  return { performance, reliability };
}

const PRINCIPLES: Record<BehaviourKey, { principle: string; example: string; exerciseKind: Exercise["kind"]; prompt: string; criteria: string[] }> = {
  inclusion: {
    principle: "In a group, the quiet person is not being quiet at you. Use their name and ask them something specific — a general 'what does everyone think?' reliably reaches nobody.",
    example: "Three people are talking and one has not spoken. \"Sam, you were on that project last year — did it work then?\"",
    exerciseKind: "rewrite",
    prompt: "Two colleagues have been talking for a few minutes and a third has said nothing. Write one line that brings the third person in, using their name and something specific to them.",
    criteria: ["Uses the person's name", "Asks about something specific rather than 'any thoughts?'", "Does not put them on the spot to justify their silence"],
  },
  floorEntry: {
    principle: "In a group nobody hands you the floor. Waiting for a gap that is obviously yours will mean not speaking. Come in on the end of someone's point, not in the silence after it.",
    example: "Rather than waiting: \"Can I pick up on that — the same thing happened to us in March.\"",
    exerciseKind: "rewrite",
    prompt: "Two people have been talking for three turns and have not looked at you. Write one line that gets you into the conversation without changing the subject.",
    criteria: ["Connects to what was just said", "Does not apologise for speaking", "Adds something rather than only agreeing"],
  },
  relevance: {
    principle: "Reply to the last thing they said before adding anything new. The material for your next line is almost always already in their sentence.",
    example: "They mention a delayed move. Rather than a new topic, something like: \"What's holding it up?\"",
    exerciseKind: "rewrite",
    prompt: "Here is a line from a conversation: \"We were meant to move in March but it keeps slipping.\" Write a reply that uses something in that sentence rather than introducing a new subject.",
    criteria: ["References a specific detail from the line", "Does not change subject", "Leaves room for them to expand"],
  },
  listening: {
    principle: "Say back the gist in one clause before responding. It gives them evidence they were understood and gives you a checkpoint if you got it wrong.",
    example: "\"So you're covering both roles until they hire someone.\"",
    exerciseKind: "rewrite",
    prompt: "Someone says: \"I've been doing my job and half of Sam's since he left, and nobody's mentioned it.\" Write a one-sentence reflection back before any advice or opinion.",
    criteria: ["One sentence", "In your own words, not repeated verbatim", "No advice attached"],
  },
  followUpQuality: {
    principle: "Listen → pick a detail → ask about that detail → relate if it genuinely fits. The follow-up is what keeps a conversation alive; the topic change is what ends it.",
    example: "\"You said it was your first time doing that — how did you decide to try it?\"",
    exerciseKind: "rewrite",
    prompt: "They say: \"I've just come back from three weeks in Portugal, mostly walking.\" Write one follow-up question about a specific detail in that sentence.",
    criteria: ["Names a detail they mentioned", "Open rather than yes/no", "Only one question"],
  },
  reciprocity: {
    principle: "Alternate between asking and offering. Several questions in a row becomes an interview; several statements in a row becomes a monologue.",
    example: "After two questions about their work, offer something about yours before the third.",
    exerciseKind: "plan",
    prompt: "Plan the next three turns of a conversation where you have already asked two questions in a row. What do you offer before asking again?",
    criteria: ["Includes something about yourself", "Returns the floor afterwards", "No more than one question"],
  },
  clarity: {
    principle: "Finish the sentence, keep the reply roughly the length of theirs, and pause instead of using a filler.",
    example: "Two clear sentences land better than one long one that loops back on itself.",
    exerciseKind: "rewrite",
    prompt: "Rewrite this to be clearer and shorter: \"Yeah so I mean I guess I was sort of thinking that maybe we could possibly look at it next week or something, if that's okay?\"",
    criteria: ["Fewer than 20 words", "No more than one hedge", "The ask is unambiguous"],
  },
  assertiveness: {
    principle: "State your position as yours, once, with at most one reason. Extra justification invites negotiation of each clause.",
    example: "\"I can't take that on this week — I'm at capacity until Friday.\"",
    exerciseKind: "rewrite",
    prompt: "Rewrite as a clear decline with one reason: \"I'm so sorry, I know it's short notice and I'd really love to help but things are a bit hectic, though maybe I could try…\"",
    criteria: ["Declines in the first sentence", "One reason at most", "No apology chain"],
  },
  empathy: {
    principle: "Acknowledge that the reaction makes sense before anything else — and do not follow it with 'but' or 'at least'.",
    example: "\"That's a rough way to find out. No wonder you're annoyed.\"",
    exerciseKind: "rewrite",
    prompt: "Someone says: \"They gave the project to someone who joined last month.\" Write a reply that acknowledges the reaction, with no 'but' and no silver lining.",
    criteria: ["Names or accepts the feeling", "No 'at least'", "No immediate advice"],
  },
  topicTransitions: {
    principle: "Bridge before you change topic: link the new subject to something already said, and signal the move.",
    example: "\"Sounds slow. Speaking of waiting — did you hear back about the job?\"",
    exerciseKind: "rewrite",
    prompt: "The current topic is a delayed building project. Write a transition to asking about their holiday that bridges from what was said.",
    criteria: ["Acknowledges the current topic first", "Contains a visible signal of the change", "Feels connected rather than abrupt"],
  },
  questionQuality: {
    principle: "Ask how/what/which rather than yes/no, and ask one question at a time.",
    example: "\"What made you choose that one?\" rather than \"Did you like it?\"",
    exerciseKind: "rewrite",
    prompt: "Rewrite as open questions: \"Did you have a good weekend?\" and \"Is work busy?\"",
    criteria: ["Both start with how, what or which", "Neither can be answered in one word", "No stacked questions"],
  },
  contribution: {
    principle: "Aim for a roughly even share of the talking across the conversation, not turn by turn.",
    example: "After a long turn, close with a question. After several short ones, offer something with substance.",
    exerciseKind: "plan",
    prompt: "You have said very little in a group for ten minutes. Plan your first contribution: what do you build on, and how do you keep it short?",
    criteria: ["Builds on someone else's point", "Under three sentences", "Hands back rather than trailing off"],
  },
  interruptionHandling: {
    principle: "Overlap is not all the same. Let a supportive noise pass, but if someone cuts across a point, return to the sentence once without apologising for taking your turn.",
    example: "I’ll finish that thought — the risk is highest in the handover, not the planning.",
    exerciseKind: "rewrite",
    prompt: "Someone cuts you off just before your main point. Write one calm line that reclaims the floor without attacking them or apologising.",
    criteria: ["Returns to the unfinished point", "Keeps the tone level", "Does not label the other person"],
  },
};

/**
 * Pick the single improvement worth naming. Deliberately one: a list of six
 * things to fix is read as "you were bad at this", and nobody applies six
 * changes to their next conversation.
 */
export function selectImprovement(scores: BehaviourScore[]): BehaviourScore | null {
  const reliable = scores.filter((score) => score.reliable);
  if (reliable.length === 0) return null;
  // Lowest score wins, with a small nudge towards behaviours where something
  // was actively done rather than merely missing. Naming "you talked over 90%
  // of the exchange" is more use than "you referenced little of what they
  // said", even when the two score identically.
  const rank = (score: BehaviourScore) => score.score - 0.15 * (score.severity ?? 0);
  return reliable.reduce((worst, score) => (rank(score) < rank(worst) ? score : worst));
}

export function whatWorked(simulation: Simulation, scores: BehaviourScore[], limit = 2): string[] {
  const strong = scores
    .filter((score) => score.reliable && score.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const features = extractFeatures(simulation);
  return strong.map((score) => describeStrength(score, features));
}

function describeStrength(score: BehaviourScore, f: TranscriptFeatures): string {
  switch (score.key) {
    case "followUpQuality":
      return `You followed up on what they actually said — ${score.evidence.toLowerCase()}.`;
    case "listening":
      return `You showed you were listening rather than waiting to speak: ${score.evidence.toLowerCase()}.`;
    case "questionQuality":
      return `Your questions gave them room to answer — ${score.evidence.toLowerCase()}.`;
    case "reciprocity":
      return `The exchange stayed two-way: ${score.evidence.toLowerCase()}.`;
    case "contribution":
      return `You held up your side without taking over — ${score.evidence.toLowerCase()}.`;
    case "interruptionHandling":
      return `You handled the floor rather than treating every overlap as a failure — ${score.evidence.toLowerCase()}.`;
    case "assertiveness":
      return `You stated your position clearly: ${score.evidence.toLowerCase()}.`;
    case "empathy":
      return `You acknowledged how they felt before moving on — ${score.evidence.toLowerCase()}.`;
    case "clarity":
      return `Your replies were easy to follow: ${score.evidence.toLowerCase()}.`;
    case "topicTransitions":
      return `Topic changes felt connected: ${score.evidence.toLowerCase()}.`;
    case "relevance":
      return `You stayed with what they were talking about — ${score.evidence.toLowerCase()}.`;
    default:
      return `${score.evidence} (${f.userTurns.length} turns).`;
  }
}

export function exerciseFor(behaviour: BehaviourKey, skillId: Id, evaluationId: Id, difficulty: 1 | 2 | 3 | 4 | 5): Exercise {
  const spec = PRINCIPLES[behaviour];
  return {
    id: `ex.${behaviour}.${evaluationId}`,
    skillId,
    kind: spec.exerciseKind,
    prompt: spec.prompt,
    criteria: spec.criteria,
    difficulty,
    generatedFrom: { evaluationId, behaviour },
  };
}

export function principleFor(behaviour: BehaviourKey): { principle: string; example: string } {
  const spec = PRINCIPLES[behaviour];
  return { principle: spec.principle, example: spec.example };
}

/**
 * The complete deterministic evaluation. This is what ships when there is no
 * AI provider configured — and it is also the substrate the AI-assisted path
 * decorates, so the numbers never depend on a model being available.
 */
export function evaluateSimulation(simulation: Simulation, evaluationId: Id, now: string): SimulationEvaluation {
  const scores = scoreTranscript(simulation);
  const improvement = selectImprovement(scores);
  const focusSkill = simulation.scenario.skillIds[0] ?? "conv.follow-up";
  const behaviour: BehaviourKey = improvement?.key ?? "followUpQuality";
  const spec = principleFor(behaviour);
  const difficulty = Math.min(5, Math.max(1, Math.round(simulation.deliveredDifficulty))) as 1 | 2 | 3 | 4 | 5;

  return {
    id: evaluationId,
    simulationId: simulation.id,
    userId: simulation.userId,
    scores,
    whatWorked: whatWorked(simulation, scores),
    highestImpactImprovement: {
      behaviour,
      observation: improvement?.evidence ?? "Not enough of the conversation to judge this yet.",
      principle: spec.principle,
      exampleAlternative: spec.example,
    },
    nextExercise: exerciseFor(behaviour, focusSkill, evaluationId, difficulty),
    source: "deterministic",
    createdAt: now,
  };
}

export interface ReplayEvidence {
  behaviour: BehaviourKey;
  score: number;
  role: "support" | "missed-opportunity";
  turnId: Id;
  turnIndex: number;
  speaker: "user" | "character";
  quote: string;
  observation: string;
  possibleStrategy: string;
}

const REPLAY_STRATEGIES: Record<BehaviourKey, string> = {
  relevance: "Reply to one concrete detail in their last line before adding a new thought.",
  listening: "Try one short acknowledgement or reflection before moving on.",
  followUpQuality: "Pick one detail they mentioned and ask how, what or which about it.",
  reciprocity: "After a question, offer one relevant piece of your own before asking again.",
  clarity: "Trim the build-up, remove filler and land the point in one or two sentences.",
  assertiveness: "State your position in the first sentence and keep to one reason.",
  empathy: "Name that the reaction makes sense before offering advice or a solution.",
  topicTransitions: "Bridge the new subject to the current one and signal the change.",
  questionQuality: "Use one open question at a time rather than stacking yes/no questions.",
  contribution: "Build on what is already being discussed, then hand the floor back.",
  interruptionHandling: "If cut off, return to the unfinished point once without apologising for taking a turn.",
  inclusion: "Invite a quieter participant by name with a specific, easy-to-answer question.",
  floorEntry: "Come in on the end of a point with a connected contribution instead of waiting indefinitely.",
};

/**
 * Turn score evidence into an inspectable replay. It deliberately offers a
 * strategy, not a single perfect replacement line.
 */
export function replayFor(evaluation: SimulationEvaluation): ReplayEvidence[] {
  return evaluation.scores.flatMap((score) =>
    (score.evidenceSpans ?? []).map((evidence) => ({
      behaviour: score.key,
      score: score.score,
      role: evidence.role,
      turnId: evidence.turnId,
      turnIndex: evidence.turnIndex,
      speaker: evidence.speaker,
      quote: evidence.quote,
      observation: evidence.role === "support"
        ? `This turn supports ${behaviourLabel(score.key)}: ${score.evidence}.`
        : `This turn is a missed opportunity for ${behaviourLabel(score.key)}: ${score.evidence}.`,
      possibleStrategy: REPLAY_STRATEGIES[score.key],
    })),
  );
}

