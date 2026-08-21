# Validation Status — Le Studio French

> **Infrastructure vs outcomes.** This document distinguishes *what the code can now measure* from *what has been externally validated with real learners*. The former is shipped; the latter is empty until independent data is supplied and, by design, will stay empty rather than fabricate.

## Summary

| Area | Infrastructure | Externally Validated Outcome |
|---|---|---|
| **Placement** | Adaptive Rasch test + `placementValidation.js` storing known teacher/exam level, ability estimate, SE, interval, items. Metrics: exact agreement, within-one-band, MAE/RMSE, calibration vs 68% expected. | **Not validated** — `fp.placementValidations.v1` starts empty. No fabricated learners. Provisional until n≥20, validated until n≥20. |
| **Progression / Transfer** | `progressionValidation.js` requires held-out tasks (reading, listening, writing, speaking, grammar, vocab transfer) scored without scaffolding. | **Not validated** — `fp.progressionValidations.v1` empty. Progression currently reflects app mastery until unseen tasks are supplied. |
| **Writing / Speaking Marking** | `writingSpeakingCorpus.js` stores learner response, prompt/task, AI score/corrections, human score/corrections, criterion, rater, consensus, plus an independent second mark (`humanScore2`/`rater2`). Metrics: MAE, within-5/10, correlation, false-correction and missed-error rates (heuristic), criterion-level, and inter-rater agreement over double-marked samples (exact, within-5, κ over score bands). Writing-studio reviews **and arena turns** seed the AI side automatically (writing and speaking). | **Not validated** — `fp.writingSpeakingCorpus.v1` empty. Existing `fp.examinerScripts.v1` / `fp.realExamResults.v1` also empty and report `no-data`/`provisional`. No teacher scores fabricated. |
| **FSRS / Retention** | `fsrsValidation.js` with log-loss, Brier, calibration curve, high-confidence gap, held-out fitting. `learnerValidation.js` retentionPredictionVsActual now uses real predicted/actual pairs. | **Provisional by construction** — scoring only runs above n≥50; fitting only above n≥200. No claim below the floor. |
| **Pronunciation Intelligibility** | `intelligibility.js` HUMAN_BENCHMARK protocol documented, `makeBenchmarkSample` validates labelled recordings (target, transcript, 1–5 `humanMean`, raters), and DevPanel ingests them into `fp.intelligibilityBenchmark.v1`; `runBenchmark`/`benchmarkStatus` report r and MAE once labels exist. | **Not validated** — the in-source array ships empty and the store starts empty; `benchmarkStatus` returns `Unvalidated`. |
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

1. **Placement**: take the adaptive test (Learning path → placement — it stores the result locally), then Settings → Dev Panel → *Placement validation — teacher entry* pairs it with an independently known level (`knownLevel`, rater, source). Genuine GCSE/DELF/TCF results belong in `source` (e.g. "DELF B1, June sitting"); real predicted-vs-returned grades go through Exam simulator marking → *actual grade*. The Analytics screen surfaces agreement/calibration status.
2. For writing/speaking, every Writing-studio review and every arena turn seeds the AI side of a corpus entry automatically; add the human mark via Dev Panel → *Corpus marking — human rater entry* (`updateCorpusHumanMark`). Do not overwrite the AI side.
3. **Double-marking**: have a second qualified rater re-mark the same response in the same card (`updateCorpusSecondMark`). A second mark by the first rater is refused. Once samples are double-marked, inter-rater agreement (exact, within-5, κ over score bands) appears in the corpus metrics.
4. For pronunciation, collect labelled recordings per the protocol in `intelligibility.js` (3 native listeners each, 1–5 intelligibility scale, drop 2+-point disagreements) and paste them as JSON into Dev Panel → *Pronunciation benchmark — human ratings* (`recordBenchmarkSample`). Invalid rows are rejected and counted, never coerced.
5. For progression, after a level-up use `buildTransferCheck({ level, banks, excludeIds })` to draw one unseen task per skill from CEFR-tagged banks, score it with support off, and record `recordProgressionValidation`.
6. Conversation turns automatically log assistance evidence (hints used → with/without support + score) to `fp.assistanceLog.v1`, feeding the dependence check.
7. Never paste synthetic "example" rows into the live store to make the dashboard look validated; the test suite guards this with `ships empty` assertions.

## Code locations

- `src/lib/placementValidation.js`, `progressionValidation.js` (+ `buildTransferCheck`), `writingSpeakingCorpus.js`, `contentCalibration.js`, `assistanceValidation.js`
- `src/lib/aiValidate.js` — runtime authority for AI structured-output shape (used by `groq.js`; re-exported through `schemas.ts`)
- `src/lib/storage.js` keys: `fp.placementValidations.v1`, `fp.progressionValidations.v1`, `fp.writingSpeakingCorpus.v1`, `fp.assistanceLog.v1`, `fp.contentCalibration.v1`, `fp.intelligibilityBenchmark.v1`, `fp.lastPlacement.v1`
- UI surfacing: Analytics → *Learner validation → External validation* rows; DevPanel → *Placement validation — teacher entry*, *Corpus marking — human rater entry*, *Pronunciation benchmark — human ratings*; ChatArena tiered corrections
- `src/lib/intelligibility.js` protocol + `HUMAN_BENCHMARK` + `makeBenchmarkSample`
- `src/lib/exams/simulator.js` `benchmarkExaminer` / `validateAgainstResults`
- `src/lib/fsrsValidation.js` scoring + `fitParameters` with held-out split

## Current counts (fresh install)

```
placementValidations: 0  → Not validated
progressionValidations: 0 → Not validated
writingSpeakingCorpus: 0 → Not validated
intelligibilityBenchmark: 0 → Unvalidated
HUMAN_BENCHMARK: 0 → Unvalidated
EXAMINER_SCRIPTS: 0 → Not benchmarked
REAL_RESULTS: 0 → Not validated
assistanceLog: 0 → Not tracked
```

Add real data and the same code paths will report `Provisional` then `Validated` without any code change.
