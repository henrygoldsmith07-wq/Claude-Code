# Life OS

One dashboard for every part of your life: finance, habits, routines,
health & nutrition, sleep, hormesis, goals, meditation, study,
relationships, self-improvement, and mental health — plus an AI coach that
reads across all of it. Data is stored locally in the browser
(localStorage) — no account or backend required.

## Sections

- **Overview** — a snapshot of every domain, today's numbers, and quick
  links in one screen.
- **Finance** — income/expense tracking, category budgets, spend
  breakdown, savings rate, and net worth snapshots.
- **Habits** — daily/weekly habits with streaks and 7-day completion rate.
- **Routines** — build morning/afternoon/evening step-by-step routines and
  check them off daily, with streaks for fully-completed days.
- **Health & Nutrition** — meal, calorie, protein, and water logging
  against daily targets, plus a weight trend chart.
- **Sleep** — bedtime/wake time logging with duration, quality, 7-day
  average, and sleep debt against an 8h target.
- **Hormesis** — log cold showers, ice baths, sauna, fasting, exercise,
  sun exposure, and breathwork, with streaks and weekly minutes by type.
- **Goals** — goals per life domain with milestones, progress bars, and
  target dates.
- **Meditation** — session logging by type with streaks and weekly
  minutes.
- **Study** — focused study sessions by subject with a focus rating,
  streaks, and minutes-by-subject breakdown.
- **Relationships** — contacts with a reach-out cadence; get nudged when
  you're overdue to reach out.
- **Self-Improvement** — track books, courses, skills, and articles with a
  progress slider.
- **Mental Health** — daily mood/stress check-ins, gratitude logging with
  a streak, and free-form journaling.
- **AI Coach** — Claude reads a summary built from every domain and
  returns a daily focus, recent wins, grounded per-domain insights, and a
  closing note. Each visitor can paste their own Anthropic API key
  (stored only in their browser, sent directly to this app's own API
  route) instead of relying on a shared server-side key.
- **Insights** — cross-domain trend charts (sleep duration, mood, study
  minutes, spending) plus locally-computed correlations (e.g. mood on
  good-sleep nights vs. short nights, mood on hormesis days vs. rest
  days).

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server-wide fallback key for
the AI Coach, or leave it unset and let each visitor paste their own key
in the Coach page instead. Everything else works without any
configuration.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
