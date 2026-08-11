# RTK live agent benchmark — raw vs RTK task success

Generated: 2026-08-11T09:07:20.625Z
Tokenizer: o200k_base
Providers: openai,anthropic,gemini
Live keys present: no (precondition only)

> No live API keys detected (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY). Results below are precondition needle-retention checks (same as `benchmark/agent-solve.js`), not live model calls. Add keys and re-run to get true task-success numbers.

| Case | Kind | Provider | Success | Latency | Needles |
| --- | --- | --- | --- | --- | --- |
| Vitest — wrong discount math (assertion diff + stack) | raw | precondition | ✓ | — | ✓ |
| Vitest — wrong discount math (assertion diff + stack) | rtk | precondition | ✓ | — | ✓ |
| tsc — 4 type errors (file:line + TS code) | raw | precondition | ✓ | — | ✓ |
| tsc — 4 type errors (file:line + TS code) | rtk | precondition | ✓ | — | ✓ |
| Next build — type error in page (Failed to compile + file ref) | raw | precondition | ✓ | — | ✓ |
| Next build — type error in page (Failed to compile + file ref) | rtk | precondition | ✓ | — | ✓ |
| Generic tool failure (Error + totals) | raw | precondition | ✓ | — | ✓ |
| Generic tool failure (Error + totals) | rtk | precondition | ✓ | — | ✓ |
| tsc — single TS error with context line (true TS shape) | raw | precondition | ✓ | — | ✓ |
| tsc — single TS error with context line (true TS shape) | rtk | precondition | ✓ | — | ✓ |

> Summary: raw 5/5 fixable, RTK 5/5 fixable. RTK must not lose success vs raw.
