// ---------------------------------------------------------------------------
// The human-validation program, end to end.
//
// The evaluator's scores are a claim about human conversation. The corpus
// modules define the bench; this module runs the program against it:
//
//   1. assemble   — build the corpus from real items and real ratings, never
//                   fabricating a rating to fill a gap;
//   2. staff      — every item needs multiple *independent* raters; single
//                   opinions are listed as gaps, not promoted to references;
//   3. agree      — inter-rater agreement measured per behaviour, not just
//                   overall, so one strong number cannot hide a weak rubric;
//   4. resolve    — disagreements inside the threshold become consensus;
//                   beyond it they are surfaced for adjudication;
//   5. validate   — each behaviour is validated on its own: can humans rate
//                   it reliably, and does the system match them when they can;
//   6. identify   — behaviours humans themselves cannot rate reliably are
//                   named, and stop serving as reference standards;
//   7. revise     — weak rubrics get an explicit remove-or-redesign
//                   recommendation, recorded as a versioned revision rather
//                   than quietly edited.
//
// Pure TypeScript. No I/O, no model calls — same as every domain module here.
// ---------------------------------------------------------------------------

import type { BehaviourKey, Id, IsoInstant } from "./types";
import {
  CORPUS_BEHAVIOURS,
  CORPUS_RUBRIC_VERSION,
  deriveConsensus,
  emptyCorpus,
  isCorpusImportValid,
  validateCorpusImport,
  type CorpusBehaviour,
  type CorpusBenchmark,
  type CorpusConsensus,
  type CorpusItem,
  type CorpusRating,
} from "./corpus";
import {
  agreementReport,
  reliabilityByBehaviour,
  type AgreementReport,
  type BehaviourRaterItem,
  type BehaviourReliability,
} from "./agreement";
import { validateAgainstHuman, type ValidationReport } from "./validation";

export const MIN_INDEPENDENT_RATERS = 2;
export const DEFAULT_MIN_ITEMS_PER_BEHAVIOUR = 20;
export const DEFAULT_MIN_CORPUS_ITEMS = 100;

export const RELIABILITY_THRESHOLDS = {
  strongKappa: 0.6,
  moderateKappa: 0.4,
  tightScoreGap: 0.15,
  acceptableScoreGap: 0.25,
} as const;

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface AssembledCorpus {
  corpus: CorpusBenchmark;
  accepted: boolean;
  issues: { path: string; message: string }[];
}

/**
 * Build a benchmark from imported items and ratings. A payload that fails
 * validation is refused whole — there is no "import the good half", because a
 * partly-unvalidated bench is worse than an empty one.
 */
export function assembleCorpus(payload: unknown, now = new Date().toISOString()): AssembledCorpus {
  const issues = validateCorpusImport(payload).issues;
  if (!isCorpusImportValid(payload)) {
    return { corpus: emptyCorpus(now), accepted: false, issues };
  }
  const imported = payload as Partial<CorpusBenchmark>;
  const fallback = emptyCorpus(now);
  return {
    corpus: {
      version: imported.version ?? fallback.version,
      rubricVersion: imported.rubricVersion as string,
      createdAt: imported.createdAt ?? now,
      items: imported.items ?? [],
      ratings: imported.ratings ?? [],
      consensus: imported.consensus ?? [],
      raters: imported.raters ?? [],
      methodology: imported.methodology ?? fallback.methodology,
    },
    accepted: true,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Coverage — is the corpus large enough to say anything?
// ---------------------------------------------------------------------------

export interface BehaviourCoverage {
  behaviour: CorpusBehaviour;
  /** Items where ≥2 independent raters labelled this behaviour. */
  doubleRatedItems: number;
  /** Items with exactly one independent label — a gap, never a reference. */
  singleRaterItems: number;
  share: number;
}

export interface CorpusCoverage {
  items: number;
  activeItems: number;
  withdrawnItems: number;
  ratedItems: number;
  /** Items double-marked by at least two independent raters overall. */
  doubleRatedItems: number;
  minCorpusItems: number;
  meetsSizeGate: boolean;
  perBehaviour: BehaviourCoverage[];
  note: string;
}

function activeItems(corpus: CorpusBenchmark): CorpusItem[] {
  return corpus.items.filter((item) => !item.withdrawnAt);
}

/** Independent (non-excluded) ratings grouped per item. */
export function independentRatingsByItem(corpus: CorpusBenchmark): Map<Id, CorpusRating[]> {
  const byItem = new Map<Id, CorpusRating[]>();
  for (const rating of corpus.ratings) {
    if (rating.status !== "independent") continue;
    const list = byItem.get(rating.itemId);
    if (list) list.push(rating);
    else byItem.set(rating.itemId, [rating]);
  }
  return byItem;
}

export function corpusCoverage(
  corpus: CorpusBenchmark,
  opts: { minCorpusItems?: number } = {},
): CorpusCoverage {
  const minCorpusItems = opts.minCorpusItems ?? DEFAULT_MIN_CORPUS_ITEMS;
  const items = activeItems(corpus);
  const byItem = independentRatingsByItem(corpus);

  let ratedItems = 0;
  let doubleRatedItems = 0;
  for (const item of items) {
    const raters = new Set((byItem.get(item.id) ?? []).map((r) => r.raterId));
    if (raters.size >= 1) ratedItems++;
    if (raters.size >= MIN_INDEPENDENT_RATERS) doubleRatedItems++;
  }

  // Per behaviour: how many items have the behaviour double-marked?
  const double = new Map<CorpusBehaviour, number>();
  const single = new Map<CorpusBehaviour, number>();
  for (const item of items) {
    const ratings = byItem.get(item.id) ?? [];
    const ratersFor = (behaviour: CorpusBehaviour) =>
      new Set(ratings.filter((r) => r.labels.some((l) => l.behaviour === behaviour)).map((r) => r.raterId));
    for (const behaviour of CORPUS_BEHAVIOURS) {
      const size = ratersFor(behaviour).size;
      if (size >= MIN_INDEPENDENT_RATERS) double.set(behaviour, (double.get(behaviour) ?? 0) + 1);
      else if (size === 1) single.set(behaviour, (single.get(behaviour) ?? 0) + 1);
    }
  }

  const perBehaviour: BehaviourCoverage[] = CORPUS_BEHAVIOURS.map((behaviour) => {
    const doubleRated = double.get(behaviour) ?? 0;
    return {
      behaviour,
      doubleRatedItems: doubleRated,
      singleRaterItems: single.get(behaviour) ?? 0,
      share: items.length === 0 ? 0 : doubleRated / items.length,
    };
  });

  const meetsSizeGate = doubleRatedItems >= minCorpusItems;
  const note = meetsSizeGate
    ? `${doubleRatedItems} double-rated items meet the ${minCorpusItems}-item gate; per-behaviour coverage still varies.`
    : `${doubleRatedItems} double-rated items; a reportable check needs at least ${minCorpusItems}. Gaps stay gaps — nothing is fabricated to close them.`;

  return {
    items: corpus.items.length,
    activeItems: items.length,
    withdrawnItems: corpus.items.length - items.length,
    ratedItems,
    doubleRatedItems,
    minCorpusItems,
    meetsSizeGate,
    perBehaviour,
    note,
  };
}

// ---------------------------------------------------------------------------
// Independence audit
// ---------------------------------------------------------------------------

export interface IndependenceIssue {
  itemId?: Id;
  raterId?: Id;
  message: string;
}

/**
 * Independence is what makes two labels worth more than one. This audit names
 * every violation it can see: a rater labelling the same behaviour twice, or a
 * behaviour carried by a single rater alone.
 */
export function auditRaterIndependence(corpus: CorpusBenchmark): IndependenceIssue[] {
  const issues: IndependenceIssue[] = [];
  const byItem = independentRatingsByItem(corpus);
  const seen = new Set<string>();

  for (const rating of corpus.ratings) {
    if (rating.status !== "independent") continue;
    for (const label of rating.labels) {
      const key = `${rating.itemId}:${rating.raterId}:${label.behaviour}`;
      if (seen.has(key)) {
        issues.push({
          itemId: rating.itemId,
          raterId: rating.raterId,
          message: `Rater ${rating.raterId} labelled ${label.behaviour} on ${rating.itemId} more than once.`,
        });
      }
      seen.add(key);
    }
  }

  for (const [itemId, ratings] of byItem) {
    for (const behaviour of CORPUS_BEHAVIOURS) {
      const raters = new Set(ratings.filter((r) => r.labels.some((l) => l.behaviour === behaviour)).map((r) => r.raterId));
      if (raters.size === 1) {
        issues.push({
          itemId,
          message: `Only one independent rater labelled ${behaviour} on ${itemId} — a gap, not a reference.`,
        });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Inter-rater reliability, wired to the benchmark
// ---------------------------------------------------------------------------

export function benchmarkRaterEntries(corpus: CorpusBenchmark): BehaviourRaterItem[] {
  const entries: BehaviourRaterItem[] = [];
  const groups = new Map<string, { behaviour: CorpusBehaviour; categorical: string[]; scores: number[] }>();

  for (const rating of corpus.ratings) {
    if (rating.status !== "independent") continue;
    for (const label of rating.labels) {
      const id = `${rating.itemId}:${label.behaviour}`;
      const group = groups.get(id) ?? { behaviour: label.behaviour, categorical: [], scores: [] };
      group.categorical.push(label.decision);
      group.scores.push(label.score);
      groups.set(id, group);
    }
  }
  for (const group of groups.values()) {
    entries.push({ behaviour: group.behaviour, categorical: group.categorical, scores: group.scores });
  }
  return entries;
}

export interface BenchmarkReliability {
  overall: AgreementReport;
  /** Least reliable first — weakness surfaces at the top, not buried. */
  perBehaviour: BehaviourReliability[];
}

export function benchmarkReliability(corpus: CorpusBenchmark): BenchmarkReliability {
  const entries = benchmarkRaterEntries(corpus);
  return {
    overall: agreementReport(entries),
    perBehaviour: reliabilityByBehaviour(entries),
  };
}

/**
 * Reliability rows exist only for behaviours someone labelled. Behaviours with
 * no data at all must still reach the recommendation stage — an unrated
 * rubric line is a gap to fill, not a passing grade.
 */
function withUnratedBehaviours(rows: BehaviourReliability[]): BehaviourReliability[] {
  const present = new Set(rows.map((row) => row.behaviour));
  const missing = CORPUS_BEHAVIOURS
    .filter((behaviour) => !present.has(behaviour))
    .map((behaviour): BehaviourReliability => ({
      behaviour,
      items: 0,
      exactAgreement: null,
      weightedAgreement: null,
      cohenKappa: null,
      meanAbsDisagreement: null,
      pearsonR: null,
      verdict: "not enough data",
    }));
  return [...rows, ...missing];
}

// ---------------------------------------------------------------------------
// Consensus resolution
// ---------------------------------------------------------------------------

export interface UnresolvedDisagreement {
  itemId: Id;
  behaviour: CorpusBehaviour;
  spread: number;
  meanScore: number;
  raterIds: Id[];
}

export interface ConsensusResolution {
  consensus: CorpusConsensus[];
  unresolved: UnresolvedDisagreement[];
  note: string;
}

/**
 * Derive consensus for every active item. Within the threshold the mean is
 * the consensus; beyond it the disagreement is returned unresolved — averaged
 * only when an adjudicator has been named, never silently.
 */
export function resolveConsensus(
  corpus: CorpusBenchmark,
  threshold = 0.25,
  adjudicatorId?: Id,
  now = new Date().toISOString(),
): ConsensusResolution {
  const byItem = independentRatingsByItem(corpus);
  const consensus: CorpusConsensus[] = [];
  const unresolved: UnresolvedDisagreement[] = [];

  for (const item of activeItems(corpus)) {
    const ratings = byItem.get(item.id) ?? [];
    consensus.push(...deriveConsensus(item, ratings, threshold, adjudicatorId, now));

    const byBehaviour = new Map<CorpusBehaviour, number[]>();
    for (const rating of ratings) {
      for (const label of rating.labels) {
        const list = byBehaviour.get(label.behaviour) ?? [];
        list.push(label.score);
        byBehaviour.set(label.behaviour, list);
      }
    }
    for (const [behaviour, scores] of byBehaviour) {
      if (scores.length < MIN_INDEPENDENT_RATERS) continue;
      const spread = Math.max(...scores) - Math.min(...scores);
      if (spread <= threshold) continue;
      unresolved.push({
        itemId: item.id,
        behaviour,
        spread,
        meanScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        raterIds: [...new Set(ratings.filter((r) => r.labels.some((l) => l.behaviour === behaviour)).map((r) => r.raterId))],
      });
    }
  }

  const note =
    unresolved.length === 0
      ? `All double-labelled behaviours reached consensus within ${threshold}.`
      : `${unresolved.length} disagreements exceed the ${threshold} threshold and need adjudication before they count as references.`;

  return { consensus, unresolved, note };
}

// ---------------------------------------------------------------------------
// Rateability — which behaviours humans cannot rate reliably?
// ---------------------------------------------------------------------------

export type Rateability = "reliable" | "moderate" | "unrateable" | "insufficient-sample" | "no-data";

export interface BehaviourRateability {
  behaviour: string;
  rateability: Rateability;
  usableAsReference: boolean;
  reasons: string[];
}

function classifyRateability(row: BehaviourReliability, minItems: number): BehaviourRateability {
  const kappa = row.cohenKappa;
  const mad = row.meanAbsDisagreement;

  if (row.items < minItems || (kappa === null && mad === null)) {
    return {
      behaviour: row.behaviour,
      rateability: kappa === null && mad === null ? "no-data" : "insufficient-sample",
      usableAsReference: false,
      reasons: [
        kappa === null && mad === null
          ? `No double-rated items yet for ${row.behaviour}.`
          : `${row.items} double-rated items; at least ${minItems} are needed before reliability means anything.`,
      ],
    };
  }

  const kappaWeak = kappa !== null && kappa < RELIABILITY_THRESHOLDS.moderateKappa;
  const kappaStrong = kappa !== null && kappa >= RELIABILITY_THRESHOLDS.strongKappa;
  const madLarge = mad !== null && mad > RELIABILITY_THRESHOLDS.acceptableScoreGap;
  const madTight = mad !== null && mad <= RELIABILITY_THRESHOLDS.tightScoreGap;

  if (kappaWeak || madLarge) {
    const reasons: string[] = [];
    if (kappaWeak) reasons.push(`Cohen's κ ${(kappa as number).toFixed(2)} is below ${RELIABILITY_THRESHOLDS.moderateKappa} — raters do not even agree on the category.`);
    if (madLarge) reasons.push(`Mean score gap ${(mad as number).toFixed(2)} exceeds ${RELIABILITY_THRESHOLDS.acceptableScoreGap} — raters disagree about how much.`);
    return { behaviour: row.behaviour, rateability: "unrateable", usableAsReference: false, reasons };
  }

  if ((kappaStrong || kappa === null) && (madTight || mad === null)) {
    return {
      behaviour: row.behaviour,
      rateability: "reliable",
      usableAsReference: true,
      reasons: [
        `κ ${kappa === null ? "n/a" : kappa.toFixed(2)}, mean gap ${mad === null ? "n/a" : mad.toFixed(2)} over ${row.items} items.`,
      ],
    };
  }

  return {
    behaviour: row.behaviour,
    rateability: "moderate",
    usableAsReference: false,
    reasons: ["Borderline calls expected — usable with caution, too soft to anchor validation."],
  };
}

export function rateability(perBehaviour: BehaviourReliability[], minItems: number): BehaviourRateability[] {
  return perBehaviour.map((row) => classifyRateability(row, minItems));
}

/** The named finding: behaviours humans themselves cannot rate reliably. */
export function unrateableBehaviours(rateabilityRows: BehaviourRateability[]): BehaviourRateability[] {
  return rateabilityRows.filter((row) => row.rateability === "unrateable");
}

// ---------------------------------------------------------------------------
// Rubric governance — keep, redesign, remove
// ---------------------------------------------------------------------------

export type RubricAction = "keep" | "redesign" | "remove" | "collect-more";

export interface RubricRecommendation {
  behaviour: string;
  action: RubricAction;
  reasons: string[];
}

/**
 * Turn rateability into an explicit recommendation. Weak rubrics are removed
 * when humans disagree about both whether the behaviour happened and how much;
 * redesigned when the concept seems sound but the definition is too fuzzy to
 * judge consistently. Small samples earn more data, not a verdict.
 */
export function recommendRubricChanges(rows: BehaviourRateability[]): RubricRecommendation[] {
  return rows
    .map((row): RubricRecommendation => {
      if (row.rateability === "unrateable") {
        return { behaviour: row.behaviour, action: "remove", reasons: [...row.reasons] };
      }
      if (row.rateability === "moderate") {
        return {
          behaviour: row.behaviour,
          action: "redesign",
          reasons: [...row.reasons, "Redesign: sharpen the definition, anchors and examples, then re-rate."],
        };
      }
      if (row.rateability === "insufficient-sample" || row.rateability === "no-data") {
        return { behaviour: row.behaviour, action: "collect-more", reasons: [...row.reasons] };
      }
      return { behaviour: row.behaviour, action: "keep", reasons: [...row.reasons] };
    })
    .sort((a, b) => rank(a.action) - rank(b.action));
}

function rank(action: RubricAction): number {
  switch (action) {
    case "remove": return 0;
    case "redesign": return 1;
    case "collect-more": return 2;
    default: return 3;
  }
}

// ---------------------------------------------------------------------------
// Revision ledger
// ---------------------------------------------------------------------------

export interface RubricRevision {
  id: Id;
  createdAt: IsoInstant;
  previousVersion: string;
  newVersion: string;
  removed: CorpusBehaviour[];
  redesigned: { behaviour: CorpusBehaviour; note: string }[];
  rationale: string;
  /** The measurements that justified the change, kept beside it. */
  evidence: { behaviour: string; cohenKappa: number | null; meanAbsDisagreement: number | null; items: number }[];
}

export interface RubricLedger {
  currentVersion: string;
  revisions: RubricRevision[];
}

export function emptyRubricLedger(): RubricLedger {
  return { currentVersion: CORPUS_RUBRIC_VERSION, revisions: [] };
}

function nextVersion(version: string): string {
  const match = version.match(/^(.*\.)(\d+)$/);
  if (!match) return `${version}.r2`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

/**
 * Apply recommendations to the rubric: removals and redesigns bump the rubric
 * version and are recorded with their evidence. Ratings already collected are
 * never rewritten — they keep the rubric version they were made under.
 */
export function applyRubricChanges(
  ledger: RubricLedger,
  recommendations: RubricRecommendation[],
  rationale: string,
  reliabilityRows: BehaviourReliability[],
  now = new Date().toISOString(),
): { ledger: RubricLedger; revision: RubricRevision | null } {
  const validBehaviours = new Set<string>(CORPUS_BEHAVIOURS);
  const removed = recommendations
    .filter((r) => r.action === "remove" && validBehaviours.has(r.behaviour))
    .map((r) => r.behaviour as CorpusBehaviour);
  const redesigned = recommendations
    .filter((r) => r.action === "redesign" && validBehaviours.has(r.behaviour))
    .map((r) => ({ behaviour: r.behaviour as CorpusBehaviour, note: r.reasons.join(" ") }));

  if (removed.length === 0 && redesigned.length === 0) return { ledger, revision: null };

  const evidence = reliabilityRows
    .filter((row) => removed.includes(row.behaviour as CorpusBehaviour) || redesigned.some((r) => r.behaviour === row.behaviour))
    .map((row) => ({
      behaviour: row.behaviour,
      cohenKappa: row.cohenKappa,
      meanAbsDisagreement: row.meanAbsDisagreement,
      items: row.items,
    }));

  const newVersion = nextVersion(ledger.currentVersion);
  const revision: RubricRevision = {
    id: `rubric-revision:${newVersion}:${now}`,
    createdAt: now,
    previousVersion: ledger.currentVersion,
    newVersion,
    removed,
    redesigned,
    rationale,
    evidence,
  };
  return {
    ledger: { currentVersion: newVersion, revisions: [...ledger.revisions, revision] },
    revision,
  };
}

/** Behaviours still part of the rubric after all applied revisions. */
export function activeRubricBehaviours(ledger: RubricLedger): CorpusBehaviour[] {
  const removed = new Set(ledger.revisions.flatMap((revision) => revision.removed));
  return CORPUS_BEHAVIOURS.filter((behaviour) => !removed.has(behaviour));
}

export function isBehaviourInRubric(ledger: RubricLedger, behaviour: CorpusBehaviour): boolean {
  return activeRubricBehaviours(ledger).includes(behaviour);
}

// ---------------------------------------------------------------------------
// The composed report
// ---------------------------------------------------------------------------

export interface HumanValidationInput {
  corpus: CorpusBenchmark;
  ledger?: RubricLedger;
  systemScores?: Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>;
  consensusThreshold?: number;
  adjudicatorId?: Id;
  minItemsPerBehaviour?: number;
  minCorpusItems?: number;
  now?: IsoInstant;
}

export interface HumanValidationReport {
  coverage: CorpusCoverage;
  independenceIssues: IndependenceIssue[];
  reliability: BenchmarkReliability;
  rateability: BehaviourRateability[];
  unrateable: BehaviourRateability[];
  recommendations: RubricRecommendation[];
  consensus: ConsensusResolution;
  validation: ValidationReport | null;
  rubric: { currentVersion: string; removed: CorpusBehaviour[]; redesignedCount: number; revisions: number };
  note: string;
}

/**
 * Run the whole program. Behaviours humans cannot rate reliably are computed
 * first and then excluded from the human-vs-system comparison: an unreliable
 * behaviour must not serve as the reference standard for the system that is
 * being judged.
 */
export function humanValidationReport(input: HumanValidationInput): HumanValidationReport {
  const { corpus } = input;
  const ledger = input.ledger ?? emptyRubricLedger();
  const now = input.now ?? new Date().toISOString();
  const threshold = input.consensusThreshold ?? 0.25;
  const minItems = input.minItemsPerBehaviour ?? DEFAULT_MIN_ITEMS_PER_BEHAVIOUR;

  const coverage = corpusCoverage(corpus, { minCorpusItems: input.minCorpusItems });
  const independenceIssues = auditRaterIndependence(corpus);
  const reliability = benchmarkReliability(corpus);
  const reliabilityRows = withUnratedBehaviours(reliability.perBehaviour);
  const rateabilityRows = rateability(reliabilityRows, minItems);
  const unrateable = unrateableBehaviours(rateabilityRows);
  const recommendations = recommendRubricChanges(rateabilityRows);

  const inRubric = new Set(activeRubricBehaviours(ledger));
  const unusable = new Set<string>([
    ...unrateable.map((r) => r.behaviour),
    ...CORPUS_BEHAVIOURS.filter((b) => !inRubric.has(b)),
  ]);
  const consensus = resolveConsensus(corpus, threshold, input.adjudicatorId, now);

  const usableConsensus = consensus.consensus.filter((row) => !unusable.has(row.behaviour));
  let validation: ValidationReport | null = null;
  if (input.systemScores) {
    const scoped: CorpusBenchmark = { ...corpus, consensus: usableConsensus };
    validation = validateAgainstHuman(scoped, input.systemScores);
  }

  const notes: string[] = [];
  notes.push(coverage.note);
  if (unrateable.length > 0) {
    notes.push(`Humans cannot rate ${unrateable.map((r) => r.behaviour).join(", ")} reliably — excluded as reference standards.`);
  }
  if (consensus.unresolved.length > 0) notes.push(consensus.note);
  if (!input.systemScores) notes.push("No system scores supplied — system comparison skipped.");

  return {
    coverage,
    independenceIssues,
    reliability,
    rateability: rateabilityRows,
    unrateable,
    recommendations,
    consensus,
    validation,
    rubric: {
      currentVersion: ledger.currentVersion,
      removed: [...new Set(ledger.revisions.flatMap((r) => r.removed))],
      redesignedCount: ledger.revisions.reduce((total, r) => total + r.redesigned.length, 0),
      revisions: ledger.revisions.length,
    },
    note: notes.join(" "),
  };
}
