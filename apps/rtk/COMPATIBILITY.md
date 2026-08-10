# RTK compatibility matrix

Tested in CI on Node 18, 20, 22 (see `.github/workflows/rtk.yml`). No dependencies.

| Tool | Parser | Success signal | What rtk keeps on failure | Notes |
| --- | --- | --- | --- | --- |
| Vitest / Jest | `vitest` | `Test Files … passed` / `Tests … passed` / `Duration` | `FAIL` headers, `AssertionError`/`Expected`/`Received`, stack frames (`at …:line:col`, `❯`), totals + duration | Triggered by `vitest`/`jest`/`npm test` in argv; covers `npm` script indirection |
| `tsc --noEmit` | `tsc` | no output (clean) → `✓ tsc — no errors` | `src/foo.ts:line:col - error TSxxxx` + next indented hint, `Found N errors` | Also catches any `error TS` line |
| `next build` | `next` | `Compiled successfully` / `Build completed` / route table | `Failed to compile`, `Type error`, `Module not found`, `.tsx:line:col` references | Success keeps route table + summary; failure keeps file refs |
| Anything else | `generic` | first `N passed` summary or `✓ passed (… suppressed)` | `FAIL`/`Error`/`AssertionError`/`Timeout`/stack frames, plus totals, `diff --git`, `@@`, `+/-` diff lines | Fallback for `eslint`, `playwright`, ad-hoc scripts |
| Long verbose logs | `truncate` (plain `rtk <cmd>`) | head + tail with omission marker | — | Used when not via `rtk err`; caps chars + lines; configurable in `.rtk/config.json` |
| Stack traces | `vitest`/`generic` + structural `compressStack` | — | User frames kept, internal `node:internal`/`node_modules/vitest` collapsed to `… N internal frame(s) omitted …` | Opt-out: `structural.stack: false` |
| JSON output | structural `compressJson` | — | Prunes null/empty, caps long arrays (head 15 + tail 5), truncates long strings; errors preserved | Opt-out: `structural.json: false` |
| Diffs | structural `compressDiff` / generic parser | — | Keeps `diff --git`, `@@`, `+/-` changes; collapses long unchanged hunks to `… N unchanged lines omitted …` | Opt-out: `structural.diff: false` |

Generic behavior applies when no parser matches; every parser falls back to tail on failure if nothing matches its patterns.

Raw logs are never filtered: `rtk err --raw <cmd>` writes the full output to `.rtk/raw/<timestamp>__<cmd>.log`.

**Platform:** Windows / macOS / Linux. `bin/rtk.js` uses `spawnSync` with `maxBuffer` 64MB; NUL bytes are replaced with `[NUL]` for binary safety. Exit codes are passed through unchanged so `set -e` and CI behave identically.

**Config:** `.rtk/config.json` or `.rtkrc.json` — `aggressiveness` (`conservative`/`balanced`/`aggressive`), `truncate`, `structural`, `parsers` per-tool `maxLines`. Also `RTK_AGGRESSIVENESS` env and `--level`/`--aggressive` flags.

**Shell:** `rtk completion <bash|zsh|fish>` — add `eval "$(rtk completion bash)"` to your rc file.

**Pipe mode:** `cat log | rtk err --stdin --json` — reads stdin instead of running a command; composable with `|` and stdout.

**Integrations:** `rtk init` writes to `CLAUDE.md` for Claude Code, Codex, Freebuff, and other agent systems.
