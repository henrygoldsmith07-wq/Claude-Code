/**
 * Personal experiment design.
 *
 * Three designs, chosen for what a single person can actually run:
 *
 *  - `crossover` — alternate conditions in blocks. The default, because it
 *    removes the biggest confounder in personal data (you, changing over
 *    time) by measuring both conditions in every phase.
 *  - `ab` — randomise condition per eligible day. Simple, but vulnerable to
 *    drift when a period is short.
 *  - `before-after` — only when a condition genuinely cannot be alternated.
 *    Weakest by far, and the design says so.
 *
 * The sample requirement is computed from the predicted effect, not chosen for
 * convenience: an experiment that cannot detect what it is looking for wastes
 * two weeks and produces a false "no effect".
 */

import { hash128 } from "../events/hash.js";
import { addDays, daysBetween } from "../events/time.js";
import { createRng } from "../statistics/random.js";
import { minSamplePaired, minSamplePerGroup } from "../statistics/power.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { StoppingConfig, StoppingConfigInput } from "./stopping.js";

export type ExperimentType = "crossover" | "ab" | "before-after";

export interface Condition {
  id: "A" | "B";
  label: string;
  /** What the user actually does. Must be unambiguous enough to follow. */
  instruction: string;
  /**
   * The behaviour slot this condition occupies (P1 #9, mutually-exclusive
   * tier) — e.g. "morning-routine", "caffeine", "sleep-window". Two live
   * experiments assigning conditions in the same slot on the same day are a
   * conflict even when they measure different metrics, because the user
   * cannot follow both. Asserted by the experiment author — nothing is
   * inferred from free-text instructions, so a condition without a slot can
   * never be proven exclusive.
   */
  behaviour?: string;
}

export interface Assignment {
  date: string;
  /** Null during a washout, when no condition applies. */
  condition: "A" | "B" | null;
  /** Block index for crossover designs; washout days keep the block they follow. */
  block: number;
}

/**
 * One measured outcome of an experiment (P1 #12). The primary carries the
 * success criterion; secondaries are reported and family-corrected, never
 * allowed to flip the verdict.
 */
export interface ExperimentOutcome {
  metricId: string;
  predictedDirection: "increase" | "decrease";
  /** Standardised effect predicted, registered up front. */
  predictedEffect: number;
  role: "primary" | "secondary";
}

/** What the user does on a washout day: nothing but record the outcome. */
export const WASHOUT_INSTRUCTION = "No condition — record the outcome only.";

/** What the user does during the baseline lead-in: measure without touching anything. */
export const BASELINE_INSTRUCTION = "Record the outcome as usual — no condition applies yet.";

/** Baseline is kept short so it cannot inflate the perceived run length. */
export const BASELINE_MAX_DAYS = 7;

/**
 * Longest accepted outcome lag. Outcomes are assumed to land the day after
 * the behaviour at most; beyond a week the pair stops meaning anything.
 */
export const OUTCOME_LAG_MAX_DAYS = 7;

/**
 * Most outcomes an experiment may register (P1 #12). One person's controlled
 * test can honestly measure a handful of things; beyond five the family
 * correction over-corrects and the design stops being about anything.
 */
export const MAX_OUTCOMES = 5;

export interface ExperimentDesign {
  id: string;
  hypothesisId: string;
  createdAt: string;
  type: ExperimentType;
  title: string;
  /** Restated hypothesis, in the experiment's own terms. */
  hypothesis: string;
  conditionA: Condition;
  conditionB: Condition;
  targetMetricId: string;
  /** Sessions needed *per condition* for the predicted effect at 80% power. */
  minSamplePerCondition: number;
  durationDays: number;
  /** Days per block in a crossover. */
  blockDays: number;
  /** Null-condition days between crossover blocks; 0 when off. Always set by
   * `designExperiment`; optional so pre-existing records stay valid. */
  washoutDays?: number;
  /** Null-condition days before the first assignment; 0 when off. Always set
   * by `designExperiment`; optional so pre-existing records stay valid. */
  baselineDays?: number;
  /** The sessions-per-week the duration was sized from; the adaptive-duration
   * rule (P1 #4) compares the observed rate against this. Always set by
   * `designExperiment`; optional so pre-existing records stay valid. */
  assumedSessionsPerWeek?: number;
  /** Pre-registered early stopping rules (P1 #5): only a rule present here may
   * stop a live run, with its thresholds resolved. `{}` when off. Always set by
   * `designExperiment`; optional so pre-existing records stay valid. */
  stopping?: StoppingConfig;
  /** Days between the assignment and the outcome that reflects it (P1 #11);
   * 0 = today's outcome. Always set by `designExperiment`; optional so
   * pre-existing records stay valid. */
  outcomeLagDays?: number;
  /** Every measured outcome (P1 #12): the hypothesis's metric as primary, the
   * rest as secondaries. Always set by `designExperiment`; optional so
   * pre-existing records stay valid. */
  outcomes?: ExperimentOutcome[];
  /** The analysed design this one replicates (P1 #13); absent for a fresh design. */
  replicatedFromDesignId?: string;
  startDate: string;
  endDate: string;
  assignments: Assignment[];
  likelyConfounders: string[];
  analysisMethod: string;
  successCriteria: string;
  /** Seed for the assignment schedule — makes the design reproducible. */
  seed: string;
  /** Things that would invalidate the run, checked at analysis time. */
  invalidations: string[];
}

export interface DesignOptions {
  type?: ExperimentType;
  startDate: string;
  /** Expected eligible sessions per week; drives the duration calculation. */
  sessionsPerWeek?: number;
  blockDays?: number;
  /** Days of no condition between crossover blocks, to let carry-over decay.
   * Crossover only; capped at `blockDays` so it cannot double the run. */
  washoutDays?: number;
  /** Days of no condition before the first assignment, to record the starting
   * level and drift before any intervention. Capped at `BASELINE_MAX_DAYS`. */
  baselineDays?: number;
  /** Overrides the power-derived sample requirement. Use sparingly. */
  minSamplePerCondition?: number;
  /** Pre-registered early stopping rules (P1 #5-8): futility, low-adherence
   * and data-quality. Only rules present here may stop the run — a rule that
   * appears after the run started is rationalisation, not a rule. Fields are
   * optional; defaults are resolved onto the stored design record. */
  stopping?: StoppingConfigInput;
  /** Days between the assignment and the outcome that reflects it (P1 #11);
   * 0 = today's outcome. Sleep measured the morning after is 1. */
  outcomeLagDays?: number;
  /** Additional outcomes beyond the hypothesis's own (which stays primary).
   * Each carries its own predicted direction and size; all are analysed with
   * the within-family Benjamini-Hochberg correction, and only the primary may
   * drive the verdict (P1 #12). */
  outcomes?: Array<{
    metricId: string;
    predictedDirection: "increase" | "decrease";
    predictedEffect: number;
  }>;
  seed?: string;
  now?: () => number;
  conditionA?: Partial<Condition>;
  conditionB?: Partial<Condition>;
  maxDurationDays?: number;
}

export function designExperiment(hypothesis: Hypothesis, options: DesignOptions): ExperimentDesign {
  const now = options.now ?? Date.now;
  const type = options.type ?? "crossover";
  const sessionsPerWeek = options.sessionsPerWeek ?? 4;
  const blockDays = options.blockDays ?? 7;
  const washoutDays = options.washoutDays ?? 0;
  const baselineDays = options.baselineDays ?? 0;
  const seed = options.seed ?? `${hypothesis.id}:${options.startDate}`;

  // Predicted effects below 0.2 SD would demand hundreds of sessions; clamp so
  // the design stays honest about what it can detect rather than proposing a
  // two-year experiment.
  const effect = Math.max(0.25, hypothesis.predictedEffect);
  const perCondition =
    options.minSamplePerCondition ??
    (type === "crossover" ? minSamplePaired(effect) : minSamplePerGroup(effect));

  const totalSessions = perCondition * 2;
  const rawDays = Math.ceil((totalSessions / sessionsPerWeek) * 7);
  const maxDuration = options.maxDurationDays ?? 56;
  const durationDays = Math.min(maxDuration, Math.max(14, roundToBlocks(rawDays, type === "crossover" ? blockDays : 1)));

  // A washout only makes sense where blocks meet; on A/B or before-after it
  // would be a silent no-op, so refuse it rather than pretend it happened.
  if (washoutDays > 0 && type !== "crossover") {
    throw new Error(`washoutDays only applies to crossover designs, not ${type}.`);
  }
  // Capped at one block so the gap cannot double the run length.
  const clampedWashout = Math.max(0, Math.min(washoutDays, blockDays));
  // A lag beyond a week would pair today's behaviour with a different week's
  // outcome; clamp rather than silently accept it.
  const outcomeLagDays = Math.max(0, Math.min(options.outcomeLagDays ?? 0, OUTCOME_LAG_MAX_DAYS));
  const stopping = resolveStoppingConfig(options.stopping);
  // A lead-in is only informative when it stays short — beyond a week it is
  // just a longer run with a weaker design.
  const clampedBaseline = Math.max(0, Math.min(baselineDays, BASELINE_MAX_DAYS));

  // Multi-outcome registration (P1 #12): the primary is always the
  // hypothesis's own outcome; everything else is a secondary with its own
  // prediction. Duplicates are refused (a metric cannot be measured twice in
  // one run) and the family is capped so the correction stays meaningful.
  const requestedSecondaries = options.outcomes ?? [];
  if (requestedSecondaries.length + 1 > MAX_OUTCOMES) {
    throw new Error(`An experiment can register at most ${MAX_OUTCOMES} outcomes (${MAX_OUTCOMES - 1} secondaries).`);
  }
  const seenMetrics = new Set<string>([hypothesis.outcomeMetricId]);
  for (const secondary of requestedSecondaries) {
    if (seenMetrics.has(secondary.metricId)) {
      throw new Error(`Outcome "${secondary.metricId}" is registered more than once in this experiment.`);
    }
    seenMetrics.add(secondary.metricId);
  }
  const outcomes: ExperimentOutcome[] = [
    {
      metricId: hypothesis.outcomeMetricId,
      predictedDirection: hypothesis.predictedDirection,
      predictedEffect: effect,
      role: "primary",
    },
    ...requestedSecondaries.map((secondary) => ({
      metricId: secondary.metricId,
      predictedDirection: secondary.predictedDirection,
      // Same floor as the primary: a prediction below 0.25 SD cannot be
      // tested by one person's experiment, so the honest record is the
      // smallest effect the design can actually detect.
      predictedEffect: Math.sign(secondary.predictedEffect) * Math.max(0.25, Math.abs(secondary.predictedEffect)),
      role: "secondary" as const,
    })),
  ];

  const conditionA: Condition = {
    id: "A",
    label: options.conditionA?.label ?? "Intervention",
    instruction: options.conditionA?.instruction ?? `Deliberately do the behaviour under test before each session.`,
    // Behaviour slot for the mutually-exclusive conflict tier (P1 #9) —
    // carried through when the author declares one, never inferred.
    ...(options.conditionA?.behaviour ? { behaviour: options.conditionA.behaviour } : {}),
  };
  const conditionB: Condition = {
    id: "B",
    label: options.conditionB?.label ?? "Control",
    instruction: options.conditionB?.instruction ?? `Keep everything else the same, but do not do the behaviour under test.`,
    ...(options.conditionB?.behaviour ? { behaviour: options.conditionB.behaviour } : {}),
  };

  const assignments = buildAssignments(type, options.startDate, durationDays, blockDays, seed, clampedWashout, clampedBaseline);
  const washoutGaps = type === "crossover" && clampedWashout > 0 ? Math.max(2, Math.floor(durationDays / blockDays)) - 1 : 0;
  const endDate = addDays(options.startDate, clampedBaseline + durationDays - 1 + clampedWashout * washoutGaps);

  const analysisMethod =
    type === "crossover"
      ? "Paired comparison of per-block means (Wilcoxon signed-rank, with a paired t-test reported alongside)"
      : type === "ab"
        ? "Two-sample comparison of session values (Welch's t-test, or Mann-Whitney when samples are small or skewed)"
        : "Two-sample comparison of the before and after periods, with a trend check to separate the change from drift";

  return {
    id: `exp-${hash128(`${hypothesis.id}:${type}:${options.startDate}`).slice(0, 16)}`,
    hypothesisId: hypothesis.id,
    createdAt: new Date(now()).toISOString(),
    type,
    title: `${type === "crossover" ? "Crossover" : type === "ab" ? "A/B" : "Before/after"} test: ${hypothesis.outcomeMetricId}`,
    hypothesis: hypothesis.statement,
    conditionA,
    conditionB,
    targetMetricId: hypothesis.outcomeMetricId,
    minSamplePerCondition: perCondition,
    durationDays,
    blockDays,
    washoutDays: clampedWashout,
    baselineDays: clampedBaseline,
    assumedSessionsPerWeek: sessionsPerWeek,
    stopping,
    outcomeLagDays,
    outcomes,
    startDate: options.startDate,
    endDate,
    assignments,
    likelyConfounders: [
      ...hypothesis.knownConfounders,
      ...(type === "before-after"
        ? ["General improvement over the period", "Anything else that changed between the two halves"]
        : ["Carry-over between blocks", "Days where you could not follow the assignment"]),
    ],
    analysisMethod,
    successCriteria: buildSuccessCriteria(hypothesis, perCondition),
    seed,
    invalidations: [
      `Fewer than ${perCondition} sessions in either condition`,
      "Adherence below 70% of assigned days",
      "A change in circumstances that affects both conditions unequally (illness, exams, travel)",
    ],
  };
}

// --- early stopping pre-registration (P1 #5) -----------------------------

/** Conditional-power floor below which a futility stop fires. */
export const DEFAULT_FUTILITY_FLOOR = 0.2;
/** Minimum share of the planned sample before futility is even evaluated. */
export const DEFAULT_FUTILITY_MIN_SAMPLE_FRACTION = 0.5;
/** Projected final adherence below which an adherence stop fires. */
export const DEFAULT_ADHERENCE_FLOOR = 0.4;
/** Minimum elapsed assigned days before an adherence stop is evaluated. */
export const DEFAULT_ADHERENCE_MIN_ASSIGNED_DAYS = 7;
/** Worst contributing source score below which a quality stop fires. */
export const DEFAULT_QUALITY_FLOOR = 0.45;
/** Minimum elapsed days of the run before a quality stop is evaluated. */
export const DEFAULT_QUALITY_MIN_ELAPSED_DAYS = 7;

/**
 * Fills in the defaults for each pre-registered stopping rule. A rule the
 * caller did not pre-register stays out — only a rule present in the resolved
 * config may stop a run, and the thresholds it can stop by are stored on the
 * design record itself rather than hidden in a default somewhere.
 */
export function resolveStoppingConfig(config: StoppingConfigInput | undefined): StoppingConfig {
  if (!config) return {};
  const resolved: StoppingConfig = {};
  if (config.futility) {
    resolved.futility = {
      conditionalPowerFloor: DEFAULT_FUTILITY_FLOOR,
      minSampleFraction: DEFAULT_FUTILITY_MIN_SAMPLE_FRACTION,
      ...config.futility,
    };
  }
  if (config.adherence) {
    resolved.adherence = {
      minAdherence: DEFAULT_ADHERENCE_FLOOR,
      minAssignedDays: DEFAULT_ADHERENCE_MIN_ASSIGNED_DAYS,
      ...config.adherence,
    };
  }
  if (config.quality) {
    resolved.quality = {
      minQuality: DEFAULT_QUALITY_FLOOR,
      minElapsedDays: DEFAULT_QUALITY_MIN_ELAPSED_DAYS,
      ...config.quality,
    };
  }
  return resolved;
}

function roundToBlocks(days: number, blockDays: number): number {
  if (blockDays <= 1) return days;
  // Always an even number of blocks, so both conditions get equal exposure.
  const blocks = Math.max(2, Math.ceil(days / blockDays));
  return (blocks % 2 === 0 ? blocks : blocks + 1) * blockDays;
}

/**
 * Assignment schedule.
 *
 * Crossover randomises only *which condition starts*; the alternation is then
 * fixed, which is what makes the design balanced against time trends. A/B
 * randomises per day with a balance constraint so a short run cannot end up
 * 11-3.
 */
export function buildAssignments(
  type: ExperimentType,
  startDate: string,
  durationDays: number,
  blockDays: number,
  seed: string,
  /** Null-condition days between crossover blocks. Crossover only. */
  washoutDays = 0,
  /** Null-condition days before the first assignment, for any type. */
  baselineDays = 0,
): Assignment[] {
  const rng = createRng(seed);
  const assignments: Assignment[] = [];

  // The baseline lead-in records the starting level before any condition is
  // applied; it belongs to no block.
  for (let day = 0; day < baselineDays; day += 1) {
    assignments.push({ date: addDays(startDate, day), condition: null, block: 0 });
  }

  if (type === "crossover") {
    const startWithA = rng.next() < 0.5;
    const blocks = Math.max(2, Math.floor(durationDays / blockDays));
    let day = baselineDays;
    for (let block = 0; block < blocks; block += 1) {
      const isFirstOfPair = block % 2 === 0;
      const condition: "A" | "B" = isFirstOfPair === startWithA ? "A" : "B";
      for (let offset = 0; offset < blockDays; offset += 1, day += 1) {
        assignments.push({ date: addDays(startDate, day), condition, block });
      }
      // A washout sits between blocks: no condition applies, but the outcome
      // is still recorded so the analysis can measure the hangover.
      if (washoutDays > 0 && block < blocks - 1) {
        for (let gap = 0; gap < washoutDays; gap += 1, day += 1) {
          assignments.push({ date: addDays(startDate, day), condition: null, block });
        }
      }
    }
    return assignments;
  }

  if (type === "before-after") {
    const half = Math.floor(durationDays / 2);
    for (let day = 0; day < durationDays; day += 1) {
      assignments.push({ date: addDays(startDate, baselineDays + day), condition: day < half ? "B" : "A", block: day < half ? 0 : 1 });
    }
    return assignments;
  }

  // A/B: shuffle a balanced pool so the split is exact.
  const pool: ("A" | "B")[] = [];
  for (let i = 0; i < durationDays; i += 1) pool.push(i % 2 === 0 ? "A" : "B");
  const shuffled = rng.shuffle(pool);
  for (let day = 0; day < durationDays; day += 1) {
    assignments.push({ date: addDays(startDate, baselineDays + day), condition: shuffled[day]!, block: 0 });
  }
  return assignments;
}

/**
 * One-click replication (P1 #13). Clones an analysed design — conditions,
 * outcomes, analysis method, success criteria and structure (block length,
 * washout, baseline, lag, stopping) — and re-derives the sample from the
 * *observed* effect of the original run, so a replication is sized to what
 * was actually seen rather than the original prediction. The clone gets a
 * fresh id, seed and start date, and carries the link back to the original —
 * the paper trail the replication ledger's retested path runs on.
 */
export function replicateDesign(
  original: ExperimentDesign,
  options: {
    startDate: string;
    /** Observed standardised effect of the original run — sizes the replication. */
    observedEffect: number;
    seed?: string;
    now?: () => number;
  },
): ExperimentDesign {
  const now = options.now ?? Date.now;
  const seed = options.seed ?? `${original.seed}:replicate:${options.startDate}`;
  const type = original.type;
  const blockDays = original.blockDays ?? 7;
  const washoutDays = original.washoutDays ?? 0;
  const baselineDays = original.baselineDays ?? 0;
  const sessionsPerWeek = original.assumedSessionsPerWeek ?? 4;

  // Sized to reproduce what the original actually found: a strong observed
  // effect needs fewer sessions, a weak one many more. The same 0.25 floor as
  // design time applies — nothing smaller can be detected in a reasonable
  // run, whatever the observation suggested.
  const effect = Math.max(0.25, Math.abs(options.observedEffect));
  const perCondition = type === "crossover" ? minSamplePaired(effect) : minSamplePerGroup(effect);

  const totalSessions = perCondition * 2;
  const rawDays = Math.ceil((totalSessions / sessionsPerWeek) * 7);
  const durationDays = Math.min(56, Math.max(14, roundToBlocks(rawDays, type === "crossover" ? blockDays : 1)));

  const assignments = buildAssignments(type, options.startDate, durationDays, blockDays, seed, washoutDays, baselineDays);
  const washoutGaps = type === "crossover" && washoutDays > 0 ? Math.max(2, Math.floor(durationDays / blockDays)) - 1 : 0;
  const endDate = addDays(options.startDate, baselineDays + durationDays - 1 + washoutDays * washoutGaps);

  return {
    id: `exp-${hash128(`${original.id}:replicate:${options.startDate}:${seed}`).slice(0, 16)}`,
    hypothesisId: original.hypothesisId,
    createdAt: new Date(now()).toISOString(),
    type,
    title: original.title,
    hypothesis: original.hypothesis,
    conditionA: original.conditionA,
    conditionB: original.conditionB,
    targetMetricId: original.targetMetricId,
    minSamplePerCondition: perCondition,
    durationDays,
    blockDays,
    washoutDays,
    baselineDays,
    assumedSessionsPerWeek: sessionsPerWeek,
    stopping: original.stopping,
    outcomeLagDays: original.outcomeLagDays,
    outcomes: original.outcomes,
    replicatedFromDesignId: original.id,
    startDate: options.startDate,
    endDate,
    assignments,
    likelyConfounders: original.likelyConfounders,
    analysisMethod: original.analysisMethod,
    successCriteria: buildReplicationCriteria(original, perCondition, effect),
    seed,
    invalidations: original.invalidations,
  };
}

/**
 * The replication's success criteria, rebuilt for the new sample and judged
 * against the effect the original actually found — reproducing a much smaller
 * effect is inconclusive, not support.
 */
function buildReplicationCriteria(original: ExperimentDesign, perCondition: number, effect: number): string {
  const primary = (original.outcomes ?? []).find((outcome) => outcome.role === "primary");
  const direction = primary?.predictedDirection ?? "increase";
  const directionWord = direction === "increase" ? "higher" : "lower";
  return [
    `At least ${perCondition} qualifying sessions in each condition.`,
    `Condition A is ${directionWord} than condition B, with a 95% confidence interval that excludes zero.`,
    `The observed effect is at least half the ${effect.toFixed(2)} SD found in the original run — a replication that comes back much smaller is inconclusive, not support.`,
  ].join(" ");
}

function buildSuccessCriteria(hypothesis: Hypothesis, perCondition: number): string {
  const direction = hypothesis.predictedDirection === "increase" ? "higher" : "lower";
  return [
    `At least ${perCondition} qualifying sessions in each condition.`,
    `Condition A is ${direction} than condition B, with a 95% confidence interval that excludes zero.`,
    `The observed effect is at least half the predicted ${hypothesis.predictedEffect.toFixed(2)} SD — a detectable but trivial difference counts as inconclusive, not as support.`,
  ].join(" ");
}

export function conditionForDate(design: ExperimentDesign, date: string): "A" | "B" | null {
  return conditionForDateFrom(design.assignments, date);
}

/**
 * The assigned day an outcome observation dated `date` reflects, under the
 * design's lag (P1 #11): a rating recorded the morning after belongs to the
 * previous day's assignment. Explicit pairing — never by row position.
 */
export function assignmentDateForOutcome(design: ExperimentDesign, date: string): string {
  return addDays(date, -(design.outcomeLagDays ?? 0));
}

/** Every metric this experiment measures, primary first (P1 #12). */
export function outcomeMetricIds(design: ExperimentDesign): string[] {
  const fromOutcomes = (design.outcomes ?? []).map((outcome) => outcome.metricId);
  return fromOutcomes.length > 0 ? fromOutcomes : [design.targetMetricId];
}

/** Condition on `date` within an arbitrary assignment list (e.g. an extended schedule). */
export function conditionForDateFrom(assignments: readonly Assignment[], date: string): "A" | "B" | null {
  return assignments.find((assignment) => assignment.date === date)?.condition ?? null;
}

/**
 * The schedule a design actually runs under, extended to `endDate`. When the
 * adaptive-duration rule (P1 #4) moves the end date, the extension continues
 * the design's condition pattern — the crossover's block alternation with its
 * washout gaps, strict alternation for A/B, the after condition for
 * before/after — so sessions recorded after the original end still belong to
 * a condition. Days inside the stored schedule are returned untouched.
 */
export function extendedAssignments(design: ExperimentDesign, endDate: string): Assignment[] {
  const totalDays = daysBetween(design.startDate, endDate) + 1;
  if (totalDays <= design.assignments.length) return design.assignments;

  const extra: Assignment[] = [];
  if (design.type === "crossover") {
    for (let day = design.assignments.length; day < totalDays; day += 1) {
      extra.push(crossoverDayAssignment(design, day));
    }
  } else if (design.type === "before-after") {
    for (let day = design.assignments.length; day < totalDays; day += 1) {
      extra.push({ date: addDays(design.startDate, day), condition: "A", block: 1 });
    }
  } else {
    // A/B: the balanced pool is fixed at design time, so the extension keeps
    // the split honest with strict alternation from the last stored day.
    const last = design.assignments[design.assignments.length - 1]!;
    for (let day = design.assignments.length; day < totalDays; day += 1) {
      const previous = extra[extra.length - 1] ?? last;
      extra.push({ date: addDays(design.startDate, day), condition: previous.condition === "A" ? "B" : "A", block: 0 });
    }
  }
  return [...design.assignments, ...extra];
}

/**
 * The assignment the crossover generator would produce for a given day index,
 * for days beyond the stored schedule: baseline, then blocks of `blockDays`
 * with a `washoutDays` gap between every pair, alternating conditions.
 */
function crossoverDayAssignment(design: ExperimentDesign, day: number): Assignment {
  const date = addDays(design.startDate, day);
  const baseline = design.baselineDays ?? 0;
  if (day < baseline) return { date, condition: null, block: 0 };
  const washout = design.washoutDays ?? 0;
  const cycle = design.blockDays + washout;
  const position = day - baseline;
  const block = Math.floor(position / cycle);
  if (position % cycle >= design.blockDays) return { date, condition: null, block };
  const firstCondition = design.assignments.find((assignment) => assignment.condition !== null)?.condition ?? "A";
  const condition = block % 2 === 0 ? firstCondition : firstCondition === "A" ? "B" : "A";
  return { date, condition, block };
}

/**
 * A contiguous stretch of the same condition in a design's schedule. Derived
 * from the assignments, never stored — the derivation is the source of truth,
 * so a period cannot drift from the schedule it names. For a crossover the
 * periods are the blocks; for before-after they are the two halves; for A/B
 * they are the condition runs.
 */
export type ExperimentPeriodKind = "intervention" | "baseline" | "washout";

export interface ExperimentPeriod {
  /** 1-based position within the design. */
  index: number;
  kind: ExperimentPeriodKind;
  /** Null for a baseline or washout period, when no condition applies. */
  condition: "A" | "B" | null;
  /** Condition label plus letter, e.g. "Intervention A"; "Baseline"/"Washout" for no-condition stretches. */
  label: string;
  startDate: string;
  endDate: string;
  dayCount: number;
}

/** A day's position within the period that contains it. */
export interface PeriodPosition {
  period: ExperimentPeriod;
  /** 1-based day within the period. */
  dayInPeriod: number;
}

/**
 * Splits the design's schedule into named periods. A period ends wherever the
 * condition changes, so every assigned date belongs to exactly one period and
 * the periods cover the assignments completely.
 */
export function derivePeriods(design: ExperimentDesign): ExperimentPeriod[] {
  return derivePeriodsFrom(design.assignments, design);
}

/** `derivePeriods` over an arbitrary assignment list (e.g. an extended schedule). */
export function derivePeriodsFrom(assignments: readonly Assignment[], design: ExperimentDesign): ExperimentPeriod[] {
  const byDate = [...assignments].sort((a, b) => a.date.localeCompare(b.date));
  const periods: ExperimentPeriod[] = [];
  for (const assignment of byDate) {
    const current = periods[periods.length - 1];
    if (current && current.condition === assignment.condition) {
      current.endDate = assignment.date;
      current.dayCount += 1;
    } else {
      // A null stretch before any condition is the baseline lead-in; one after
      // is a washout gap. Position, not a stored label, decides — the same
      // derivation-of-truth rule as the periods themselves.
      const kind: ExperimentPeriodKind =
        assignment.condition === null
          ? periods.some((period) => period.condition !== null)
            ? "washout"
            : "baseline"
          : "intervention";
      const label =
        kind === "baseline"
          ? "Baseline"
          : kind === "washout"
            ? "Washout"
            : `${(assignment.condition === "A" ? design.conditionA : design.conditionB).label} ${assignment.condition}`;
      periods.push({
        index: periods.length + 1,
        kind,
        condition: assignment.condition,
        label,
        startDate: assignment.date,
        endDate: assignment.date,
        dayCount: 1,
      });
    }
  }
  return periods;
}

/** The period containing `date`, with the day's 1-based position within it. */
export function periodForDate(design: ExperimentDesign, date: string): PeriodPosition | null {
  return periodForDateFrom(design.assignments, design, date);
}

/** `periodForDate` over an arbitrary assignment list (e.g. an extended schedule). */
export function periodForDateFrom(
  assignments: readonly Assignment[],
  design: ExperimentDesign,
  date: string,
): PeriodPosition | null {
  for (const period of derivePeriodsFrom(assignments, design)) {
    if (date >= period.startDate && date <= period.endDate) {
      return { period, dayInPeriod: daysBetween(period.startDate, date) + 1 };
    }
  }
  return null;
}
