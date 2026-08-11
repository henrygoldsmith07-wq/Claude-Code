# RTK — raw vs RTK agent-solve benchmark

Generated: 2026-08-11T09:07:20.066Z
Tokenizer: o200k_base

> Precondition for agent solves: every fix-critical needle present in raw output is still present in RTK-compressed output, at lower token cost. Tokenizer: o200k_base.
> No LLM calls — this harness measures needle retention + context saving; swap `hasNeedles()` for a model call to make it a live agent benchmark (same cases + needles are the ground truth).

| Case | Parser | Raw tokens | RTK tokens | Saved | $ saved/1k runs* | Fixable? |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Vitest — wrong discount math (assertion diff + stack) | vitest | 20,012 | 168 | 99% (~19,844) | $49.61 | ✓ yes — all needles retained |
| tsc — 4 type errors (file:line + TS code) | tsc | 169 | 169 | 0% (~0) | $0.00 | ✓ yes — all needles retained |
| Next build — type error in page (Failed to compile + file ref) | next | 61 | 46 | 25% (~15) | $0.038 | ✓ yes — all needles retained |
| Generic tool failure (Error + totals) | generic | 33 | 23 | 30% (~10) | $0.025 | ✓ yes — all needles retained |
| tsc — single TS error with context line (true TS shape) | tsc | 47 | 47 | 0% (~0) | $0.00 | ✓ yes — all needles retained |

> Fixable = every fixNeedle present in RTK output. Tokenizer: o200k_base. Cost/1k runs = tokensSaved × $2.50/1M (GPT-4o input) — see src/tokens.js for Claude/Gemini table.
> CI fails if any RTK row is not fixable.
