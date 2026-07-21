# Podcast Repurposer

Paste a podcast episode transcript and get a blog post, show notes, social
snippets, and chapter markers generated in one pass, powered by Claude.

## Features

- One-shot generation of blog post, show notes, social snippets and chapters
- **Local history** — every successful generation is saved in the browser so you
  can revisit past outputs without re-running Claude (up to 20 recent items)

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local`. Supabase persistence
(`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) is optional — if
unset, generation still works but results aren't saved. To enable it, run
`config/supabase/schema.sql` against your Supabase project first.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
