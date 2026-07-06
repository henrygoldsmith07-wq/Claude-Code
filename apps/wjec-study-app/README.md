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
  lessons per topic, cached locally so they only need generating once. A
  "Generate all lessons" action (globally or per subject) bulk-generates the
  lesson for every topic that doesn't have one yet, a few requests at a time.
- Per-topic and per-subject mastery, blending spaced-repetition progress
  with recent quiz accuracy.
- A day-streak counter and a "study all due" button that interleaves due
  cards across every subject at once.
- **Study plans** — set an exam date per subject and get a full day-by-day
  plan through to the exam, not just a same-day checklist. Each topic's
  urgency is FSRS's own forgetting curve extrapolated forward to the exam
  date itself (how likely you are to still recall it *then*, not just
  whether it's due today), blended with recent quiz accuracy; untouched
  topics and anything already due for everyday review always come first.
  The weakest topics are spread onto the earliest remaining days so they
  get the most spaced-repetition exposure before the exam, without
  overloading any single day. The plan is a plain day-by-day list by
  default; switch it to **Calendar** mode to drag topics onto specific hours
  of specific days on a month/day grid instead — entirely optional, a toggle
  per subject.
- **Active-learning nudges** — every few flashcards during a study session, a
  short Claude-generated nudge appears, alternating an encouraging framing
  ("picture acing this exam") with a loss-aversion one ("skip this now and
  you're relearning it the night before") — subject- and exam-date-aware
  when available, with a curated static fallback so a session never waits on
  a network call to start.
- **Chained flashcards** — for extended-response (6-mark style) questions,
  a linked sequence of flashcards where each answer is the stepping stone to
  the next question (e.g. "why does a symptom occur?" → "what's the
  underlying mechanism?" → a compare/contrast synthesis step), so the full
  answer is built by the student one deliberate step at a time rather than
  read as a finished block.
- **Gamification** — XP for reviews, quizzes and lessons, levels, a longest
  day-streak, and badges for milestones.
- **NotebookLM links** — save a NotebookLM notebook URL per topic (there's
  no public API to auto-create one, so this just stores and opens a link
  you made yourself), with a bulk JSON import for pasting in many at once.
- **Ask AI** — an instant Q&A chat with a "guided learning" mode that breaks
  answers down step by step, plus document anchoring (paste text or upload
  a `.txt` file) so answers are drawn only from that source.
- **Practice tests** — multi-format tests (multiple choice, matching,
  fill-in-the-blank) generated per topic with instant feedback.
- **Mind maps** — an auto-generated node/edge diagram of how concepts in a
  topic or your own notes connect.
- **Notes** — typed notes with tags, a freehand sketch pad, audio
  recordings, and photo scanning (OCR via Claude vision) to digitize
  handwritten or printed pages.
- **Tasks** — a drag-and-drop Kanban board with subtasks and attached
  links.
- **Focus timer** — an adjustable Pomodoro timer with procedurally
  synthesized ambient sound (white/brown noise, a rain-like texture — no
  licensed music assets, so no real lo-fi tracks).
- **Audio overviews** — Claude writes a two-host discussion script per
  topic; your own ElevenLabs API key turns it into playable audio.
- **Analytics** — a study-day heatmap, a time-by-subject breakdown, and a
  this-week-vs-last-week trend (a gentle nudge, not a streak you get punished
  for breaking).
- **Study Room** — a live Supabase Realtime presence list of who else is
  studying right now, plus an XP leaderboard read through a hardened
  `SECURITY DEFINER` function so peers' standings are visible without exposing
  the rest of anyone's profile.
- **Shop** — spend coins earned from XP to unlock accent color themes.

## Architecture

- **Auth & data** — [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side)
  with `createServerClient` in Server Components / Server Actions and
  `createBrowserClient` in Client Components. Next.js Middleware refreshes the
  session cookie on every request (and gates every route behind a sign-in) so
  a session never expires mid-study.
- **Server-rendered initial data** — the page is a Server Component that reads
  the user's whole study dataset from Supabase in one pass and hands it to the
  client, so there's no client-side loading spinner on first paint (a
  `loading.tsx` skeleton covers the navigation itself).
- **Optimistic writes** — task status flips, card grades, note adds, etc.
  update React state immediately and persist via Server Actions in the
  background.
- **Security** — RLS is enabled on every user-scoped table with
  `auth.uid() = user_id` policies; the shared content cache is
  read/insert-only for authenticated users.
- **Evidence-grounded generation** — every content-generation prompt (flashcards,
  quizzes, lessons, Q&A, chained flashcards) carries a shared system
  instruction directing Claude to separate well-established consensus from
  contested or oversimplified explanations, rather than presenting a single
  generalized narrative as settled fact. There's no Consensus API
  integration (no credentials available) — this is a prompt-level substitute,
  not a real literature-search backend.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server-wide fallback key, or
leave it unset and let each visitor paste their own key in the app instead.
Audio overviews additionally need a visitor-supplied ElevenLabs API key,
entered in the Audio Overviews tab (not read from an environment variable).

The app now requires a Supabase project for accounts and persistence. Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

in `.env.local` (Project Settings → API in your Supabase dashboard).

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
