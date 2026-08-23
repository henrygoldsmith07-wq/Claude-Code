# Pulse Statistical Methodology — Researcher Review

This document is the review surface for Pulse's discovery statistics. It exists
so that a researcher can audit the methodology without reading the codebase,
and so that every claim in `evidence/registry.json` (`pulse-discovery`) traces
to a named measurement or an explicit gap.

**Status: awaiting first external review.** Nothing here is proof the product
works; it is the specification of what would count as proof, plus the
measurements that exist today.

---

## 1. How to review

1. Read §2–4 for what the statistics actually do and how they are validated.
2. Run the benchmarks yourself:

   ```bash
   cd apps/pulse
   npx vitest run tests/validation.test.ts tests/differentiation.test.ts tests/discovery.test.ts
   ```

3. Work through the checklist in §6. A `[x]` means "reviewed and accepted";
   anything left `[ ]` is open.
4. Record verdicts and required changes in §7. Changes to the methodology
   itself (thresholds, gates, matching rules) require a new review date below.

| Date | Reviewer | Verdict | Notes |
|------|----------|---------|-------|
| — | — | — | No review yet |

## 2. What discovery does statistically (the claims under review)

- Pairwise candidate generation over daily metric series, gated by minimum
  sample size before any test is run (`src/statistics/safeguards.ts`).
- Association testing with Pearson/Spearman; effect sizes reported with CIs;
  lag search bounded and reported per pair (`src/timeseries/lag.ts`,
  `src/statistics/correlation.ts`).
- Benjamini–Hochberg FDR control across each scan's family, with family size,
  adjusted p-values and expected-false-discovery counts surfaced in the report
  (`src/statistics/multiple.ts`, `DiscoveryReport`).
- Confounder handling: time-of-day/day-of-week checks, stratified effects,
  negative controls; findings carry confounder status rather than hiding it
  (`src/discovery/confounders.ts`).
- Confidence grading by a published rubric over evidence class, n, quality,
  design and search size (`src/statistics/confidence.ts`). Grades never upgrade
  automatically.
- Causal-language guard: non-experimental evidence cannot be phrased as cause,
  enforced structurally by `validateFinding`, not by prompt.
- Robustness diagnostics: holdout time-splits, outlier sensitivity, counter-
  factual sitting analysis, autocorrelation control (`src/discovery/counterfactuals.ts`,
  `src/statistics/safeguards.ts`).
- Experiments: crossover/A-B/before-after designs sized by power analysis,
  pre-registered stopping rules, adherence floors, Benjamini–Hochberg within
  outcome families, primary-outcome-only verdicts (`src/experiments/`).

## 3. Validation measurements that exist now

All seeded and deterministic; all CI-gated in `tests/validation.test.ts`.

| Question | Measurement | Where |
|---|---|---|
| Does Pulse beat naive methods? | Precision/recall/F1 vs four uncorrected baselines (Pearson dashboard, Spearman dashboard, naive trend, simple before/after) on planted ground truth | `src/validation/comparison.ts` |
| What does mess cost? | Same comparison re-run after corruption: dropped days, dropout gaps, double exports, unit errors, timestamp jitter | `src/validation/corrupt.ts` + comparison harness |
| False positives on null data | Matched null-user dataset per scan; baseline claim counts vs Pulse finding counts | comparison harness + `synthetic/benchmark.ts` specificity |
| Do confidence grades mean anything? | Per-grade reliability table (supported/refuted rates); grades must track outcomes monotonically to be trusted | `src/validation/evaluate.ts` `calibrateGrades` |
| Are predictions honest? | Predicted vs observed experiment effects: MAE, sign agreement, shrinkage ratio | `comparePredictedToActual` |
| Do findings replicate / reverse? | Replication ledger signatures → replicated/reversed/neither rates; reversal tracked separately from failure | `ValidationLedger.summary()` |
| Do recommendations help? | Adherence, explicit usefulness verdicts, target-metric improvement share | `ValidationLedger` recommendation entries |

Known result (seeded): on the standard synthetic user, Pulse's precision meets
or beats the Pearson dashboard while making far fewer raw claims, and stays
silent on the matched null user where uncorrected dashboards do not. Exact
figures live in the test output; they are seed-fixed and re-checked per commit.

## 4. What this validation cannot show yet

These need calendar time or humans, not more code:

1. **Real longitudinal data (months).** Protocol: export one person's data via
   the file-import connector monthly; run `diagnoseLongitudinal`, then
   discovery; log reviewed false positives into a `ValidationLedger`
   (`false-positive-review` entries). Target: ≥3 months, ≥90% logging days.
2. **Real N-of-1 crossover experiments.** Designs already enforce washout,
   baseline lead-in, pre-registered stopping and power sizing. Each completed
   run logs `experiment-prediction` (predicted vs observed) and settles its
   origin finding's confidence grade (`confidence-check`).
3. **Human-reviewed precision/recall on real data.** A reviewer labels each
   real-data finding true/false/unclear; labels land as ledger entries and feed
   the same scoring functions as the synthetic ground truth.
4. **Replication/reversal rates in the wild.** Ledger accumulates
   `replication-outcome` entries as later scans re-test earlier signatures;
   meaningful once ≥20 settled signatures exist.
5. **Recommendation outcomes.** Adherence comes from experiment sessions or
   direct updates; usefulness from explicit feedback verdicts; target-metric
   movement measured after follow-through only.

Until these accumulate, `pulse-discovery` remains **internally-benchmarked**
and no copy may claim otherwise.

## 5. Deliberate methodological choices a reviewer may challenge

- **FDR not Bonferroni** across scan families — power over conservatism at
  personal-n sizes; expected-false counts are shown to the user either way.
- **Direction-free replication matching** — a reversed sign is scored as a
  reversal of the same claim, not a new claim.
- **0.25 SD floor on experiment sizing** — smaller effects are declared
  untestable for one person rather than promised.
- **Corruption applied post-normalisation** — models ingestion reality, not
  raw-device noise; duplicated records deliberately survive dedupe keys.
- **Baseline dashboards get no correction** — they represent common practice,
  which is the comparison being claimed.

## 6. Reviewer checklist

- [ ] Candidate gating and family construction are understood and accepted
- [ ] FDR choice (BH) and its reporting accepted
- [ ] Confounder checks cover the plausible alternatives for this data
- [ ] Confidence rubric weights judged reasonable; grade semantics defined
- [ ] Causal-language guard judged sufficient (structural, not cosmetic)
- [ ] Baseline set judged fair (neither strawman nor too strong)
- [ ] Ground-truth matching rules (outcome+exposure pairs) accepted
- [ ] Corruption recipe judged representative of real device data
- [ ] Experiment designs (crossover default, stopping rules, floors) accepted
- [ ] Ledger entry taxonomy covers every standing validation question
- [ ] Claims in `evidence/registry.json` match the limitations stated here
- [ ] §4 protocols approved for execution

## 7. Required changes

_None recorded._
