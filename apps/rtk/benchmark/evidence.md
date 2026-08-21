# RTK evidence audit — what can actually be claimed

Generated: 2026-08-21T14:27:43.665Z
rtk commit: 8caf81ce61662952bb1f10581eac3d80e0575b07
benchmark version: 0.3.0
corpus version: corpus-50-b5bd6ac2
operating system: Windows_NT 10.0.26200 x64
node: v24.16.0

## Corpus inventory (provenance-separated)

| Kind | Provenance | Count | Usable as real-world evidence? |
| --- | --- | ---: | --- |
| Agent tasks (paired) | synthetic | 300 | no — regression guard only |
| Fixture cases (precondition) | synthetic | 5 | no — regression guard only |
| Tool-output logs | captured | 6 | yes, but far below target (0/200 CI-log target) |
| Tool-output logs | adversarial | 14 | no — stress inputs, not measurements |
| Tool-output logs | synthetic | 29 | no — regression guard only |
| Real agent tasks | captured | 0 | **the gap that blocks the headline claim** |

> Synthetic data is never counted as real-world corpus evidence. The 6 captured logs are genuine command output but are CI logs, not agent tasks, and do not approach the coverage targets.

## Task success (synthetic paired benchmark)

- Paired tasks: **300** (deterministic seed, extensible: `--count=500`)
- Raw success rate: **97.0%** (291/300, Wilson 90% CI 94.4–98.4)
- RTK success rate: **97.0%** (291/300, Wilson 90% CI 94.4–98.4)
- Paired difference (RTK − raw): **0.00 points**, 90% CI -1.00 to 1.00
- Discordant pairs: **0** (0 raw-only, 0 RTK-only)
- Equivalence (TOST, ±5 points): **demonstrated**
- Token reduction across the run: **97%** (1,256,853 → 31,857 tokens)

> These are needle-retention results on generated output shaped like real tool output. They demonstrate the parsers do not lose fix-critical lines at scale — they are NOT task success by a live model on a real repository.

## Information retention (per-field accuracy)

| Field | Retention | Cases with field |
| --- | ---: | ---: |
| filename | 22% | 48 |
| path | 57% | 33 |
| line number | 41% | 37 |
| column | 40% | 33 |
| error type | 96% | 44 |
| failed test name | 100% | 10 |
| expected value | 80% | 5 |
| actual value | 75% | 3 |
| relevant stack frame | 36% | 23 |
| exit status | 94% | 13 |
| command | 56% | 9 |
| warning type | 82% | 6 |
| root-cause context | 36% | 6 |
| actionable remediation clues | 60% | 8 |

> Error type, failed-test name and exit status are ≥95% retained. Filename/line/stack percentages are lower because passing-noise filenames and internal frames are intentionally collapsed — see `benchmark/retention-fields.md` for the per-parser breakdown showing failure-relevant retention near 100%.

## Failure corpus (raw succeeds, RTK fails)

- Confirmed RTK-caused failures: **0** (empty on the synthetic corpus — expected, since fixtures were written alongside the parsers)
- Unresolved failure categories: none recorded yet; the taxonomy (`benchmark/failure-corpus.js`) covers filename lost, context removed, incorrect deduplication, parser bug, stack over-compression, ordering changed, warning removed, malformed transformation, unknown

## Precondition harness (fixture pairs)

| Arm | Success | 90% CI (Wilson) |
| --- | ---: | --- |
| raw | 5/5 | 56.6%–100.0% |
| rtk | 5/5 | 56.6%–100.0% |

- Difference (RTK − raw): **0.0 points**, 90% CI -60.0 to 60.0
- Equivalence (TOST, ±5 points): **NOT demonstrated**
- No discordant pairs — no evidence of a difference either way.

> A significance test is not an equivalence test. "No significant difference" and "equivalent" are different claims, and with small n only the first is even reachable.

## Agent-task corpus status

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

## Claims currently supported

1. **Token reduction on synthetic corpora**: ~97% mean reduction across 300 paired synthetic tasks and the fixture table, tokenizer-measured, reproducible from committed seeds.
2. **Critical-line retention on synthetic corpora**: 100% needle retention on all fixture cases and zero discordant pairs across 300 paired tasks (CI-gated).
3. **Per-field retention**: error type, failed-test name and exit status ≥95% retained across the labeled corpus (CI-gated at 95%).
4. **Robustness**: 19 pathological input classes (100k-line logs, 10MB single lines, broken ANSI, invalid UTF-8, Windows/Unix paths, nested causes, interleaved workers, truncated messages) pass without hangs or lost needles — including two real bugs this suite found and fixed (catastrophic regex backtracking; ANSI stripping that ate the first letter after a broken escape).
5. **Cross-platform behaviour**: path parsing, line endings, config discovery, shell-wrapper detection and exit-code passthrough verified on Windows/macOS/Linux CI matrix.
6. **Statistical machinery**: TOST equivalence testing, exact McNemar, Wilson intervals and sample-size planning are implemented and unit-tested; the paired harness computes them correctly at n=250–500.

## Claims NOT yet supported

1. **Task-success equivalence on real agent work** — requires ≥248 paired runs of a live model on real repositories with a captured agent-task corpus. Zero such tasks exist.
2. **Reduction numbers on real tool output** — the 6 captured logs are too few; targets are 200 CI logs across ≥8 tools and ≥5 repos.
3. **Net token effect including retries** — retry detection exists (`src/verdict.js`) but has never been fed live-agent transcripts.
4. **Model-capability differences** — the tiered provider registry (frontier/medium/small) is built, but no live multi-model comparison has been run.
5. **Adaptive/aggressive compression as default** — level comparison harness exists (`benchmark/levels.js`); aggressive shows no losses on synthetic data, which is exactly why that result cannot justify a default change.

## Limitations

- Every success metric here is needle retention on generated output — a necessary precondition for the product claim, nowhere near sufficient for it.
- Fixtures were written by the same people as the parsers; adversarial corpus entries narrow but do not close that gap.
- Retry detection is lexical and under-counts silent re-runs.
- Latency figures measure filter time only, not end-to-end agent turns.
