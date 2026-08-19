# Habit

A quiet habit tracker — do the thing, keep the streak.

Habit is a single-person check-in log with weekly targets. Each habit has a
number of days per week you intend to do it (not a daily chain you're set up
to fail); each day you mark it done or not; and the app shows your current
streak, your best streak, your progress against the weekly target, and an
8-week history.

## Why this exists

Most habit apps optimise for the first week — a dopamine curve — and quietly
punish the first miss. The first miss is where habits actually start: the
tool's job is to make a missed day cost nothing except the visible truth that
it happened. So Habit:

- **uses weekly targets, not daily chains.** Three days a week is a legitimate
  habit. The weekly bar is what moves, not a streak you lose by being ill.
- **keeps a streak alive until the day is over.** A habit not yet done today
  doesn't break its streak until today actually passes.
- **archives rather than deletes.** A habit you dropped can be restored with
  its whole history; deletion is explicit and two-click.
- **shows the history, not a score.** The 8-week table is counts vs target per
  week — information, not judgement.

## Running it

```bash
npm install
cp .env.example .env.local    # fill in your Supabase project
npm run dev
```

Supabase setup: run `supabase/schema.sql` in the project's SQL editor. The
app runs without configuration and shows setup instructions instead of data —
it never fails silently.

## Tests

The streak and date maths are the only interesting logic, and they are the
only tested logic:

```bash
npm test
```

Tests cover current/best streak semantics (including the "today not yet
done" rule), weekly grouping, timezone-safe day arithmetic, and the Pulse
mirror + opt-in flag round-tripping through storage.

## Pulse connection

Habit can share its check-ins with Pulse, the personal evidence engine in this
ecosystem, when both apps are served from one origin. Sharing is **opt-in**
and controlled here, where the data originates: the Manage tab has a
"Share habits with Pulse" toggle. While it is on, the app mirrors its habits
and check-ins into `localStorage` (`habit-tracker-state-v1`) for Pulse's
same-origin connector to read. Turning it off deletes the mirror immediately
and sets the opt-in flag Pulse's connector checks, so the flow stops at the
source — even a stale mirror is refused. No Supabase credentials are shared;
Pulse reads only what this device's own browser holds.

## Schema

- `habits` — name, target days per week (1-7), colour, sort order, archived.
- `checkins` — one row per habit per day (`unique (habit_id, day)`), so
  re-toggling upserts instead of duplicating.

This app has no user accounts; like Noticed, RLS is permissive and the anon
key is the access boundary. Do not store sensitive data here.
