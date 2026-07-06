# Daily Debate

A daily critical-thinking app: debate an AI opponent (by typing or speaking)
across at least five rounds and get scored on depth, evidence, logic,
rebuttal quality, and clarity — or challenge another player head-to-head on
today's topic and let an AI judge declare the winner. Points, levels, and
streaks make it a game.

## Stack

Next.js (App Router) + Supabase (auth, Postgres, Realtime) + the Anthropic API.

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
- **Player vs player** — join the matchmaking queue for today's topic, get
  randomly assigned a side, and take alternating turns. Once both players hit
  the round limit, a neutral AI judge scores the whole transcript and
  declares a winner (or tie). Both players see turns update live via
  Supabase Realtime.
- **Voice input/output** — the mic button uses the browser's Web Speech API
  (`SpeechRecognition`) to dictate your response as text before sending; the
  AI's messages are read aloud with `speechSynthesis`. Both are Chrome-family
  only; the composer falls back to typing where unsupported.
- **Gamification** — points per round, levels, and daily streaks, plus a
  global leaderboard.

## Setup

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL,
   anon key, service role key, and an `ANTHROPIC_API_KEY`.
3. `npm install && npm run dev`.

## Known limitations

- Daily topics and PvP matchmaking are scoped per calendar day and per
  server-process rate limits — fine for a single-instance deployment, not
  yet built for multi-region scale.
- Matchmaking is FIFO on a shared queue table; there's no skill-based (Elo)
  pairing yet.
