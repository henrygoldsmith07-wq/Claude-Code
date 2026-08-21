# Validation Status — Le Studio French

> **Infrastructure vs outcomes.** This document distinguishes *what the code can now measure* from *what has been externally validated with real learners*. The former is shipped; the latter is empty until independent data is supplied and, by design, will stay empty rather than fabricate.

## Summary

| Area | Infrastructure | Externally Validated Outcome |
|---|---|---|
| **Placement** | Adaptive Rasch test + `placementValidation.js` storing known teacher/exam level, ability estimate, SE, interval, items. Metrics: exact agreement, within-one-band, MAE/RMSE, calibration vs 68% expected. | **Not validated** — `fp.placementValidations.v1` starts empty. No fabricated learners. Provisional until n≥20, validated until n≥20. |
| **Progression / Transfer** | `progressionValidation.js` requires held-out tasks (reading, listening, writing, speaking, grammar, vocab transfer) scored without scaffolding. | **Not validated** — `fp.progressionValidations.v1` empty. Progression currently reflects app mastery until unseen tasks are supplied. |
| **Writing / Speaking Marking** | `writingSpeakingCorpus.js` stores learner response, prompt/task, AI score/corrections, human score/corrections, criterion, rater, consensus. Metrics: MAE, within-5/10, correlation, false-correction and missed-error rates (heuristic), criterion-level. | **Not validated** — `fp.writingSpeakingCorpus.v1` empty. Existing `fp.examinerScripts.v1` / `fp.realExamResults.v1` also empty and report `no-data`/`provisional`. No teacher scores fabricated. |
| **FSRS / Retention** | `fsrsValidation.js` with log-loss, Brier, calibration curve, high-confidence gap, held-out fitting. `learnerValidation.js` retentionPredictionVsActual now uses real predicted/actual pairs. | **Provisional by construction** — scoring only runs above n≥50; fitting only above n≥200. No claim below the floor. |
| **Pronunciation Intelligibility** | `intelligibility.js` HUMAN_BENCHMARK protocol documented, `runBenchmark` reports r and MAE only when humanMean labels exist. | **Not validated** — benchmark array ships empty; `benchmarkStatus` returns `Unvalidated`. |
| **Exam Marking** | `exams/simulator.js` `benchmarkExaminer` (MAE, κ) and `validateAgainstResults` (exact/within-one) over real rater data. | **Not benchmarked** — `EXAMINER_SCRIPTS` and `REAL_RESULTS` empty; UI shows “Not benchmarked — treat as practice feedback, not a predicted grade.” |
| **Content Calibration** | `contentCalibration.js` audits every reading/listening item by frequency, sentence complexity, grammar, abstraction, idiomaticity, speech rate, support level; adds `provenance`/`reviewState`. | **Library audit available** but review states are `pending` until editorial review; flagged drift is reported, not hidden. |
| **Assistance Fading** | `assistanceValidation.js` tracks with- vs without-support scores, hints/retries, delayed retention, dependence detection. | **Not tracked** until events are logged — `fp.assistanceLog.v1` starts empty. |
| **Exam Validity** | `boards.js` carries `specVersion` + `verifyAt` + caveat; `tasks.js` every item has `provenance:'generated'` + `official:false` + `boardStyle`. Simulator returns `caveat` and distinguishes generated practice from official papers. | Specifications change — model is not a copy. Timings pass internal `timingQa` but are not authoritative; UI must surface `specCaveat()`. |

## What counts as validation

- **Independent known level**: teacher assessment or external exam (GCSE, DELF, TCF) supplied by a qualified rater with a source label, never invented.
- **Human-marked corpus**: corrections and scores from a qualified marker; at least two raters or a consensus for the “consensus” field.
- **Held-out tasks**: for progression, tasks the learner had not practised and scored without hints/captions/translation.
- **Sample floors**: placement n≥20, progression n≥15, corpus n≥30, FSRS n≥50, examiner n≥30. Below the floor: `provisional`; empty: `no-data` and an explicit “not validated” message.
- **Calibration**: reported as gap vs expected 68% for ±1 SE (placement) or reliability curve bins (FSRS). No single “accuracy” number is presented without its calibration.

## How to populate (and not to)

1. Export a `fp.placementValidations.v1` entry via Settings → Dev → “Add placement validation” (teacher supplies `knownLevel`, `rater`, `source`).
2. For writing/speaking, store the AI turn first (`recordCorpusEntry`), then later add the human mark (`updateCorpusHumanMark`). Do not overwrite the AI side.
3. For progression, after a level-up, assign a short held-out quiz (one per skill) with support off and record `recordProgressionValidation`.
4. Never paste synthetic “example” rows into the live store to make the dashboard look validated; the test suite guards this with `ships empty` assertions.

## Code locations

- `src/lib/placementValidation.js`, `progressionValidation.js`, `writingSpeakingCorpus.js`, `contentCalibration.js`, `assistanceValidation.js`
- `src/lib/storage.js` keys: `fp.placementValidations.v1`, `fp.progressionValidations.v1`, `fp.writingSpeakingCorpus.v1`, `fp.assistanceLog.v1`, `fp.contentCalibration.v1`
- `src/lib/intelligibility.js` protocol + `HUMAN_BENCHMARK`
- `src/lib/exams/simulator.js` `benchmarkExaminer` / `validateAgainstResults`
- `src/lib/fsrsValidation.js` scoring + `fitParameters` with held-out split

## Current counts (fresh install)

```
placementValidations: 0  → Not validated
progressionValidations: 0 → Not validated
writingSpeakingCorpus: 0 → Not validated
HUMAN_BENCHMARK: 0 → Unvalidated
EXAMINER_SCRIPTS: 0 → Not benchmarked
REAL_RESULTS: 0 → Not validated
assistanceLog: 0 → Not tracked
```

Add real data and the same code paths will report `Provisional` then `Validated` without any code change.
