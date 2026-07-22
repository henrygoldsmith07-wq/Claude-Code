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
  next review date using [FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
  (Free Spaced Repetition Scheduler), the modern, empirically-fit successor
  to the older SM-2 algorithm that current Anki uses by default. Rather
  than one fixed "easiness" multiplier, FSRS tracks each card's memory
  stability and difficulty separately and reschedules it for the point
  where predicted recall probability decays to 90%. This targets the
  "spacing effect": review effort concentrates on material about to be
  forgotten instead of material you already know.
- **Interleaved practice** — study sessions mix topics and subjects instead
  of blocking through one topic at a time, and weight weaker topics (lower
  memory stability) earlier in the queue. Interleaving feels harder in the
  moment but produces better long-term retention than blocked practice.
- **Active recall & the testing effect** — quizzes require producing an
  answer before seeing it, with immediate corrective feedback and an
  explanation, rather than just re-reading content.
- **Retrieval within a session** — a flashcard graded "Again" is
  re-inserted a few cards later in the same session for another attempt,
  instead of waiting until tomorrow. A lesson section you answer incorrectly
  does the same automatically.
- **Interpolated testing during instruction** — lessons pause after each
  short section for a 4-option check-your-understanding question with
  instant right/wrong feedback, rather than reading a wall of text straight
  through.

## Features

- Curriculum-organised topics across Chemistry, Physics, Biology and Maths.
- Claude-generated flashcards, multiple-choice quizzes, and interactive
  lessons per topic, cached so they only need generating once.
- Per-topic and per-subject mastery, blending spaced-repetition progress
  with recent quiz accuracy.
- A day-streak counter and a "study all due" button that interleaves due
  cards across every subject at once.
- **Study plans** — set an exam date per subject and get a full day-by-day
  plan through to the exam, driven by FSRS forgetting curves.
- **Gamification** — XP, levels, streaks, badges, and a coin shop for accent themes.
- **Ask AI**, practice tests, mind maps, notes, tasks, focus timer, audio overviews,
  analytics, and a live Study Room leaderboard.
- **Topic filter** — search topics within an expanded subject.
- **Keyboard study** — Space/Enter reveals a flashcard; 1–4 grades it. In quizzes,
  1–4 selects an option and Enter advances (last-answer score is tracked reliably).

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
