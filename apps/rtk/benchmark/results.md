# RTK benchmark — evidence

Generated: 2026-08-10T19:44:34.075Z
Commit: a2b081d

| Command | Parser | Raw chars | Emitted chars | Reduction | Raw lines | Emitted lines | Critical retained |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vitest pass (200 tests) | vitest | 61210 | 76 | 100% | 1200 | 3 | ✓ 100% |
| Vitest failure (2 fails) | vitest | 57281 | 491 | 99% | 1173 | 15 | ✓ 100% |
| tsc pass (clean) | tsc | 13 | 38 | -192% | 2 | 1 | n/a |
| tsc failure (4 errors) | tsc | 522 | 522 | 0% | 9 | 9 | ✓ 100% |
| Next build failure | next | 236 | 191 | 19% | 8 | 6 | ✓ 100% |
| Next build pass | next | 371 | 288 | 22% | 10 | 8 | ✓ 100% |
| Generic failure | generic | 85 | 65 | 24% | 5 | 3 | ✓ 100% |
| Truncate (2k-line verbose log) | generic | 112889 | 32 | 100% | 2000 | 1 | n/a |
| GitHub Actions log (failure) | generic | 1968 | 89 | 95% | 35 | 3 | ✓ 100% |
| Search results JSON (120 hits) | generic | 68217 | 32 | 100% | 1928 | 1 | n/a |
| CLI verbose (2k lines) | generic | 106419 | 32 | 100% | 2000 | 1 | n/a |
| Diff (4 files) | generic | 5575 | 599 | 89% | 176 | 24 | ✓ 100% |
| Stack trace | vitest | 182 | 182 | 0% | 6 | 6 | ✓ 100% |

> Fixtures are deterministic synthetic logs shaped like real tool output (see `benchmark/fixtures.js`, `datasets.js`).
> Reduction = `1 − emitted/raw`. Critical retained checks that every failure/error/total line the developer needs is still present.
> `tsc pass` raw is near-empty (tsc prints nothing on success); rtk collapses it to one line — the negative % reflects that the shell wrapper dominates.
> Representative datasets: GitHub Actions, JSON/search results, CLI verbose, diff, and stack traces demonstrate structural filtering at scale.
