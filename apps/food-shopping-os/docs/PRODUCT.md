# Forq product positioning

## Primary promise

> **Plan meals, buy exactly what you need and waste less food.**

That is the product. Everything else is optional support.

## Why this matters

Without a single promise, Forq can be read as ten different apps (meal planner, nutrition tracker, shopping list, pantry manager, budget app, recipe app, household organiser, health tracker, fitness tracker, sustainability app). That makes it hard to explain, hard to design for, and hard for users to know where to start.

## Primary loop (in order)

1. **Plan meals** — choose what you will cook.
2. **Buy exactly what you need** — generate a list from the plan, minus pantry and leftovers.
3. **Waste less food** — cook what you planned, use what is expiring, record waste honestly.

## Supporting pillars (not co-equal products)

| Pillar | How it serves the promise |
|--------|---------------------------|
| Recipes / cook mode | Makes the plan cookable |
| Pantry | Stops the list rebuying stock |
| Budget / receipts | Keeps “buy less” affordable |
| Nutrition diary | Fits the plan to energy/macro targets |
| Health / exercise | Adjusts targets; not a clinic or gym |
| Analytics | Shows whether the plan/shop/waste loop is working |
| Sustainability estimates | Secondary to wasting less food |

## Copy rules

- Lead with the **promise**, then the **three-step loop**.
- Never list nutrition, health, fitness and sustainability as equal top-line product definitions.
- Prefer “supports your plan” language over “all-in-one food OS” when introducing new surfaces.
- Capability register remains honest about platform limits.

## Product modes (simplify the surface, keep the depth)

At setup (and later in Preferences), users pick what they mainly need:

| Mode | Surfaces first |
|------|----------------|
| **Meal Planning** | Plan, recipes, leftovers |
| **Shopping and Budgeting** | Shop, pantry, spend |
| **Nutrition** | Diary, targets, macros |
| **Household Organisation** | Pantry, people, expiry |
| **Everything** | Full UI from day one |

Mode controls: home widgets, bottom-nav order, onboarding questions, guidance ranking, notification presets, and which advanced tools show initially. Features are not removed — switch mode or open Preferences to surface more.

## Source of truth in code

- `src/data/product.js` — `PRODUCT`, `PRIMARY_LOOP`, `SUPPORTING_PILLARS`, `SURFACE_POSITIONING`
- `src/data/productModes.js` — selectable modes and apply helpers
