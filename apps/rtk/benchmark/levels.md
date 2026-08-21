# RTK compression levels — conservative vs balanced vs aggressive

Generated: 2026-08-21T14:27:32.078Z
RTK commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
Benchmark version: 0.3.0
Corpus version: corpus-50-777a244a
Operating system: Windows_NT 10.0.26200 x64

> **Synthetic corpus — regression evidence only.** Same 300 deterministic tasks (seed 12648430) run through each compression level. This measures how much headroom aggressive compression has and where it starts losing fixability; it does not by itself justify enabling aggressive mode as a default.

## Cross-level summary

| Level | Raw success | RTK success | Difference (RTK−raw) | 90% CI | Discordant (raw-only) | Token reduction | Net tokens |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| conservative | 97.0% | 97.0% | 0.00 pts | -1.00 to 1.00 | 0 | 97% | +1,224,996 |
| balanced | 97.0% | 97.0% | 0.00 pts | -1.00 to 1.00 | 0 | 97% | +1,224,996 |
| aggressive | 97.0% | 97.0% | 0.00 pts | -1.00 to 1.00 | 0 | 97% | +1,224,996 |

## Equivalence per level (TOST ±5 points)

- **conservative**: demonstrated — Equivalent: the difference in task success is within ±5 points (90% CI -1.0 to 1.0, n=300).
- **balanced**: demonstrated — Equivalent: the difference in task success is within ±5 points (90% CI -1.0 to 1.0, n=300).
- **aggressive**: demonstrated — Equivalent: the difference in task success is within ±5 points (90% CI -1.0 to 1.0, n=300).

> Sample-size note: About 248 paired cases are needed to show equivalence within ±5 points at 80% power, assuming the arms disagree on 10% of cases.

## Per-tool reduction and retention by level

| Tool | n | Conservative red. | Balanced red. | Aggressive red. | Aggressive losses (raw-only) |
| --- | ---: | ---: | ---: | ---: | ---: |
| cargo | 15 | 69% | 69% | 69% | 0 |
| docker | 12 | 0% | 0% | 0% | 0 |
| eslint | 24 | 3% | 3% | 3% | 0 |
| generic | 24 | 95% | 95% | 95% | 0 |
| gha | 12 | 48% | 48% | 48% | 0 |
| git | 12 | 0% | 0% | 0% | 0 |
| go | 15 | 0% | 0% | 0% | 0 |
| gradle | 12 | 0% | 0% | 0% | 0 |
| k8s | 12 | 23% | 23% | 23% | 0 |
| maven | 12 | 0% | 0% | 0% | 0 |
| next | 6 | 25% | 25% | 25% | 0 |
| pm | 18 | 10% | 10% | 10% | 0 |
| pytest | 24 | 59% | 59% | 59% | 0 |
| terraform | 12 | 0% | 0% | 0% | 0 |
| tsc | 36 | 3% | 3% | 3% | 0 |
| vitest | 54 | 99% | 99% | 99% | 0 |

## Where aggressive loses cases (raw succeeds, aggressive fails)

> Aggressive retained all needles on this corpus — the loss budget is untested here. Real-corpus failures will be harsher.

## Recommendation logic (not auto-enabled)

```
Adaptive compression MAY be considered when ALL hold on a REAL corpus:
  1. balanced shows equivalence within margin on real captured tasks
  2. aggressive shows equivalence OR its extra savings exceed retry costs
  3. per-tool analysis shows no tool family with systematic losses
Until then: default stays "balanced". No config change ships from this file.
```

## Provenance

```
rtk commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
benchmark version: 0.3.0
corpus version: corpus-50-777a244a
execution date: 2026-08-21T14:27:32.078Z
```
