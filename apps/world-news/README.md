# World News Globe

Understand what happened, where it happened, who is reporting it and where accounts differ.

The home page is an interactive 3D globe — hover to highlight a country, click to open its news page. Each country's news is summarised by **Google Gemini with Google Search grounding** (so it's current and cites real sources), organised as **story clusters** rather than only country summaries, plus source-country mix, source perspective where available, primary sources, timeline, conflicting claims, widely agreed facts, uncertainty, correction history, "what changed since yesterday?" and coverage gaps.

## Stack

- Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript
- [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) (three.js) for the globe
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) — Gemini SDK with the
  `google_search` grounding tool
- No login. Summaries are cached per country/day via Next.js `unstable_cache`
  (6-hour revalidate), and optionally persisted to Supabase for history + pre-caching.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key
npm run dev
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Summarise news via Gemini + Google Search grounding. Free key: <https://aistudio.google.com/apikey>. |
| `GEMINI_API_KEYS` | no | Extra free Gemini keys as one comma/space/newline-separated list (easiest way to add many). The app rotates to the next when one hits its daily quota (429). |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_20` | no | Alternative to `GEMINI_API_KEYS`: extra keys as individually numbered vars. Both forms can be combined; duplicates are de-duped. |
| `GROQ_API_KEY` | no | Tags the geolocated news dots and writes the audio-briefing podcast scripts. Free: <https://console.groq.com/keys>. Falls back to a local script when unset. |
| `OPENROUTER_API_KEY` | no | Makes OpenRouter the **primary** news source: real GDELT articles organised by an OpenRouter model into topic summaries + points (Gemini becomes the fallback). Key: <https://openrouter.ai/keys>. |
| `OPENROUTER_MODEL` | no | Override the OpenRouter model. Defaults to `meta-llama/llama-3.3-70b-instruct:free`. The model only *organises* real GDELT data, so it can't fabricate news. |
| `SUPABASE_URL` | no | Supabase project URL — enables the historical timeline + scheduled pre-caching. |
| `SUPABASE_SERVICE_ROLE_KEY` | no | **Secret**, server-side only. Supabase → Settings → API → `service_role`. Set in Vercel env, never commit. |
| `CRON_SECRET` | no | Shared secret guarding `/api/cron/refresh`; Vercel Cron sends it as a Bearer token. |

Without `GEMINI_API_KEY` the globe still works, but country pages show a "configure your
key" message. Without Supabase the app simply generates news live per request (no history).

### Timeline & pre-caching (Supabase)

The `news_snapshots` table stores one summary per place per day. It powers:

- **Historical timeline** — a date slider on country/world pages to scrub back through
  past days (`?date=YYYY-MM-DD` loads that day's snapshot).
- **Scheduled pre-caching** — `vercel.json` registers a daily cron that calls
  `/api/cron/refresh`, which regenerates the world summary and a small set of major
  countries and stores them, so real visits load instantly without re-hitting Gemini.

To enable: create a Supabase project, run the migration in
`supabase/migrations/`, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`CRON_SECRET` in Vercel.

## How it works

- `public/countries.geojson` — bundled Natural Earth country polygons (name + ISO codes)
  drive the globe and map codes to names (`src/lib/countries.ts`).
- `src/lib/gemini.ts` — prompts Gemini to search current news for a country and return a
  JSON summary grounded in real sources, plus **story clusters** (what/where/who/differ), source mix, perspective, primary sources, timeline, conflicting claims, agreed facts, uncertainty, corrections and what changed. Grounding source links come from
  `groundingMetadata.groundingChunks`.
- `src/lib/storyModel.ts` / `src/lib/storyAnalysis.ts` — typed model for stories and pure helpers for source mix, perspective mapping, headline overlap and "what changed" diffing.
- `src/lib/news.ts` — caches each country's summary (`getCountryNews`).
- `src/app/country/[code]/page.tsx` and `src/app/world/page.tsx` — render story clusters + topics + meta panels (widely agreed, uncertainty, coverage gaps, corrections, what changed).
- `/api/country/<code>` returns the same data as JSON. `/benchmark` is the public clustering/summarisation benchmark.

## New in 10.0

- **Clustering benchmark** — real evaluation dataset (`src/lib/benchmarkDataset.ts` — 5 extended cases + 2 base = 7), macro P/R/F1 at `/benchmark`, syndicated dedup (`dedup.ts`) and original-vs-rewrite scoring, event persistence with merge/split corrections (`eventStore.ts`).
- **Multilingual** — GDELT `sourcelang` per-language fetch (`fetchScopeGeoNewsForLang`, `fetchMultilingualScope`), multilingual topic queries, `translation.ts` (Gemini cached) and `sourcing.ts` diversity report.
- **Provenance** — claim-level provenance (`provenance.ts`: `provenanceForStory`, `timelineConfidence`, `disputedFacts`, `splitStoryContent`, `whatChangedSince`), evidence-linked summaries, disputed-fact cards, `Why this matters / What changed / What remains unknown` panels.
- **Knowledge graphs** — entity / country / event graphs (`knowledgeGraph.ts`) derived from stories.
- **Personalisation without bubbles** — explicit diversity guards (`personalisation.ts`), saved topics + browser notifications (`notifications.ts`, `SavedTopics.tsx`), `DiversityNudge` and filter-bubble warnings.
- **Coverage compare** — country \u00d7 publisher matrix (`coverageMatrix.ts`, `CoverageCompare.tsx`) and gap detection.
- **Geo** — Nominatim geocoding with confidence (`geocode.ts`: `geocode`, `locationConfidence`, `regionalLabel`, `mapCluster`), multi-location/regional events, map clustering.
- **Search & a11y** — `SearchStories.tsx` and `StoryScreenReader.tsx` (role=feed), keyboard nav (`/` to search), `GlobeFallback` / `LiteNewsList` / `?lite=1` for low-bandwidth and offline (`offline.ts` cache helpers).

## Provenance core

Six modules that answer one question — *how much should this story move your
beliefs?* — by counting original reports rather than articles.

| Module | Question it answers |
| --- | --- |
| `syndication.ts` | Which report is the original, and who is carrying it? |
| `independence.ts` | Why do these sources count as separate accounts? |
| `corrections.ts` | Who is still publishing something the originator withdrew? |
| `timeline.ts` | When did it happen, as opposed to when it was posted? |
| `epistemic.ts` | What is known, disputed, unverified — and what is not established? |
| `corpus.ts` | Do we have the labels to claim any of this is accurate? |

Three ideas do most of the work:

- **Virtual origins.** When six outlets print "(Reuters)" and Reuters' own copy
  is not in the corpus, all six root at a virtual Reuters node. Without it, six
  carriers of one wire report count as six independent accounts — the exact
  error the product exists to avoid.
- **Similarity is not evidence.** Between 0.30 and 0.62 headline overlap, a
  measured pair we *want* linked scores 0.34 while a pair we want kept apart
  scores 0.55. No cutoff orders them correctly, so a link in that band needs a
  structural signal too — a wire or official parent, or shared entities close in
  time. The reasoning is recorded in `syndication.ts` rather than buried in a
  constant.
- **Absence is rendered.** Unknowns are computed from the shape of the sourcing
  (no primary record, no local outlet, no stated date, one origin behind
  everything) rather than read off a model's `uncertainty` list, so a story with
  one wire source and no local coverage says so whether or not the generation
  step noticed. They occupy space in `SourceProvenancePanel`, because a missing
  fact has no natural place in a layout and a page that closes up around it
  reads as complete.

Corrections propagate along the derivation graph, and withdrawn claims are
struck through rather than deleted — a reader who saw the original is owed the
update.

## Benchmarks: what is measured, and what is not

`benchmarkGold.ts` is **synthetic**, and now says so. Its articles are authored
fixtures with URLs that resolve to nothing; no human reviewed a real article to
produce them. Scored against fixtures written with the clusterer in mind, a
clusterer is measured on its ability to recover the fixture author's intent, so
the number says nothing about news. It is kept as a regression guard and is
structurally barred from being reported as accuracy.

The real corpora live in `corpusData.ts` and are **empty**:

- `CLUSTERING_CORPUS` — real articles, two independent annotators, adjudicated
  disagreements, Cohen's κ over same-event pair decisions. Target 2000 articles.
- `CLAIM_VERIFICATION_SET` — one (claim, cited source) pair per row, judged
  against the cited page alone, with a verbatim quote required for `supported`
  and `contradicted`. Target 300 citations.

`benchmarkEligibility()` refuses to report either until they are real, large
enough, double-labelled and adjudicated. `npm run benchmark` prints the refusal
next to the synthetic numbers so the two cannot be confused:

```
SYNTHETIC dev set (regression guard — NOT a benchmark): 59 events + 30 singletons = 217 fixtures
Human-labelled corpus (the actual benchmark): Empty human-labelled corpus: 0 articles, 0 labels.
Reportable as a clustering benchmark: no
  - 0 articles; a reportable benchmark needs at least 2000.
  - 0 annotator(s); agreement cannot be measured below 2.
```

Filling them is human work. The code holds the shape and reports zero rather
than generating something to occupy the space.

Known limitation, tested and documented in `epistemic.test.ts`: claim-to-source
matching is lexical, so a French report supporting an English claim is not
counted as support. This under-counts corroboration — the safer direction — but
it is a real ceiling on the cross-lingual clustering the product claims.

## Positioning

Not "impartial AI news" as the headline — instead: *Understand what happened, where it happened, who is reporting it and where accounts differ.* Summaries are grounded in live search results (not model memory), and the prompt requires neutral tone, attribution of contested claims, and presenting multiple sides. Source links are always shown so you can verify. New in this repositioning: story clustering, source-country mix, source political perspective where available, primary sources, timeline, conflicting claims, widely agreed facts, uncertainty, correction history, "what changed since yesterday?" and coverage gaps.

## Tests

```bash
npm test          # vitest (see src/lib/*.test.ts)
npm run type-check
npm run build
```
