# RTK retention on real-world failure logs

Generated: 2026-08-13T15:09:00.550Z

| Case | Parser | Raw | Emitted | Reduction | Critical retained |
| --- | --- | ---: | ---: | ---: | --- |
| corpus/ansi.log | vitest | 113 | 113 | 0% | ✓ 100% |
| corpus/cargo-build-fail.log | cargo | 596 | 178 | 70% | ✓ 100% |
| corpus/diff-4files.log | generic | 5575 | 599 | 89% | ✓ 100% |
| corpus/eslint-scan.log | eslint | 576 | 574 | 0% | ✓ 100% |
| corpus/generic-fail.log | vitest | 85 | 65 | 24% | ✓ 100% |
| corpus/gha-fail.log | gha | 1968 | 162 | 92% | ✓ 100% |
| corpus/gha-real-fail.log | gha | 397 | 315 | 21% | ✓ 100% |
| corpus/json-search.log | vitest | 28434 | 31 | 100% | n/a (pass log) |
| corpus/ndjson.log | vitest | 3114 | 55 | 98% | n/a (pass log) |
| corpus/next-fail.log | vitest | 236 | 100 | 58% | ✓ 100% |
| corpus/npm-ci-fail.log | pm | 869 | 829 | 5% | ✓ 100% |
| corpus/playwright-fail.log | generic | 444 | 168 | 62% | ✓ 100% |
| corpus/pytest-traceback.log | pytest | 633 | 230 | 64% | ✓ 100% |
| corpus/stack.log | vitest | 182 | 182 | 0% | ✓ 100% |
| corpus/tsc-fail.log | tsc | 522 | 522 | 0% | ✓ 100% |
| corpus/unicode.log | vitest | 73 | 73 | 0% | ✓ 100% |
| corpus/vitest-fail.log | vitest | 37523 | 491 | 99% | ✓ 100% |
| corpus/vitest-pass.log | vitest | 40613 | 76 | 100% | n/a (pass log) |
| synthetic/tsc-fail (true TS error) | tsc | 146 | 146 | 0% | ✓ 100% |

> Corpus lives in `benchmark/corpus/*.log` (captured real tool outputs). Synthetic tsc-fail uses a true `error TS2322` shape because `npx tsc` in /tmp fails at the wrapper layer.
> CI fails if any critical needle is missing. Use `node benchmark/retention.js [--write]` to refresh `benchmark/retention.md`.
