// Prompt diversity & anti-repetition for Reflect.
// Keeps the assistant from asking the same 3 questions on every reflection
// and personalises to the user's recent patterns.

import type { Entry } from "./types";

const PIPELINE_STEPS = [
  "observations",
  "assumptions",
  "emotion",
  "alternatives",
  "outcome_action",
  "predicted_outcome",
] as const;

type Step = (typeof PIPELINE_STEPS)[number];

// Track which pipeline steps have already been probed in this conversation.
export function coveredSteps(messages: { role: string; content: string }[]): Set<Step> {
  const text = messages.map((m) => m.content.toLowerCase()).join(" \n");
  const s = new Set<Step>();
  if (/\bobserv|what (was said|happened|did)|\bfacts?\b/i.test(text)) s.add("observations");
  if (/assum|infer|treating as fact|what are you assuming/i.test(text)) s.add("assumptions");
  if (/emotion|feel|naming|hurt|shame|fear/i.test(text)) s.add("emotion");
  if (/alternative|another way|other reading|other perspective/i.test(text)) s.add("alternatives");
  if (/want to happen|outcome|next step|action|intend/i.test(text)) s.add("outcome_action");
  if (/think will happen|predict|if you (do|take)|expected outcome/i.test(text)) s.add("predicted_outcome");
  return s;
}

// Candidate question bank — diverse phrasings per step so we don't repeat.
// The model is instructed to ground in the user's last message; this bank
// is a fallback and for the prompt suffix that nudges diversity.
const BANK: Record<Step, string[]> = {
  observations: [
    "What was actually said or done — in words someone else could verify?",
    "If a camera had recorded the moment, what would it have captured?",
    "What are the verifiable facts here, separate from what they might mean?",
  ],
  assumptions: [
    "What are you treating as fact that you didn't directly observe?",
    "If you had to label the leap from facts → meaning, what would it be?",
    "What story did your mind add to the facts in the moment?",
  ],
  emotion: [
    "Beneath the first label, what feeling is actually sitting there?",
    "If you set aside 'angry'/'fine' for a second — what hurts?",
    "What emotion would you name if you had to be precise?",
  ],
  alternatives: [
    "What's another plausible reading of the same facts — even if you don't like it?",
    "How might someone who cares about you explain what happened?",
    "If this happened to a friend, what other explanation might you offer them?",
  ],
  outcome_action: [
    "What do you actually want to happen here — not what feels satisfying right now?",
    "What's one concrete next step that serves that outcome?",
    "If you act in line with what you want, what does that look like this week?",
  ],
  predicted_outcome: [
    "If you take that step — what do you think will actually happen?",
    "What's your honest prediction for how they'll respond?",
    "Imagine you do it: what changes, and what stays the same?",
  ],
};

export function diverseQuestionHint(history: { role: string; content: string }[]): string | null {
  // Find least-covered step
  const covered = coveredSteps(history);
  for (const step of PIPELINE_STEPS) {
    if (!covered.has(step)) {
      const variants = BANK[step];
      // pick variant that hasn't been used verbatim recently
      const recent = history
        .filter((m) => m.role === "assistant")
        .map((m) => m.content.toLowerCase())
        .join(" ");
      const unused = variants.find((q) => !recent.includes(q.toLowerCase().slice(0, 28)));
      return unused ?? variants[0];
    }
  }
  return null;
}

// Personal adaptation: surface a brief, hedged nudge based on longitudinal patterns.
// Example: "You've often noted mind-reading here — want to test that one again?"
export function personalAdaptationHint(entries: Entry[]): string | null {
  const completed = entries.filter((e) => e.summary);
  if (completed.length < 3) return null;

  // most common trigger — normalised so "Work" and "work" count together
  const trigDisplay = new Map<string, string>();
  const trig = new Map<string, number>();
  for (const e of completed) for (const t of e.summary!.underlyingTriggers) {
    const k = t.trim().toLowerCase();
    if (!k) continue;
    trig.set(k, (trig.get(k) ?? 0) + 1);
    if (!trigDisplay.has(k)) trigDisplay.set(k, t);
  }
  const top = [...trig.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) {
    const label = trigDisplay.get(top[0]) ?? top[0];
    return `Pattern note (tentative, not a diagnosis): "${label}" has come up ${top[1]}× recently — consider whether it explains this situation or whether this time is different. Hold the pattern lightly; check the evidence for and against.`;
  }

  // most frequent hedged bias type flagged before — normalised
  const biasDisplay = new Map<string, string>();
  const biases = new Map<string, number>();
  for (const e of completed) for (const b of e.summary!.possibleBiases) {
    const k = b.type.trim().toLowerCase();
    if (!k) continue;
    biases.set(k, (biases.get(k) ?? 0) + 1);
    if (!biasDisplay.has(k)) biasDisplay.set(k, b.type);
  }
  const topBias = [...biases.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topBias && topBias[1] >= 2) {
    const label = biasDisplay.get(topBias[0]) ?? topBias[0];
    return `You've explored "${label}" before — only flag it again if the evidence this time actually fits (evidence for vs against, confidence ≥ 0.45; otherwise omit).`;
  }
  return null;
}

// Explicit uncertainty helper: always render a calibrated sentence with the summary.
// Used by SummaryView so every interpretation shows "how sure" language.
export function uncertaintySentence(confidence: number): string {
  if (confidence >= 0.8) return "Fairly confident in this reading, but still check it against the evidence listed.";
  if (confidence >= 0.6) return "Moderately confident — the evidence supports this, with notable counter-evidence to weigh.";
  return "Low confidence — treat as one possibility among several and lean on the evidence for vs against.";
}

export const __test = { BANK, PIPELINE_STEPS, coveredSteps };
