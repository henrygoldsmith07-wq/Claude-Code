import { getSkill } from "./skills";
import type { Experiment, ExperimentObservation, Id, IsoInstant } from "./types";

// ---------------------------------------------------------------------------
// Personal experiments.
//
// A user runs a self-experiment with a sample of eight, no control, no
// blinding, and their own mood as the measurement instrument. That is not a
// reason to refuse them — testing a change deliberately beats guessing — but it
// is a hard limit on what may be concluded, and the analysis below is written
// to respect it.
//
// So: differences are reported with both group sizes, the language is always
// "on the occasions you did X", and there is an explicit `caveat` field that
// the UI is required to render. No p-values, because a p-value here would be
// theatre.
// ---------------------------------------------------------------------------

export const MEASURE_LABELS: Record<Experiment["measure"], { question: string; low: string; high: string }> = {
  "perceived-difficulty": { question: "How difficult did that feel?", low: "Easy", high: "Very hard" },
  "conversation-flow": { question: "How well did the conversation flow?", low: "Stalled", high: "Flowed easily" },
  "attempt-rate": { question: "Did you do it when the opportunity came up?", low: "No", high: "Yes" },
};

export const EXPERIMENT_TEMPLATES: { question: string; plan: string; measure: Experiment["measure"]; skillIds: Id[] }[] = [
  {
    question: "Does asking more follow-up questions make conversations easier to keep going?",
    plan: "Ask one extra genuine follow-up in conversations where it fits naturally.",
    measure: "conversation-flow",
    skillIds: ["conv.follow-up"],
  },
  {
    question: "Does speaking in the first ten minutes make meetings easier?",
    plan: "Contribute once within the first ten minutes of each meeting.",
    measure: "perceived-difficulty",
    skillIds: ["conf.groups"],
  },
  {
    question: "Does saying no in the first sentence make declining easier?",
    plan: "When declining, lead with the no and give at most one reason.",
    measure: "perceived-difficulty",
    skillIds: ["asrt.no"],
  },
  {
    question: "Does preparing one opener beforehand help me start conversations?",
    plan: "Before each social situation, decide on one situational opener in advance.",
    measure: "attempt-rate",
    skillIds: ["conv.start"],
  },
  {
    question: "Does acknowledging the feeling first change how support conversations go?",
    plan: "Before offering anything, say that the reaction makes sense.",
    measure: "conversation-flow",
    skillIds: ["emp.validation"],
  },
];

export interface ExperimentAnalysis {
  applied: { count: number; mean: number };
  notApplied: { count: number; mean: number };
  difference: number;
  /** Enough data to say anything at all. */
  sufficient: boolean;
  /** Plain-language finding — always about the occasions, never about the person. */
  summary: string;
  /** Always rendered. Non-negotiable part of the output. */
  caveat: string;
  /** Suggested next step: continue, conclude, or adjust. */
  recommendation: string;
}

const MIN_PER_GROUP = 3;

export function analyse(experiment: Experiment, observations: ExperimentObservation[]): ExperimentAnalysis {
  const applied = observations.filter((item) => item.applied);
  const notApplied = observations.filter((item) => !item.applied);
  const appliedMean = mean(applied.map((item) => item.value));
  const notAppliedMean = mean(notApplied.map((item) => item.value));
  const difference = appliedMean - notAppliedMean;
  const sufficient = applied.length >= MIN_PER_GROUP && notApplied.length >= MIN_PER_GROUP;

  const label = MEASURE_LABELS[experiment.measure];
  // For difficulty, lower is better; for the others, higher is.
  const betterWhenLower = experiment.measure === "perceived-difficulty";
  const favourable = betterWhenLower ? difference < 0 : difference > 0;
  const magnitude = Math.abs(difference);

  let summary: string;
  if (!sufficient) {
    summary = `Not enough yet: ${applied.length} occasion${applied.length === 1 ? "" : "s"} where you applied the change and ${notApplied.length} where you did not. At least ${MIN_PER_GROUP} of each is needed before the comparison means anything.`;
  } else if (magnitude < 0.4) {
    summary = `On the occasions you applied it, ${label.question.toLowerCase().replace("?", "")} averaged ${appliedMean.toFixed(1)} against ${notAppliedMean.toFixed(1)} when you did not — effectively no difference across ${observations.length} occasions.`;
  } else {
    summary = `On the ${applied.length} occasions you applied it, the average was ${appliedMean.toFixed(1)}; on the ${notApplied.length} you did not, ${notAppliedMean.toFixed(1)}. That is a difference of ${magnitude.toFixed(1)} in the ${favourable ? "expected" : "opposite"} direction.`;
  }

  const caveat = sufficient
    ? "You chose which occasions to apply this to, and rated them yourself — so easier conversations may simply have been the ones where you tried it. This shows an association across a handful of occasions, not that the change caused the difference."
    : "Nothing can be read from this yet.";

  const recommendation = !sufficient
    ? `Keep going — ${Math.max(0, MIN_PER_GROUP - applied.length)} more applied and ${Math.max(0, MIN_PER_GROUP - notApplied.length)} more unapplied occasions would make it comparable.`
    : magnitude < 0.4
      ? "No clear difference. Worth either trying a bigger version of the change, or testing something else."
      : favourable
        ? "Worth keeping. If you want more confidence, run it for another two weeks — the pattern holding up over time is better evidence than a bigger difference now."
        : "It went the other way. That is a real result and worth knowing; consider whether the change is being applied in the harder situations.";

  return {
    applied: { count: applied.length, mean: Number(appliedMean.toFixed(2)) },
    notApplied: { count: notApplied.length, mean: Number(notAppliedMean.toFixed(2)) },
    difference: Number(difference.toFixed(2)),
    sufficient,
    summary,
    caveat,
    recommendation,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createExperiment(
  userId: Id,
  template: { question: string; plan: string; measure: Experiment["measure"]; skillIds: Id[] },
  now: IsoInstant,
): Experiment {
  return {
    id: `exp.${userId}.${hash(template.question)}`,
    userId,
    question: template.question,
    plan: template.plan,
    measure: template.measure,
    skillIds: template.skillIds.filter((id) => getSkill(id) !== undefined),
    targetObservations: 10,
    startedAt: now,
  };
}

function hash(text: string): string {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

/** Progress towards a usable comparison, for the UI's progress indicator. */
export function progressOf(experiment: Experiment, observations: ExperimentObservation[]): {
  recorded: number;
  target: number;
  ready: boolean;
} {
  const applied = observations.filter((item) => item.applied).length;
  const notApplied = observations.length - applied;
  return {
    recorded: observations.length,
    target: experiment.targetObservations,
    ready: applied >= MIN_PER_GROUP && notApplied >= MIN_PER_GROUP,
  };
}
