# Noticed

A shared board for the invisible labor of running a household. Log the
things you notice need doing — no categorizing, no assigning, no due date —
and see it side by side, once a week, with what your partner noticed and
what actually got resolved.

## Why this exists

The biggest driver of resentment in a household usually isn't unfinished
chores, it's the *unequal noticing* — one person remembers the appointment
needs booking, the fridge is nearly empty, the kid's shoes don't fit anymore,
and that work is invisible until it becomes a fight. Chore-split apps track
completed tasks; they don't capture the anticipatory work of noticing
something before it becomes urgent.

## How it's designed to avoid the obvious failure mode

Every "shared household app" dies the same way: logging something becomes
more effort than just doing it, so nobody uses it past week one. This one is
built around two constraints:

- **Capture is a single text field.** No category, no assignee, no due date
  required. If it takes more than a few seconds to log a thought, the whole
  point is lost.
- **No score, no leaderboard.** The weekly view shows noticed/resolved counts
  side by side per person, framed neutrally — not a "fairness %" or a ranked
  list. Turning this into a scoreboard is how the tool becomes ammunition in
  an argument instead of a way to make invisible work visible.

## How a household works

There are no user accounts. Whoever starts a household gets a short join
code; share it with your partner and they join with the same code from
their own device. Each person picks a name and color once, stored locally
on their device — that's the entire identity model. This keeps the whole
thing usable in under a minute, at the cost of the join code being the only
thing standing between someone and your board (see Security below).

## Setup

```bash
npm install
cp .env.example .env.local
```

This app needs a Supabase project — unlike a single-user tool, its entire
value is a board shared live between two people, so it can't fall back to
browser-only storage.

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. In the Supabase dashboard, go to Database → Replication and enable
   Realtime for the `items` table (optional — the app still works without
   it, polling every 20s as a fallback, just not instantly).
4. Copy your project URL and anon public key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app

## Security note

This app has no authentication. A household is identified by a short join
code, similar to a shared shopping-list app — anyone who has the code (or
guesses the underlying UUID, which is intentionally hard) can read and write
that household's board. This is an acceptable tradeoff for a low-stakes,
two-person household tool, but don't put sensitive information into it.

## What's deliberately not built (v1 scope)

- No email/push weekly digest — the in-app "This week" view covers the same
  need without standing up a cron job and an email provider for an MVP.
- No more than two active identities per household — the mechanic is
  designed around a couple, not a larger shared household.
- No historical trends/charts — the goal is visibility this week, not a
  dashboard to obsess over.
