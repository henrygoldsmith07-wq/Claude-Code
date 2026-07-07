# Daily Debate

A daily critical-thinking app: debate an AI opponent (by typing or speaking)
across at least five rounds and get scored on depth, evidence, logic,
rebuttal quality, and clarity. Points, levels, and streaks make it a game.

## Stack

Next.js (App Router) + MongoDB + Auth.js (Credentials) + the Anthropic API.

## Features

- **Daily topic** — a new debatable proposition is generated once per day
  (`getOrCreateTodayTopic`), grounded with 3-5 real, well-known institutions
  relevant to the topic (their homepage + what angle/data they're known for).
  Claude does not have live web access in this app, so these are named
  credible sources to go research yourself, not live-fetched citations.
- **Solo debate vs AI** — pick a side, then go back and forth with an AI
  arguing the opposite side for a minimum of 5 rounds. Each response is
  scored 0-10 on depth, evidence, logic, rebuttal, and clarity, with short
  feedback, before the AI's next challenge. Finishing awards points, updates
  your level, and updates your daily streak.
- **Voice input/output** — the mic button uses the browser's Web Speech API
  (`SpeechRecognition`) to dictate your response as text before sending; the
  AI's messages are read aloud with `speechSynthesis`. Both are Chrome-family
  only; the composer falls back to typing where unsupported.
- **Gamification** — points per round, levels, and daily streaks, plus a
  global leaderboard.

## Setup

1. Create a MongoDB database (e.g. a free MongoDB Atlas cluster).
2. Copy `.env.example` to `.env.local` and fill in `MONGODB_URI`,
   `MONGODB_DB_NAME`, a random `NEXTAUTH_SECRET` (e.g. `openssl rand -base64
   32`), `NEXTAUTH_URL`, and an `ANTHROPIC_API_KEY`.
3. `npm install && npm run dev`.

Collections (`users`, `profiles`, `daily_topics`, `solo_debates`,
`solo_debate_turns`) and their indexes are created automatically on first
connection — no migration step required.

## Known limitations

- Daily topics and per-user rate limits are scoped per calendar day and per
  server-process state — fine for a single-instance deployment, not yet
  built for multi-region scale.
- Auth is email/password only (Auth.js Credentials provider) with no email
  verification or password reset flow yet.
