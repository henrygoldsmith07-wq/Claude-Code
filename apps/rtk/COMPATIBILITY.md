# RTK compatibility matrix

Tested in CI on Node 18, 20, 22 (see `.github/workflows/rtk.yml`).

| Tool | Parser | Success signal | What rtk keeps on failure | Notes |
| --- | --- | --- | --- | --- |
| Vitest / Jest | `vitest` | `Test Files … passed` / `Tests … passed` / `Duration` | `FAIL` headers, `AssertionError`/`Expected`/`Received`, stack frames (`at …:line:col`, `❯`), totals + duration | Triggered by `vitest`/`jest`/`npm test` in argv; covers `npm` script indirection |
| `tsc --noEmit` | `tsc` | no output (clean) → `✓ tsc — no errors` | `src/foo.ts:line:col - error TSxxxx` + next indented hint, `Found N errors` | Also catches any `error TS` line |
| `next build` | `next` | `Compiled successfully` / `Build completed` / route table | `Failed to compile`, `Type error`, `Module not found`, `.tsx:line:col` references | Success keeps route table + summary; failure keeps file refs |
| Anything else | `generic` | first `N passed` summary or `✓ passed (… suppressed)` | `FAIL`/`Error`/`AssertionError`/`Timeout`/stack frames, plus totals | Fallback for `eslint`, `playwright`, ad-hoc scripts |
| Long verbose logs | `truncate` (plain `rtk <cmd>`) | head + tail with omission marker | — | Used when not via `rtk err`; caps chars + lines |

Generic behavior applies when no parser matches; every parser falls back to tail on failure if nothing matches its patterns.

Raw logs are never filtered: `rtk err --raw <cmd>` writes the full output to `.rtk/raw/<timestamp>__<cmd>.log`.
