# Ecosystem Shell

One origin for the apps Pulse reads.

Pulse analyses data the other apps produce. A browser will not let one origin
read another's `localStorage`, so as long as each app sat on its own
`*.vercel.app` host there was no way for Pulse to see anything — which is why
three separate hand-built integrations (Arise's `window.__PULSE_ADAPTER__`,
Reflect's `CustomEvent`, Forq's `forqSnapshot`) all ended up dead code.

This project is the fix, and it is deliberately the smallest possible one: a
static `index.html` and a table of rewrites. It builds nothing and owns no data.
Every app keeps its own Vercel project, its own pipeline and its own release
cadence; the shell only makes them share an origin so the browser treats them as
one site.

## The routing table

| Path | App | Upstream project | Prefix |
|------|-----|------------------|--------|
| `/pulse` | apps/pulse | `claude-code-xuc7` | stripped |
| `/arise` | apps/arise | `arise-fitness` | stripped |
| `/french` | apps/french-practice | `claude-code` | stripped |
| `/forq` | apps/food-shopping-os | `forq` | preserved |
| `/reflect` | apps/emotion-tracker | `claude-code-y8k6` | preserved |
| `/revise` | apps/revise | `claude-code-ybbm` | preserved |
| `/rapport` | apps/rapport | `rapport` | preserved |

That last column is the part to understand before editing anything.

**Stripped, for the Vite apps.** Arise and French Practice already build with
`base: './'`, so their HTML asks for `./assets/…` and resolves it against
whatever path served the page. Serve `/arise/` and the browser asks for
`/arise/assets/…` on its own. The upstream deployment knows nothing about the
prefix and must not receive it, so `/arise/:path*` maps to the upstream's
`/:path*`. Pulse now matches them (`base: "./"`), which is why it needs no
`basePath` either.

**Preserved, for the Next apps.** Next resolves assets from `basePath`, and with
`basePath: '/forq'` the deployment genuinely serves `/forq/…`. Strip the prefix
there and every asset 404s.

## Deploying, in this order

The order is not a preference. Getting it wrong takes the apps down.

1. **Create this project.** Root Directory `apps/ecosystem-shell`, framework
   Other. Nothing else. Visit `/arise` and `/pulse` — the three stripped-prefix
   apps work immediately, because relative assets need no rebuild.
2. **Then** set `APP_BASE_PATH` on each Next project and redeploy it:

   | Vercel project | `APP_BASE_PATH` |
   |----------------|-----------------|
   | `forq` | `/forq` |
   | `claude-code-y8k6` | `/reflect` |
   | `claude-code-ybbm` | `/revise` |
   | `rapport` | `/rapport` |

Each Next config reads `process.env.APP_BASE_PATH` and falls back to `''`, so
until you set that variable nothing changes and every app keeps serving at its
own root exactly as it does today. Setting it is the switch, and unsetting it is
the rollback — there is no window in which the repo is committed to a prefix the
shell is not yet serving.

Once a Next app has a `basePath`, its standalone URL serves at
`…vercel.app/forq/` rather than `…vercel.app/`. That is the cost of one origin,
and it is why the switch is an environment variable rather than a commit.

## What this does not solve

- **Revise** keeps its review history in Supabase, not in the browser. A shared
  origin gives Pulse nothing there; that source needs a cloud reader.
- **Rapport** persists only which insights were dismissed, so there is nothing
  for Pulse to read yet.
- **French Practice** keeps only the last 10 sessions (`sessions.slice(-10)`) and
  stores reviews as a per-day count, so per-review events cannot be reconstructed
  and long gaps between Pulse visits lose sessions permanently.

## Storage hygiene

At one origin every app shares one `localStorage`, so key names are now a shared
namespace. Today there are no collisions — Arise uses `arise.*`, Forq `forq-*`,
French `fp.*`, Reflect `reflect*` — but Revise still writes three unprefixed
keys (`lastPullAt`, `onboardedAt`, `seedVersion`). Namespace those before the
next app arrives and picks the same obvious name.
