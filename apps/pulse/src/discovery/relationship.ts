/**
 * Relationship identity — the "same claim" key.
 *
 * Shared by the contradiction ledger and the causal hypothesis library so the
 * two stores agree on what "the same outcome-exposure relationship" is.
 *
 * The key is `outcome|exposure`, with direction deliberately absent: the
 * replication signature includes direction (an opposite sign is a failed
 * replication), but contradiction must treat an opposing sighting as the same
 * claim, not a different one. A missing exposure normalises to the empty
 * string, so a method-split finding (one metric, no exposure) keys identically
 * to a library entry that stores the absence as null.
 */
export function relationshipSubject(
  outcomeMetricId: string | null | undefined,
  exposureMetricId: string | null | undefined,
): string {
  return `${outcomeMetricId ?? ""}|${exposureMetricId ?? ""}`;
}

/**
 * The same key, qualified by the finding's candidate kind. "Higher in the
 * evening" and "higher with method = practice" are different claims about one
 * outcome, so they must never collapse into a single insight or contradict
 * each other — but direction stays absent, so a claim that flips sign is a
 * reversal of that insight rather than one insight vanishing and another
 * appearing.
 */
export function findingSubject(finding: {
  metricIds: readonly string[];
  tags: readonly string[];
}): string {
  const kind = finding.tags[0] ?? "unknown";
  return `${kind}|${relationshipSubject(finding.metricIds[0], finding.metricIds[1])}`;
}
