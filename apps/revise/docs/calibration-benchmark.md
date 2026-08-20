# Revise calibration: empirical design and benchmark protocol

Revise's assessment predictions are estimates, not observed learner results. The
population values used before enough evidence exists are stored in the versioned
`CALIBRATION_PRIOR_V1` object (`src/domain/calibration-priors.ts`). A prediction
also stores `modelVersion`, `priorVersion`, `source`, the sample size and its
interval in `predictionHistory`. Changing a prior or fitting implementation
therefore does not rewrite an old prediction.

## Observation unit

The primary transfer outcome is a join with this temporal direction:

```text
captured pre-revision state
  → topic + revision action + duration
  → later question that was unseen before the outcome
  → actual marked score
```

`Attempt.calibrationContext` is captured before marking. A
`CalibrationObservation` is persisted only when the revision context, ordering,
duration, baseline mastery/evidence, and unseen outcome are all present. Missing
fields are excluded; they are never reconstructed from today's mastery. Repeated
rows for the same user and later question are deduplicated chronologically.

Paper calibration uses a separate immutable `PredictionHistoryRecord`: the
prediction is written before the sitting and its actual marks are filled only
after submission. A record is eligible only when
`predictedAt < outcomeAt < asOf`. This prevents a paper result from changing the
prediction that is evaluated against it.

## Fitted layers

- Question marks: ridge regression of later mark proportion on baseline mastery,
  log-duration and revision-action indicators. Coefficients are pulled toward
  the declared prior with prior strengths; subject fits fall back to the global
  fit and then to the population prior.
- Recoverable fraction: an observed improvement/opportunity ratio only when
  both marks are explicitly recorded. Dropped marks by themselves do not create
  an improvement outcome.
- Marks per revision hour: an observed improvement-mark rate divided by the
  captured duration. With no improvement outcome, the UI shows the wide prior
  interval and labels it as a population prior; it does not turn marks lost into
  a fabricated productivity result.
- Timing: seconds per marked question mark, shrunk toward the versioned timing
  prior. Paper-specific duration and mark totals are preferred when available;
  the prior is the explicit fallback.
- Paper calibration: a regularised affine calibration of predicted paper
  proportion to later actual paper proportion. It is applied only from completed
  pre-sitting prediction records and its uncertainty is unioned with the
  question-level interval.

## Gates and shrinkage

The current prior declares the following gates rather than hiding them in
callers:

| Evidence | Gate |
| --- | ---: |
| Personal transfer outcomes before personal fitting is considered | 8 |
| Reliable transfer evidence marker | 20 |
| Completed paper outcomes needed for a paper calibration fit | 3 |
| Timing outcomes needed for a stable timing status | 3 |
| Held-out outcomes required for an `ok` benchmark report | 5 |
| Group outcomes required before a bias flag is emitted | 8 |

Sparse numeric estimates use normal-normal shrinkage. If `n` observed values
are available and the prior strength is `s`, the personal weight is
`n / (n + s)`. The point is the weighted prior/sample mean. The interval uses
the declared prior uncertainty, sampling uncertainty and a between-source
mixture term, with a minimum standard deviation and 95% multiplier. This keeps
one surprising result from producing a narrow, deterministic-looking answer.

## Held-out evaluation

`evaluateHeldOutCalibration` is a chronological walk-forward evaluation. For a
test outcome at time `t`, its training set contains only observations with
`outcomeAt < t`; future rows are excluded before fitting. The report records
the model/prior versions, training gate, eligible/holdout sizes, future rows
excluded and a `noFutureLeakage` assertion. Paper evaluation uses the same
prequential rule: each paper prediction is scored against a model fit only
from earlier completed paper outcomes, with the population prior used for the
early rows.

The benchmark metrics are:

- MAE and RMSE for point error;
- signed bias (`actual − predicted`), overall and by revision action/group;
- ECE over five predicted-proportion bins;
- calibration intercept and slope;
- interval coverage and mean interval width;
- bias flags only for groups meeting the minimum sample gate.

`benchmarkCalibration` returns both the transfer and paper reports. The
`/benchmarks` page shows these empirical metrics separately from deterministic
synthetic harnesses. Synthetic rows exist only to test the machinery in CI and
the page; they are not user outcomes and never enter the live calibration model.

## Reproduce

Run the focused and full test suites from `apps/revise`:

```text
pnpm exec vitest run tests/calibration.test.ts --maxWorkers=1 --minWorkers=1
pnpm exec vitest run --maxWorkers=1 --minWorkers=1
```

The tests cover prior-only intervals, missing-context exclusion, sparse
shrinkage, chronological future exclusion, MAE/ECE/coverage/bias metrics,
marks/hour provenance, paper-history leakage, persistence and the synthetic
benchmark harness. No test invents a learner result for the production model.

## Interpretation limits

These are predictive calibration layers, not causal estimates of the effect of
revision. A later unseen-question score is an observed transfer outcome, not a
counterfactual score without revision. Intervals should widen when evidence is
thin, and a paper prediction is shown as a range when the paper ledger or
question evidence is weak. Population-prior, shrunk-personal and
personal-calibrated labels must remain visible wherever the estimate is shown.
