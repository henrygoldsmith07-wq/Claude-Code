# Life OS — scraped production build [ARCHIVED — READ-ONLY REFERENCE]

> **Status: superseded.** This directory is a frozen mirror of the deployed
> static build served at https://life-os-livid-nine.vercel.app/ (and
> https://henry-lifeos.vercel.app/), pulled 2026-07-03. It is **not** the
> original source and is **not** developed further. The canonical training
> implementation is `apps/arise`.
>
> **Canonical app:** `apps/arise` — `README.md` there is the source of
> truth for training. This directory is kept only as an audit reference for
> what was ported and what was deliberately dropped.

This repo is a mirror of the deployed static build (not the original project
source) — it's the compiled Vite/React output plus one unminified Web Worker
file that Vite left unbundled. Kept for provenance only.

## What's included

- `index.html` — the served HTML shell (marketing/SEO landing content that's
  replaced by the React app once `assets/index-DiON6DRo.js` mounts)
- `assets/index-DiON6DRo.js` — main JS bundle (minified, React 19 + app code)
- `assets/index-DhgWPbqA.css` — compiled Tailwind CSS
- `assets/createLucideIcon-Bh9ebzgG.js` — lucide-react icon helper chunk
- `assets/analyticsWorker-D6rY7e72.js` — analytics Web Worker (readable
  source — Vite didn't minify this one)
- `manifest.webmanifest`, `favicon.svg`

## What's missing

The app icons (`icon-72.png` … `icon-512.png`, `icon-maskable.png`) and the
`Geist-Variable.woff2` font referenced in `index.html` could **not** be
mirrored — the fetch tool available in this session decodes responses as
UTF-8 text, which corrupts binary files. Re-export those from the live site
or the original project if you need them.

## Known issue found while scraping

`assets/analyticsWorker-D6rY7e72.js` implements `filterAndSort()` using
`eval()` on `filterFn`/`sortFn` strings passed via `postMessage`. Since this
is a same-origin Web Worker fed only by the app's own main thread, it's not
directly exploitable by a third party today — but it's worth replacing with
real function references or a small predicate DSL, since any future code
path that forwards less-trusted data into that worker would become a code
injection vector.

## Consolidation decision (2026-08-09)

Arise (`apps/arise`) is the long-term home for training. This scrape is
retained as a read-only artifact so reviewers can verify what was kept vs
dropped.

### Ported into Arise (strongest practices)

- **Rest timer** — Old Life OS had an auto rest timer in the fitness tracker.
  Ported as a per-exercise rest countdown in `SessionRunner` (tap `Rest 90s` →
  sticky countdown + `navigator.vibrate` on finish, skippable).
- **Previous session display** — Life OS showed the previous workout's loads
  beside each exercise. Ported as `lastExerciseSets(history, exerciseId)` in
  `src/lib/store.js` and rendered per block in `SessionRunner` (`Last: 20kg×8
  on 2026-02-01`, or `No prior log — first time`).
- **Post-workout summary** — Life OS showed a summary after saving. Ported as
  a `Last session summary` card at the top of `ProgressView` (volume, sets,
  exercises, note).
- **PR detection** — Already existed in Arise; now also exposed as
  `prsHitBySession(session, priorHistory)` for per-save deltas (Epley 1RM).

### Intentionally not ported

- **Analytics Web Worker `filterAndSort()` with `eval()`** — dropped. The
  pattern is noted as an issue above; Arise uses safe in-thread helpers
  instead. Reintroducing a worker should use a predicate DSL or function
  references, never `eval` on postMessage strings.
- **Monolithic Life OS scope** (nutrition/CRM/journal/AI coach/dashboard) —
  out of scope for Arise, which is `training, levelled up` only (see
  `apps/arise/README.md` §12).
