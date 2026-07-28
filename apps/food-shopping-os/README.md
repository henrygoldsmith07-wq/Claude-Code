# Forq — Food Shopping OS

One app for planning, shopping, cooking, nutrition, budgeting and reducing
waste. Mobile-first PWA-style web app built with Vite + React 18 + Tailwind
CSS 4, styled in the calm monochrome Le Studio design language (see
`apps/le-studio-site`): ink-on-neutral surfaces, border-first cards,
black-on-white CTAs, and monochrome stroke iconography (lucide-react)
throughout — no emoji in the UI.

**The app starts empty.** There is no demo user, no pretend pantry, no invented
spending history and no pre-earned achievements. A first run asks for your
name, budget and targets, and from then on every number you see is computed
from what you actually log, buy, cook and plan. Everything persists to
localStorage on your device — no backend, no account.

The only data that ships with the app is reference material, not user data: a
recipe book, a food/barcode/restaurant nutrition catalogue, per-100 g nutrient
tables and UK reference intakes.

## Features

- **First-run setup** — name, household size, weekly budget, how you eat, and
  what you're aiming at. Every one of them is editable afterwards
- **Goals & targets** — a body goal (weight loss · weight gain · maintenance ·
  muscle gain · body recomposition) sets the energy delta and protein
  priority; dietary patterns (keto · low-carb · high-protein · Mediterranean ·
  vegan · vegetarian · pescatarian · gluten-free · dairy-free) cap or floor
  macros and rule ingredients in or out. Maintenance comes from Mifflin-St
  Jeor when you give body stats, or a figure you type. **Custom macro goals**
  hand the numbers over entirely, **daily calorie targets** drive the diary,
  and a **weekly target** reads the week as one budget — what you've eaten,
  what's left, and what that leaves per day
- **Home dashboard** — today's planned meals, budget and calorie rings, water,
  cooking streak and XP, pantry snapshot with what's about to go off, and
  suggestions derived from your own kitchen (never generic marketing copy).
  Empty states explain what each surface will do once you feed it
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
- **Nutrition tracking** — 24 nutrients from the same per-100 g profiles the
  diary logs: calories, protein, carbs, fat, fibre and sugar; saturated fat,
  trans fat and cholesterol; sodium, potassium, calcium, iron, magnesium and
  zinc; vitamins A, B complex, C, D, E and K; water, caffeine and alcohol.
  Goals read as progress, limits read as headroom, every daily target is
  editable, and the panel says plainly what share of the day's calories
  carries a full micronutrient profile
- **Meal planner** — a real weekly plan: tap any breakfast/lunch/dinner slot
  and pick from the 200 dishes for *that* meal, filtered to your dietary
  patterns; or let the generator build a meal, a day or a week from
  budget-per-serving, people, occasion and time, then drop it into your week.
  Planned meals cost out per day and can send their missing ingredients to the
  list
- **Shop** — your list (add anything, prices you type in, aisle guessed from
  the name), shopping mode with a running total against your budget, and
  **finish shop** to record what you actually paid. Recorded shops drive your
  spending history, budget streaks and a **price history** of what each item
  costs you over time and where it was cheapest
- **Pantry** — your inventory: add items by hand or **from a photo of a shelf**
  (correct what it read, pick where it goes, and it lands as ordinary items),
  with amount, cost, location, shop and use-by date; flag things as running low
  and push them to the list in one tap. Expiry status, pantry value and
  "use soon" are computed from your dates
- **Recipes** — 600+ dishes, 200 for each meal of the day, composed from real
  ingredients so every dish's calories, macros, cost and health/protein/planet
  scores are computed from what is in it. No star ratings: nothing here has
  been cooked by anyone but you. Discovery masonry with 20 filters and search,
  favourites, recipe pages with **your** pantry checked against the ingredient
  list ("you have 5 of 7"), plus a full-screen **cooking mode** with step
  timers that logs the meal and awards XP on finish
- **Profile** — nutrition dashboard, weekly calories from your diary, spending
  from your recorded shops, the cuisines you actually cook, achievements that
  are all earned (never seeded), theme and accent, plus export and reset for
  your data
- **AI food coach** — answers only from your own data: what needs using up,
  how today's macros look, what you can afford, what to cook tonight. With an
  empty kitchen it says so rather than inventing a week you didn't have

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/ (installable PWA with service worker)
npm test         # vitest suite
```

## Structure

```
src/
  App.jsx              # shell: 6-tab bottom nav, overlays, onboarding gate
  index.css            # theme tokens (light/dark + 5 accents), animations
  lib/store.jsx        # app state (starts empty) + localStorage persistence
  lib/kitchen.js       # pantry/shop/plan/achievement maths derived from your data
  lib/utils.js         # currency/date/expiry helpers
  lib/planner.js       # pure plan generation (hard constraints + soft preferences)
  lib/goals.js         # maintenance energy, macro splits, weekly budget, diet fit
  lib/nutrition.js     # portion scaling, day/meal totals, timing & snack insights
  lib/foodlog.js       # search, barcode, voice parsing, photo demo, recipe import
  data/                # reference only: recipes (signature dishes + the parts
                       # and templates the rest are composed from), foods
                       # (catalogue + barcodes + menus), nutrients
                       # (units/targets), micronutrients (per-100 g table),
                       # goals (body goals + dietary patterns), and taxonomy
                       # for aisles/locations
  components/          # one file per surface + shared ui.jsx primitives
  components/icons.jsx # data-glyph → lucide icon map (data keeps emoji keys)
tests/                 # vitest suite
```

State notes: nothing is stored twice. The diary (`log`, keyed by date) is the
single source of truth for nutrition; the pantry, shopping list, recorded
`shops`, `plan` and `cooked` history are the source for everything else. Budget
headroom is your weekly budget minus the shops you recorded this week; streaks
count consecutive days you actually cooked; badge progress reads real counters;
price trends come from prices you typed as you shopped. A new calendar day
resets only water — everything else is date-keyed and carries over.

Charts use a monochrome ink ramp (every series is directly labeled, so identity
never depends on colour); status colours (good/warn/danger) are muted and always
paired with a label. All tokens live as CSS custom properties in `index.css`,
with the accent defaulting to mono (ink) plus four restrained alternatives.
