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
- No login. Summaries are cached per country/day via Next.js `unstable_cache`
  (6-hour revalidate), and optionally persisted to Supabase for history + pre-caching.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key
npm run dev
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Summarise news via Gemini + Google Search grounding. Free key: <https://aistudio.google.com/apikey>. |
| `GEMINI_API_KEYS` | no | Extra free Gemini keys as one comma/space/newline-separated list (easiest way to add many). The app rotates to the next when one hits its daily quota (429). |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_20` | no | Alternative to `GEMINI_API_KEYS`: extra keys as individually numbered vars. Both forms can be combined; duplicates are de-duped. |
| `GROQ_API_KEY` | no | Tags the geolocated news dots and writes the audio-briefing podcast scripts. Free: <https://console.groq.com/keys>. Falls back to a local script when unset. |
| `OPENROUTER_API_KEY` | no | Makes OpenRouter the **primary** news source: real GDELT articles organised by an OpenRouter model into topic summaries + points (Gemini becomes the fallback). Key: <https://openrouter.ai/keys>. |
| `OPENROUTER_MODEL` | no | Override the OpenRouter model. Defaults to `meta-llama/llama-3.3-70b-instruct:free`. The model only *organises* real GDELT data, so it can't fabricate news. |
| `SUPABASE_URL` | no | Supabase project URL — enables the historical timeline + scheduled pre-caching. |
| `SUPABASE_SERVICE_ROLE_KEY` | no | **Secret**, server-side only. Supabase → Settings → API → `service_role`. Set in Vercel env, never commit. |
| `CRON_SECRET` | no | Shared secret guarding `/api/cron/refresh`; Vercel Cron sends it as a Bearer token. |

Without `GEMINI_API_KEY` the globe still works, but country pages show a "configure your
key" message. Without Supabase the app simply generates news live per request (no history).

### Timeline & pre-caching (Supabase)

The `news_snapshots` table stores one summary per place per day. It powers:

- **Historical timeline** — a date slider on country/world pages to scrub back through
  past days (`?date=YYYY-MM-DD` loads that day's snapshot).
- **Scheduled pre-caching** — `vercel.json` registers a daily cron that calls
  `/api/cron/refresh`, which regenerates the world summary and a small set of major
  countries and stores them, so real visits load instantly without re-hitting Gemini.

To enable: create a Supabase project, run the migration in
`supabase/migrations/`, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`CRON_SECRET` in Vercel.

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
