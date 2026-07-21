# rtk

A small CLI that cuts tool-call tokens by filtering noisy command output down
to what an LLM agent actually needs.

## Usage

```bash
# route test/build commands through the error filter
rtk err npm test        # success: one summary line. failure: only the failing details.

# route anything else that tends to produce long output
rtk git status
rtk find . -name "*.js"

# wire a project up so Claude Code picks rtk on its own
rtk init                 # appends usage instructions to ./CLAUDE.md

# see cumulative savings across every command run through rtk
rtk gain
```

`rtk err` inspects the command's exit code: on success it collapses the
output to a single summary line; on failure it keeps only lines that look
like failures (`FAIL`, `Error`, `AssertionError`, stack frames, etc.) plus any
totals line, discarding the passing-test noise.

The plain `rtk <command>` form runs anything and truncates long output to its
head and tail, so a single runaway command can't blow up context.

Every invocation logs raw vs. emitted output size to `.rtk/stats.json` in the
current project (or the nearest ancestor directory that already has one);
`rtk gain` reports the totals, approximate tokens saved, a progress bar, and a
per-command breakdown with mini bars.

## Install

```bash
cd apps/rtk
npm link   # exposes the `rtk` binary on PATH
```

## Test

```bash
npm test
```
