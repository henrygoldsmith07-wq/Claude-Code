# rtk — cut tool-call tokens, keep the signal

A small CLI that filters noisy command output to what an LLM agent (or a human) actually needs. Per-tool parsers keep every critical failure line while collapsing passing-test spam.

## Evidence

Deterministic synthetic fixtures shaped like real tool output (`benchmark/fixtures.js`). `npm run benchmark` reproduces this table and `benchmark/results.json`; CI fails if any critical line is lost.

| Command | Parser | Raw chars | Emitted chars | Reduction | Critical retained |
| --- | --- | --- | --- | --- | --- |
| Vitest pass (200 tests) | vitest | 61,210 | 76 | 99.9% | ✓ 100% |
| Vitest failure (2 fails) | vitest | 57,281 | 491 | 99% | ✓ 100% |
| tsc failure (4 errors) | tsc | 522 | 522 | 0%* | ✓ 100% |
| Next build failure | next | 236 | 191 | 19% | ✓ 100% |
| Next build pass | next | 371 | 288 | 22% | ✓ 100% |
| Truncate (2k-line verbose log) | truncate | 112,889 | 32 | 100% | n/a |

\* `tsc pass` prints nothing on success (raw ≈ shell wrapper); rtk collapses it to one `✓` line. `tsc failure` has no passing noise to strip — 0% reduction and 100% retention is the correct outcome. Full table with line counts: `benchmark/results.md` (generated, committed as evidence artifact).

Reproduce:

```bash
npm run benchmark        # prints table, asserts 100% critical retention
npm run benchmark:write  # also writes benchmark/results.md + results.json
```

## Usage

```bash
# tests/builds: one line on success, only failing details on failure
rtk err npm test
rtk err npm run build

# anything else verbose: same output, long runs truncated (head/tail)
rtk git status
rtk find . -name "*.js"

# cumulative savings
rtk gain
rtk gain --json

# per-tool parsers (auto-selected from argv)
#   vitest/jest → vitest parser, tsc → tsc parser, next build → next parser, else → generic
rtk err npx tsc --noEmit
rtk err npm run build   # next build when next is in the command

# structured output for CI / tool calls
rtk err --json npm test
# → {"parser":"vitest","exitCode":1,"rawChars":57281,"emittedChars":491,"reductionPct":99,"output":"…","redacted":false,"rawLog":null}

# raw logs (full unfiltered output, never truncated)
rtk err --raw npm test
# → writes .rtk/raw/<timestamp>__<cmd>.log + prints filtered output

# debug: why each line was kept or dropped
rtk err --explain npm test
rtk err --explain --json npm test   # structured explain: { explain: [{i, kept, reason, line}] }

# secret redaction (on by default; covers api_key, bearer, ghp_*, npm_*, AKIA*, slack, stripe, …)
rtk err npm test              # redacts
rtk err --no-redact npm test  # disable for this run

# wire a project up so Claude Code / Freebuff picks rtk on its own
rtk init                 # creates .rtk/ + appends to ./CLAUDE.md (idempotent)

rtk version / rtk --help
```

`rtk err` inspects the exit code; `rtk <command>` truncates long stdout/stderr to head+tail. Every invocation logs raw vs. emitted sizes to `.rtk/stats.json` (nearest ancestor `.rtk/` or cwd); `rtk gain` reports totals, efficiency bar, tokens saved (~chars/4), and per-command breakdown.

Raw logs live in `.rtk/raw/` and are never emitted to the agent — they’re the ground truth for debugging.

## Install

```bash
cd apps/rtk
npm link              # exposes `rtk` on PATH (dev)
npm pack && npm i -g rtk-*.tgz   # local tarball install
# when published:
npm i -g rtk
# or one-off:
npx rtk err npm test
```

Requires Node ≥ 18. No dependencies.

## Compatibility

See [COMPATIBILITY.md](./COMPATIBILITY.md). CI tests Node 18 / 20 / 22 (`.github/workflows/rtk.yml`).

## Development

```bash
npm test              # node --test
npm run benchmark     # assert parsers + evidence table (CI runs this)
```
