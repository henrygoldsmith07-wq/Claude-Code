# RTK evidence audit — what can actually be claimed

Generated: 2026-08-14T17:40:57.622Z

## Task success

| Arm | Success | 90% CI (Wilson) |
| --- | ---: | --- |
| raw | 5/5 | 56.6%–100.0% |
| rtk | 5/5 | 56.6%–100.0% |

- Discordant pairs (the only ones carrying information): **0** (0 raw-only, 0 RTK-only)
- Difference (RTK − raw): **0.0 points**, 90% CI -60.0 to 60.0
- Equivalence (TOST, ±5 points): **NOT demonstrated**
- Not demonstrated. No case differed between arms, but 5 pairs only bound the difference at ±60.0 points, which is wider than the ±5-point margin. More cases needed.
- No discordant pairs — no evidence of a difference either way.

> A significance test is not an equivalence test. "No significant difference" and "equivalent" are different claims, and with 5 pairs only the first is even reachable.

## Corpus

```
Agent-task corpus: Empty captured corpus: 0 entries. Nothing here can be reported as a measurement.
  Reportable: no
    - 0 entries; the claim needs at least 1000.
    - 0 tool(s) covered; at least 8 needed, or the result only describes the tools that were tested.
    - 0 repo(s); at least 5 needed so the result is not one codebase's habits.
CI corpus: Empty captured corpus: 0 entries. Nothing here can be reported as a measurement.
  Reportable: no
    - 0 entries; the claim needs at least 200.
    - 0 tool(s) covered; at least 8 needed, or the result only describes the tools that were tested.
    - 0 repo(s); at least 5 needed so the result is not one codebase's habits.
Statistics: About 248 paired cases are needed to show equivalence within ±5 points at 80% power, assuming the arms disagree on 10% of cases.
```

## Verdict

```
Cannot make the headline claim yet:
  - The corpus is synthetic. Reduction on generated fixtures is not evidence about real tool output.
  - Task-success equivalence is not demonstrated. No case differed between arms, but 5 pairs only bound the difference at ±60.0 points, which is wider than the ±5-point margin. More cases needed.
  Sample: 5 pairs. About 248 paired cases are needed to show equivalence within ±5 points at 80% power, assuming the arms disagree on 10% of cases.
```

Required sample: About 248 paired cases are needed to show equivalence within ±5 points at 80% power, assuming the arms disagree on 10% of cases.
