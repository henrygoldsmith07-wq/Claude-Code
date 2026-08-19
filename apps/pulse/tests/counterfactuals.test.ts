/**
 * Counterfactual explanations.
 *
 * A finding says "the data shows this". The counterfactual analysis asks the
 * companion question: "how much of the data would have to be different for
 * the claim to stop being true?" A claim that survives removing its most
 * influential sittings is trustworthy; one that reverses when a single
 * sitting is removed is not a claim at all yet.
 */

import { describe, expect, it } from "vitest";
import {
  counterfactualFromClusters,
  counterfactualFromSeries,
} from "../src/discovery/counterfactuals.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

function clusters(values: readonly number[], date = "2025-01-01"): { keys: string[]; values: number[] } {
  return {
    keys: values.map((_, i) => `${date}:${Math.floor(i / 6)}`),
    values: [...values],
  };
}

describe("counterfactual explanations", () => {
  describe("group comparisons", () => {
    it("flags a finding carried by a single sitting as fragile", () => {
      // One extreme sitting on the higher side carries the whole difference.
      const a = clusters([10, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
      const b = clusters([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
      const explanation = counterfactualFromClusters(a, b, { pValue: 0.01 });

      expect(explanation.verdict).toBe("fragile");
      expect(explanation.fragileToSingleSitting).toBe(true);
      expect(explanation.removalsToFlipDirection).toBe(1);
      expect(explanation.influentialSittings[0]?.value).toBe(10);
      expect(explanation.statement).toMatch(/single sitting/);
    });

    it("judges a broad, well-separated effect as robust", () => {
      // 40 sittings per side, huge separation, no single point in charge.
      const jitter = (base: number, seed: number) => Array.from({ length: 40 }, (_, i) => base + ((i * seed) % 5 - 2) * 0.2);
      const a = clusters(jitter(10, 3));
      const b = clusters(jitter(6, 7));
      const explanation = counterfactualFromClusters(a, b, { pValue: 0.05 });

      expect(explanation.verdict).toBe("robust");
      expect(explanation.fragileToSingleSitting).toBe(false);
      expect(explanation.removalsToFlipDirection).toBe(Number.POSITIVE_INFINITY);
      expect(explanation.removalsToBreakSignificance).toBe(Number.POSITIVE_INFINITY);
      expect(explanation.statement).toMatch(/Robust/);
    });

    it("compares the re-run test against the finding's own reported threshold", () => {
      // A modest effect, significant at baseline: the direction never flips,
      // but the effect fades once the sittings most responsible for it go.
      // The stricter the bar, the sooner the re-run test crosses it — which
      // is the threshold mechanism working, not a fixed number.
      const jitter = (base: number, seed: number) => Array.from({ length: 40 }, (_, i) => base + ((i * seed) % 5 - 2) * 0.5);
      const a = clusters(jitter(10.5, 3));
      const b = clusters(jitter(10.0, 7));
      const loose = counterfactualFromClusters(a, b, { pValue: 0.05 });
      const strict = counterfactualFromClusters(a, b, { pValue: 0.005 });

      // Deterministic fixture: at the standard bar the effect breaks at seven
      // removals and only reverses direction later, at sixteen; a stricter bar
      // breaks significance sooner (or not at all later on).
      expect(loose.removalsToBreakSignificance).toBe(7);
      expect(loose.removalsToFlipDirection).toBe(16);
      expect(strict.removalsToBreakSignificance).toBeLessThanOrEqual(loose.removalsToBreakSignificance);
      expect(loose.statement).toMatch(/significance threshold/);
    });

    it("keeps every numeric field well-formed", () => {
      const a = clusters([10, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
      const b = clusters([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
      const explanation = counterfactualFromClusters(a, b, { pValue: 0.05 });

      expect(explanation.removalsToFlipDirection === Number.POSITIVE_INFINITY || Number.isInteger(explanation.removalsToFlipDirection)).toBe(true);
      expect(explanation.removalsToBreakSignificance === Number.POSITIVE_INFINITY || Number.isInteger(explanation.removalsToBreakSignificance)).toBe(true);
      expect(explanation.fragileToSingleSitting).toBe(
        explanation.removalsToFlipDirection === 1 || explanation.removalsToBreakSignificance === 1,
      );
      expect(explanation.influentialSittings.length).toBeGreaterThan(0);
      expect(explanation.influentialSittings.length).toBeLessThanOrEqual(6);
    });
  });

  describe("lagged correlations", () => {
    it("flags a day that carries the whole correlation", () => {
      const dates = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05", "2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09", "2025-01-10"];
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Flat except one extreme day that manufactures the association.
      const y = [5, 5, 6, 4, 5, 6, 4, 5, 6, 40];
      const explanation = counterfactualFromSeries(dates, x, y, { pValue: 0.05 });

      expect(explanation.verdict).toBe("fragile");
      expect(explanation.fragileToSingleSitting).toBe(true);
      expect(explanation.removalsToBreakSignificance).toBe(1);
      // The outcome value that day is the anomaly that manufactured the link.
      expect(explanation.influentialSittings[0]?.value).toBe(40);
      expect(explanation.influentialSittings[0]?.localDate).toBe("2025-01-10");
      expect(explanation.statement).toMatch(/single day/);
    });
  });

  describe("end to end", () => {
    it("explains every finding the synthetic user produces", async () => {
      const { pulse } = await createSyntheticPulse({});
      pulse.discover();
      const findings = pulse.findings();
      expect(findings.length).toBeGreaterThan(0);

      for (const finding of findings) {
        expect(finding.counterfactual, finding.title).toBeDefined();
        const explanation = finding.counterfactual!;
        expect(["robust", "fragile"]).toContain(explanation.verdict);
        expect(explanation.statement.length).toBeGreaterThan(20);
        expect(
          explanation.removalsToFlipDirection === Number.POSITIVE_INFINITY || Number.isInteger(explanation.removalsToFlipDirection),
        ).toBe(true);
        expect(
          explanation.removalsToBreakSignificance === Number.POSITIVE_INFINITY || Number.isInteger(explanation.removalsToBreakSignificance),
        ).toBe(true);
        expect(explanation.fragileToSingleSitting).toBe(
          explanation.removalsToFlipDirection === 1 || explanation.removalsToBreakSignificance === 1,
        );
        for (const sitting of explanation.influentialSittings) {
          expect(sitting.localDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
          expect(["A", "B"]).toContain(sitting.side);
          expect(Number.isFinite(sitting.value)).toBe(true);
        }
      }
    });

    it("is deterministic across repeated scans of the same data", async () => {
      const { pulse } = await createSyntheticPulse({});
      pulse.discover();
      const first = pulse.findings().map((finding) => finding.counterfactual?.statement).join("|");
      pulse.discover();
      const second = pulse.findings().map((finding) => finding.counterfactual?.statement).join("|");
      expect(second).toBe(first);
    });

    it("flows into the privacy export", async () => {
      const { pulse } = await createSyntheticPulse({});
      pulse.discover();
      const exported = pulse.export();
      expect(exported.findings.length).toBeGreaterThan(0);
      for (const finding of exported.findings) {
        expect(finding.counterfactual).toBeDefined();
      }
    });
  });
});
