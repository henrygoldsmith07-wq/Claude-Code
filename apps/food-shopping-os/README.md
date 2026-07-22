# Forq — Food Shopping OS

The "Spotify + Google Maps + Duolingo of food shopping": one app for planning,
shopping, cooking, nutrition, budgeting and reducing waste. Mobile-first PWA-style
web app built with Vite + React 18 + Tailwind CSS 4, styled in the calm monochrome
Le Studio design language (see `apps/le-studio-site`): ink-on-neutral surfaces,
border-first cards, black-on-white CTAs, and monochrome stroke iconography
(lucide-react) throughout — no emoji in the UI. All data is rich local mock data
with localStorage persistence — no backend required.

## Features

- **Home dashboard** — today's meals, budget & calorie rings, water tracker,
  cooking streak & XP, AI suggestions (weather/seasonal/family), pantry snapshot
  with expiring & low items, leftovers, weekly challenge, recipe of the day
- **AI meal planner** — generate 1 meal / a day / a week from budget-per-serving,
  people, goal (weight loss, muscle gain…), diet, occasion and time constraints;
  weekly plan grid with per-day cost; meal-prep progress
- **Shop** — three views: aisle-ordered checklist with shopping mode (running
  total, budget warnings, store route), store profiles (offers, loyalty points,
  basket price index, hours, delivery), and price intelligence (12-week sparkline
  trends per staple with AI buy/wait/hold calls)
- **Smart pantry** — inventory by location (fridge/freezer/cupboard/…) with
  quantity, cost, store and expiry status; "use soon" rail; search; capture
  affordances for barcode/receipt/voice/photo
- **Recipes** — Pinterest-style discovery masonry with 18 filters, search,
  favourites, community rail; recipe pages with nutrition rings,
  health/protein/planet scores, pantry-aware ingredients ("you have 5 of 7"),
  and a full-screen **cooking mode** with step-by-step navigation and live timers
  that logs the meal and awards XP on finish
- **Profile** — nutrition dashboard (macros, micronutrient pills, weekly kcal
  chart), spending analytics, cuisine split, achievement badges with progress,
  streaks, dark/light theme, five accent colours, integrations
- **AI food coach** — floating assistant on every screen; answers budget,
  pantry, picky-eater, calorie and time questions from the app's own data

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```

## Structure

```
src/
  App.jsx              # shell: 5-tab bottom nav, overlays, floating AI button
  index.css            # theme tokens (light/dark + 5 accents), animations
  lib/store.jsx        # app state context + localStorage persistence
  lib/utils.js         # currency/date/expiry helpers
  data/                # recipes, pantry, stores/prices, plan/gamification
  components/          # one file per surface + shared ui.jsx primitives
  components/icons.jsx # data-glyph → lucide icon map (data keeps emoji keys)
```

Charts use a monochrome ink ramp (every series is directly labeled, so identity
never depends on colour); status colours (good/warn/danger) are muted and always
paired with a label. All tokens live as CSS custom properties in `index.css`,
with the accent defaulting to mono (ink) plus four restrained alternatives.
