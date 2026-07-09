# World News Globe

A personal, impartial world-news reader. The home page is an interactive 3D globe —
hover to highlight a country, click to open its news page. Each country's news is
summarised by **Google Gemini with Google Search grounding** (so it's current and
cites real sources), split into topics: Politics, Economy & Business, World & Conflict,
Science & Health, Technology, Society & Culture, and Sport.

## Stack

- Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript
- [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) (three.js) for the globe
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) — Gemini SDK with the
  `google_search` grounding tool
- No database, no login. Summaries are cached per country/day via Next.js
  `unstable_cache` (6-hour revalidate).

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` — get one free at
<https://aistudio.google.com/apikey>. Without it the globe still works, but country pages
show a "configure your key" message.

## How it works

- `public/countries.geojson` — bundled Natural Earth country polygons (name + ISO codes)
  drive the globe and map codes to names (`src/lib/countries.ts`).
- `src/lib/gemini.ts` — prompts Gemini to search current news for a country and return a
  neutral, topic-split JSON summary; grounding source links come from
  `groundingMetadata.groundingChunks`.
- `src/lib/news.ts` — caches each country's summary (`getCountryNews`).
- `src/app/country/[code]/page.tsx` — renders topics + sources. `/api/country/<code>`
  returns the same data as JSON.

## Impartiality

Summaries are grounded in live search results (not model memory), and the prompt requires
neutral tone, attribution of contested claims, and presenting multiple sides. Source links
are always shown so you can verify.
