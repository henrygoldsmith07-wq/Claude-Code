import type { MotivationalPrompt } from "./types";

// Always-available nudges shown during a study session so recall stays
// active rather than passive, alternating encouragement with a loss-aversion
// framing of the same exam-day stakes — no AI/network dependency, so a
// session never has to wait on a generation call before showing one.
export const FALLBACK_MOTIVATIONAL_PROMPTS: MotivationalPrompt[] = [
  { tone: "encouraging", message: "Keep going — you've got this." },
  { tone: "encouraging", message: "Every card you get right now is one less thing to worry about later." },
  { tone: "encouraging", message: "Picture how it'll feel walking out of that exam knowing you nailed it." },
  { tone: "loss-aversion", message: "Skip this now, and you'll be relearning it the night before the exam." },
  {
    tone: "loss-aversion",
    message: "Think about the doors a bad grade here could close — is stopping now worth that?",
  },
  { tone: "encouraging", message: "Your future self is counting on the version of you studying right now." },
];

export function pickPrompt(prompts: MotivationalPrompt[], seed: number): MotivationalPrompt {
  const pool = prompts.length > 0 ? prompts : FALLBACK_MOTIVATIONAL_PROMPTS;
  return pool[seed % pool.length];
}
