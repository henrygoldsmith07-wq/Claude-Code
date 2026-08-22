// ---------------------------------------------------------------------------
// Real-world transfer loop.
//
// The claim the product stakes is that practice changes what someone actually
// does. Showing that requires a lifecycle, not a single metric:
//
//   baseline → practice → challenge → real-world reflection → later unseen practice → progress analysis
//
// The loop is deliberately gated:
//
//  * baseline is the first evaluated simulation *before* the real-world attempt;
//  * practice is any simulation or exercise in between;
//  * challenge + reflection is the real-world attempt with the user's own
//    perceived outcome and free-text signals;
//  * later unseen practice is a simulation on a *different* scenario than the
//    one that trained the behaviour, so transfer is not memory;
//  * progress analysis compares the later practice against the baseline, using
//    deterministic transcript features both times — no self-report is counted as
//    observed behaviour.
//
// No claim of transfer is emitted until the later unseen practice has been
// independently validated (human-rated where possible, at least deterministically
// scored with high confidence and with the challenge marked completed). Until
// then, the loop is "in progress" and the UI says so.
//
// This module is pure: it takes observations and produces a report. I/O belongs
// to repository/state.
// ---------------------------------------------------------------------------

import type { BehaviourKey, ChallengeAttempt, Id, IsoInstant, Reflection, Simulation, SimulationEvaluation } from "./types";
import { BEHAVIOUR_KEYS } from "./types";
import { extractSignals } from "./reflection";

export type TransferPhase = "baseline" | "practice" | "challenge" | "reflection" | "unseen-practice" | "analysis";

export interface TransferRecord {
  id: Id;
  skillId: Id;
  behaviour: BehaviourKey;
  createdAt: IsoInstant;
  /** Deterministic score from the baseline simulation, when available. */
  baselineScore: number | null;
  baselineEvaluationId: Id | null;
  /** Real-world challenge attempt in the middle. */
  challengeAttemptId: Id | null;
  challengeCompleted: boolean;
  /** User reflection after the challenge. */
  reflectionId: Id | null;
  perceivedOutcome: "yes" | "partly" | "no" | "no-opportunity" | "wrong-situation" | null;
  perceivedDifficulty: number | null;
  /** Later unseen practice (different scenario). */
  unseenPracticeEvaluationId: Id | null;
  unseenScore: number | null;
  /** Progress: unseen minus baseline, null until both exist. */
  gain: number | null;
  /** Whether transfer has been independently validated. */
  validated: boolean;
  validationNote: string;
  phase: TransferPhase;
  updatedAt: IsoInstant;
}

export interface TransferLoopInput {
  skillId: Id;
  behaviour: BehaviourKey;
  evaluations: SimulationEvaluation[];
  simulations: Simulation[];
  attempts: ChallengeAttempt[];
  reflections: Reflection[];
  /** Only human-validated scores count as independent validation. Null means deterministic-only so far. */
  humanValidatedBehaviours?: Set<string>; // "evalId:behaviour"
}

function findSimulation(simulations: Simulation[], simulationId: Id): Simulation | undefined {
  return simulations.find((s) => s.id === simulationId);
}

function behaviourScore(evaluation: SimulationEvaluation, behaviour: BehaviourKey): number | null {
  const s = evaluation.scores.find((item) => item.key === behaviour);
  return s?.reliable ? s.score : null;
}

export function buildTransferRecords(input: TransferLoopInput, now = new Date().toISOString()): TransferRecord[] {
  // One record per challenge attempt for this skill/behaviour, tracing baseline → unseen
  const attempts = input.attempts
    .filter((a) => a.challenge.skillId === input.skillId)
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));

  if (attempts.length === 0) return [];

  // All evaluations for this behaviour on this skill, ordered
  const relevantEvals = input.evaluations
    .filter((e) => findSimulation(input.simulations, e.simulationId)?.scenario.skillIds.includes(input.skillId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const records: TransferRecord[] = [];
  for (const attempt of attempts) {
    const reflection = input.reflections.find((r) => r.subject.kind === "challenge" && (r.subject as { kind: "challenge"; attemptId: Id }).attemptId === attempt.id) ?? null;
    const attemptAt = attempt.completedAt ?? attempt.assignedAt;

    // Baseline: the most recent evaluation *before* the attempt
    const baseline = [...relevantEvals].reverse().find((e) => e.createdAt < attemptAt) ?? null;
    const baselineScore = baseline ? behaviourScore(baseline, input.behaviour) : null;

    // Unseen practice: the first evaluation *after* the reflection on a different scenario than baseline
    let unseen: SimulationEvaluation | null = null;
    let unseenScore: number | null = null;
    if (reflection) {
      const baselineScenarioId = baseline ? findSimulation(input.simulations, baseline.simulationId)?.scenarioId : null;
      for (const e of relevantEvals) {
        if (e.createdAt <= reflection.createdAt) continue;
        const sim = findSimulation(input.simulations, e.simulationId);
        if (!sim) continue;
        if (baselineScenarioId && sim.scenarioId === baselineScenarioId) continue; // must be unseen scenario
        const score = behaviourScore(e, input.behaviour);
        if (score !== null) {
          unseen = e;
          unseenScore = score;
          break;
        }
      }
    }

    const gain = baselineScore !== null && unseenScore !== null ? Number((unseenScore - baselineScore).toFixed(3)) : null;
    const challengeCompleted = attempt.completedAt !== undefined && attempt.outcome !== "no" && attempt.outcome !== undefined;

    // Validation: unseen practice exists AND challenge was completed AND (if humanValidated set given, that pair is validated)
    let validated = false;
    let validationNote = "No transfer claim — unseen practice not yet completed on a different scenario.";
    if (!baseline) validationNote = "Baseline not yet established — need a practice conversation before the real-world attempt.";
    else if (!challengeCompleted) validationNote = "Challenge not yet marked completed — transfer cannot be assessed.";
    else if (!reflection) validationNote = "Awaiting reflection on the real-world attempt.";
    else if (!unseen) validationNote = "Awaiting later unseen practice on a different scenario.";
    else if (gain === null) validationNote = "Scores not comparable — one or both transcripts lacked enough material.";
    else {
      // Deterministic comparison exists; mark as validated only if human validation present or explicitly allowed to be deterministic
      const key = unseen ? `${unseen.id}:${input.behaviour}` : null;
      const humanValidated = !input.humanValidatedBehaviours || (key && input.humanValidatedBehaviours.has(key));
      if (humanValidated === false) {
        validationNote = "Deterministic comparison available but not yet human-validated — transfer is suggestive, not confirmed.";
      } else {
        validated = true;
        validationNote =
          gain > 0.12
            ? `Validated transfer: ${input.behaviour} rose ${gain.toFixed(2)} from baseline to unseen practice.`
            : gain < -0.12
              ? `Validated comparison shows ${input.behaviour} lower in unseen practice (${gain.toFixed(2)}).`
              : `Validated comparison shows little change (${gain === null ? "n/a" : gain.toFixed(2)}) — transfer not yet demonstrated.`;
      }
    }

    const phase: TransferPhase = !baseline
      ? "baseline"
      : !challengeCompleted
        ? "challenge"
        : !reflection
          ? "reflection"
          : !unseen
            ? "unseen-practice"
            : "analysis";

    records.push({
      id: `transfer:${input.skillId}:${input.behaviour}:${attempt.id}`,
      skillId: input.skillId,
      behaviour: input.behaviour,
      createdAt: attempt.assignedAt,
      baselineScore,
      baselineEvaluationId: baseline?.id ?? null,
      challengeAttemptId: attempt.id,
      challengeCompleted,
      reflectionId: reflection?.id ?? null,
      perceivedOutcome: (reflection?.attempted as TransferRecord["perceivedOutcome"]) ?? attempt.outcome ?? null,
      perceivedDifficulty: reflection?.difficulty ?? attempt.perceivedDifficulty ?? null,
      unseenPracticeEvaluationId: unseen?.id ?? null,
      unseenScore,
      gain,
      validated: validated && gain !== null && gain > 0.08,
      validationNote,
      phase,
      updatedAt: now,
    });
  }

  return records;
}

export interface TransferLoopSummary {
  skillId: Id;
  behaviour: BehaviourKey;
  records: TransferRecord[];
  totalAttempts: number;
  completedAttempts: number;
  reflectedAttempts: number;
  validatedTransfers: number;
  meanGain: number | null;
  headline: string;
}

export function summariseTransfer(records: TransferRecord[], skillId: Id, behaviour: BehaviourKey): TransferLoopSummary {
  const totalAttempts = records.length;
  const completedAttempts = records.filter((r) => r.challengeCompleted).length;
  const reflectedAttempts = records.filter((r) => r.reflectionId !== null).length;
  const validatedTransfers = records.filter((r) => r.validated).length;
  const gains = records.flatMap((r) => (r.gain === null ? [] : [r.gain]));
  const meanGain = gains.length ? Number((gains.reduce((a, b) => a + b, 0) / gains.length).toFixed(3)) : null;
  let headline: string;
  if (validatedTransfers > 0) {
    headline = `${validatedTransfers} validated transfer${validatedTransfers === 1 ? "" : "s"} for ${behaviour} — mean gain ${meanGain === null ? "n/a" : meanGain.toFixed(2)}.`;
  } else if (totalAttempts === 0) {
    headline = "No real-world attempts yet — transfer cannot be assessed.";
  } else if (completedAttempts === 0) {
    headline = "Real-world challenges assigned but not yet completed.";
  } else if (reflectedAttempts === 0) {
    headline = "Challenges completed but not yet reflected on.";
  } else {
    const pending = records.filter((r) => !r.validated).length;
    headline = `${pending} loop${pending === 1 ? "" : "s"} awaiting unseen practice on a different scenario — no transfer claimed until independently validated.`;
  }
  return { skillId, behaviour, records, totalAttempts, completedAttempts, reflectedAttempts, validatedTransfers, meanGain, headline };
}

// ---------------------------------------------------------------------------
// Challenge lifecycle helpers
// ---------------------------------------------------------------------------

export interface ChallengeLifecycleEvent {
  kind: "assigned" | "completed" | "reflected" | "follow-up-scored";
  at: IsoInstant;
  attemptId: Id;
  detail: string;
}

export function challengeLifecycle(attempt: ChallengeAttempt, reflection: Reflection | null, followUpEvaluation: SimulationEvaluation | null): ChallengeLifecycleEvent[] {
  const events: ChallengeLifecycleEvent[] = [{ kind: "assigned", at: attempt.assignedAt, attemptId: attempt.id, detail: `Challenge "${attempt.challenge.objective}" assigned.` }];
  if (attempt.completedAt) {
    events.push({ kind: "completed", at: attempt.completedAt, attemptId: attempt.id, detail: `Marked ${attempt.outcome ?? "completed"}${attempt.perceivedDifficulty !== undefined ? `, difficulty ${attempt.perceivedDifficulty}/5` : ""}.` });
  }
  if (reflection) {
    const signal = extractSignals(reflection);
    events.push({
      kind: "reflected",
      at: reflection.createdAt,
      attemptId: attempt.id,
      detail: `Reflected: ${signal.behavioursMentioned.length ? signal.behavioursMentioned.join(", ") : "no specific behaviour named"}; appraisal ${signal.selfAppraisal.toFixed(2)}; obstacles: ${signal.obstacles.join(", ") || "none reported"}.`,
    });
  }
  if (followUpEvaluation) {
    events.push({ kind: "follow-up-scored", at: followUpEvaluation.createdAt, attemptId: attempt.id, detail: `Unseen practice scored (${followUpEvaluation.scores.length} behaviours, ${followUpEvaluation.scores.filter((s) => s.reliable).length} reliable).` });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------------------
// Delayed transfer and persistence.
//
// An immediate gain can be session warmth — the same conversation, minutes
// later, with the technique still loaded. Whether practice stuck is a question
// about a *later* conversation, on a scenario that is unseen again, after real
// time has passed. Until that check exists the loop reports "in progress"
// rather than claiming persistence it cannot see.
// ---------------------------------------------------------------------------

/** Minimum days between unseen practice and a later check for delay to be meaningful. */
export const DELAYED_CHECK_DAYS = 14;
/** Gain over baseline considered retained at the delayed check (noise floor). */
const PERSISTENCE_MARGIN = 0.03;

export interface DelayedCheck {
  behaviour: BehaviourKey;
  baselineScore: number | null;
  unseenScore: number | null;
  laterScore: number | null;
  /** Days between unseen practice and the later check; null when no check yet. */
  daysLater: number | null;
  /**
   * true = improvement over baseline held at the delayed check;
   * false = it faded back to baseline or below; null = not yet checkable.
   */
  persisted: boolean | null;
  note: string;
}

/**
 * Re-check a completed transfer loop at a delay.
 *
 * The later conversation must be on a scenario different from both the
 * baseline and the unseen-practice scenarios — otherwise the second gain could
 * be memory of the first rather than the skill.
 */
export function delayedTransferCheck(
  input: { evaluations: SimulationEvaluation[]; simulations: Simulation[] },
  record: TransferRecord,
  minDays = DELAYED_CHECK_DAYS,
): DelayedCheck {
  const base = { behaviour: record.behaviour, baselineScore: record.baselineScore, unseenScore: record.unseenScore };
  if (record.unseenPracticeEvaluationId === null || record.unseenScore === null) {
    return { ...base, laterScore: null, daysLater: null, persisted: null, note: "No unseen practice yet — nothing to re-check at a delay." };
  }
  const unseen = input.evaluations.find((e) => e.id === record.unseenPracticeEvaluationId);
  if (!unseen) {
    return { ...base, laterScore: null, daysLater: null, persisted: null, note: "Unseen-practice evaluation missing — delayed check unavailable." };
  }
  const unseenSim = findSimulation(input.simulations, unseen.simulationId);
  const unseenScenarioId = unseenSim?.scenarioId ?? null;
  const baselineEval = input.evaluations.find((e) => e.id === record.baselineEvaluationId);
  const baselineScenarioId = baselineEval ? findSimulation(input.simulations, baselineEval.simulationId)?.scenarioId ?? null : null;

  const cutoffMs = Date.parse(unseen.createdAt) + minDays * 86_400_000;
  const later = input.evaluations
    .filter((e) => e.createdAt >= unseen.createdAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .find((e) => {
      if (Date.parse(e.createdAt) < cutoffMs) return false;
      const sim = findSimulation(input.simulations, e.simulationId);
      if (!sim) return false;
      // Different from the unseen scenario, and from the baseline's when known.
      if (sim.scenarioId === unseenScenarioId) return false;
      if (baselineScenarioId !== null && sim.scenarioId === baselineScenarioId) return false;
      return behaviourScore(e, record.behaviour) !== null;
    });

  const laterScore = later ? behaviourScore(later, record.behaviour) : null;
  if (!later || laterScore === null) {
    return {
      ...base,
      laterScore: null,
      daysLater: null,
      persisted: null,
      note: `Awaiting another new-scenario conversation at least ${minDays} days later to check whether the change held.`,
    };
  }

  const daysLater = Math.round((Date.parse(later.createdAt) - Date.parse(unseen.createdAt)) / 86_400_000);
  if (record.baselineScore === null) {
    return { ...base, laterScore, daysLater, persisted: null, note: `Delayed score exists (${daysLater} days later) but the baseline was never established.` };
  }
  const heldVsBaseline = laterScore - record.baselineScore >= PERSISTENCE_MARGIN;
  return {
    ...base,
    laterScore,
    daysLater,
    persisted: heldVsBaseline,
    note: heldVsBaseline
      ? `${record.behaviour} was still above baseline ${daysLater} days later (${laterScore.toFixed(2)} vs ${record.baselineScore.toFixed(2)}) — the change persisted.`
      : `${record.behaviour} returned to around baseline by the ${daysLater}-day check (${laterScore.toFixed(2)} vs ${record.baselineScore.toFixed(2)}) — the gain did not persist.`,
  };
}

// ---------------------------------------------------------------------------
// Specificity: trained vs untrained behaviours.
//
// If every behaviour improves together, the likely cause is comfort with the
// simulator or with being observed — not the training. Transfer is credible
// when the trained behaviour moves more than behaviours the loop never aimed
// at, measured over the same attempts.
// ---------------------------------------------------------------------------

export interface SpecificityReport {
  skillId: Id;
  behaviour: BehaviourKey;
  /** Mean baseline→unseen gain on the trained behaviour. */
  trainedMeanGain: number | null;
  /** Mean gain across other measurable behaviours over the same attempts. */
  untrainedMeanGain: number | null;
  /** Trained exceeds untrained by at least the margin. Null when not computable. */
  specific: boolean | null;
  note: string;
}

const SPECIFICITY_MARGIN = 0.05;

export function trainedVersusUntrained(input: TransferLoopInput): SpecificityReport {
  const trainedRecords = buildTransferRecords(input);
  const gains = trainedRecords.flatMap((r) => (r.gain === null ? [] : [r.gain]));
  const trainedMeanGain = gains.length ? Number((gains.reduce((a, b) => a + b, 0) / gains.length).toFixed(3)) : null;

  const untrainedGains: number[] = [];
  for (const behaviour of BEHAVIOUR_KEYS) {
    if (behaviour === input.behaviour) continue;
    const records = buildTransferRecords({ ...input, behaviour });
    for (const r of records) if (r.gain !== null) untrainedGains.push(r.gain);
  }
  const untrainedMeanGain = untrainedGains.length
    ? Number((untrainedGains.reduce((a, b) => a + b, 0) / untrainedGains.length).toFixed(3))
    : null;

  let specific: boolean | null = null;
  let note = "Not enough paired scores yet to compare trained and untrained movement.";
  if (trainedMeanGain !== null && untrainedMeanGain !== null) {
    specific = trainedMeanGain - untrainedMeanGain >= SPECIFICITY_MARGIN;
    note = specific
      ? `Trained behaviour moved +${trainedMeanGain.toFixed(2)} versus +${untrainedMeanGain.toFixed(2)} on untrained ones — the change tracks what was practised.`
      : `Trained behaviour (+${trainedMeanGain.toFixed(2)}) did not move more than untrained ones (+${untrainedMeanGain.toFixed(2)}) — treat the gain cautiously until it does.`;
  } else if (trainedMeanGain !== null) {
    note = "Trained-behaviour gain exists but no untrained behaviour produced comparable scores yet.";
  }
  return { skillId: input.skillId, behaviour: input.behaviour, trainedMeanGain, untrainedMeanGain, specific, note };
}

// ---------------------------------------------------------------------------
// Over-formulaic drift.
//
// Coaching names example phrases. Some users then run every conversation as a
// sequence of those examples — the metric rises while the underlying skill
// stiffens. This measures the stiffness from transcripts alone: opener
// repetition, coached-marker density and reply-length uniformity.
// ---------------------------------------------------------------------------

const FORMULAIC_MARKERS = [
  "that sounds", "i hear you", "that makes sense", "no wonder",
  "speaking of", "fair enough", "i can see why", "so you're saying",
];

/** 0-1 per transcript; high means scripted-feeling replies. Pure heuristic, labelled as one. */
export function formulaicityIndex(simulation: Simulation): number {
  const userTurns = [...simulation.turns]
    .filter((turn) => turn.speaker === "user")
    .sort((a, b) => a.index - b.index);
  if (userTurns.length < 3) return 0;

  const tokens = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  // Opener repetition: share of turns starting with the same two words.
  const openers = new Map<string, number>();
  for (const turn of userTurns) {
    const words = tokens(turn.text);
    if (words.length < 3) continue;
    const opener = words.slice(0, 2).join(" ");
    openers.set(opener, (openers.get(opener) ?? 0) + 1);
  }
  const topOpenerShare = openers.size === 0 ? 0 : Math.max(...openers.values()) / userTurns.length;

  // Coached-marker density: share of turns containing any stock phrase.
  const markerTurns = userTurns.filter((turn) => {
    const lower = turn.text.toLowerCase();
    return FORMULAIC_MARKERS.some((marker) => lower.includes(marker));
  }).length / userTurns.length;

  // Length uniformity: near-identical reply lengths suggest a template.
  const lengths = userTurns.map((turn) => tokens(turn.text).length);
  const meanLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const sd = Math.sqrt(lengths.reduce((sum, len) => sum + (len - meanLength) ** 2, 0) / lengths.length);
  const uniformity = Math.max(0, Math.min(1, 1 - sd / 10));

  const index = 0.4 * topOpenerShare + 0.4 * markerTurns + 0.2 * uniformity;
  return Number(Math.max(0, Math.min(1, index)).toFixed(3));
}

export interface FormulaicTrend {
  recentMean: number | null;
  earlierMean: number | null;
  direction: "rising" | "falling" | "stable" | "unknown";
  flagged: boolean;
  note: string;
}

/**
 * Whether formulaicity is rising across the session history.
 *
 * Flagged deliberately conservatively — a rising index is a prompt to vary the
 * coaching examples, never an accusation, and it needs both halves of the
 * history before it says anything.
 */
export function overFormulaicTrend(simulations: Simulation[], riseThreshold = 0.1): FormulaicTrend {
  const ordered = [...simulations].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  if (ordered.length < 4) {
    return { recentMean: null, earlierMean: null, direction: "unknown", flagged: false, note: "Not enough conversations yet to see any pattern." };
  }
  const half = Math.floor(ordered.length / 2);
  const earlier = ordered.slice(0, half).map(formulaicityIndex);
  const recent = ordered.slice(half).map(formulaicityIndex);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const earlierMean = Number(mean(earlier).toFixed(3));
  const recentMean = Number(mean(recent).toFixed(3));
  const delta = recentMean - earlierMean;
  const direction = delta > riseThreshold ? "rising" : delta < -riseThreshold ? "falling" : "stable";
  const flagged = direction === "rising" && recentMean >= 0.5;
  const note = flagged
    ? "Recent conversations have become noticeably more templated. Worth varying how you open and respond — the aim is judgement, not recitation."
    : direction === "rising"
      ? "Replies are getting somewhat more uniform, though not worryingly so."
      : direction === "falling"
        ? "Replies are becoming less templated over time."
        : "Reply style shows no strong drift toward templates.";
  return { recentMean, earlierMean, direction, flagged, note };
}
