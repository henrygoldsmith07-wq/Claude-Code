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

## Build order

1. **Life OS hub** *(this change)* — the `/os` tree live inside omni-life,
   every area mapped including gaps.
2. **Study OS deepening** — real NotebookLM share URLs on the notebook cards;
   deploy `wjec-study-app` and point its tile at the live URL; build the Exam
   Planner (highest-value gap: dates + countdown + timetable).
3. **Money & Health wiring** — deploy subscription-tracker and
   emotion-tracker; surface Stripe income per app in Money OS.
4. **Builder OS pipeline** — turn App Portfolio statuses into the
   ship/kill pipeline the core training document calls for.
5. **Product split (later)** — if Study OS earns attention from other
   students, extract it behind its own domain; the personal tree just links
   to it.

## Future areas (not yet OSes)

Input OS (world-news, daily-debate, podcast-repurposer as a "what I consume"
area) and Admin OS (calendar, email, tasks — Gmail/GCal are already connected
to Claude) were considered but not selected in the interview. The tree
structure makes them a five-minute add when wanted.
