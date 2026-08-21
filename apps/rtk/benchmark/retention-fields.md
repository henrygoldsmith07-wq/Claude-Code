# RTK retention — per-field accuracy

Generated: 2026-08-21T14:27:41.502Z
RTK commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
Corpus version: corpus-50-777a244a
Tokenizer: o200k_base

> Cases evaluated: 59 (synthetic + adversarial + captured). Captured logs are ground truth for real-world retention; synthetic shows parser robustness.

## Per-field retention (all cases, where field appears in raw)

| Field | Cases with field | Total instances | Retained | Retention | Cases perfect |
| --- | ---: | ---: | ---: | ---: | ---: |
| filename | 48 | 184 | 64 | 35% | 77% |
| path | 33 | 80 | 46 | 57% | 82% |
| line number | 37 | 329 | 135 | 41% | 76% |
| column | 33 | 323 | 130 | 40% | 73% |
| error type | 44 | 52 | 50 | 96% | 95% |
| failed test name | 10 | 22 | 22 | 100% | 100% |
| expected value | 5 | 5 | 4 | 80% | 80% |
| actual value | 3 | 4 | 3 | 75% | 67% |
| relevant stack frame | 23 | 288 | 105 | 36% | 78% |
| exit status | 13 | 18 | 17 | 94% | 92% |
| command | 8 | 15 | 10 | 67% | 63% |
| warning type | 6 | 11 | 9 | 82% | 67% |
| root-cause context | 6 | 11 | 4 | 36% | 50% |
| actionable remediation clues | 8 | 10 | 6 | 60% | 50% |

> Critical fields (error type, failed test, exit status) must be ≥95% retained. Filename/line/stack include passing-noise and internal frames that are intentionally collapsed, so their overall pct is lower by design — per-parser tables show the failure-relevant retention.

## Per-parser family retention (retention % where applicable)

| Parser | filename | path | line_number | column | error_type | failed_test_name | expected_value | actual_value | stack_frame | exit_status | command | warning_type | root_cause | remediation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cargo | 100% | 100% | 100% | 100% | 100% | — | — | — | — | — | — | 50% | 0% | 0% |
| eslint | 100% | 100% | 100% | 100% | 100% | — | — | — | — | — | 100% | 100% | — | 100% |
| generic | 21% | 59% | 33% | 33% | 89% | — | 100% | 50% | 33% | 80% | 70% | 100% | 100% | 83% |
| gha | 75% | — | 67% | 67% | 100% | — | — | — | 67% | 100% | 50% | — | — | — |
| go-test | 100% | — | 100% | — | — | 100% | — | — | — | — | — | — | — | — |
| gradle | 100% | 100% | 100% | 100% | 100% | 100% | — | — | — | 100% | — | — | 0% | 0% |
| k8s | — | — | — | — | 100% | — | — | — | — | — | — | 100% | — | — |
| maven | 100% | 100% | — | — | 100% | — | — | — | — | 100% | — | — | — | — |
| next | 100% | 100% | 100% | 100% | 100% | — | — | — | 100% | — | — | — | 100% | — |
| pytest | 100% | 100% | 100% | — | 100% | 100% | 100% | — | — | — | — | — | — | — |
| terraform | 100% | — | — | — | 100% | — | — | — | — | — | — | — | — | — |
| tsc | 63% | 50% | 77% | 77% | 100% | — | — | — | 0% | — | — | — | — | — |
| vitest | 34% | 33% | 65% | 67% | 100% | 100% | 67% | 100% | 100% | 100% | — | — | — | — |

## Failing cases (any field <100% where critical)

> 17 case(s) lost a critical field:

| File | Parser | Field | Missing |
| --- | --- | --- | --- |
| vitest-fail.log | vitest | filename | src/lib/foo0.test.ts, src/lib/foo1.test.ts |
| vitest-pass.log | generic | filename | src/lib/foo0.test.ts, src/lib/foo1.test.ts |
| diff-4files.log | generic | filename | a/src/file0.ts, b/src/file0.ts |
| stack.log | generic | line_number | :95:5 |
| playwright-fail.log | generic | line_number | :18:5 |
| gha-real-fail.log | gha | filename | home/runner/work/_actions/actions/setup-node/v4/dist/setup/index.js |
| gha-real-fail.log | gha | line_number | :4:5 |
| gha-real-fail.log | gha | stack_frame | at cleanup (/home/runner/work/_actions/actions/setup-node/v4/dist/setup/index.js:4:5 |
| git-conflict.log | generic | filename | src/app.ts |
| massive-stack.log | generic | line_number | :40:5, :41:5 |
| massive-stack.log | generic | error_type | Error: |
| massive-stack.log | generic | stack_frame | at func30 (src/app.ts:40:5, at func31 (src/app.ts:41:5 |
| interleaved-parallel.log | generic | line_number | :71:5, :73:5 |
| interleaved-parallel.log | generic | stack_frame | at src/worker1.ts:71:5, at src/worker0.ts:73:5 |
| windows-paths.log | tsc | filename | Users\runner\project\src\app.ts, project\src\bar.ts |
| windows-paths.log | tsc | line_number | :42:10, :100:20 |
| windows-paths.log | tsc | stack_frame | at C:\project\src\bar.ts:100:20 |
| unix-paths.log | tsc | filename | src/app/page.tsx |
| unix-paths.log | tsc | line_number | :42:10 |
| unix-paths.log | tsc | stack_frame | at ./src/app/page.tsx:42:10 |
| real-git-status.log | generic | filename | apps/arise/src/components/SessionRunner.jsx, apps/arise/src/lib/export.js |
| real-git-log.log | generic | error_type | f901 |
| real-git-diff.log | generic | filename | apps/arise/src/components/SessionRunner.jsx, apps/arise/src/lib/export.js |
| real-node-test-fail.log | vitest | filename | Node.js |
| real-node-test-fail.log | vitest | line_number | :152, :219:10 |
| synthetic/vitest | vitest | filename | src/lib/foo0.test.ts, src/lib/foo1.test.ts |
| synthetic/stack | generic | line_number | :95:5 |

## Provenance

```
rtk commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
benchmark: 0.3.0
corpus: corpus-50-777a244a
os: Windows_NT 10.0.26200 x64
date: 2026-08-21T14:27:41.502Z
```
