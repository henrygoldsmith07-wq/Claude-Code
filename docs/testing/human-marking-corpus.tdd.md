# Human marking corpus — TDD evidence

Source plan: no plan file was supplied; the journey and acceptance criteria were derived from the request and the existing marking benchmark.

## User journey

As a Revise maintainer, I want human-labelled marking examples stored as a versioned, validated corpus, so that rubric changes can be measured against the same auditable rows in CI and on the Benchmarks page.

## RED checkpoint

- Test: `npm.cmd test -- --run tests/human-marking-corpus.test.ts`
- Result: failed during collection because `@/domain/human-marking-corpus` did not exist.
- Commit: `bd99733 test(revise): define human marking corpus`

## GREEN checkpoint

- Test: `npm.cmd test -- --run tests/human-marking-corpus.test.ts`
- Result: 4 tests passed.
- Existing benchmark: `npm.cmd test -- --run tests/marking.benchmark.test.ts` — 7 tests passed; 12 rows, 0.583 exact-match, 0.417 per-part MAE.
- Commit: `7afe342 feat(revise): add human marking corpus`

## Guarantees

| # | Guarantee | Test | Result |
|---|---|---|---|
| 1 | Corpus metadata is versioned and row IDs are unique. | `tests/human-marking-corpus.test.ts` | PASS |
| 2 | Every human award aligns to a question part and stays within that part's mark range. | `tests/human-marking-corpus.test.ts` | PASS |
| 3 | The shared scorer reports row results, exact-match accuracy, per-part MAE and total MAE. | `tests/human-marking-corpus.test.ts` | PASS |
| 4 | The existing marking benchmark consumes the extracted corpus without changing its published 12-row metrics. | `tests/marking.benchmark.test.ts` | PASS |
| 5 | The Benchmarks page and ledger expose the corpus version and shared scoring harness. | `tests/phase8-public.test.ts` | PASS |

## Final validation

- `npm.cmd test -- --run tests/human-marking-corpus.test.ts tests/marking.benchmark.test.ts tests/phase8-public.test.ts`: 19/19 passed.
- `npm.cmd test -- --run tests/perf.test.ts --testTimeout=15000`: 6/6 passed; curriculum benchmark 1.045s.
- Full parallel suite: 481/482 passed; the existing curriculum timing assertion was starved by parallel workers and measured 5.676s against its 1.5s threshold. It passes in isolation above.
- `npm.cmd run type-check`: PASS.
- `npm.cmd run lint:check -- --no-warn-ignored`: PASS with 0 errors and 40 pre-existing warnings.
- `npm.cmd run build`: PASS.
- Coverage: no coverage script or provider is configured in `apps/revise/package.json`; no percentage is claimed.

