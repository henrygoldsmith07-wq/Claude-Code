# Life OS — scraped production build

This repo is a mirror of the deployed static build served at
https://life-os-livid-nine.vercel.app/ (and https://henry-lifeos.vercel.app/),
pulled directly from the live deployment on 2026-07-03. It is **not** the
original project source — it's the compiled Vite/React output plus one
unminified Web Worker file that Vite left unbundled.

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
