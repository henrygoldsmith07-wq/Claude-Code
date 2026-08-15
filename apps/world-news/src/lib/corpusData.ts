// The live labelled corpora. Both are empty, and that is the accurate state.
//
// Nothing here is generated. The clustering corpus takes real articles that
// somebody fetched and two people labelled; the claim-verification set takes
// real (claim, cited source) pairs that two people opened and judged. Neither
// can be produced by writing code, which is why this file contains no data
// rather than plausible-looking placeholders.
//
// Reading these as zero is the point. `corpusStats()` will say "0 articles",
// `benchmarkEligibility()` will refuse, and the benchmark report prints the
// refusal instead of a score. The moment the first real labels land, the same
// functions start reporting them with no code change.
//
// To add labels:
//   1. Fetch real articles and append them to CLUSTERING_CORPUS.articles,
//      each with its real `url` and the `fetchedAt` time — headlines change
//      under a stable URL, so a capture time is what makes a label checkable.
//   2. Register each labeller in `annotators`.
//   3. Have at least two of them label independently, against
//      LABELLING_GUIDELINES_V2, without looking at the clusterer's output.
//   4. Send disagreements to an adjudicator, who records a reason, not just a
//      verdict.

import { emptyCorpus, type Corpus } from "./corpus";
import { emptyClaimVerificationSet, type ClaimVerificationSet } from "./claimVerification";

/** Real articles labelled for event identity. Empty until people label them. */
export const CLUSTERING_CORPUS: Corpus = emptyCorpus("human-labelled");

/** Real (claim, cited source) pairs labelled for whether the citation holds. */
export const CLAIM_VERIFICATION_SET: ClaimVerificationSet = emptyClaimVerificationSet("human-labelled");

/**
 * Target sizes, recorded so the gap between ambition and reality stays legible.
 *
 * These are the sizes at which each measurement becomes worth reporting, not a
 * promise that they exist. `benchmarkEligibility()` compares against them.
 */
export const CORPUS_TARGETS = {
  clusteringArticles: 2000,
  claimCitations: 300,
  minAnnotatorsPerItem: 2,
  minKappa: 0.6,
} as const;
