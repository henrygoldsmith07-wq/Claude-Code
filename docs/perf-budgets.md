# Performance Budgets

`scripts/performance-budgets.json` is the single source of truth. Every substantial app has a budget on its browser bundle (`.next/static` or `dist`), checked in CI via `scripts/check-performance-budgets.mjs --require-builds`.

## Budgets (2026-08-21)

| App | Artifact | Max bytes | Rationale |
|-----|----------|-----------|-----------|
| Revise | `.next/static` | 16,000,000 | Next 15 + heavy domain + markdown + katex |
| Rapport | `.next/static` | 16,000,000 | Next + domain-heavy, local-first |
| Forq | `.next/static` | 16,000,000 | Next local-first, retailer flows |
| Pulse | `dist` | 5,000,000 | Vite analytics core — smaller by design |
| Daily Debate | `.next/static` | 16,000,000 | Next + Supabase + Anthropic |
| Reflect (emotion-tracker) | `.next/static` | 16,000,000 | Smallest Next app |
| Noticed (mental-load) | `.next/static` | 12,000,000 | Small Next + realtime |
| Habit | `.next/static` | 12,000,000 | Small Next + Supabase |
| Arise | `dist` | 2,000,000 | Vite SPA, ~268 KB baseline |
| Le Studio French | `dist` | 3,000,000 | Vite, ~1.6 MB baseline with vocab |

## How it is enforced

```bash
node scripts/check-performance-budgets.mjs                  # skip missing builds (local)
node scripts/check-performance-budgets.mjs --require-builds  # fail on missing builds (CI)
node scripts/check-performance-budgets.mjs --require-builds --only=apps/revise
```

Each product workflow calls the per-app variant. `engineering.yml:repository-gates` runs the config check without `--require-builds`.

## What to watch

- **Next `dynamic`:** use `force-dynamic` only where DB/API required.
- **Web Vitals:** where testable, add Lighthouse thresholds (the budget above is artifact size, not runtime). Route-bundle splitting is the next lever when a budget breaches.
- **Server/API latency:** for Supabase-backed apps, track p95 of AI and sync endpoints (see [Observability](./observability.md)).

## Prior snapshot (2026-08-08 cold builds)

| App | Artifact | Size (`du -sh`) |
|-----|----------|---------------|
| revise | `.next` | 23 MB |
| daily-debate | `.next` | 23 MB |
| emotion-tracker | `.next` | 8.2 MB |
| arise | `dist` | 268 KB |
| french-practice | `dist` | 1.6 MB |
