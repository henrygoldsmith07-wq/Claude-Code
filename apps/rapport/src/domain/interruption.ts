import type { Id, Simulation, SimulationTurn } from "./types";
import { addressee } from "./floor";

// ---------------------------------------------------------------------------
// Interruption: who cut across whom, and whether it mattered.
//
// "Don't interrupt" is bad advice and a bad thing to measure. Overlapping
// speech is how real conversation works — agreement, encouragement and
// finishing someone's sentence are all overlap, and a person who never
// overlaps at all reads as disengaged, not polite. Meanwhile the users this
// product is for are usually failing in the opposite direction: they wait for a
// gap that never comes.
//
// So this module does not count interruptions. It classifies them:
//
//   backchannel          "yeah", "right" over someone — support, not a grab
//   cooperative-overlap  overlapped, and the other person carried on
//   cut-off              overlapped, and the other person stopped
//   self-selection       took the floor in a gap, uninvited
//
// Only `cut-off` is treated as costing anything, and `self-selection` is
// counted as a *success*: in a group that will not hand over the floor, taking
// it is the behaviour being trained.
//
// What is detectable depends on the mode, and the module is honest about it.
// Text turns are serialised by construction — there is no such thing as
// overlapping typing here — so in text mode only self-selection exists. Voice
// turns carry a start time and a duration, so real overlap is computable
// without any audio analysis, which keeps the no-audio-features guarantee in
// `voice.ts` intact.
//
// Pure. No I/O.
// ---------------------------------------------------------------------------

export type InterruptionKind = "backchannel" | "cooperative-overlap" | "cut-off" | "self-selection";

export const INTERRUPTION_MEANING: Record<InterruptionKind, string> = {
  backchannel: "A short supportive noise over someone still speaking. Normal, and usually helpful.",
  "cooperative-overlap": "Spoke over someone, and they carried on. Overlap, not a takeover.",
  "cut-off": "Spoke over someone and they stopped. This one costs the other person their turn.",
  "self-selection": "Took the floor in a gap without being invited. In a group, this is the skill.",
};

export interface InterruptionEvent {
  turnIndex: number;
  by: "user" | Id;
  against: "user" | Id;
  kind: InterruptionKind;
  /** Milliseconds of overlap. Absent in text mode, where turns cannot overlap. */
  overlapMs?: number;
  evidence: string;
  /** Only cut-offs are disruptive; the others are ordinary conversation. */
  disruptive: boolean;
}

/** Short supportive tokens. Overlapping with one of these is not taking a turn. */
const BACKCHANNELS = [
  "yeah", "yes", "right", "mm", "mhm", "sure", "exactly", "totally", "of course",
  "makes sense", "oh", "ok", "okay", "true", "same", "wow", "no way", "i see",
];

/** At or under this many words, an overlapping turn is a noise rather than a bid. */
const BACKCHANNEL_MAX_WORDS = 4;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isBackchannel(text: string): boolean {
  if (wordCount(text) > BACKCHANNEL_MAX_WORDS) return false;
  const cleaned = text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return BACKCHANNELS.some((token) => cleaned === token || cleaned.startsWith(`${token} `));
}

/**
 * Whether a turn reached the end of its sentence.
 *
 * A transcript of speech that was stopped part-way through trails off without
 * terminal punctuation, which is exactly what a speech-to-text engine produces
 * when someone is talked over. Trailing dashes and ellipses count as unfinished
 * for the same reason.
 */
function endsCompletely(text: string): boolean {
  const trimmed = text.trim().replace(/["'”’)\]]+$/, "");
  if (trimmed.length === 0) return true;
  if (/[—–-]$|\.\.\.$|…$/.test(trimmed)) return false;
  return /[.!?]$/.test(trimmed);
}

function speakerOf(turn: SimulationTurn): "user" | Id {
  return turn.speaker === "user" ? "user" : (turn.characterId ?? "user");
}

function startMs(turn: SimulationTurn): number {
  return Date.parse(turn.createdAt);
}

function endMs(turn: SimulationTurn): number {
  return startMs(turn) + (turn.voice?.durationMs ?? 0);
}

/**
 * Find every interruption in a transcript.
 *
 * Overlap is computed from turn start times and voice durations, both of which
 * are already stored. Nothing here inspects audio, so a user's accent, pitch or
 * emotional state remain as uncomputable as `voice.ts` promises.
 */
export function detectInterruptions(simulation: Simulation): InterruptionEvent[] {
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  const events: InterruptionEvent[] = [];

  for (let i = 1; i < turns.length; i += 1) {
    const turn = turns[i];
    const previous = turns[i - 1];
    if (!turn || !previous) continue;
    const by = speakerOf(turn);
    const against = speakerOf(previous);
    if (by === against) continue;

    const overlap = endMs(previous) - startMs(turn);
    const hasTiming = Boolean(previous.voice) && Number.isFinite(overlap);

    if (hasTiming && overlap > 0) {
      if (isBackchannel(turn.text)) {
        events.push({
          turnIndex: turn.index,
          by,
          against,
          kind: "backchannel",
          overlapMs: overlap,
          evidence: `"${turn.text.trim()}" over ${Math.round(overlap)}ms of the previous turn`,
          disruptive: false,
        });
        continue;
      }
      // Was the overlapped turn finished, or stopped mid-thought?
      //
      // "Did they speak again?" looks like the obvious test and is the wrong
      // one: someone who is cut off and fights their way back in has still been
      // cut off, and scoring that as cooperative would make coming back
      // impossible to detect — which is the single behaviour here most worth
      // detecting. Whether the turn reached the end of its sentence is the
      // signal that actually distinguishes the two.
      const finished = endsCompletely(previous.text);
      events.push({
        turnIndex: turn.index,
        by,
        against,
        kind: finished ? "cooperative-overlap" : "cut-off",
        overlapMs: overlap,
        evidence: finished
          ? `overlapped by ${Math.round(overlap)}ms after they had finished the sentence`
          : `overlapped by ${Math.round(overlap)}ms, stopping them mid-sentence`,
        disruptive: !finished,
      });
      continue;
    }

    // No overlap. The only thing left to detect is taking a gap uninvited,
    // which only means anything when the floor was not being offered.
    //
    // One-to-one conversations are excluded by design: there the character
    // always replies after each user turn, so the floor comes back for free and
    // almost every reply would be miscounted as an uninvited bid. The skill
    // only exists where others can hold the floor — in groups.
    if (by === "user" && simulation.scenario.characters.length > 1) {
      const invited = addressee(previous.text, simulation.scenario, previous.speaker === "user") === "user";
      if (!invited) {
        events.push({
          turnIndex: turn.index,
          by,
          against,
          kind: "self-selection",
          evidence: "took the floor without being asked",
          disruptive: false,
        });
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface InterruptionSummary {
  events: InterruptionEvent[];
  /** Times the user took the floor uninvited. The behaviour being trained. */
  selfSelections: number;
  /** Times a character cut the user off. */
  timesCutOff: number;
  /** Times the user cut a character off. */
  timesCuttingOff: number;
  /** Times the user came back after being cut off. */
  reclaims: number;
  /** True when overlap could not be measured, i.e. a text-mode transcript. */
  overlapUnavailable: boolean;
  note: string;
}

/**
 * Roll the events up into the few numbers worth showing.
 *
 * `reclaims` is the one to read. Being talked over is not a skill failure —
 * it happens to everyone and is largely about who else is in the room. Coming
 * back afterwards is a skill, it is trainable, and it is invisible unless
 * something counts it.
 */
export function summariseInterruptions(simulation: Simulation): InterruptionSummary {
  const events = detectInterruptions(simulation);
  const turns = [...simulation.turns].sort((a, b) => a.index - b.index);
  const overlapUnavailable = simulation.mode === "text" || turns.every((t) => !t.voice);

  const cutOffsAgainstUser = events.filter((e) => e.kind === "cut-off" && e.against === "user");
  let reclaims = 0;
  for (const event of cutOffsAgainstUser) {
    const after = turns.filter((t) => t.index > event.turnIndex).slice(0, 3);
    if (after.some((t) => t.speaker === "user")) reclaims += 1;
  }

  const selfSelections = events.filter((e) => e.kind === "self-selection" && e.by === "user").length;
  const timesCuttingOff = events.filter((e) => e.kind === "cut-off" && e.by === "user").length;

  const parts: string[] = [];
  if (selfSelections > 0) parts.push(`came in uninvited ${selfSelections} time(s)`);
  if (cutOffsAgainstUser.length > 0) {
    parts.push(`were cut off ${cutOffsAgainstUser.length} time(s), coming back after ${reclaims}`);
  }
  if (timesCuttingOff > 0) parts.push(`cut someone off ${timesCuttingOff} time(s)`);

  const note = overlapUnavailable
    ? parts.length > 0
      ? `In this text conversation you ${parts.join(", ")}. Overlapping speech cannot be measured in text — only voice sessions show who talked over whom.`
      : "Text conversations cannot show overlap. Practise by voice to see who talked over whom."
    : parts.length > 0
      ? `You ${parts.join(", ")}.`
      : "No interruptions either way.";

  return {
    events,
    selfSelections,
    timesCutOff: cutOffsAgainstUser.length,
    timesCuttingOff,
    reclaims,
    overlapUnavailable,
    note,
  };
}

export const INTERRUPTION_METHODOLOGY =
  "Overlap is computed from when each turn started and how long the previous one lasted — never from " +
  "audio, so nothing here can infer accent, pitch or emotion. Overlapping speech is classified rather " +
  "than counted: short supportive noises and overlaps the other person spoke through are normal " +
  "conversation and cost nothing. Only cutting someone off is treated as a cost, and taking the floor " +
  "in a gap is recorded as a success, because in a group that is the harder thing to do.";
