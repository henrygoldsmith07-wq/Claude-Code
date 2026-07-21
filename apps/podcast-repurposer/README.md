# Podcast Repurposer

Paste a podcast episode transcript and get a **blog post**, **show notes**, **social snippets**, and **chapter markers** generated in one pass — powered by Claude.

## Features

- One-shot generation of four content types from a raw transcript
- **Local history** of the last 20 generations (browser localStorage)
- **Tabbed results** with one-click **Copy** on every section
- **Download as Markdown** (all outputs in a single `.md` file)
- **Word / character count** on the transcript input
- **Load example** transcript for quick demos
- Optional **client-side Anthropic API key** (overrides the server key per request)
- Optional **Supabase persistence** of episodes & outputs
- Rate limiting on the generate endpoint (10 req / min / IP)
- **Dark / light** theme toggle (persisted)
- Mobile-friendly layout

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local`. Visitors can also paste their own key in the form.

Supabase (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) is optional — if unset, generation still works and results are kept only in the browser history. To enable server-side persistence, run `config/supabase/schema.sql` against your Supabase project first.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app

## Privacy

- Client-supplied API keys are stored only in `localStorage` and sent only with the generate request.
- Local generation history never leaves the browser.
- Server-side Supabase storage is optional and off by default.
