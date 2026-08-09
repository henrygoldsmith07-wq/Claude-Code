# RTK retention on real-world failure logs

Generated: 2026-08-09T12:17:15.247Z

| Case | Parser | Raw | Emitted | Reduction | Critical retained |
| --- | --- | ---: | ---: | ---: | --- |
| corpus/generic-fail.log | vitest | 46 | 37 | 20% | ✓ 100% |
| corpus/node-test-fail.log | vitest | 785 | 318 | 59% | ✓ 100% |
| corpus/npm-test-pass.log | vitest | 2794 | 402 | 86% | n/a (pass log) |
| corpus/tsc-fail.log | tsc | 544 | 38 | 93% | n/a (pass log) |
| corpus/tsc-pass.log | tsc | 0 | 38 | 0% | n/a (pass log) |
| corpus/vitest-fail.log | vitest | 3504 | 870 | 75% | ✓ 100% |
| synthetic/tsc-fail (true TS error) | tsc | 146 | 146 | 0% | ✓ 100% |

> Corpus lives in `benchmark/corpus/*.log` (captured real tool outputs). Synthetic tsc-fail uses a true `error TS2322` shape because `npx tsc` in /tmp fails at the wrapper layer.
> CI fails if any critical needle is missing. Use `node benchmark/retention.js [--write]` to refresh `benchmark/retention.md`.
