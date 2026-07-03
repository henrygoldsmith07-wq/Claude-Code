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
- **Spending breakdown** — a donut chart of active monthly spend by category.
- **Annual cost projection** — total projected yearly cost, plus your top 3
  most expensive subscriptions (annualized).
- **Free trial reminders** — mark a subscription as a free trial with an end
  date and get a prominent warning banner before it starts charging.
- **CSV export** — export subscriptions, budgets, and refunds to CSV for
  spreadsheets or tax prep.
- **Search & filter** — filter the subscription list by name, category, or
  status (active/paused/trial).
- **Split subscriptions** — mark a subscription as split between multiple
  people; all spend totals, budgets, and the annualized "most expensive"
  list use your actual share, not the full charge.
- **Annual plan savings** — enter what the annual plan would cost and see
  how much you'd save per year by switching off monthly billing.
- **Notes & cancel links** — attach a free-text note and a direct
  manage/cancel URL to any subscription.
- **Sorting** — sort subscriptions by name, price, or renewal date.
- **Click-to-filter chart** — click a category in the spending chart to
  filter the subscription list to it.
- **Confirm + undo delete** — deleting asks for confirmation, then shows an
  undo toast for a few seconds.
- **Duplicate subscription** — clone an existing subscription in one click.
- **Bulk pause/resume** — pause or resume every subscription in a category
  at once (shown when a category filter is active).
- **Cancellation savings ledger** — deleting an active subscription logs its
  annualized cost to a running "saved from cancellations" total.
- **Idle detection** — set a last-used date and get an "idle 30+ days"
  badge on subscriptions you haven't touched in a month.
- **JSON backup/restore** — full-fidelity export/import of all data
  (subscriptions, budgets, refunds, cancellation log).
- **CSV import** — bring in subscriptions from a previously exported CSV.
- **`/` keyboard shortcut** — jumps focus to the subscription search box.
- **Theme toggle** — light/dark/system, persisted.
- **Weekly summary line** — a one-line recap of this week's renewals and
  ending trials.
- **Price hike impact stat** — lifetime annualized cost of all recorded
  price increases.
- **Refund tabs & sorting** — filter refunds by pending/received/overdue,
  sort by amount, and see total received this calendar year.
- **Budget overview card** — total budgeted vs. total spend at a glance.
- **Show full cost vs. your share** — global toggle for how split
  subscriptions display their price.
- **Copy summary** — copies a plain-text summary of your finances to the
  clipboard.

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
