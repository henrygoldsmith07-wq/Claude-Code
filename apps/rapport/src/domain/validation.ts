// ---------------------------------------------------------------------------
// Rapport vs human validation — per-behaviour, no hiding.
//
// The evaluator's output is compared against the human consensus from the
// corpus. Results are broken down by behaviour so a single overall number cannot
// hide that the system is weak on empathy or curiosity while being good on
// question quality. Every comparison carries the exact human evidence and the
// system evidence side by side, so a reviewer can audit the disagreement
// without taking any metric on trust.
//
// Human ratings are never fabricated: a missing human rating is a gap. A
// behaviour where inter-rater agreement is weak is reported as weak rather than
// smoothed into the overall.
// ---------------------------------------------------------------------------

import type { BehaviourKey, Id } from "./types";
import type { CorpusBenchmark, CorpusBehaviour, CorpusConsensus } from "./corpus";
import { CORPUS_BEHAVIOUR_MAP } from "./corpus";
import { pearsonCorrelation } from "./agreement";

export interface BehaviourValidation {
  behaviour: CorpusBehaviour;
  internalKeys: BehaviourKey[];
  compared: number;
  meanAbsoluteError: number | null;
  pearsonR: number | null;
  exactAgreementRate: number | null; // within tolerance
  falsePositives: number;
  falseNegatives: number;
  uncertain: number;
  worstExamples: ComparisonRecord[];
  verdict: string;
}

export interface ComparisonRecord {
  itemId: Id;
  behaviour: CorpusBehaviour;
  internalKey: BehaviourKey;
  systemScore: number;
  systemEvidence: string;
  humanScore: number;
  humanDecision: string;
  humanEvidence: string[];
  absoluteError: number;
  classification: "aligned" | "false-positive" | "false-negative" | "uncertain";
  consensusMethod: string;
  rubricVersion: string;
}

export interface ValidationReport {
  compared: number;
  meanAbsoluteError: number | null;
  overallPearsonR: number | null;
  perBehaviour: BehaviourValidation[];
  note: string;
}

function classificationFor(system: number, humanScore: number, humanDecision: string): ComparisonRecord["classification"] {
  if (humanDecision === "uncertain" || humanDecision === "not-applicable") return "uncertain";
  if (humanDecision === "absent" && system >= 0.6) return "false-positive";
  if (humanDecision === "present" && system <= 0.35) return "false-negative";
  return Math.abs(system - humanScore) <= 0.2 ? "aligned" : "uncertain";
}

/**
 * Compare system scores against corpus consensus.
 *
 * @param corpus       The human-rated corpus (consensus already derived).
 * @param systemScores Map from itemId → {key, score, evidence}[] as produced by scoreTranscript.
 */
export function validateAgainstHuman(
  corpus: CorpusBenchmark,
  systemScores: Map<Id, { key: BehaviourKey; score: number; evidence: string }[]>,
): ValidationReport {
  const consensusByKey = new Map<string, CorpusConsensus>();
  for (const c of corpus.consensus) consensusByKey.set(`${c.itemId}:${c.behaviour}`, c);

  // For human scores we need to collect per-item per-behaviour human score from consensus
  // For system, we map internal keys to corpus behaviours via CORPUS_BEHAVIOUR_MAP reverse.

  const records: ComparisonRecord[] = [];

  for (const item of corpus.items) {
    if (item.withdrawnAt) continue;
    const sys = systemScores.get(item.id);
    if (!sys) continue;

    for (const consensus of corpus.consensus.filter((c) => c.itemId === item.id)) {
      // Find system score(s) that correspond to this corpus behaviour
      const internalKeys = CORPUS_BEHAVIOUR_MAP[consensus.behaviour] ?? [];
      // Take the best-matching internal key that exists in system scores
      let matched: { key: BehaviourKey; score: number; evidence: string } | undefined;
      for (const key of internalKeys) {
        const candidate = sys.find((s) => s.key === key);
        if (candidate) {
          matched = candidate;
          break;
        }
      }
      // Fallback: try direct string match if corpus behaviour name coincides with BehaviourKey
      if (!matched) {
        const direct = sys.find((s) => s.key === (consensus.behaviour as unknown as BehaviourKey));
        if (direct) matched = direct;
      }
      if (!matched) continue;

      const error = Math.abs(matched.score - consensus.consensusScore);
      records.push({
        itemId: item.id,
        behaviour: consensus.behaviour,
        internalKey: matched.key,
        systemScore: matched.score,
        systemEvidence: matched.evidence,
        humanScore: consensus.consensusScore,
        humanDecision: consensus.consensusDecision,
        humanEvidence: consensus.evidence.map((e) => e.quote),
        absoluteError: error,
        classification: classificationFor(matched.score, consensus.consensusScore, consensus.consensusDecision),
        consensusMethod: consensus.method,
        rubricVersion: consensus.rubricVersion,
      });
    }
  }

  if (records.length === 0) {
    return {
      compared: 0,
      meanAbsoluteError: null,
      overallPearsonR: null,
      perBehaviour: [],
      note: "No items with both human consensus and system score — validation not possible. No ratings have been fabricated to fill the gap.",
    };
  }

  const meanAbs = records.reduce((sum, r) => sum + r.absoluteError, 0) / records.length;
  const sysArr = records.map((r) => r.systemScore);
  const humArr = records.map((r) => r.humanScore);
  const overallPearson = sysArr.length >= 2 ? pearsonCorrelation(sysArr, humArr) : null;

  // Per-behaviour breakdown
  const byBehaviour = new Map<CorpusBehaviour, ComparisonRecord[]>();
  for (const r of records) {
    const list = byBehaviour.get(r.behaviour) ?? [];
    list.push(r);
    byBehaviour.set(r.behaviour, list);
  }

  const perBehaviour: BehaviourValidation[] = [];
  for (const [behaviour, group] of byBehaviour) {
    const mae = group.reduce((sum, r) => sum + r.absoluteError, 0) / group.length;
    const a = group.map((r) => r.systemScore);
    const b = group.map((r) => r.humanScore);
    const pr = group.length >= 2 ? pearsonCorrelation(a, b) : null;
    const aligned = group.filter((r) => r.classification === "aligned").length;
    const exactRate = group.length ? aligned / group.length : null;
    const falsePos = group.filter((r) => r.classification === "false-positive").length;
    const falseNeg = group.filter((r) => r.classification === "false-negative").length;
    const uncertain = group.filter((r) => r.classification === "uncertain").length;
    const worstExamples = [...group].sort((x, y) => y.absoluteError - x.absoluteError).slice(0, 3);
    const verdict =
      mae <= 0.12 && (pr === null || pr >= 0.6)
        ? "good agreement — behaviour is reliably measured"
        : mae <= 0.2 && (pr === null || pr >= 0.4)
          ? "moderate agreement — borderline cases will disagree"
          : "poor agreement — do not rely on this behaviour score";

    perBehaviour.push({
      behaviour,
      internalKeys: CORPUS_BEHAVIOUR_MAP[behaviour] ?? [],
      compared: group.length,
      meanAbsoluteError: Number(mae.toFixed(3)),
      pearsonR: pr === null ? null : Number(pr.toFixed(3)),
      exactAgreementRate: exactRate === null ? null : Number(exactRate.toFixed(3)),
      falsePositives: falsePos,
      falseNegatives: falseNeg,
      uncertain,
      worstExamples,
      verdict,
    });
  }

  // Sort worst behaviours first — do not hide poor validity
  perBehaviour.sort((a, b) => (a.meanAbsoluteError ?? 1) - (b.meanAbsoluteError ?? 1));
  // Actually worst first for surfacing:
  perBehaviour.sort((a, b) => (b.meanAbsoluteError ?? 0) - (a.meanAbsoluteError ?? 0));

  const note =
    records.length < 20
      ? `Only ${records.length} comparisons — sample too small for strong validation claims.`
      : `Validated on ${records.length} behaviour comparisons. Per-behaviour breakdown below; do not rely on the overall MAE alone.`;

  return {
    compared: records.length,
    meanAbsoluteError: Number(meanAbs.toFixed(3)),
    overallPearsonR: overallPearson === null ? null : Number(overallPearson.toFixed(3)),
    perBehaviour,
    note,
  };
}
