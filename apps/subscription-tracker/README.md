# Subscription Tracker

Track recurring subscriptions, catch price hikes, budget by category, and
keep tabs on pending refunds. Data is stored locally in the browser
(localStorage) — no account or backend required.

## Features

- **Subscriptions** — add recurring charges, see monthly-equivalent cost
  regardless of billing cycle, get flagged when a renewal is coming up in
  the next 7 days.
- **Price hike detection** — editing a subscription's price keeps the old
  price in history and flags the subscription with a "price hike" badge.
- **AI cancellation suggestions** — Claude reviews your active subscriptions
  for category overlap, price hikes, or commonly-forgotten services and
  suggests what's worth reviewing.
- **Budgets** — set a monthly limit per category and see spend vs. budget
  with a progress bar that turns red when you're over.
- **Refunds** — track pending refunds, mark them received, and see overdue
  ones flagged automatically.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` to enable AI cancellation
suggestions. Everything else works without any configuration.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
