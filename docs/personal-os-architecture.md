# Personal OS Architecture

> Blueprint for the nested "operating systems" structure: one Life OS at the
> top, sub-OSes per life area, and deeper OSes inside those (e.g. NotebookLM
> OS inside Study OS). Grounded in the owner interview of 2026-07-12.

## The idea

One main OS is the single place to view everything; every tile inside it is
itself a smaller OS you can zoom into. Three levels deep is the working
depth: **Life → area → tool**.

```
LIFE OS  (omni-life — the dashboard you open first)
│
├── 📚 STUDY OS
│   ├── 📓 NotebookLM OS      one card per notebook (Chemistry, Physics,
│   │                         Biology, Maths) — an organised launcher, since
│   │                         NotebookLM has no public API
│   ├── 🗂️ WJEC Study Hub     built (apps/wjec-study-app): FSRS flashcards,
│   │                         interleaving, quizzes — also a product for
│   │                         other students
│   ├── ⏳ Exam Planner       planned: dates, countdowns, revision timetable
│   └── 🗃️ Notes Vault        planned: class notes, past papers, mark schemes
│
├── 🛠️ BUILDER OS
│   ├── 📦 App Portfolio      all eight apps/ bets with status
│   ├── 🚀 Ship Pipeline      planned: ideas → building → shipped → kill
│   └── 🧠 Knowledge Base     live: the /raw + /wiki improvement loop
│
├── ❤️ HEALTH OS
│   ├── 📈 Emotion Tracker    built (apps/emotion-tracker)
│   ├── 🏃 Fitness & Sleep    planned — omni-life already has Google Fit and
│   │                         Hevy service code to light up
│   └── 🔁 Habits             planned
│
└── 💷 MONEY OS
    ├── 💳 Subscription Tracker  built (apps/subscription-tracker)
    ├── 📊 App Income            planned — omni-life's Stripe service feeds it
    └── 🧾 Budget                planned
```

## Interview decisions (2026-07-12)

- **Areas**: all four — Study, Builder, Health, Money.
- **Hub**: extend **omni-life** rather than build a new hub; it was already
  designed as a personal OS.
- **Study**: doing WJEC A-levels, heavy NotebookLM user, and the study tools
  should also serve other students as products.
- **Order**: Life OS hub first; deepen the sub-OSes after.

## How it's implemented

The whole tree is **one config file + one recursive page** in omni-life:

| Piece | Path | Role |
|-------|------|------|
| OS tree | `apps/omni-life/src/lib/os/tree.ts` | Every OS, tile, link, and status — edit this to grow the system |
| Renderer | `apps/omni-life/src/app/os/[[...slug]]/page.tsx` | Renders any node as a tile dashboard with breadcrumbs |
| Entry point | Sidebar "Life OS" → `/os` | The top-level view |

Node statuses: `live` (usable now), `built` (code exists, not deployed),
`planned` (a mapped gap). Tiles with an `href` open the external tool; tiles
with children drill one level deeper.

Adding a new OS at any depth = adding a node to `tree.ts`. No new routes,
pages, or components.

### Data flows up the chain

Every mini-app publishes a **signal** — its one headline stat, computed from
the same localStorage it stores to (`lib/os/signals.ts`). `collectSignals()`
rolls them up recursively: a sub-OS tile shows its children's signals and the
Life OS root shows the top signal from every area, so the top level is a live
status board ("Next exam: Chemistry in 5d", "£12 earned this month"), not a
menu.

### Agentic workflows

`lib/os/workflows.ts` is the sense→decide→act layer: rules watch each OS's
data and surface suggested actions in a ⚡ panel on the root and area pages.
Some deep-link to the right system; some execute in one click (promote a
high-ratio idea into the Ship Pipeline, save a habit streak, log a glass of
water). Mutations broadcast `DATA_EVENT` so tiles and panels recompute live.
Current rules: exam-crunch focus nudge, weak-subject rotation weighting,
net-wrong flashcard sweep, promote-best-idea, too-much-WIP, finish-nearest
-launch, streak rescue, hydration nudge, sleep guard, over-budget flag, and
affordable-must-have.

## Build order

1. **Life OS hub** ✅ — the `/os` tree live inside omni-life, every area
   mapped including gaps.
2. **Sub-OS mini-apps** ✅ — all seven planned systems built as working
   pages: Exam Planner (countdowns + 7-day revision rotation), Notes Vault,
   Ship Pipeline (kanban seeded with the eight apps), Habits (streaks),
   Fitness & Sleep log, App Income (per-app leaderboard), Budget (plan vs
   actual). **Known debt**: data is localStorage (per-browser, no sync) via
   `src/lib/os/storage.ts` — that hook is the single seam for a later
   Supabase swap.
3. **Third-level systems** ✅ — ten more mini-apps one level deeper:
   Study gains Focus Timer, Grade Tracker, and Quick Cards; Builder gains
   Idea Vault (impact÷effort ranking that promotes ideas into the Ship
   Pipeline via the shared `lib/os/pipeline.ts` model) and Launch Checklist
   (eight shipping steps per app); Health gains Water Tracker, Meal Log,
   and Screen Time; Money gains Savings Goals and Wishlist. Same
   localStorage seam as phase 2.
4. **Wiring** — real NotebookLM share URLs on the notebook cards; deploy
   `wjec-study-app` and point its tile at the live URL; feed App Income from
   omni-life's Stripe webhook; light up Google Fit/Hevy in Fitness & Sleep.
5. **Product split (later)** — if Study OS earns attention from other
   students, extract it behind its own domain; the personal tree just links
   to it.

## Future areas (not yet OSes)

Input OS (world-news, daily-debate, podcast-repurposer as a "what I consume"
area) and Admin OS (calendar, email, tasks — Gmail/GCal are already connected
to Claude) were considered but not selected in the interview. The tree
structure makes them a five-minute add when wanted.
