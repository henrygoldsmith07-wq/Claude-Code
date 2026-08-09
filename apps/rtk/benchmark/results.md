# RTK benchmark — evidence

Generated: 2026-08-07T20:16:01.890Z
Commit: 4530ad3

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

> Fixtures are deterministic synthetic logs shaped like real tool output (see `benchmark/fixtures.js`).
> Reduction = `1 − emitted/raw`. Critical retained checks that every failure/error/total line the developer needs is still present.
> `tsc pass` raw is near-empty (tsc prints nothing on success); rtk collapses it to one line — the negative % reflects that the shell wrapper dominates.
