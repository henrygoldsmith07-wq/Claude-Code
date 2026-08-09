# RTK — raw vs RTK agent-solve benchmark

Generated: 2026-08-09T12:17:15.276Z

> Precondition for agent solves: every fix-critical needle present in raw output is still present in RTK-compressed output, at lower token cost.
> No LLM calls — this harness measures needle retention + context saving; swap `hasNeedles()` for a model call to make it a live agent benchmark (same cases + needles are the ground truth).

| Case | Parser | Raw tokens | RTK tokens | Saved | Fixable? |
| --- | --- | ---: | ---: | ---: | --- |
| Vitest — wrong discount math (assertion diff + stack) | vitest | 14,320 | 123 | 99% (~14,197) | ✓ yes — all needles retained |
| tsc — 4 type errors (file:line + TS code) | tsc | 131 | 131 | 0% (~0) | ✓ yes — all needles retained |
| Next build — type error in page (Failed to compile + file ref) | next | 59 | 48 | 19% (~11) | ✓ yes — all needles retained |
| Generic tool failure (Error + totals) | generic | 21 | 16 | 24% (~5) | ✓ yes — all needles retained |
| tsc — single TS error with context line (true TS shape) | tsc | 37 | 37 | 0% (~0) | ✓ yes — all needles retained |

> Fixable = every fixNeedle present in RTK output. Raw is ground truth — fixtures are shaped so rawHas is true by construction.
> Token cost ≈ chars/4. CI fails if any RTK row is not fixable.
