/**
 * Hypothesis tracking.
 *
 * A hypothesis is what turns "I noticed something" into "I predicted this
 * before I looked". Recording the predicted direction and size *before* the
 * experiment runs is the whole point — it is what stops a result being
 * reinterpreted after the fact to match whatever happened.
 *
 * The status machine is deliberately narrow, and `inconclusive` is a
 * first-class terminal state rather than a failure.
 */

import { hash128 } from "../events/hash.js";
import type { Finding } from "../discovery/finding.js";

export type HypothesisStatus =
  | "proposed"
  | "testing"
  | "supported"
  | "refuted"
  | "inconclusive"
  | "abandoned";

export type PredictedDirection = "increase" | "decrease";

export interface StatusChange {
  from: HypothesisStatus | null;
  to: HypothesisStatus;
  at: string;
  reason: string;
}

export interface Hypothesis {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Deterministically worded. The AI layer may restate it, never restate the numbers. */
  statement: string;
  /** Finding that prompted it, when there was one. */
  originFindingId: string | null;
  exposureMetricId: string | null;
  outcomeMetricId: string;
  predictedDirection: PredictedDirection;
  /** Standardised effect predicted, registered up front. */
  predictedEffect: number;
  status: HypothesisStatus;
  history: StatusChange[];
  experimentIds: string[];
  /** Confounders the originating finding could not rule out. */
  knownConfounders: string[];
}

const ALLOWED: Record<HypothesisStatus, HypothesisStatus[]> = {
  proposed: ["testing", "abandoned"],
  testing: ["supported", "refuted", "inconclusive", "abandoned"],
  // A concluded hypothesis can be retested — that is how a personal finding
  // survives contact with a new term, a new job, a new sleep schedule.
  supported: ["testing", "abandoned"],
  refuted: ["testing", "abandoned"],
  inconclusive: ["testing", "abandoned"],
  abandoned: [],
};

export class HypothesisTracker {
  private hypotheses = new Map<string, Hypothesis>();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Builds a hypothesis from a finding. Only findings that actually justify a
   * test are eligible: an effect that dissolved under adjustment produces a
   * null return rather than a hypothesis nobody should spend two weeks on.
   */
  proposeFromFinding(finding: Finding): Hypothesis | null {
    if (finding.nextAction?.kind !== "run-experiment") return null;

    const direction: PredictedDirection = finding.effect.value >= 0 ? "increase" : "decrease";
    const at = new Date(this.now()).toISOString();
    const id = `hyp-${hash128(`${finding.id}:${finding.metricIds.join(",")}`).slice(0, 16)}`;

    const hypothesis: Hypothesis = {
      id,
      createdAt: at,
      updatedAt: at,
      statement: `If I deliberately ${describeIntervention(finding)}, then ${describeOutcome(finding)} will ${direction === "increase" ? "increase" : "decrease"} by about ${Math.abs(finding.effect.value).toFixed(2)} standard deviations.`,
      originFindingId: finding.id,
      exposureMetricId: finding.metricIds[1] ?? null,
      outcomeMetricId: finding.metricIds[0]!,
      predictedDirection: direction,
      predictedEffect: Math.abs(finding.effect.value),
      status: "proposed",
      history: [{ from: null, to: "proposed", at, reason: `Derived from finding "${finding.title}"` }],
      experimentIds: [],
      knownConfounders: finding.confounders.filter((c) => c.status === "uncontrolled").map((c) => c.name),
    };

    this.hypotheses.set(id, hypothesis);
    return hypothesis;
  }

  add(hypothesis: Hypothesis): Hypothesis {
    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  get(id: string): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  list(status?: HypothesisStatus): Hypothesis[] {
    const all = [...this.hypotheses.values()];
    const filtered = status ? all.filter((h) => h.status === status) : all;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  transition(id: string, to: HypothesisStatus, reason: string): Hypothesis {
    const hypothesis = this.hypotheses.get(id);
    if (!hypothesis) throw new Error(`Unknown hypothesis: ${id}`);
    if (!ALLOWED[hypothesis.status].includes(to)) {
      throw new Error(`Cannot move hypothesis ${id} from ${hypothesis.status} to ${to}`);
    }
    const at = new Date(this.now()).toISOString();
    hypothesis.history.push({ from: hypothesis.status, to, at, reason });
    hypothesis.status = to;
    hypothesis.updatedAt = at;
    return hypothesis;
  }

  linkExperiment(id: string, experimentId: string): Hypothesis {
    const hypothesis = this.hypotheses.get(id);
    if (!hypothesis) throw new Error(`Unknown hypothesis: ${id}`);
    if (!hypothesis.experimentIds.includes(experimentId)) hypothesis.experimentIds.push(experimentId);
    hypothesis.updatedAt = new Date(this.now()).toISOString();
    return hypothesis;
  }

  size(): number {
    return this.hypotheses.size;
  }
}

function describeIntervention(finding: Finding): string {
  const action = finding.nextAction?.summary ?? "";
  const match = /schedule sessions (.+?) for/.exec(action);
  if (match) return `schedule sessions ${match[1]}`;
  return finding.title.replace(/^.*? is (higher|lower) /, "arrange sessions ");
}

function describeOutcome(finding: Finding): string {
  return finding.title.split(" is ")[0]?.toLowerCase() ?? "the outcome";
}
