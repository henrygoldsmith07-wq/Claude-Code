/**
 * What Forq does, what it can't, and what it refuses to.
 *
 * Most apps answer "does it integrate with X?" with a Coming Soon badge. This
 * is the register instead: every capability people ask for, its actual status,
 * and — where the honest answer is no — the nearest real thing, which is
 * usually already built.
 *
 * Three kinds of "no" are kept apart, because they are not the same:
 *
 *   `impossible` — a browser cannot do it. No amount of work here changes
 *                  that; it needs a server, a native app, or a vendor deal.
 *   `refused`    — it could be built and shouldn't be, because the output
 *                  would be advice the evidence doesn't support.
 *   `partial`    — the useful half is built and the label oversells it.
 */

const cap = (id, name, status, detail, instead = null) => ({ id, name, status, detail, instead });

export const CAPABILITIES = [
  /* ---------- Built ---------- */
  cap('micro', 'Micronutrient optimisation', 'built',
    'Finds the foods that close the most of what your logged days are short on, in normal portions, ranked by how much of each gap they actually cover.'),
  cap('footprint', 'Carbon & water footprint', 'built',
    'Computed from published per-kilogram category averages (Poore & Nemecek 2018) against the grams you logged, always with the share of your food it could place.'),
  cap('sustainability', 'Sustainability score', 'built',
    'Your daily average against the categories driving it, and the swaps that would actually move the number.'),
  cap('waste', 'Food waste tracking', 'built',
    'Binning a pantry item records what it cost you at the price you paid.'),
  cap('predictions', 'Shopping predictions', 'built',
    'Predicts the next trip, products likely due and weekly budget pace from your own dated shops. Every result includes the evidence and stops when there is too little history.'),
  cap('autoList', 'Auto-generated shopping lists', 'built',
    'Combines pantry rows you marked low with products due from repeat purchase cadence, deduplicated against the current list.'),
  cap('recipeLibrary', 'Personal recipe library', 'built',
    'Recipes can be saved, favourited, rated from one to five and organised into named collections. All of it stays in local app state and ratings are explicitly personal rather than a pretend community score.'),
  cap('recipeCooking', 'Guided recipe cooking', 'built',
    'Recipes scale ingredient quantities, calculate per-serving nutrition, send missing ingredients to shopping, and run step-by-step cooking mode with independent timers and original video links.'),
  cap('notifications', 'Notification centre', 'built',
    'Opt-in presets cover expiry, shopping, meals, budgets, weekly reports, daily summaries, pantry alerts, saved price targets and repeat-buy restocks. Context comes from local records; foreground browser alerts, catch-up and calendar export share the existing reminder scheduler.'),
  cap('uxLayer', 'Global UX controls', 'built',
    'Cross-app search and commands, quick add, keyboard shortcuts, a 30-action local undo history, type filters and sorting, touch/context menus, and drag ordering for meals, shopping and dashboard widgets. Gestures supplement visible controls rather than hiding the only route to an action.'),
  cap('recipeImport', 'Recipe URL import', 'partial',
    'Parses recipe text copied from a page and keeps its source or video URL. The offline browser cannot reliably fetch cross-origin recipe sites, so the app asks for the copied text instead of generating a pretend result from a URL.'),
  cap('retailers', 'UK retailer integration', 'partial',
    'Tesco, Sainsbury’s, Asda, Aldi, Lidl, Morrisons, Waitrose, Ocado and Amazon Fresh each have official product, offers and fulfilment links. Recorded receipt prices and saved vouchers stay local; live prices, stock and delivery slots are confirmed by the retailer because there is no retailer API connection.'),
  cap('menu', 'Restaurant menu analysis', 'built',
    'The chains the app ships figures for, read against your targets rather than against a star rating.'),
  cap('fasting', 'Fasting tracker', 'built',
    'Overnight fasts read straight off your diary — the gap between last night’s entry and this morning’s — plus a timer for a fast you set.'),
  cap('prep', 'Meal prep planner', 'built',
    'Batch mode in the planner: fewer dishes in deliberate blocks, with which day to cook, how many batches, and the time it saves.'),
  cap('label', 'Nutrition label scanner', 'partial',
    'No OCR ships here, so it doesn’t pretend to read the photograph. You paste the panel and the parsing is the real part — “of which” lines, kJ/kcal pairs, salt to sodium, per-serving scaled back to 100 g.'),
  cap('receipt', 'Receipt scanner', 'partial',
    'Uses the browser’s native text detector when available, then parses items, prices, quantities, store and date and checks the result against the printed total. Pasted text remains the fallback because most browsers do not expose OCR.'),
  cap('barcode', 'Barcode recognition', 'partial',
    'Reads EAN and UPC codes from a camera image through the browser’s native BarcodeDetector where available. Product lookup stays offline against the bundled catalogue; manual entry is the fallback.'),
  cap('pantryPhoto', 'Pantry image recognition', 'partial',
    'On-device demonstration only. It shows what recognition would give you and says plainly that it is not identifying your actual shelf.'),
  cap('voice', 'Voice logging', 'built',
    'Speech in the browser, parsed into portions — “two slices of wholemeal bread and 200g greek yogurt for lunch”.'),
  cap('voiceAssistant', 'Voice assistant', 'partial',
    'A spoken question can drive the local food coach where browser speech recognition exists. Typed questions remain available everywhere.'),
  cap('geofence', 'Geofenced reminders', 'partial',
    'A saved 200m area can trigger a notification on re-entry while Forq is open. Background geofencing needs native operating-system permissions and is not available to this web app.'),
  cap('offline', 'Offline mode', 'built',
    'The whole app is offline. There is no backend to lose: everything lives in your browser’s storage, and the service worker caches the app itself so it opens with no connection.'),
  cap('bloods', 'Blood test results', 'partial',
    'No lab has an API a web app can call, and none would open one to an unauthenticated browser. You enter your own results and they are banded against the published reference ranges.'),
  cap('cgm', 'Continuous glucose monitor', 'partial',
    'No browser API exists for Dexcom or Libre — their APIs are OAuth against a vendor server, which needs a server of our own. So: import the CSV they export, and the app lines the trace up against what you logged eating.'),

  /* ---------- A browser cannot ---------- */
  cap('smartKitchen', 'Smart kitchen integration', 'impossible',
    'Ovens, fridges and scales speak Matter, Zigbee or a vendor cloud. A web page can reach none of them — there is no browser API for any of it, and a “Connect” button here would be decoration.',
    'The plan and the recipe are on your phone, which is the screen you were going to use in the kitchen anyway.'),
  cap('api', 'Authenticated API integrations', 'impossible',
    'An authenticated live feed needs a server to hold credentials and take requests. Forq has neither, by design — that is the same decision that means nobody can read your diary.',
    'Retailer links, local receipt prices and open-format exports provide useful hand-offs without claiming a live connection.'),
  cap('coach', 'Coach or trainer dashboard', 'impossible',
    'A dashboard means accounts, a server, and your food diary sitting on someone else’s computer. None of that exists here.',
    'Generate the report and hand it over — the printable PDF and the CSVs are exactly what a coach would want, and you decide what goes and when.'),
  cap('provider', 'Healthcare provider access', 'impossible',
    'Clinical access needs identity, audit and a legal basis for holding health data. An app with no server can offer none of it, and pretending otherwise around medical data would be worse than not offering it.',
    'The same report, printed or as CSV, is something you can take to an appointment. It says how many days it covers, which is the first thing a clinician will ask.'),
  cap('corporate', 'Corporate wellness', 'impossible',
    'Corporate programmes mean an employer-side view of employee data. There is no server to host it, and an app whose whole premise is that your data never leaves your device is the wrong place to build one.',
    'Nothing stops you using Forq while your employer runs a scheme; your data simply isn’t part of it.'),
  cap('languages', 'Multi-language support', 'partial',
    'The interface is English only. Numbers, dates and times follow your device’s locale, and units are yours to set — but the words have not been translated, and shipping a machine translation of nutrition copy is how a caveat becomes a claim.'),

  /* ---------- Could be built, shouldn't be ---------- */
  cap('dna', 'DNA-based nutrition advice', 'refused',
    'This one is a deliberate no. Consumer genotyping covers a handful of common variants, and for nearly all of them the effect on what you should eat is either tiny, unreplicated, or entirely dependent on things the test didn’t measure. Trials that gave people gene-based diets have not beaten the same advice given without the genes. Building this would mean generating confident, personal, permanent-sounding instructions from evidence that does not support them — so it isn’t built.',
    'If you have a report from a clinician about a genuine condition — coeliac disease, haemochromatosis, PKU, a diagnosed intolerance — set it as an allergy or an intolerance under Preferences and every recipe surface will honour it.'),
];

export const capabilityBy = Object.fromEntries(CAPABILITIES.map((c) => [c.id, c]));

export const STATUS_LABELS = {
  built: { label: 'Built', tone: 'good' },
  partial: { label: 'Partly, honestly', tone: 'accent' },
  impossible: { label: 'A browser can’t', tone: 'muted' },
  refused: { label: 'Deliberately not', tone: 'warn' },
};

export const REGISTER_INTRO =
  'Everything people ask a nutrition app for, and where Forq actually stands on it. “A browser can’t” means exactly that — no server, no native permissions, no vendor deal. “Deliberately not” means it could be built and shouldn’t be.';
