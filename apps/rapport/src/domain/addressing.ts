import type { Id, SimulationScenario } from "./types";

// ---------------------------------------------------------------------------
// Who a turn is aimed at.
//
// Its own module because both the floor engine and the character engine need
// it, and having either import the other would make the dependency circular.
// Names are the only addressing signal a transcript carries — gaze and body
// orientation do most of this work in a real room and none of it is in the
// data — so this deliberately does not try to infer an addressee from anything
// subtler than a name.
// ---------------------------------------------------------------------------

export type Participant = Id | "user";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Every character named in one turn — the basis for "brings people in". */
export function namesAddressed(text: string, scenario: SimulationScenario): Id[] {
  return scenario.characters
    .filter((c) => new RegExp(`\\b${escapeRegExp(firstName(c.name))}\\b`, "i").test(text))
    .map((c) => c.id);
}

/**
 * Who a line of text is aimed at.
 *
 * A name appearing anywhere counts. This routes the turn, and over-detecting an
 * address is a far smaller error than leaving a directly-asked question
 * unanswered — the latter teaches the user that naming people does nothing.
 */
export function addressee(text: string, scenario: SimulationScenario, fromUser: boolean): Participant | null {
  const named = namesAddressed(text, scenario);
  const first = named[0];
  if (first !== undefined) return first;
  // A character asking a question with nobody named is addressing the user;
  // between characters the engine names whoever it means.
  if (!fromUser && /\?/.test(text)) return "user";
  return null;
}
