// Claim-verification benchmark: does the cited source actually say it?
//
// Every claim on a story page carries source links. That is the product's core
// promise — "follow the link and check" — and it is completely untested. The
// clustering benchmark measures whether articles are grouped correctly, which
// is a different question and a much easier one. Nothing measures whether the
// source attached to "forty people were killed" is a source that says forty
// people were killed.
//
// It is also the failure a reader is least able to detect. A wrong cluster is
// visible on the page; a wrong citation looks exactly like a right one until
// someone opens the link, and most people open none of them. A citation that
// does not support its claim is worse than no citation at all, because it
// converts a reader's scepticism into misplaced confidence.
//
// So the unit of labelling here is one (claim, cited source) pair, and the
// annotator must paste the span of the source that settles it. A verdict
// without a quote is unauditable — the next person cannot tell whether the
// annotator read the piece or skimmed the headline — so `supported` and
// `contradicted` require one.
//
// Like `corpus.ts`, this ships empty and refuses to produce a score until real
// labels exist.
//
// Pure + deterministic. No network.

import { GUIDELINES_VERSION, type Annotator } from "./corpus";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type ClaimVerdict =
  /** The cited source states the claim. */
  | "supported"
  /** The source supports part of it, or a weaker version. */
  | "partially-supported"
  /** The source states something incompatible with the claim. */
  | "contradicted"
  /** The source is about the story but does not address this claim at all. */
  | "not-addressed"
  /** The source could not be retrieved when labelling. */
  | "unreachable";

export const VERDICT_MEANING: Record<ClaimVerdict, string> = {
  supported: "The cited page states this claim.",
  "partially-supported": "The cited page supports a weaker or narrower version of this claim.",
  contradicted: "The cited page states something incompatible with this claim.",
  "not-addressed": "The cited page concerns the story but does not address this claim.",
  unreachable: "The cited page could not be retrieved at labelling time.",
};

/** One (claim, cited source) pair awaiting judgement. */
export interface ClaimCitation {
  id: string;
  /** The statement exactly as the interface displayed it. */
  claim: string;
  /** The source the interface cited for it. */
  citedUrl: string;
  citedTitle: string;
  citedPublisher: string;
  /** The status the app asserted, so predictions can be scored against labels. */
  assertedStatus?: "known" | "disputed" | "unverified" | "withdrawn";
  storyId?: string;
}

export interface ClaimVerificationLabel {
  citationId: string;
  verdict: ClaimVerdict;
  /**
   * Verbatim span from the cited page justifying the verdict.
   * Required for `supported` and `contradicted`; a verdict nobody can check is
   * not evidence.
   */
  quote?: string;
  annotatorId: string;
  at: string;
  guidelinesVersion: string;
  note?: string;
}

export interface ClaimVerificationSet {
  provenance: "human-labelled" | "synthetic";
  guidelinesVersion: string;
  annotators: Annotator[];
  citations: ClaimCitation[];
  labels: ClaimVerificationLabel[];
}

export function emptyClaimVerificationSet(
  provenance: ClaimVerificationSet["provenance"] = "human-labelled",
): ClaimVerificationSet {
  return { provenance, guidelinesVersion: GUIDELINES_VERSION, annotators: [], citations: [], labels: [] };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface LabelProblem {
  citationId: string;
  problem: string;
}

/** Labels that cannot be audited, listed rather than silently accepted. */
export function invalidLabels(set: ClaimVerificationSet): LabelProblem[] {
  const problems: LabelProblem[] = [];
  const known = new Set(set.citations.map((c) => c.id));
  for (const l of set.labels) {
    if (!known.has(l.citationId)) {
      problems.push({ citationId: l.citationId, problem: "Label refers to a citation that is not in the set." });
      continue;
    }
    if ((l.verdict === "supported" || l.verdict === "contradicted") && !l.quote?.trim()) {
      problems.push({
        citationId: l.citationId,
        problem: `Verdict '${l.verdict}' requires a verbatim quote from the cited page.`,
      });
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface CitationPrecisionReport {
  /** Citations with at least one settled label. */
  judged: number;
  /** Of those, how many a human confirms support their claim. */
  supporting: number;
  partial: number;
  contradicting: number;
  notAddressed: number;
  unreachable: number;
  /**
   * Share of citations that genuinely support their claim.
   * Partial support counts as half: it is neither a clean citation nor a wrong one.
   */
  precision: number;
  note: string;
}

/**
 * How often a citation supports the claim it is attached to.
 *
 * Counting partial support as a half is a judgement, and worth stating: a
 * source supporting a weaker version of a claim is a real problem — the
 * interface has firmed something up — but it is not the same failure as citing
 * a page that contradicts it, and scoring them identically would hide which of
 * the two is happening.
 */
export function citationPrecision(set: ClaimVerificationSet): CitationPrecisionReport {
  const byCitation = new Map<string, ClaimVerdict[]>();
  for (const l of set.labels) {
    const g = byCitation.get(l.citationId);
    if (g) g.push(l.verdict);
    else byCitation.set(l.citationId, [l.verdict]);
  }

  // Only citations where the labellers agree are scored; disagreement is a
  // finding about the claim's clarity, not a tiebreak to resolve arbitrarily.
  const settled = [...byCitation.entries()]
    .filter(([, verdicts]) => new Set(verdicts).size === 1)
    .map(([id, verdicts]) => ({ id, verdict: verdicts[0] }));

  const tally = (v: ClaimVerdict) => settled.filter((s) => s.verdict === v).length;
  const supporting = tally("supported");
  const partial = tally("partially-supported");
  const contradicting = tally("contradicted");
  const notAddressed = tally("not-addressed");
  const unreachable = tally("unreachable");

  // Unreachable pages say nothing about attribution quality; exclude them.
  const scorable = supporting + partial + contradicting + notAddressed;
  const precision = scorable === 0 ? 0 : Math.round(((supporting + partial * 0.5) / scorable) * 100) / 100;

  const note =
    settled.length === 0
      ? "No settled labels — citation precision cannot be computed."
      : `${supporting} of ${scorable} citations fully support their claim (${contradicting} contradict, ${notAddressed} do not address it).`;

  return { judged: settled.length, supporting, partial, contradicting, notAddressed, unreachable, precision, note };
}

export interface ClaimVerificationEligibility {
  eligible: boolean;
  reasons: string[];
}

export function claimBenchmarkEligibility(
  set: ClaimVerificationSet,
  minCitations = 300,
): ClaimVerificationEligibility {
  const reasons: string[] = [];
  if (set.provenance !== "human-labelled") {
    reasons.push("Set is synthetic — not reportable as a claim-verification score.");
  }
  if (set.citations.length < minCitations) {
    reasons.push(`${set.citations.length} citations; a reportable score needs at least ${minCitations}.`);
  }
  if (set.annotators.filter((a) => a.role === "annotator").length < 2) {
    reasons.push("Fewer than 2 annotators; agreement cannot be measured.");
  }
  const problems = invalidLabels(set);
  if (problems.length) reasons.push(`${problems.length} label(s) are unauditable (missing quotes or unknown citations).`);
  return { eligible: reasons.length === 0, reasons };
}

export function assertClaimBenchmarkable(set: ClaimVerificationSet, minCitations = 300): void {
  const { eligible, reasons } = claimBenchmarkEligibility(set, minCitations);
  if (!eligible) {
    throw new Error(`Claim-verification set is not reportable:\n  - ${reasons.join("\n  - ")}`);
  }
}

export const CLAIM_LABELLING_GUIDELINES = [
  "Judge the claim against the cited page only. What you know from elsewhere is irrelevant to whether this citation supports this claim.",
  "Paste the span that settles it. If you cannot find one, the verdict is 'not-addressed', not 'supported'.",
  "A source reporting that someone asserted the claim supports 'X said Y', not 'Y'. Attribution is part of the claim.",
  "A weaker version of the claim is 'partially-supported'. Firming up a hedge is a real error and is recorded as one.",
  "If the page has changed since it was cited, label 'unreachable' and note it, rather than judging a different version.",
  "Do not look at the app's own status label before deciding. It is what is being measured.",
] as const;

export const CLAIM_VERIFICATION_METHODOLOGY =
  "Each (claim, cited source) pair is judged by two annotators against the cited page alone, and every " +
  "'supported' or 'contradicted' verdict must carry a verbatim quote. Citations where the annotators " +
  "disagree are reported as unsettled rather than resolved by majority — disagreement usually means the " +
  "claim was ambiguously worded, which is itself the finding. Partial support counts as half, so firming " +
  "up a hedged source is visible as a distinct failure from citing a contradicting one.";
