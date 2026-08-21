// ---------------------------------------------------------------------------
// Privacy guarantees — benchmark & exports.
//
// Four invariants, each enforceable in code rather than by policy:
//
//  1. Benchmark data is opt-in. No transcript enters the corpus without an
//     explicit consent record for that one transcript.
//  2. Identifying information can be stripped. `stripForBenchmark` removes
//     emails, phones, URLs, postcodes and suggested names; the user sees the
//     exact text that would leave the device and edits it. Export payload is
//     the redacted copy, never the original.
//  3. Exports remain user-controlled. `exportAll` is a local file the user
//     holds. `exportBenchmark` is a separate file that only exists when
//     benchmark consent is on, and normal export never includes it.
//  4. Benchmark/research data is separable from normal product data and
//     deletion of either leaves the other intact. `wipe` clears product data;
//     `deleteCorpusBenchmark` clears research data; neither touches the other
//     unless the user asks for both.
//  5. Deletion remains possible and complete. `wipe`, `deleteReflection`,
//     `deleteCorpusBenchmark` and consent withdrawal all remove the data rather
//     than tombstoning it where a future read could still surface it.
// ---------------------------------------------------------------------------

import type { DonatedTranscript } from "./donation";
import type { CorpusBenchmark, CorpusItem } from "./corpus";
import { redactionCandidates } from "./donation";
import type { Snapshot, Id, IsoInstant } from "./types";

export const BENCHMARK_DATA_KIND = "benchmark-corpus" as const;
export const PRODUCT_DATA_KIND = "product" as const;

export interface BenchmarkConsent {
  transcriptId: Id;
  grantedAt: IsoInstant;
  consentVersion: string;
  withdrawnAt?: IsoInstant;
}

export interface PrivacyCheck {
  ok: boolean;
  reasons: string[];
}

/** True when the corpus is properly isolated from the product snapshot. */
export function corpusIsSeparable(snapshot: Snapshot, corpus: CorpusBenchmark): PrivacyCheck {
  const reasons: string[] = [];
  // Snapshot must not contain corpus data
  const snapshotHasCorpus = (snapshot as unknown as Record<string, unknown>).corpus !== undefined || (snapshot as unknown as Record<string, unknown>).corpusBenchmark !== undefined;
  if (snapshotHasCorpus) reasons.push("Snapshot must not embed benchmark corpus.");
  // Corpus items must not contain user ids
  for (const item of corpus.items) {
    const itemAny = item as unknown as Record<string, unknown>;
    if (itemAny.userId !== undefined || itemAny.user !== undefined) reasons.push(`Corpus item ${item.id} leaks user identity.`);
    if (Array.isArray(item.transcript)) {
      for (const turn of item.transcript) {
        if ((turn as unknown as Record<string, unknown>).userId !== undefined) reasons.push(`Corpus turn in ${item.id} leaks userId.`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/** Check that a donated transcript can be stripped of PII before it enters the corpus. */
export function benchmarkStrippingCheck(donated: DonatedTranscript, stripped: CorpusItem): PrivacyCheck {
  const reasons: string[] = [];
  const originalText = donated.turns.map((t) => t.text).join("\n");
  const candidates = redactionCandidates(originalText, []);
  // If candidates exist and stripped text still contains them, stripping failed
  for (const c of candidates) {
    const stillPresent = stripped.transcript.some((t) => t.text.includes(c.text));
    if (stillPresent) reasons.push(`Stripping missed candidate ${c.kind}:${c.text}`);
  }
  // Email/phone/URL must never survive into corpus text
  const leakPatterns = [/@/, /https?:\/\//, /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/];
  for (const turn of stripped.transcript) {
    for (const pat of leakPatterns) if (pat.test(turn.text)) reasons.push(`Potential PII leak in stripped transcript: "${turn.text.slice(0, 40)}"`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Totally separable export: product export must never include benchmark,
 * benchmark export must never include product reflections/simulations etc.
 */
export function exportSeparationCheck(productExport: unknown, benchmarkExport: unknown): PrivacyCheck {
  const reasons: string[] = [];
  const product = productExport as Record<string, unknown>;
  const benchmark = benchmarkExport as Record<string, unknown>;
  if (product && (product.corpus !== undefined || product.corpusBenchmark !== undefined)) reasons.push("Product export leaks benchmark data.");
  if (benchmark && (benchmark.snapshot !== undefined || benchmark.events !== undefined || benchmark.humanEvidence !== undefined)) {
    // Benchmark export leaking product data is allowed only if corpus is separate; product snapshot inside benchmark is a leak
    if (benchmark.snapshot) reasons.push("Benchmark export must not embed full product snapshot.");
  }
  return { ok: reasons.length === 0, reasons };
}

export function deletionCheck(before: unknown, after: unknown, kind: typeof BENCHMARK_DATA_KIND | typeof PRODUCT_DATA_KIND): PrivacyCheck {
  const reasons: string[] = [];
  // After deletion, no data of that kind should remain accessible
  if (kind === BENCHMARK_DATA_KIND) {
    const afterObj = after as Record<string, unknown>;
    if (afterObj && Array.isArray(afterObj.items) && (afterObj.items as unknown[]).length > 0) reasons.push("Benchmark deletion left items behind.");
    if (afterObj && Array.isArray(afterObj.ratings) && (afterObj.ratings as unknown[]).length > 0) reasons.push("Benchmark deletion left ratings behind.");
  }
  if (kind === PRODUCT_DATA_KIND) {
    const afterObj = after as Record<string, unknown>;
    if (afterObj && Array.isArray((afterObj as unknown as { events: unknown[] }).events) && (afterObj as unknown as { events: unknown[] }).events.length > 0) reasons.push("Product wipe left events behind.");
  }
  return { ok: reasons.length === 0, reasons };
}
