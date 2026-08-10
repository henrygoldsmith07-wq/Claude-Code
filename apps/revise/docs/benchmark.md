# Benchmarks — recommendation quality, marking and grades

Revise owns its claims with numbers. This doc records the harnesses, the invariants and the honest limits.

## Recommendation quality (synthetic → real)

*Source:* `src/domain/recommender.ts` — `syntheticOutcomePairs`, `benchmarkRecommendationQuality`; `tests/recommender.benchmark.test.ts`.

- 400 deterministic synthetic learner states covering the product of urgency × weakness × forgetting × uncertainty × exam proximity × adaptive difficulty.
- Invariants pinned: urgency monotone in days-to-exam, weakness monotone in mastery, forgetting monotone in retention/days, uncertainty monotone in evidence, no duplicate keys, explanation present, total ordering.
- Outcome harness: `benchmarkRecommendationQuality(pairs)` reports `mae | bias | correlation | hitRate (±5 marks)` over `(predicted, actual)` pairs.
- Synthetic now via `syntheticOutcomePairs(seed, n, subjectId, topicIds)`; production replaces them with `(simulatePaper.predictedMarks, laterTimedPaper.actualMarks)`.
- Philosophy: rank by **marks per minute**, not popularity. Every candidate is scored as expected exam marks per minute; proximity and adaptive-difficulty are bounded multipliers (1.0–1.45 and 0.85–1.15) so no single factor dominates.

## Marking — rubric floor + AI vs human

*Source:* `src/domain/marking.ts`, `tests/marking.test.ts`, `tests/marking.benchmark.test.ts`.

- Rubric: keyword + lemma overlap ≥50% per mark-scheme point or numeric match; 3-word cap, proportional award, strict about content, generous about wording.
- Benchmark harness: 3-row synthetic gold set (4 marks / 0 marks / 1 mark) with `accuracy` floor and examiner-voice feedback contract.
- Real AI vs human will be reported here as a table keyed by `questionId` once provider-marked gold exists: rows `(rubricAward, aiAward, humanAward)` and aggregate `rubricVsHuman MAE` vs `aiVsHuman MAE`.
- UI labels every answer `rubric` vs `ai` so the student is never misled.

## Grade prediction & confidence calibration

*Source:* `src/domain/grades.ts`, `tests/grade-calibration.test.ts`.

- `predictGrade` blends measured accuracy and coverage; band + confidence, never a single letter.
- `calibrationReport(pairs)` computes Brier score, ECE, per-bucket `meanPredicted vs meanActual`, bias; well-calibrated is ECE < 0.08.
- `syntheticCalibrationOutcomes(seed, n)` benchmarks without real papers; production uses `(predictGrade.percent/100, laterPaperPercent/100)`.
- `calibrateFromHistory({ subjectId, pairs })` fits `slope/bias/mae` over ≥3 timed papers; thin-sample path returns identity.

## Curriculum regression

*Source:* `scripts/validate-curriculum.mjs`, `src/domain/content-review.ts`, `tests/coverage.test.ts`.

- Every topic has `specPoints` on every unit; every `specPointIds` is paired with `learningClaims`; stale topics (>365d) and unverified statements are surfaced by `regressionReport`.
- CI gate: `node scripts/validate-curriculum.mjs` — 110 topics / 142 questions today.

## Offline & sync invariants

*Source:* `src/data/sync.ts`, `tests/sync.test.ts`.

- IndexedDB is the source of truth; Supabase is a replica drained via an outbox.
- Outbox batches per entity; last-write-wins per row on `updatedAt`; FSRS state resolves to the later review row. E2E smoke in `tests/sync.test.ts` covers onboarding → seed → due queue → grade → mistake loop without a browser; full Playwright offline harness lives in `e2e/`.

## Performance & security floors

*Source:* `tests/perf.test.ts`, `tests/security.test.ts`, `next.config.ts`.

- Perf budgets: curriculum modules and domain files are size-capped; curriculum validation < 1.5s.
- Security: RLS enabled on every user-owned table (`with check user_id = auth.uid()`), plus `updated_at` trigger and hostile-import clamping (`deck-io`).

## Case studies (synthetic now, real cohorts later)

The product ships with synthetic longitudinal histories. Once timetabled-paper → later-paper outcomes exist, this section will carry:

- Cohort: n, weeks, board, grade movement, MAE/bias/correlation before and after each engine change.
- The method will be the same harnesses above; numbers will be from observed `(predicted, actual)` rather than synthetic.
