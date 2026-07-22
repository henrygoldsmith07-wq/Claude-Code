# WJEC A-Level Study Hub

A study app for WJEC/Eduqas A-level Chemistry, Physics, Biology and Maths,
built around the study techniques with the strongest evidence behind them
rather than passive note re-reading. Data is stored per-user in Supabase
(Postgres + Auth), so progress syncs across devices behind a sign-in, with
Row Level Security ensuring each student only ever sees their own data.
Claude-generated content (flashcards, quizzes, lessons, etc.) is cached in a
shared table so each topic is only generated once for everyone.

## Learning science behind it

- **Spaced repetition (FSRS)** — every flashcard review schedules its own
  next review date using [FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler).
- **Interleaved practice** — study sessions mix topics and subjects instead
  of blocking through one topic at a time.
- **Active recall & the testing effect** — quizzes require producing an
  answer before seeing it, with immediate corrective feedback.
- **Retrieval within a session** — a flashcard graded "Again" is re-inserted
  a few cards later in the same session.

## Features

- Curriculum-organised topics across Chemistry, Physics, Biology and Maths.
- Claude-generated flashcards, quizzes, and interactive lessons (cached).
- Per-topic / per-subject mastery, day streaks, XP, badges, shop themes.
- Study plans to an exam date, Ask AI, practice tests, mind maps, notes,
  tasks, focus timer, audio overviews, Study Room, analytics.
- **Daily review goal** — set a target (10–100) and track reviews completed today.
- **Study session upgrades** — undo last grade (U), reverse cards (R),
  keyboard grades (1–4), session end summary by grade.
- **Shortcuts help** — press `?` or use the Shortcuts button.
- **Show due only** — filter the dashboard to subjects with due cards.
- **CSV export** — download study days and time sessions from Analytics.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` (optional server fallback) plus:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
