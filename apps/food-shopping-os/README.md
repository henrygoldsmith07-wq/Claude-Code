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
  what you're aiming at. It also asks for weight, height, age and sex, because
  together they let Forq *estimate* your maintenance calories instead of asking
  you to already know the number — sex is in there because Mifflin-St Jeor's
  constants differ by 166 kcal, which after the activity multiplier is a couple
  of hundred a day, and "rather not say" takes the midpoint rather than picking
  one for you. The
  weight you give starts your body series rather than sitting apart from it.
  Cycle tracking is a yes/no at setup, off by default, offered to everyone
  rather than inferred from an answer. Every one of them is editable afterwards
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
  trans fat and cholesterol; sodium, its UK-label **salt equivalent**, potassium,
  calcium, iron, magnesium and zinc; vitamins A, B complex, C, D, E and K;
  water, caffeine and alcohol.
  Goals read as progress, limits read as headroom, every daily target is
  editable, and the panel says plainly what share of the day's calories
  carries a full micronutrient profile
- **Meal planner** — a **weekly** grid of breakfast/lunch/dinner slots and a
  **monthly** calendar, both walking forwards and back; tap any slot and pick
  from the 200 dishes for *that* meal, filtered to everyone's dietary patterns,
  with what's in season flagged. Meals **move by dragging** them, or by pressing
  their grip and tapping where they go — an occupied slot swaps rather than
  losing anything. The **generator** builds a meal, a day, a week or a whole
  month from your goal, budget-per-serving, people, occasion and time, and will
  favour **what's already in your pantry** and **what's in season this month**.
  **Batch mode** deliberately plans fewer dishes in blocks, and any dish planned
  twice gets a cook-once schedule: which day, how many batches, how much time it
  saves. **Leftovers** you save after cooking sit in the fridge with a use-by
  date, cover planned meals, and drop out of the shopping list. The list itself
  generates from whichever range you're looking at, minus your pantry
- **Household** — name a household and add adult or child profiles, each with
  their own portions, dietary patterns, shopping/pantry/recipe permissions and
  notification preference. Shopping lines and chores can be assigned to a
  person, with household activity kept in one feed
- **Shared household data** — shopping, pantry, saved recipes, profiles and
  chores export together in one validated snapshot for another device. Open
  tabs in the same browser update live through local storage events; true
  cross-device live sync still requires an account and backend and is labelled
  that way in the app
- **Recipe scheduling** — any recipe page can put itself in the plan on a chosen
  day and meal, up to a fortnight out
- **Shop** — a list that learns. Items **group by aisle**, guessed from the
  name until you move one, after which that's where it lives. Pick the shop
  you're walking round and the aisles come in **the order you actually walked
  it last time**, learned from the order you ticked things off. Add by hand or
  by **barcode**; an unknown code is reported as unknown rather than filled in
- **Price comparison** — what this same list would cost at every shop you've
  recorded, from the prices you typed in, always saying how many items each
  shop can actually price. Plus what you're about to overpay for, and a price
  history per item with where it was cheapest
- **Budget tracking** — the basket against your week: what it comes to, what
  your offers take off, and what that leaves of the budget after what you've
  already spent — with unpriced items counted as unknown, never as free
- **Offers** — no deals feed and no retailer connection, so nothing is ever
  suggested to you. Enter the offers you have (money off, per cent off, or a
  multibuy) and they're applied to the list you're holding
- **Meal-to-shopping** — a week or month of meals becomes one list, with a
  duplicate ingredient merged into a single line that remembers every meal that
  wanted it, minus your pantry and minus what leftovers already cover
- **Store hand-off** — Forq connects to no supermarket, so the list exports as
  plain text in your aisle order, to paste into whichever app you use
- **Pantry** — your inventory: add by hand, **from a photo of a shelf**, or by
  barcode, with amount, cost, location, shop and use-by date; flag things as
  running low and push them to the list in one tap. **Expiry tracking** buckets
  everything dated by urgency (past its date · today or tomorrow · three days ·
  this week), says how many items have no date at all, and binning something
  records **what the waste cost you** at what you paid. Things you buy again
  and again but have run out of come back as restock suggestions — read off
  your own receipts, never a generic "people also buy"
- **Recipes** — a library of 1,200+ dishes, 400 for each meal of the day,
  composed from real ingredients so every dish's calories, macros, cost and
  health/protein/planet scores are computed from what is in it. No star
  ratings: nothing here has been cooked by anyone but you. Browse the library,
  **your own recipes** or **favourites**; filter by **diet**, by **cooking
  time**, by **ingredients in and out** ("with rice, without mushrooms") and by
  how much shopping you'd have to do — including *can make now*, read against
  your actual pantry
- **Recipe generator** — invents a dish from what you have, composed from the
  same ingredient tables as the book, so its nutrition and cost are computed
  rather than written. It says which parts of the dish your kitchen covered and
  what it assumed you'd buy; the same request always produces the same dish
- **Portion scaling** — cook for any number: amounts scale (and keep the
  recipe's own formatting), per-serving nutrition doesn't, and the total cost
  follows. Unreadable amounts like "to serve" are left exactly as written
- **Ingredient substitutions** — swaps that name a real replacement, so
  applying one **recomputes** calories, macros, cost and diet tags from the new
  ingredient, renames the dish so the filters can't be fooled, and says plainly
  when a swap is outside the ingredient tables. One tap makes a dish vegan,
  dairy-free, gluten-free or nut-free where the swaps exist
- **Nutritional breakdown** — every nutrient in a serving: the dish's own
  macros, where its calories come from, and micronutrients estimated from the
  food catalogue, with how much of the ingredient list that estimate recognised
- **Cooking mode** — full screen, one step at a time, with timers that survive
  navigating back and forth, plus a **hands-free walkthrough** that plays the
  method itself. There is no stock video in this app and none is invented; a
  recipe you imported from a video keeps its link and offers it as what it is
- **Community recipes** — sharing without a server: a recipe becomes a code you
  send someone, and theirs reads it back, credited to whoever sent it. Imported
  and shared dishes join your library and can be planned and cooked like any
  other
- **Profile** — nutrition dashboard, weekly calories from your diary, spending
  from your recorded shops, the cuisines you actually cook, theme and accent,
  plus export and reset for your data
- **Progress** — the game layer, counted rather than banked. **XP** is a
  reading of what you've done (a cook is worth 60 for as long as it's in your
  history, and no longer — undo it and the XP goes too), which drives
  **levels** and their titles. Three **streaks** — diary, cooking and days on
  target — each with the best you've managed. Five **daily goals**, three
  **weekly challenges** picked by the week itself so they don't reshuffle, a
  **seasonal event** for every month of the real calendar, and longer
  **missions**. Twelve **badges** and dated **achievements** — the things that
  actually happened, with the day they happened on. **Rewards** are three extra
  accent colours at levels 4, 8 and 12; the five the app always had stay
  available from level one, so nothing you use is ever taken away
- **AI food coach** — a page and a chat, both reading only your own data.
  **Today** gives the day back to you with **feedback on each meal** (its share
  of your calories and protein, and at most one suggestion). **Habits** counts
  what your diary shows: eating window, snack share, which meals reach the
  diary, weekdays against weekends, what you eat most. **Progress** turns your
  average intake against your maintenance figure into a **weekly pace** and, if
  you've set a target weight, how many weeks that is — refusing to run on
  fewer than five logged days and printing its assumptions. **Ideas** carries
  **personalised tips** (each with the number behind it), **grocery
  recommendations** answering the nutrients your week actually came up short
  on, **macro adjustments** when a target you never hit needs to move rather
  than you, and **restaurant picks** from the handful of chains the app ships
  figures for. The **chat** also connects the rest of the app: it can generate
  a pantry recipe, draft a pantry-first week, explain or guide tonight's
  recipe, suggest verified substitutions, improve a logged meal, surface
  expiring food, optimise a basket from recorded prices and build the aisle
  route learned from previous shops. There is no model, supermarket feed or
  server here: every answer is computed on-device from your records and the
  bundled food tables, and missing evidence is stated rather than invented
- **Healthy swaps** — on any food, alternatives from the catalogue that beat it
  on protein, fibre, saturated fat or sugar per calorie, with the reason
  attached; a swap is only offered when a real number supports it
- **Nutrition labels** — this build ships no OCR, so it doesn't pretend to read
  the picture: you copy the panel in and the *parsing* is real — "of which"
  lines, kJ/kcal pairs, salt converted to sodium, a per-serving column scaled
  back to 100 g — with anything it couldn't find listed as missing rather than
  guessed, and the result saved as one of your foods
- **Health tracking** — one Health area brings the nutrition breakdown,
  hydration, editable macro and weight targets, evidence-backed healthy swaps
  and body readings together. **Weight**, **body fat
  %**, **waist** and **resting heart rate** each keep a dated series with a
  sparkline and the movement between the first and last reading — reported with
  the days it spanned, because two readings a day apart are not a trend.
  **BMI** is computed from your latest weight and your height rather than
  stored, and asks for a height instead of guessing one. **Waist** is banded
  against the published thresholds, which are sex-specific, so without a stated
  sex it shows the number and says why it can't band it. **Blood pressure**,
  **blood glucose** and **cholesterol** are labelled with the ordinary NHS /
  Diabetes UK reference ranges, always alongside the reminder that a label is
  not a diagnosis. **Sleep** and **stress** average only the nights and days you
  logged, and say how many that is. **Cycle tracking** is opt-in — the page
  isn't there unless you asked for it, at setup or later under Goals — and it
  predicts the next period
  from the average of *your* logged cycles and nothing else — one logged period
  gives no prediction, and it says so. **Progress photos** stay on the device
  (there is nowhere else for them to go), shrunk to thumbnails and capped,
  because browser storage is a few megabytes for the whole app
- **Exercise** — **workout logging** across ten kinds of training with an
  intensity and the extras that belong to each (distance for a run, sets and
  reps for a gym session). **Calories burned** are the standard MET equation —
  `kcal ≈ MET × 3.5 × kg ÷ 200 × minutes` — labelled an estimate everywhere it
  appears, and it returns *nothing* without a weight rather than assuming a
  body. **Activity adjustment** is off by default: eating an estimate back is a
  choice, so you make it. **Strength, running, cycling and walking** are types,
  not integrations. **Apple Health, Google Health Connect and smartwatches**
  have no browser API a web app can call, and this build ships no fake Connect
  button; what all of them can do is export a file, so the importer reads that
  CSV — mapping the column names and activity names those apps actually write,
  preferring an exported energy figure over its own estimate, deduplicating
  against what you already have, and counting the rows it couldn't read

- **Reminders** — **meals, water, supplements, groceries, weigh-ins, exercise,
  sleep** and **anything else you name**, each with your own wording, as many
  times a day as you like, on the days you choose. A reminder arrives carrying
  **your own figure** — "you're at 750 of 2,000 ml", "last weighed 7 days ago,
  at 82 kg", "2 items on the list · 1 running low" — rather than a bare nudge;
  where there's no data behind it, it says so instead of padding it out. Late
  still counts as due for ninety minutes, ticking one off clears that firing
  and not tomorrow's, and snoozing is 10 / 30 / 60 minutes.
  **Suggestions** come from your records with the evidence attached — meal
  times from the median time you actually start each meal (three logged days
  minimum, rounded to five minutes), water spaced across the day for the
  target you set, the weekday most of your weigh-ins already land on, the days
  your workouts cluster on — and nothing is offered that your data can't
  support.
  On **notifications**, the app is blunt about the platform: while Forq is open
  a due reminder becomes a real notification; while it's closed **it cannot**,
  because that needs a push server and there isn't one. So there's no
  background-notifications toggle that could never work — instead it catches
  you up on what came due while it was shut, and offers a **calendar export**
  (`.ics`, one repeating `VALARM` per time) so the alarm clock you already
  trust does the part a web page can't

- **Analytics dashboards** — recorded spend, offer savings and favourite stores;
  30-day nutrition averages with diary coverage; pantry value, locations,
  categories and expiry coverage; waste cost, rate and repeat waste; shopping
  frequency, frequently bought products and favourite brands; and estimated
  food and shopping carbon. Calendar **monthly** and **yearly** reports bring
  spend, savings, waste, nutrition and footprint together without treating
  missing diary days or unrecorded receipts as zero
- **Reports** — the diary added up over a **day** (split by meal,
  with each one's share and the hours you ate between), a **week**, a **month**,
  and **month-by-month** further back. Every report leads with **how many days
  it actually saw**, and averages only those — a blank day is a day you didn't
  record, not a day you didn't eat, and a month with nothing logged is left out
  of the trend rather than averaged towards zero. **Weight** charts from your
  readings and says plainly that one reading is a number, not a line.
  **Adherence** counts how often each target landed within 10%, and how often
  it went under or over. **Meal timing** reads the usual hour of each meal off
  your own entries and reports the spread as a finding rather than a failure.
  **Shortfall alerts** name nutrients averaging under 70% of their reference —
  refusing to say anything under seven logged days, never treating "under a
  limit" like sodium as a shortfall, and carrying the caveat that a low figure
  is a prompt to look, not a diagnosis. **CSV** comes out three ways (per day,
  per food, measurements), properly quoted. **PDF** is your browser's own:
  Forq builds a clean printable page and hands it to the print dialogue, where
  "Save as PDF" does a better job than any library worth making you download
- **Personalisation** — split down the middle on purpose. **Allergies** (the
  fourteen UK/EU declarable ones) and **religious or cultural rules** (halal,
  kosher, Hindu vegetarian, Jain, Buddhist vegetarian) are *hard lines*: a
  recipe naming one is **removed**, not ranked down or shown behind a warning
  you could tap through, and the page tells you how much of the book that
  leaves and where each allergen usually hides. **Intolerances** *flag* instead,
  because the amount is the point and only you know your threshold. Everything
  here matches ingredient text and says so — a filter, never a guarantee.
  **Favourite cuisines**, **cooking skill** and **time available** reorder what
  you're offered without removing anything. **Units** — kg / lb / stone,
  cm / feet, kcal / kJ, ml / fl oz, 24- or 12-hour — change the *display* only;
  everything is stored and calculated in metric, because a unit preference
  reaching the maths compounds into a real error over months. **Widgets** let
  you reorder or hide any card on Home, which hides a panel and never a number

- **Carbon & water footprint** — kg CO₂e and litres per day, computed from the
  grams in your diary against published per-kilogram category means (Poore &
  Nemecek 2018, the largest food-LCA meta-analysis there is). Always states
  **what share of your food it could place** — anything the table can't
  categorise is reported as unmatched, never counted as zero — plus the
  categories driving the number, the swaps that would actually move it, and the
  standing caveat that a category average is an order of magnitude, not a
  measurement of what you bought
- **Micronutrient optimisation** — a greedy set-cover over the food catalogue:
  which foods, in portions a person would actually eat, close the most of what
  your logged days are short on. Weighted towards the worst gaps, capped so one
  freakishly high food can't dominate, silent under five logged days, blind to
  anything your allergies rule out, and explicit about what is *still* short
  after everything it could suggest
- **Fasting** — the overnight gap between last night's last entry and this
  morning's first is read straight off the diary, so nothing needs pressing.
  A running fast is the one exception, because "hasn't logged since 8pm" and
  "is deliberately fasting" are different claims. 16:8 and the rest are labels
  for a window you chose, not protocols the app recommends
- **Receipt reader** — no OCR, so no pretending to read the photo. Paste the
  text and the parsing is the real part: items, prices, quantities (including
  `0.482 kg @ £4.99/kg`), store and date, with loyalty and payment lines
  skipped — then it **checks its own total against the printed one** and says
  whether to trust the parse, and lists any line it couldn't read
- **Blood results & CGM** — no lab has an API a browser can call and no CGM has
  one either (Dexcom and Libre are OAuth against a vendor server, which needs a
  server of our own). So: type your own panel in and it's banded against
  ordinary adult reference ranges, and paste your CGM's CSV export and the
  trace gets lined up against what you logged eating — reported, never graded,
  because a rise after eating is what eating does
- **The capability register** — the page most apps leave out. Every feature
  people ask for, and where Forq actually stands: **built**, **partly and
  honestly** (label scanning, receipts, pantry photos, bloods, CGM),
  **a browser can't** (smart kitchen, API integrations, coach dashboards,
  healthcare provider access, corporate wellness — each with the nearest real
  thing, usually an export you control), and **deliberately not**:
  DNA-based nutrition advice, which could be built and isn't, because consumer
  genotyping does not support confident personal diet instructions and dressing
  it up as if it did would be the least honest thing in the app

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
  lib/state.js         # what an install is: empty state + pure state helpers
  lib/store.jsx        # the provider: actions, the clock, persistence
  lib/derive.js        # every number the screens read, computed from state
  lib/health-actions.js # the store's body/training actions, bounded on the way in
  lib/reminder-actions.js # the store's reminder actions, validated on the way in
  lib/reminders.js     # when one is due, what came due while you were away,
                       # and the line it arrives carrying from your own data
  lib/reminder-suggest.js # reminders your records support, and the .ics export
  lib/notify.js        # the browser's notification API, and its real limits
  lib/reports.js       # day/week/month reports, trends, timing, adherence,
                       # shortfalls — each carrying its own sample size
  lib/report-export.js # quoted CSV, and the printable page the browser PDFs
  lib/preferences.js   # hard lines (allergens, observance) vs soft ones
  lib/preference-actions.js # the store's preference actions, validated in
  lib/units.js         # display-only conversions; the maths stays metric
  lib/footprint.js     # CO₂e and water from published per-kg category means
  lib/micro-optimise.js # greedy set-cover closing your nutrient gaps
  lib/fasting.js       # eating windows and overnight fasts, off the diary
  lib/receipt.js       # a real parser for pasted supermarket receipts
  lib/cgm.js           # CGM export parsing, and meals lined up with the trace
  lib/shopping.js      # aisles that learn, store routes, price comparison,
                       # offers, budget projection, expiry buckets, restock
  lib/kitchen.js       # pantry/shop/plan/achievement maths derived from your data
  lib/utils.js         # currency/date/expiry helpers
  lib/planner.js       # pure plan generation (hard constraints + soft preferences)
  lib/mealplan.js      # calendar maths, moves/swaps, batch groups, leftovers,
                       # and the shopping list for any range
  lib/recipe-tools.js  # scaling, substitutions, full nutrition, search, sharing
  lib/recipe-ai.js     # invents a dish from your pantry, on-device
  lib/coach.js         # adherence, trends, habits, progress, the day summarised
  lib/advice.js        # meal feedback, swaps, groceries, targets, tips, eating out
  lib/label.js         # a real parser for UK/EU nutrition panels
  lib/health.js        # measurement series and trends, BMI, waist banding,
                       # vitals, sleep, stress, cycles from your own starts
  lib/exercise.js      # METs, the burn estimate, the training week, and the
                       # importer for a health app's CSV export
  lib/photos.js        # thumbnail sizing and the storage a photo set costs
  lib/progress.js      # XP, levels, streaks, goals, challenges, missions,
                       # seasonal events and achievements — all counted
  lib/goals.js         # maintenance energy, macro splits, weekly budget, diet fit
  lib/nutrition.js     # portion scaling, day/meal totals, timing & snack insights
  lib/foodlog.js       # search, barcode, voice parsing, photo demo, recipe import
  data/                # reference only: recipes (signature dishes + the parts
                       # and per-meal templates the rest are composed from), foods
                       # (catalogue + barcodes + menus), nutrients
                       # (units/targets), micronutrients (per-100 g table),
                       # goals (body goals + dietary patterns), seasons (the UK
                       # growing calendar), quests (what earns XP and what the
                       # goals are), health (published reference ranges),
                       # workouts (METs per activity and how each health app
                       # exports), reminders (the kinds one can be, and the
                       # plain truth about notifications), preferences
                       # (allergens, observance, cuisines, units, widgets),
                       # sustainability (published CO₂e/water factors),
                       # capabilities (what's built, what a browser can't do,
                       # and what's deliberately refused), and taxonomy for
                       # aisles/locations
  components/          # one file per surface + shared ui.jsx primitives
  components/icons.jsx # data-glyph → lucide icon map (data keeps emoji keys)
tests/                 # vitest suite
```

State notes: nothing is stored twice. The diary (`log`, keyed by date) is the
single source of truth for nutrition; the pantry, shopping list, recorded
`shops`, `plan` and `cooked` history are the source for everything else. Budget
headroom is your weekly budget minus the shops you recorded this week; streaks
count consecutive days you actually cooked; badge progress reads real counters;
price trends come from prices you typed as you shopped; XP, levels and every
quest bar are counted from those same records rather than stored, so nothing
can be earned twice or kept after the thing that earned it is deleted. Body
readings, vitals, sleep, stress, cycles and workouts are stored as dated
records and every figure drawn from them — BMI, a trend, a cycle average, the
training week, the day's burn — is computed on read. A new
calendar day resets only water — everything else is date-keyed and carries
over.

Charts use a monochrome ink ramp (every series is directly labeled, so identity
never depends on colour); status colours (good/warn/danger) are muted and always
paired with a label. All tokens live as CSS custom properties in `index.css`,
with the accent defaulting to mono (ink) plus four restrained alternatives.
