# RTK benchmark — evidence

Generated: 2026-08-13T15:08:57.690Z
Commit: 86c0b42
Tokenizer: o200k_base (js-tiktoken o200k_base when available, else chars/4 fallback)

| Command | Parser | Raw chars | Emitted chars | Reduction | Raw tokens | Emitted tokens | Token red. | Saved $/1k runs* | Latency | Critical retained |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vitest pass (200 tests) | vitest | 61210 | 76 | 100% | 22966 | 26 | 100% | $57.35 | 0.4ms | ✓ 100% |
| Vitest failure (2 fails) | vitest | 57281 | 491 | 99% | 20012 | 168 | 99% | $49.61 | 0.9ms | ✓ 100% |
| tsc pass (clean) | tsc | 13 | 38 | -192% | 6 | 11 | -83% | $0.00 | 0.1ms | n/a |
| tsc failure (4 errors) | tsc | 522 | 522 | 0% | 169 | 169 | 0% | $0.00 | 0.2ms | ✓ 100% |
| Next build failure | next | 236 | 191 | 19% | 61 | 46 | 25% | $0.038 | 0.4ms | ✓ 100% |
| Next build pass | next | 371 | 288 | 22% | 81 | 59 | 27% | $0.055 | 0.1ms | ✓ 100% |
| Generic failure | generic | 85 | 65 | 24% | 33 | 23 | 30% | $0.025 | 0.3ms | ✓ 100% |
| ESLint errors | eslint | 143 | 143 | 0% | 51 | 51 | 0% | $0.00 | 0.1ms | ✓ 100% |
| Pytest failure | pytest | 160 | 160 | 0% | 57 | 57 | 0% | $0.00 | 0.2ms | ✓ 100% |
| Ruff | ruff | 98 | 98 | 0% | 36 | 36 | 0% | $0.00 | 0.1ms | ✓ 100% |
| mypy | mypy | 89 | 64 | 28% | 28 | 20 | 29% | $0.020 | 0.1ms | ✓ 100% |
| Cargo error | cargo | 149 | 77 | 48% | 45 | 22 | 51% | $0.058 | 0.2ms | ✓ 100% |
| Go test FAIL | go-test | 93 | 93 | 0% | 36 | 36 | 0% | $0.00 | 0.2ms | ✓ 100% |
| Maven BUILD FAILURE | maven | 120 | 120 | 0% | 41 | 41 | 0% | $0.00 | 0.1ms | ✓ 100% |
| Gradle BUILD FAILED | gradle | 124 | 124 | 0% | 36 | 36 | 0% | $0.00 | 0.5ms | ✓ 100% |
| Docker ERROR | docker | 103 | 103 | 0% | 29 | 29 | 0% | $0.00 | 0.5ms | ✓ 100% |
| K8s CrashLoop | k8s | 92 | 65 | 29% | 30 | 23 | 23% | $0.018 | 0.4ms | ✓ 100% |
| Terraform Error | terraform | 74 | 74 | 0% | 21 | 21 | 0% | $0.00 | 0.3ms | ✓ 100% |
| npm ERR! | pm | 76 | 76 | 0% | 20 | 20 | 0% | $0.00 | 0.3ms | ✓ 100% |
| Git CONFLICT | git | 102 | 102 | 0% | 26 | 26 | 0% | $0.00 | 0.4ms | ✓ 100% |
| GHA annotation | gha | 109 | 96 | 12% | 32 | 28 | 13% | $0.010 | 0.5ms | ✓ 100% |
| Truncate (2k-line verbose log) | generic | 112889 | 32 | 100% | 26999 | 8 | 100% | $67.48 | 0.4ms | n/a |
| GitHub Actions log (failure) | generic | 1968 | 89 | 95% | 699 | 30 | 96% | $1.67 | 0.2ms | ✓ 100% |
| Search results JSON (120 hits) | generic | 68217 | 32 | 100% | 17077 | 8 | 100% | $42.67 | 0.3ms | n/a |
| CLI verbose (2k lines) | generic | 106419 | 32 | 100% | 26079 | 8 | 100% | $65.18 | 0.2ms | n/a |
| Diff (4 files) | generic | 5575 | 599 | 89% | 1451 | 236 | 84% | $3.04 | 0.1ms | ✓ 100% |
| Stack trace | vitest | 182 | 182 | 0% | 67 | 67 | 0% | $0.00 | 0.2ms | ✓ 100% |
| NDJSON logs | generic | 1564 | 55 | 96% | 558 | 19 | 97% | $1.35 | 0.0ms | ✓ 100% |
| JUnit XML | generic | 187 | 187 | 0% | 60 | 60 | 0% | $0.00 | 0.0ms | ✓ 100% |
| SARIF | generic | 199 | 199 | 0% | 54 | 54 | 0% | $0.00 | 0.0ms | ✓ 100% |
| ANSI escapes | vitest | 113 | 113 | 0% | 53 | 53 | 0% | $0.00 | 0.0ms | ✓ 100% |
| Unicode + emoji | generic | 73 | 73 | 0% | 26 | 26 | 0% | $0.00 | 0.0ms | ✓ 100% |
| Nested JSON | generic | 180 | 180 | 0% | 107 | 107 | 0% | $0.00 | 0.0ms | ✓ 100% |
| CRLF vitest failure | vitest | 78 | 78 | 0% | 24 | 24 | 0% | $0.00 | 0.0ms | ✓ 100% |
| Truncated mid-error (no trailing newline) | vitest | 55 | 55 | 0% | 16 | 16 | 0% | $0.00 | 0.0ms | ✓ 100% |

> Tokenizer: o200k_base. When js-tiktoken is installed, token counts use o200k_base (GPT-4o family); else chars/4 fallback. Both are reported where applicable.
> Fixtures are deterministic synthetic logs shaped like real tool output (see `benchmark/fixtures.js`, `datasets.js`).
> Reduction = `1 − emitted/raw`. Critical retained checks that every failure/error/total line the developer needs is still present.
> `*` Saved $/1k runs = tokensSaved × $2.50/1M (GPT-4o input price) × 1000 — blended table in `src/tokens.js` has Claude/Gemini too.
> Latency = parser filter time per fixture (p50 proxy; wall-clock in `performance.now()`).<br> `tsc pass` raw is near-empty (tsc prints nothing on success); rtk collapses it to one line — the negative % reflects that the shell wrapper dominates.
> Representative datasets: GitHub Actions, JSON/search results, CLI verbose, diff, stack, NDJSON, JUnit, SARIF, ANSI, Unicode — plus all 15+ tool parsers.
> Latency: p50/p95 measured in benchmark/perf.js (separate harness).
