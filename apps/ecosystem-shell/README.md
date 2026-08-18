# Ecosystem Shell

The shell gives the first-party apps one browser origin so Pulse can read the
explicitly published, consent-gated histories they already own. It is a static
`index.html` plus Vercel rewrites; it owns no user data.

## Routing table

| Path | App | Prefix | Shared history |
|------|-----|--------|----------------|
| `/pulse` | apps/pulse | stripped | Pulse store |
| `/arise` | apps/arise | stripped | `arise.store.v1` |
| `/french` | apps/french-practice | stripped | `fp.pulse-history.v2` |
| `/forq` | apps/food-shopping-os | preserved | `forq-state-v2` |
| `/reflect` | apps/emotion-tracker | preserved | `reflectEntries` |
| `/revise` | apps/revise | preserved | authenticated cloud history |
| `/rapport` | apps/rapport | preserved | `rapport.pulse-history.v2` |

`/x` redirects to `/x/`, then `/x/` and `/x/:path*` are rewritten upstream.
The Vite apps use stripped prefixes because their assets are relative. Next
apps use a matching `APP_BASE_PATH` so their generated assets and API routes
retain the prefix.

## Release and rollback

Set `APP_BASE_PATH` to `/forq`, `/reflect`, `/revise` or `/rapport` on the
corresponding upstream deployment before promoting the shell route. Unsetting
the variable and restoring the previous shell route is the rollback path. The
route manifest in `routes.json`, the Vercel config and the deployment smoke
tests must agree before release.

Forq is now routed and its known release blockers are closed: the generated
stylesheet uses relative type sizing and the price-alert flow has its expected
accessible label. Pulse reads Forq's existing `forq-state-v2` state once both
deployments share the origin.

## Data coverage

- Revise exposes an authenticated, transcript-free cloud history endpoint;
  Pulse still requires its own connector grant.
- Rapport mirrors its durable IndexedDB event log into a compact,
  transcript-free shared-origin envelope.
- French Practice retains full sessions and writes durable per-review events;
  the Pulse envelope is versioned separately from the heatmap aggregate.
- Revise's old `lastPullAt`, `onboardedAt` and `seedVersion` metadata keys are
  migrated once to `revise.*.v1` names. Durable shared-origin keys must carry an
  app prefix and a version suffix; collision tests enforce this rule.
