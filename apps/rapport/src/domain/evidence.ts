import { behaviourForSkill, skillForBehaviour } from "./behaviours";
import { BEHAVIOUR_KEYS } from "./types";
import type {
  AssistLevel,
  BehaviourKey,
  ChallengeAttempt,
  Id,
  IsoInstant,
  Simulation,
  SimulationEvaluation,
  UserSkillState,
} from "./types";
import type { HumanEvidenceState } from "./human-evidence";

/** Evidence channels are intentionally not collapsed into one score. */
export const EVIDENCE_SOURCES = [
  "simulator",
  "self-reported-mission",
  "human-rated",
  "validated-transfer",
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export interface EvidenceSourceSummary {
  count: number;
  meanPerformance: number | null;
  lastAt: IsoInstant | null;
}

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient evidence";

export interface BehaviourEvidenceProfile {
  behaviour: BehaviourKey;
  /** The skill the evidence most directly maps to, when the link is known. */
  skillId?: Id;
  /** Counts independent observations; validated transfer is a subset of human-rated data. */
  amountOfEvidence: number;
  /** A sampling-confidence estimate, not competence. */
  confidence: number;
  /** Categorical confidence considering amount, consistency, transcript quality, rubric reliability, extraction uncertainty. */
  confidenceLevel: ConfidenceLevel;
  /** Why that confidence level, for inspectability. */
  confidenceReasons: string[];
  /** Most recent observed performance across the separate evidence channels. */
  recentPerformance: number | null;
  /** Distinct simulator situations that exercised this behaviour. */
  scenarioDiversity: number;
  /** Assistance used on the most recent simulator observation. */
  assistance: AssistLevel | null;
  /** Current retention estimate for the linked skill, when available. */
  retention: number | null;
  /** Remaining uncertainty in the evidence sample, separate from mastery. */
  uncertainty: number;
  sources: Record<EvidenceSource, EvidenceSourceSummary>;
}

interface Observation {
  behaviour: BehaviourKey;
  skillId?: Id;
  source: EvidenceSource;
  performance: number;
  at: IsoInstant;
  scenarioId?: Id;
  assistance?: AssistLevel;
}

export interface EvidenceLedgerInput {
  evaluations: SimulationEvaluation[];
  simulations: Simulation[];
  attempts: ChallengeAttempt[];
  states: UserSkillState[];
  humanEvidence?: HumanEvidenceState;
}

function emptySources(): Record<EvidenceSource, EvidenceSourceSummary> {
  return {
    simulator: { count: 0, meanPerformance: null, lastAt: null },
    "self-reported-mission": { count: 0, meanPerformance: null, lastAt: null },
    "human-rated": { count: 0, meanPerformance: null, lastAt: null },
    "validated-transfer": { count: 0, meanPerformance: null, lastAt: null },
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function missionPerformance(attempt: ChallengeAttempt): number | null {
  switch (attempt.outcome) {
    case "yes":
      return 1;
    case "partly":
      return 0.5;
    case "no":
      return 0;
    default:
      return null;
  }
}

function addObservation(observations: Observation[], observation: Observation): void {
  observations.push({ ...observation, performance: clamp01(observation.performance) });
}

function sourceSummary(observations: Observation[], source: EvidenceSource): EvidenceSourceSummary {
  const values = observations.filter((item) => item.source === source);
  if (values.length === 0) return { count: 0, meanPerformance: null, lastAt: null };
  const ordered = [...values].sort((a, b) => a.at.localeCompare(b.at));
  return {
    count: values.length,
    meanPerformance: values.reduce((sum, item) => sum + item.performance, 0) / values.length,
    lastAt: ordered[ordered.length - 1]?.at ?? null,
  };
}

function observationsFor(
  input: EvidenceLedgerInput,
): Map<BehaviourKey, Observation[]> {
  const simulationsById = new Map(input.simulations.map((simulation) => [simulation.id, simulation]));
  const byBehaviour = new Map<BehaviourKey, Observation[]>();
  const add = (observation: Observation) => {
    const list = byBehaviour.get(observation.behaviour) ?? [];
    addObservation(list, observation);
    byBehaviour.set(observation.behaviour, list);
  };

  for (const evaluation of input.evaluations) {
    const simulation = simulationsById.get(evaluation.simulationId);
    const skillId = simulation?.scenario.skillIds[0] ?? evaluation.nextExercise.skillId;
    for (const score of evaluation.scores.filter((item) => item.reliable)) {
      add({
        behaviour: score.key,
        skillId,
        source: "simulator",
        performance: score.score,
        at: evaluation.createdAt,
        scenarioId: simulation?.scenarioId,
        assistance: simulation?.assistLevel,
      });
    }
  }

  for (const attempt of input.attempts) {
    const performance = missionPerformance(attempt);
    const behaviour = attempt.challenge.behaviour ?? behaviourForSkill(attempt.challenge.skillId);
    if (performance === null || !behaviour) continue;
    add({
      behaviour,
      skillId: attempt.challenge.skillId,
      source: "self-reported-mission",
      performance,
      at: attempt.completedAt ?? attempt.assignedAt,
    });
  }

  const human = input.humanEvidence;
  if (human) {
    const activeRatings = human.ratings.filter((rating) => rating.status !== "excluded");
    for (const item of human.items) {
      const ratings = activeRatings.filter((rating) => rating.itemId === item.id);
      for (const key of BEHAVIOUR_KEYS) {
        const labels = ratings.flatMap((rating) => rating.labels.filter((label) => label.key === key));
        if (labels.length === 0) continue;
        const performance = labels.reduce((sum, label) => sum + clamp01(label.score), 0) / labels.length;
        const skillId = item.skillIds[0] ?? skillForBehaviour(key);
        add({
          behaviour: key,
          skillId,
          source: "human-rated",
          performance,
          at: item.occurredAt,
        });

        const raterCount = new Set(ratings.map((rating) => rating.raterId)).size;
        const disagreement = human.disagreements.find(
          (candidate) => candidate.itemId === item.id && candidate.behaviourKey === key,
        );
        const adjudicated = human.adjudications.some(
          (candidate) => candidate.itemId === item.id && candidate.behaviourKey === key,
        );
        if (item.kind === "real-world-challenge" && (adjudicated || (raterCount >= 2 && disagreement?.status !== "open"))) {
          add({
            behaviour: key,
            skillId,
            source: "validated-transfer",
            performance,
            at: item.occurredAt,
          });
        }
      }
    }
  }

  return byBehaviour;
}

function confidenceLevelFor(params: {
  amountOfEvidence: number;
  uncertainty: number;
  consistency: number | null;
  scenarioDiversity: number;
  rubricReliabilityApprox: number;
}): { level: ConfidenceLevel; reasons: string[] } {
  const { amountOfEvidence, uncertainty, consistency, scenarioDiversity, rubricReliabilityApprox } = params;
  const reasons: string[] = [];
  if (amountOfEvidence === 0) return { level: "insufficient evidence", reasons: ["No independent observations yet for this behaviour."] };
  if (amountOfEvidence === 1) reasons.push("Only one observation — not enough to be sure.");
  if (consistency !== null && consistency < 0.55) reasons.push(`Observations disagree (consistency ${consistency.toFixed(2)}).`);
  if (scenarioDiversity <= 1 && amountOfEvidence >= 3) reasons.push("Observations come from very few situations — variety is low.");
  if (rubricReliabilityApprox < 0.5) reasons.push("Human raters disagree on this behaviour — scores are tentative.");
  // uncertainty directly from amount
  const confidence = 1 - uncertainty;
  let level: ConfidenceLevel;
  if (amountOfEvidence < 2 || confidence < 0.32) level = "low";
  else if (confidence < 0.58 || amountOfEvidence < 4) level = "moderate";
  else if (confidence >= 0.72 && amountOfEvidence >= 4) level = "high";
  else level = "moderate";
  if (amountOfEvidence === 1 && confidence < 0.45) level = "insufficient evidence";
  if (level === "high" && rubricReliabilityApprox < 0.55) {
    level = "moderate";
    reasons.push("Capped at moderate because rubric reliability is limited.");
  }
  if (reasons.length === 0) {
    if (level === "high") reasons.push("Multiple consistent observations with good rubric reliability.");
    else if (level === "moderate") reasons.push("Some evidence, broadly consistent.");
    else reasons.push("Limited or mixed evidence — more observations would clarify.");
  }
  return { level, reasons };
}

function consistencyFor(observations: Observation[]): number | null {
  if (observations.length < 2) return null;
  const scores = observations.map((o) => o.performance);
  const meanVal = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, v) => sum + (v - meanVal) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance);
  return Math.max(0, 1 - sd * 2);
}

function profileFor(
  behaviour: BehaviourKey,
  observations: Observation[],
  states: UserSkillState[],
): BehaviourEvidenceProfile {
  const ordered = [...observations].sort((a, b) => a.at.localeCompare(b.at));
  const skillId = ordered.find((item) => item.skillId)?.skillId ?? skillForBehaviour(behaviour);
  const state = skillId ? states.find((item) => item.skillId === skillId) : undefined;
  const sources = emptySources();
  for (const source of EVIDENCE_SOURCES) sources[source] = sourceSummary(ordered, source);

  const independentCount = sources.simulator.count + sources["self-reported-mission"].count + sources["human-rated"].count;
  const uncertainty = independentCount === 0 ? 0.75 : Math.max(0.15, Math.min(0.75, 0.7 / Math.sqrt(independentCount)));
  const simulator = ordered.filter((item) => item.source === "simulator");
  const recent = ordered[ordered.length - 1];
  const consistency = consistencyFor(ordered);
  const scenarioDiversity = new Set(simulator.flatMap((item) => (item.scenarioId ? [item.scenarioId] : []))).size;
  // Rubric reliability placeholder: if we have human-rated data for this behaviour, treat as moderate-high, otherwise default to 0.6
  const rubricReliabilityApprox = sources["human-rated"].count > 0 ? 0.65 : 0.6;
  const conf = confidenceLevelFor({ amountOfEvidence: independentCount, uncertainty, consistency, scenarioDiversity, rubricReliabilityApprox });
  const profile: BehaviourEvidenceProfile = {
    behaviour,
    amountOfEvidence: independentCount,
    confidence: Number((1 - uncertainty).toFixed(3)),
    confidenceLevel: conf.level,
    confidenceReasons: conf.reasons,
    recentPerformance: recent?.performance ?? null,
    scenarioDiversity,
    assistance: simulator[simulator.length - 1]?.assistance ?? null,
    retention: state?.retentionEstimate ?? null,
    uncertainty: Number(uncertainty.toFixed(3)),
    sources,
  };
  if (skillId) profile.skillId = skillId;
  return profile;
}

/** Build a behaviour-level ledger without ever pretending the sources are interchangeable. */
export function buildEvidenceLedger(input: EvidenceLedgerInput): BehaviourEvidenceProfile[] {
  const observations = observationsFor(input);
  return BEHAVIOUR_KEYS.map((behaviour) => profileFor(behaviour, observations.get(behaviour) ?? [], input.states));
}

export function evidenceSourceLabel(source: EvidenceSource): string {
  switch (source) {
    case "simulator":
      return "Simulator";
    case "self-reported-mission":
      return "Self-reported mission";
    case "human-rated":
      return "Human-rated";
    case "validated-transfer":
      return "Validated transfer";
  }
}

