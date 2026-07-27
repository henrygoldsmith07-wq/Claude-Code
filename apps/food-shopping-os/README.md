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
- **Food diary (Log tab)** — every route into a log: fuzzy **search** across
  generic foods, branded products and restaurant menus; **barcode scanner**
  (viewfinder + manual code entry, unknown codes route to custom foods);
  **AI photo recognition** of a plate with per-item confidence and editable
  portions; **voice logging** that parses “two slices of wholemeal bread and
  200g greek yogurt for lunch” into portions; **recipe importer** (paste a
  recipe or a link — quantities, units and ingredient matches drive a
  per-serving estimate); **restaurant meals** from six UK chains; **recent**
  and **favourite** foods; **custom foods**; **meal templates**; **copy a
  previous meal** from any day in the diary; **quick-add calories** with
  optional macros; portion control by serving, multiplier or **weighed
  grams/ml**; per-entry **meal timing** with an eating-window insight; and
  **snack tracking** as a share of the day
- **Nutrition tracking** — 24 nutrients tracked from the same per-100 g
  profiles the diary logs: calories, protein, carbs, fat, fibre and sugar;
  saturated fat, trans fat and cholesterol; sodium, potassium, calcium, iron,
  magnesium and zinc; vitamins A, B complex, C, D, E and K; water, caffeine
  and alcohol. Goals read as progress, limits read as headroom, every daily
  target is editable, and the panel says plainly what share of the day's
  calories carries a full micronutrient profile
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
npm run build    # production build to dist/ (installable PWA with service worker)
npm test         # vitest suite (utils, store, planner, render smoke test)
```

## Structure

```
src/
  App.jsx              # shell: 6-tab bottom nav, overlays, floating AI button
  index.css            # theme tokens (light/dark + 5 accents), animations
  lib/store.jsx        # app state context + localStorage persistence
  lib/utils.js         # currency/date/expiry helpers
  lib/planner.js       # pure plan generation (hard constraints + soft preferences)
  lib/nutrition.js     # portion scaling, day/meal totals, timing & snack insights
  lib/foodlog.js       # search, barcode, voice parsing, photo demo, recipe import
  data/                # recipes, pantry, stores/prices, plan/gamification,
                       # foods (catalogue + barcodes + menus), log-seed,
                       # nutrients (units/targets), micronutrients (per-100 g table)
  components/          # one file per surface + shared ui.jsx primitives
  components/icons.jsx # data-glyph → lucide icon map (data keeps emoji keys)
tests/                 # vitest suite
```

State notes: the food diary is the single source of truth for nutrition —
`log` is keyed by date and every nutrient figure in the app (home rings,
profile dashboard, weekly chart, the full 24-nutrient panel) is derived from it, so a new calendar day
simply starts with an empty diary. Water and cooked-today reset on the first
open of a new day; the cooking streak increments once per
day when a recipe is finished, and finishing cooking mode logs that serving to
the diary; the weekly-budget ring is `spentBase` (earlier
shops) plus whatever is ticked off in shopping mode; recipe pages and the
planner append missing ingredients to the shopping list under a
"From recipes" aisle.

Charts use a monochrome ink ramp (every series is directly labeled, so identity
never depends on colour); status colours (good/warn/danger) are muted and always
paired with a label. All tokens live as CSS custom properties in `index.css`,
with the accent defaulting to mono (ink) plus four restrained alternatives.
