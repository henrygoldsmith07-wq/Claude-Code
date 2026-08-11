# rtk — cut tool-call tokens, keep the signal

A small CLI that filters noisy command output to what an LLM agent (or a human) actually needs. Per-tool parsers keep every critical failure line while collapsing passing-test spam. Structural compression (JSON schema-aware, diff, stack, dedup), configurable aggressiveness, and pipe composability — with preservation guarantees.

## Evidence

Deterministic synthetic fixtures shaped like real tool output (`benchmark/fixtures.js` + `benchmark/datasets.js`). `npm run benchmark` reproduces this table and `benchmark/results.json`; CI fails if any critical line is lost.

| Command | Parser | Raw chars | Emitted chars | Reduction | Critical retained |
| --- | --- | ---: | ---: | ---: | --- |
| Vitest pass (200 tests) | vitest | 61,210 | 76 | 99.9% | ✓ 100% |
| Vitest failure (2 fails) | vitest | 57,281 | 491 | 99% | ✓ 100% |
| tsc failure (4 errors) | tsc | 522 | 522 | 0%* | ✓ 100% |
| Next build failure | next | 236 | 191 | 19% | ✓ 100% |
| Next build pass | next | 371 | 288 | 22% | ✓ 100% |
| Truncate (2k-line verbose log) | truncate | 112,889 | 32 | 100% | n/a |
| GitHub Actions log | generic | ~2,400 | ~120 | ~95% | ✓ 100% |
| Search JSON (120 hits) | structural | ~45,000 | ~4,000 | ~91% | ✓ 100% |
| Diff (4 files) | structural | ~1,800 | ~600 | ~67% | ✓ 100% |

\* `tsc pass` prints nothing on success (raw ≈ shell wrapper); rtk collapses it to one `✓` line. `tsc failure` has no passing noise to strip — 0% reduction and 100% retention is the correct outcome. Full table with line counts + tokenizer tokens + cost + latency: `benchmark/results.md` (generated, committed as evidence artifact). Representative datasets (GitHub, logs, JSON, search, CLI, diff, stack, NDJSON, JUnit, SARIF, ANSI, Unicode) live in `benchmark/datasets.js`; large corpus in `benchmark/corpus/`.

Reproduce:

```bash
npm run benchmark            # 34-case evidence table with tokenizer tokens + cost + latency
npm run benchmark:write      # also writes benchmark/results.md + results.json
node benchmark/agent-solve.js   # raw vs RTK fixability (no LLM calls, tokenizer-accurate)
node benchmark/agent-live.js    # live LLM task-success raw vs RTK (skips gracefully when no keys)
node benchmark/retention.js     # retention on real corpus/ + synthetic tsc
node benchmark/perf.js          # latency p50/p95 + memory + very-large output
node benchmark/agent-live.js --providers openai --corpus 20   # live with OpenAI (add key)
```

## Before / After

**Vitest — 200 passing tests (raw bloats context):**

```
# raw: 1,200 lines, 61k chars — every ✓ case + summary
 ✓ src/lib/foo0.test.ts > suite 0 > case 0 (2ms)
 ✓ src/lib/foo1.test.ts > suite 1 > case 1 (2ms)
 ... (1,197 more lines)
 Test Files  10 passed (10)
      Tests  200 passed (200)
   Duration  3.21s
```

```
# rtk err npm test — 3 lines, 76 chars
 Test Files  10 passed (10)
      Tests  200 passed (200)
   Duration  3.21s
```

**Vitest — 2 failures (raw buries the fix in 1,173 lines of passing noise):**

```
# rtk err npm test — 15 lines, 491 chars — every FAIL, assertion, stack, total retained
FAIL src/lib/billing.test.ts > createInvoice > case 0
AssertionError: expected 9000 to equal 8000
Expected: 8000
Received: 9000
 ❯ src/lib/billing.ts:142:19
   at src/lib/billing.test.ts:40:12
 ... (totals + duration)
```

**JSON search results — 120 hits (schema-aware compression):**

```
# raw: 45k chars — full pretty JSON with empty facets, nulls, verbose snippets
# rtk err --stdin (structural json): 4k chars — nulls/empties pruned, long arrays capped, long strings truncated, errors preserved
```

**Diff — 4 files (unchanged hunks collapsed):**

```
# raw: 1,800 chars — 20 unchanged context lines per hunk
# rtk err --stdin: 600 chars — ... 14 unchanged lines omitted ... around each change
```

## Preservation guarantees

On failure (`exitCode != 0`), rtk **never drops**:

- `FAIL` / `Error` / `AssertionError` / `Type error` / `Failed to compile` headers
- File references (`src/foo.ts:line:col`, `./src/app/page.tsx:42:10`)
- Stack frames (`at ...:line:col`, `❯`)
- Totals and duration (`Tests 1 failed`, `Found N errors`, `Duration`)

Structural helpers (dedup, stack, diff, JSON) are conservative: they only collapse internal frames, duplicate lines, and unchanged diff context — never error lines. CI asserts 100% needle retention across synthetic fixtures **and** the regression suite (`test/regression.test.js`, adversarial and fuzz cases).

## Usage

```bash
# tests/builds: one line on success, only failing details on failure
rtk err npm test
rtk err npm run build

# anything else verbose: same output, long runs truncated (head/tail)
rtk git status
rtk find . -name "*.js"

# pipe mode — composable in shell pipelines (stdin/stdout, binary-safe: NUL → [NUL])
cat build.log | rtk err --stdin --json
cat results.json | rtk err --stdin --explain
echo "$output" | rtk --stdin

# cumulative savings
rtk gain
rtk gain --json

# per-tool parsers (auto-selected from argv + output sniffing; 15+ tools)
#   vitest/jest/eslint, tsc, next, pytest/ruff/mypy, cargo, go test, gradle/maven, docker, k8s, terraform, pm (npm/yarn/pnpm), git, GHA → specific parser, else → generic
rtk err npx tsc --noEmit
rtk err npm run build   # next build when next is in the command

# aggressiveness: conservative (keep more), balanced (default), aggressive (trim more)
rtk err --level=conservative npm test
rtk err --aggressive npm test
# also: .rtk/config.json { "aggressiveness": "balanced" } or env RTK_AGGRESSIVENESS

# structured output for CI / tool calls (+ --stats for tokenizer tokens + cost + latency)
rtk err --json --stats npm test
# → {"parser":"vitest","exitCode":1,"rawChars":57281,"emittedChars":491,"reductionPct":99,"rawLines":1173,"emittedLines":15,"tokensSaved":14197,"output":"…","redacted":false,"rawLog":null}

# raw logs (full unfiltered output, never truncated)
rtk err --raw npm test
# → writes .rtk/raw/<timestamp>__<cmd>.log + prints filtered output

# debug: why each line was kept or dropped (+ --stats)
rtk err --explain npm test
rtk err --explain --json --stats npm test   # structured explain: { explain: [{i, kept, reason, line}] }

# secret redaction (on by default; covers api_key, bearer, ghp_*, npm_*, AKIA*, slack, stripe, …)
rtk err npm test              # redacts
rtk err --no-redact npm test  # disable for this run

# shell completion
rtk completion bash   # also: zsh, fish
# add to ~/.bashrc: eval "$(rtk completion bash)"

# wire a project up so Claude Code / Codex / Freebuff picks rtk on its own
rtk init                 # creates .rtk/ + .rtk/config.json + appends to ./CLAUDE.md (idempotent)

rtk version / rtk --help
```

`rtk err` inspects the exit code; `rtk <command>` truncates long stdout/stderr to head/tail (configurable via `.rtk/config.json` `truncate`). Every invocation logs raw vs. emitted sizes to `.rtk/stats.json` (tokenizer-accurate when js-tiktoken installed) (nearest ancestor `.rtk/` or cwd); `rtk gain` reports totals, efficiency bar, tokens saved (~chars/4), and per-command breakdown.

Raw logs live in `.rtk/raw/` and are never emitted to the agent — they’re the ground truth for debugging. Exit codes are always passed through unchanged so `set -e` and CI behave identically.

## Config

`.rtk/config.json` (or `.rtkrc.json` in the repo root), also `RTK_AGGRESSIVENESS` env:

```json
{
  "aggressiveness": "balanced",
  "truncate": { "headLines": 20, "tailLines": 5, "maxChars": 4000 },
  "structural": { "json": true, "diff": true, "stack": true, "dedup": true },
  "parsers": { "vitest": { "maxLines": 60 } }
}
```

Levels: `conservative` (head 30/tail 10/maxLines 80), `balanced` (20/5/60), `aggressive` (12/3/25).

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

Requires Node ≥ 18. No dependencies. Cross-platform (Windows/macOS/Linux); `bin/rtk.js` uses `spawnSync` with `maxBuffer` 64MB and binary-safe NUL handling. Startup is < 30ms (single `require`, no async).

## Compatibility

See [COMPATIBILITY.md](./COMPATIBILITY.md). CI tests Node 18 / 20 / 22 (`.github/workflows/rtk.yml`) — type-check + `npm test` + `benchmark/run.js` + `benchmark/retention.js` + `benchmark/agent-solve.js` + `benchmark/agent-live.js` + `benchmark/perf.js` + `npm pack --dry-run`.

## Development

```bash
npm test                  # node --test (regression + structural + tokenizer + fuzz + adversarial)
npm run benchmark         # 34-case evidence table with tokens + cost + latency; asserts 100% retention
node benchmark/agent-live.js --help  # live LLM task-success (needs OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY)
```

## Integrations

- **Claude Code**: `rtk init` writes to `CLAUDE.md`; `rtk err` is the preferred wrapper for test/build tool calls.
- **Codex / Freebuff / other agents**: same `CLAUDE.md` hint; `rtk gain --json` and `rtk err --json --stats` are machine-readable.
- **Shell**: `rtk completion <bash|zsh|fish>` for completion; stdin/stdout pipe mode for `|` composability.
