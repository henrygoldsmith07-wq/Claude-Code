# Distractor quality validation — TDD evidence

Source plan: no plan file was supplied; the journey and acceptance criteria were derived from the request and the existing question-validation lifecycle.

## User journey

As a content reviewer, I want MCQ distractors checked structurally and against observed responses, so that duplicate, blank, unused, or misleading options are identified before questions are trusted.

## RED checkpoint

- Test: `npm.cmd test -- --run tests/distractor-quality.test.ts`
- Result: failed during collection because `@/domain/distractor-quality` did not exist.
- Commit: `d619940 test(revise): define distractor quality validation`

## GREEN checkpoint

- Test: `npm.cmd test -- --run tests/distractor-quality.test.ts`
- Result: 7 tests passed.
- Related regression suite: `npm.cmd test -- --run tests/question-validation.test.ts` — 6 tests passed.
- Commit: `9003750 feat(revise): add distractor quality validation`

## Guarantees

| # | Guarantee | Test | Result |
|---|---|---|---|
| 1 | Non-MCQ questions are not treated as distractor-bearing items. | `tests/distractor-quality.test.ts` | PASS |
| 2 | Blank and case/whitespace-normalised duplicate options are blocking structural issues. | `tests/distractor-quality.test.ts` | PASS |
| 3 | Responses are deduplicated to the latest valid attempt per learner. | `tests/distractor-quality.test.ts` | PASS |
| 4 | Unused and over-selected distractors are warnings only once the response minimum is met. | `tests/distractor-quality.test.ts` | PASS |
| 5 | Empty answers are excluded rather than coerced to option A. | `tests/distractor-quality.test.ts` | PASS |
| 6 | The report is persisted through `validateQuestion` and its blocking issues affect validation status. | `tests/distractor-quality.test.ts`, `tests/question-validation.test.ts` | PASS |

## Final validation

- `npm.cmd test -- --run --testTimeout=15000`: 477/478 passed; the existing curriculum performance assertion measured 1.593s against its 1.5s budget under the parallel suite. The same `tests/perf.test.ts` file passed in isolation: 6/6, 995ms for the benchmark.
- `npm.cmd run type-check`: PASS.
- `npm.cmd run lint:check -- --no-warn-ignored`: PASS with 0 errors and 40 pre-existing warnings.
- `npm.cmd run build`: PASS.
- Coverage: no coverage script or provider is configured in `apps/revise/package.json`; no percentage is claimed.

