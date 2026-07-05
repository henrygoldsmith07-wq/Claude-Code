# Podcast Repurposer

Paste a podcast episode transcript and get a blog post, show notes, social
snippets, and chapter markers generated in one pass, powered by Claude.

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
