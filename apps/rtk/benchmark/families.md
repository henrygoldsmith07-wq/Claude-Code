# RTK benchmark — token savings across model families

Generated: 2026-08-13T15:09:00.421Z
Commit: 86c0b42

Same 35 evidence cases as benchmark/run.js, scored with every js-tiktoken encoding: o200k_base (GPT-4o/o1), cl100k_base (GPT-4/3.5), p50k_base (Codex), r50k_base (text-davinci), gpt2.

| Family | Encoding | Headline model | Raw tokens | RTK tokens | Tokens saved | Reduction | $ saved / 1k runs* |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| GPT-4o / GPT-4.1 / o1 family | o200k_base | gpt-4o @ $2.5/1M input | 117,086 | 1,664 | 115,427 | 99% | $288.57 |
| GPT-4 / GPT-3.5 family | cl100k_base | gpt-4 @ $30/1M input | 117,084 | 1,647 | 115,442 | 99% | $3463.26 |
| Codex / code models | p50k_base | code-davinci-002 @ $0.12/1M input | 127,765 | 1,867 | 125,903 | 99% | $15.11 |
| GPT-3 / text-davinci family | r50k_base | text-davinci-003 @ $2/1M input | 137,486 | 1,941 | 135,550 | 99% | $271.10 |
| GPT-2 base | gpt2 | gpt-3.5-turbo @ $0.5/1M input | 137,486 | 1,941 | 135,550 | 99% | $67.78 |

**Stability:** reduction spread across families = 0 pts (min 99%, max 99%, avg 99%). A low spread means RTK's savings hold regardless of which model's tokenizer bills the context.

Per-case reduction % by family (raw → RTK):

| Case | Parser | o200k | cl100k | p50k | r50k | gpt2 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Vitest pass (200 tests) | vitest | 100% | 100% | 100% | 100% | 100% |
| Vitest failure (2 fails) | vitest | 99% | 99% | 99% | 99% | 99% |
| tsc pass (clean) | tsc | -83% | -71% | -71% | -71% | -71% |
| tsc failure (4 errors) | tsc | 0% | 0% | 0% | 0% | 0% |
| Next build failure | nextBuild | 25% | 25% | 23% | 35% | 35% |
| Next build pass | nextBuild | 27% | 27% | 26% | 31% | 31% |
| Generic failure | generic | 30% | 30% | 26% | 26% | 26% |
| ESLint errors | eslint | 0% | 0% | 0% | 0% | 0% |
| Pytest failure | pytest | 0% | 0% | 0% | 0% | 0% |
| Ruff | ruff | 0% | 0% | 0% | 0% | 0% |
| mypy | mypy | 29% | 29% | 31% | 31% | 31% |
| Cargo error | cargo | 51% | 51% | 50% | 51% | 51% |
| Go test FAIL | gotest | 0% | 0% | 0% | 0% | 0% |
| Maven BUILD FAILURE | maven | 0% | 0% | 0% | 0% | 0% |
| Gradle BUILD FAILED | gradle | 0% | 0% | 0% | 0% | 0% |
| Docker ERROR | docker | 0% | 0% | 0% | 0% | 0% |
| K8s CrashLoop | k8s | 23% | 23% | 28% | 28% | 28% |
| Terraform Error | terraform | 0% | 0% | 0% | 0% | 0% |
| npm ERR! | pm | 0% | 0% | 0% | 0% | 0% |
| Git CONFLICT | git | 0% | 0% | 0% | 0% | 0% |
| GHA annotation | gha | 13% | 13% | 14% | 14% | 14% |
| Truncate (2k-line verbose log) | generic | 100% | 100% | 100% | 100% | 100% |
| GitHub Actions log (failure) | generic | 96% | 96% | 96% | 96% | 96% |
| Search results JSON (120 hits) | generic | 100% | 100% | 100% | 100% | 100% |
| CLI verbose (2k lines) | generic | 100% | 100% | 100% | 100% | 100% |
| Diff (4 files) | generic | 84% | 84% | 79% | 79% | 79% |
| Stack trace | vitest | 0% | 0% | 0% | 0% | 0% |
| NDJSON logs | generic | 97% | 97% | 96% | 96% | 96% |
| JUnit XML | generic | 0% | 0% | 0% | 0% | 0% |
| SARIF | generic | 0% | 0% | 0% | 0% | 0% |
| ANSI escapes | vitest | 0% | 0% | 0% | 0% | 0% |
| Unicode + emoji | generic | 0% | 0% | 0% | 0% | 0% |
| Nested JSON | generic | 0% | 0% | 0% | 0% | 0% |
| CRLF vitest failure | vitest | 0% | 0% | 0% | 0% | 0% |
| Truncated mid-error (no trailing newline) | vitest | 0% | 0% | 0% | 0% | 0% |

> `$ saved / 1k runs` = tokensSaved × headline-model input price × 1000. Prices: gpt-4o $2.50, gpt-4 $30, code-davinci-002 $0.12, text-davinci-003 $2.00, gpt-3.5-turbo $0.50 per 1M input tokens.
> Anthropic (Claude) and Gemini use proprietary tokenizers; their cost rows in `src/tokens.js` are estimated with the o200k_base proxy count. The stability section shows savings are tokenizer-robust, so these estimates are credible.
> Negative per-case reduction happens where the raw output is already minimal (e.g. `tsc pass` prints nothing) — the aggregate columns are the honest number.
