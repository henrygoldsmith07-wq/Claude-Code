# RTK compatibility matrix

Tested in CI on Node 18, 20, 22 (see `.github/workflows/rtk.yml`). One dependency (`js-tiktoken` for tokenizer-accurate tokens; falls back to chars/4 if not installed).

| Tool | Parser | Success signal | What rtk keeps on failure | Notes |
| --- | --- | --- | --- | --- |
| Vitest / Jest | `vitest` | `Test Files … passed` / `Tests … passed` / `Duration` | `FAIL` headers, `AssertionError`/`Expected`/`Received`, stack frames (`at …:line:col`, `❯`), totals + duration | Triggered by `vitest`/`jest`/`npm test` in argv; covers `npm` script indirection |
| `tsc --noEmit` | `tsc` | no output (clean) → `✓ tsc — no errors` | `src/foo.ts:line:col - error TSxxxx` + next indented hint, `Found N errors` | Also catches any `error TS` line |
| `next build` | `next` | `Compiled successfully` / `Build completed` / route table | `Failed to compile`, `Type error`, `Module not found`, `.tsx:line:col` references | Success keeps route table + summary; failure keeps file refs |
| ESLint | `eslint` | `✖ 0 problems` / `✓ eslint — no problems` | `file:line: error F401/E501` + rule codes, `✖ N problems` | Triggered by `eslint` in argv or sniffing `F401/E501` |
| Pytest | `pytest` | `N passed` | `FAILED` headers, `E   assert`, `File "...", line N`, totals | Triggered by `pytest`/`py.test` in argv |
| Ruff | `ruff` | `Found 0 errors` / `✓ ruff — no errors` | `file:line: RULE` + `Found N errors` | Triggered by `ruff` in argv or sniffing rule codes |
| mypy | `mypy` | `Success: no issues` | `: error:` + `: note:` context + `Found N errors` | Triggered by `mypy` in argv |
| Cargo | `cargo` | `Finished` / `test result: ok` | `error[E####]:` + `--> file.rs:line:col` + `warning:` | Triggered by `cargo` in argv or sniffing `error[E` |
| Go test | `go-test` | `ok   pkg` | `--- FAIL:` + `foo.go:line:` + `FAIL` package | Triggered by `go test` in argv |
| Maven | `maven` | `BUILD SUCCESS` | `[ERROR]` + `BUILD FAILURE` + `Tests run: Failures:` | Triggered by `mvn`/`maven` in argv |
| Gradle | `gradle` | `BUILD SUCCESSFUL` | `FAILURE:` + `Task :X FAILED` + `e: file:line` | Triggered by `gradle`/`gradlew` in argv |
| Docker | `docker` | `Successfully built/tagged` | `ERROR` / `failed to solve` + build steps | Triggered by `docker` in argv |
| K8s (kubectl) | `k8s` | table header `NAME READY` | `CrashLoopBackOff`/`ImagePullBackOff`/`Error from server`/`Failed` | Triggered by `kubectl`/`k8s` in argv |
| Terraform | `terraform` | `Apply complete!` / `Plan: N to add` | `Error:` + `on file.tf line N` | Triggered by `terraform` in argv |
| npm/yarn/pnpm | `pm` | `added N packages` / `up to date` | `npm ERR!` / `Cannot resolve` / `peer dep` | Triggered by `npm install`/`yarn`/`pnpm` in argv |
| Git | `git` | branch/status summary | `CONFLICT` / `Auto-merging` / `diff --git` + `@@` + `+/-` | Triggered by git merge/conflict shape |
| GitHub Actions | `gha` | `::group::` summary | `::error::`/`::warning::` + `Process completed with exit code` | Triggered by `::error`/`##[error]` sniffing |
| Jest | `jest` | `Test Suites` / `Tests:` | `FAIL` + `●` + `Expected/Received` + `at file:line` | Triggered by `jest` in argv (distinct from vitest) |
| Anything else | `generic` | first `N passed` summary or `✓ passed (… suppressed)` | `FAIL`/`Error`/`AssertionError`/`Timeout`/stack frames, plus totals, `diff --git`, `@@`, `+/-` diff lines | Fallback for unknown tools |
| Long verbose logs | `truncate` (plain `rtk <cmd>`) | head + tail with omission marker | — | Used when not via `rtk err`; caps chars + lines; configurable in `.rtk/config.json` |
| NDJSON | structural `compressNdjson` | — | error json lines kept, long ok runs collapsed to `… N ok json lines omitted …` | Opt-out: `structural.ndjson: false` |
| XML / JUnit | structural `compressXml` | — | `<failure>` blocks kept, passing `<testcase>` runs collapsed | Opt-out: `structural.xml: false` |
| SARIF | structural `compressSarif` | — | error/warning results kept, `note` dropped; tool notifications stripped | Opt-out: `structural.sarif: false` |
| GHA annotations | structural `compressAnnotations` | — | `::error`/`::warning` + group context kept, noise dropped | Opt-out: `structural.annotations: false` |
| Stack traces | `vitest`/`generic` + structural `compressStack` | — | User frames kept, internal `node:internal`/`node_modules/vitest` collapsed to `… N internal frame(s) omitted …` | Opt-out: `structural.stack: false` |
| JSON output | structural `compressJson` | — | Prunes null/empty, caps long arrays (head 15 + tail 5), truncates long strings; errors preserved | Opt-out: `structural.json: false` |
| Diffs | structural `compressDiff` / generic parser | — | Keeps `diff --git`, `@@`, `+/-` changes; collapses long unchanged hunks to `… N unchanged lines omitted …` | Opt-out: `structural.diff: false` |

Generic behavior applies when no parser matches; every parser falls back to tail on failure if nothing matches its patterns.

Raw logs are never filtered: `rtk err --raw <cmd>` writes the full output to `.rtk/raw/<timestamp>__<cmd>.log`.

**Platform:** Windows / macOS / Linux. `bin/rtk.js` uses `spawnSync` with `maxBuffer` 64MB; NUL bytes are replaced with `[NUL]` for binary safety. Exit codes are passed through unchanged so `set -e` and CI behave identically.

**Config:** `.rtk/config.json` or `.rtkrc.json` (repo-local) and `~/.config/rtk/config.json` (global) — `aggressiveness`, `contextWindow` (0-10), `preset` (claude-code/codex/cursor/generic), `truncate`, `structural` (json/ndjson/xml/sarif/annotations/diff/stack/dedup), `parsers` per-tool `maxLines`, `preservation` (user keep-patterns), `plugins` (custom parsers), `otel`. Also `RTK_AGGRESSIVENESS`/`RTK_CONTEXT_WINDOW`/`RTK_PRESET` env and `--level`/`--context-window`/`--preset`/`--dry-run` flags.

**Shell:** `rtk completion <bash|zsh|fish>` — add `eval "$(rtk completion bash)"` to your rc file. Completion covers `--preset`, `--context-window`, `--dry-run`, `--otel`, `--level`.

**Pipe mode & streaming:** `cat log | rtk err --stdin --json` — reads stdin (64k chunked, binary-safe), `rtk --stdin` for truncate path; streaming safe for very large outputs (tested to 50k lines, 10ms). NUL → `[NUL]`, broken ANSI stripped, surrogates repaired.

**Integrations:** `rtk init` writes to `CLAUDE.md` + `AGENTS.md` + `.codex/config.toml` for Claude Code, Codex, Freebuff, Cursor/Cline. Agent presets (`--preset=claude-code|codex`) tune aggressiveness + context window per agent. `--dry-run` previews the plan; `preservation` rules keep user-specified patterns; `plugins` load custom parsers from `.rtk/plugins/*.js`.
