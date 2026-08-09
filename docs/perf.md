# Performance snapshot (Run 5)

Measured 2026-08-08 from `.next` / `dist` on disk (cold build artifacts before `next start`). Not gzipped or CDN; useful for regression trending.

| App | Artifact | Size (du -sh) | Notes |
|-----|----------|---------------|-------|
| revise | `.next` | 23 MB | Next 15 + 14 test suites (245 tests) |
| world-news | `.next` | 24 MB | Globe + Gemini/GDELT |
| daily-debate | `.next` | 23 MB | Supabase + anthropic |
| emotion-tracker | `.next` | 8.2 MB | Smallest Next app |
| arise | `dist` | 268 KB | Vite React SPA |
| french-practice | `dist` | 1.6 MB | Rich vocab/grammar bundle |

## What to watch
- **Next `dynamic`:** each app uses `force-dynamic` only where DB/API required (debate topics, world-news country, emotion-tracker auth). No accidental static leak seen.
- **Vitest:** no custom `poolOptions` yet — default `forks` is fine at current test counts (11–245). Add `pool: "threads"` when a suite exceeds ~2s.
- **Next step:** add `.next` size to CI via `du -sh` artifact and alert on >10% growth per PR (planned Run 12).
