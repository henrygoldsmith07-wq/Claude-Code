# RTK paired benchmark — raw vs RTK (large synthetic corpus)

Generated: 2026-08-21T14:27:29.089Z
RTK commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
Benchmark version: 0.3.0
Corpus version: corpus-50-777a244a
Operating system: Windows_NT 10.0.26200 x64
Node: v24.16.0
Tokenizer: o200k_base

> **Synthetic corpus — not real-world evidence.** This benchmark measures needle retention on generated outputs shaped like real tool output. See `benchmark/evidence.md` for the real corpus status. Synthetic retention is a regression guard, never a claim about production.

## Summary

- Tasks: **300** (provenance: synthetic, deterministic seed)
- Raw success rate: **97.0%** (291/300, Wilson 90% CI 94.4–98.4)
- RTK success rate: **97.0%** (291/300, Wilson 90% CI 94.4–98.4)
- Paired difference (RTK − raw): **0.00 points**, 90% CI -1.00 to 1.00
- Discordant pairs: **0** (0 raw-only, 0 RTK-only)
- Equivalence (TOST, ±5 points): **demonstrated** — Equivalent: the difference in task success is within ±5 points (90% CI -1.0 to 1.0, n=300).
- No discordant pairs — no evidence of a difference either way.
- Token reduction: **97%** (raw 1,256,853 → RTK 31,857 tokens, saved 1,224,996 tokens, $$3.06 at GPT-4o)
- Economics (net): Saved 1225.0k tokens with no additional retries. (extra retries: 0, net profitable)
- Avg latency: raw 6.85ms, RTK 2.13ms

> Required sample for ±5 points at 80% power: About 248 paired cases are needed to show equivalence within ±5 points at 80% power, assuming the arms disagree on 10% of cases.

## Per-tool retention

| Tool | n | Raw success | RTK success | Avg token reduction | Discordant |
| --- | ---: | ---: | ---: | ---: | ---: |
| cargo | 15 | 100% | 100% | 69% | 0 |
| docker | 12 | 100% | 100% | 0% | 0 |
| eslint | 24 | 100% | 100% | 3% | 0 |
| generic | 24 | 100% | 100% | 45% | 0 |
| gha | 12 | 100% | 100% | 48% | 0 |
| git | 12 | 100% | 100% | 0% | 0 |
| go | 15 | 100% | 100% | 0% | 0 |
| gradle | 12 | 100% | 100% | 0% | 0 |
| k8s | 12 | 100% | 100% | 23% | 0 |
| maven | 12 | 100% | 100% | 0% | 0 |
| next | 6 | 100% | 100% | 25% | 0 |
| pm | 18 | 100% | 100% | 5% | 0 |
| pytest | 24 | 100% | 100% | 59% | 0 |
| terraform | 12 | 100% | 100% | 0% | 0 |
| tsc | 36 | 92% | 92% | 3% | 0 |
| vitest | 54 | 89% | 89% | 99% | 0 |

## Failure corpus (raw succeeds, RTK fails)

> **No failures** — in this synthetic run, every case fixable from raw was also fixable from RTK output. The failure corpus is empty for this run (expected for synthetic shaped like parsers were built for).

## Provenance

```
rtk commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
benchmark version: 0.3.0
corpus version: corpus-50-777a244a
repository commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
operating system: Windows_NT 10.0.26200 x64
node: v24.16.0
execution date: 2026-08-21T14:27:29.089Z
```

## Reproducibility

```bash
node benchmark/paired.js --count=300 --seed=12648430  # deterministic
node benchmark/paired.js --count=500 --seed=12648430  # scale to 500+
```
