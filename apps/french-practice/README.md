# Le Studio 🗣️ — French Speaking Practice

A single-page React + Tailwind app for practicing intermediate French speaking.
The interface is English-first; only the practice material (conversation, topics,
examples) is in French, always with translations on hand.
100% client-side — no backend. Your Groq API key lives only in `localStorage`.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

Add a free Groq API key (console.groq.com) via the settings modal, and pick
your CEFR level (A1–C2) — it calibrates the AI's complexity and scoring — it is
validated against the `/models` endpoint before being stored. Or flip on
**Mock Mode** in settings → Dev Panel to explore the whole app offline.

## Features

- **Learning Path** — pick a goal (travel, school, business, fluency), take a
  12-question placement test (A1–C2), and follow a personal roadmap of units
  whose lessons reuse the app's activities (conversations, dictée, SRS cards,
  quick fire). Each unit ends in a scored conversation checkpoint; two strong
  checkpoints in a row move your CEFR level up, and every LLM prompt tracks it.
  When flashcards pile up, a smart-review step is suggested before the lesson.
- **Home dashboard** — the daily loop: XP goal ring, streak, a personalized
  "Today's focus" carried over from your last session report, the count of
  flashcards due for review, and a suggested (least-practiced) scenario.

- **Roleplay Arena** — scenario-based voice chat (bistro, post office, flight
  rescheduling…) with a surprise curveball on your 3rd turn, 3-step hint
  engine, per-turn corrections, native alternatives, and scores
  (`S = 0.30·grammar + 0.30·naturalness + 0.20·relevance + 0.20·fluency`).
- **Audio engine** — MediaRecorder (webm/mp4-safari), live canvas frequency
  waveform (AnalyserNode), dB peak meter, DynamicsCompressor AGC, and VAD
  auto-submit after 3.5 s of silence.
- **Micro-feedback loop** — Whisper `whisper-large-v3-turbo` transcription
  (editable before sending) → `llama-3.1-8b-instant` strict-JSON evaluation.
- **Session report card** — "End Session" compiles the conversation
  into a graded report: strengths, stubborn habits, tomorrow's focus, progress
  rings, canvas radar chart, 10-session trend line, streaks, and a shareable
  PNG progress card.
- **Speaking hub** — drills for the mouth (under the Skills tab):
  - **Pronunciation** — read a sentence aloud; Whisper transcribes it and a
    word-level diff scores how much was recognized, with unrecognized words
    underlined as trouble spots and an LLM "accent coach" naming the exact
    sounds to work on (French r, nasals, u/ou, liaison…).
  - **Shadowing** — listen to the native TTS rhythm first (recording is
    gated until you have), then repeat and get the same scoring.
  - **Quick Fire** — 45-second improv challenges with WPM flow tracking.
  - **Dictée** — pure listening drill: type what you hear, word-diff scored.
- **Free Talk** — an open-ended Arena scenario with no script: your partner
  follows your lead, asks open questions, and still scores every turn.
- **Listening hub** — TTS-narrated tracks with listen-first transcripts,
  per-line highlighting, a 0.5–1.5× speed slider and comprehension quizzes:
  mini-podcasts (monologues), two-voice dialogues (distinct French voices or
  pitch-shifted speakers), radio-style news bulletins, and movie-style scenes.
  Dictée lives here too. All audio is synthesized locally — no external media.
- **Writing hub** — a typing drill (copy sentences exactly, accents and all),
  sentence completion judged by the AI, free writing from prompts with full
  correction, and an essay studio with structured feedback (corrections,
  strengths, suggestions, grammar/vocabulary/structure scores). Handwriting
  support is intentionally omitted — French uses the Latin script.
- **Reading hub** — graded readers, a branching interactive story ("La porte
  bleue" — you choose what happens), magazine articles, news items, and
  public-domain classics (La Fontaine). Dual-language toggle, per-word
  tap-to-translate (text gloss → vocabulary dictionary → cached LLM lookup)
  with one-tap save to the notebook, and comprehension quizzes.
- **Vocabulary** — eighteen themed packs: food, travel, work, feelings,
  family & people, the body, animals, clothing & colours, city & transport,
  health, home & household, nature & weather, time / numbers / money, a
  picture deck of everyday objects, idioms, slang & argot, regional French
  (Québec/Belgium/South) and filler words. Every card has a
  frequency rank (Top 100 → Niche), example sentence with translation, TTS
  pronunciation (word, sentence, 0.75× slow), synonyms/antonyms,
  collocations and register notes — plus an LLM-verified "use it in a
  sentence" challenge. One-click save any word to a personal notebook (with
  your own custom entries), and review everything through a cross-pack
  spaced-repetition queue.
- **Grammar** — a reference library of eight CEFR-tagged topics (present
  tense through subjunctive, plus object pronouns and comparatives), each an
  interactive lesson: explanation with spoken
  examples and a "watch out" note, drills with instant feedback, tap-to-order
  sentence building, and a scored quiz (best kept; 80+ = mastered). After a
  conversation mistake, the Arena shows a grammar tip that deep-links into
  the matching lesson.
- **AI studio** — five tools built straight on the LLM: an **AI tutor** you
  can ask anything (grammar, nuance, culture, study advice — answers pitched
  to your CEFR level), **AI characters** with distinct personalities (a Lyon
  grandmother, a Marseille fisherman, a Parisian actress, a space-mad
  ten-year-old) who chat in French with inline translations, an **instant
  translator** (both directions, with TTS on French output), an **exercise
  generator** that writes a three-question drill on any topic you name, and
  **personalized lessons** generated from your own recurring-mistake bank.
  In the Arena, every corrected turn also gets a "Why? Explain the rule"
  button for an on-demand grammar explanation of that specific mistake.
- **Memory & revision (evidence-based)** — the review engine is built on the
  learning-science findings that most reliably speed acquisition:
  - **Spaced repetition — the SM-2 algorithm** (SuperMemo/Anki): each card
    carries an ease factor that grows on easy recalls and shrinks on hard
    ones, with the interval compounding by ease once a card graduates
    (1 → 6 → interval×ease days); a lapse drops the ease and restarts the
    ladder.
  - **Most-forgotten-first, interleaved review**: the due queue is ordered by
    ascending predicted recall from an exponential forgetting curve
    (R(t)=e^(−t/S)) — you review each word right as it nears the forgetting
    threshold, where one repetition does the most — mixed across packs, with
    ties broken toward higher-frequency words.
  - Plus retention buckets (strong/fading/at-risk/new), a plotted forgetting
    curve, **weak-word review**, **mistake review**, **custom flashcards**, a
    **review heatmap**, a daily outlook, opt-in **smart reminders**, and a
    "the science behind this" panel that explains the method.
- **Gamification (single-player)** — a profile behind the header avatar:
  XP feeds **levels** with French titles (Débutant → Légende) and a progress
  bar; **coins** accrue with every XP gain and buy **avatars** (others are
  achievement gifts); 12 **achievements** with coin rewards unlock
  automatically from your stats; 3 deterministic **daily challenges** rotate
  each day (clear all three for a postcard); a 12-piece **postcard
  collection** is earned — never bought — via challenges, achievement
  milestones and date-windowed **seasonal events** (one per season, XP goal
  → exclusive postcard). Daily streaks were already in the header. No
  leaderboards or leagues by design: the app is a solo studio with no
  backend to rank against.
- **Motivation** — daily and **weekly XP goals** (both configurable, shown as
  rings/bars on Home and in the profile), **encouraging feedback** on Home
  that adapts to your progress and streak, a full **learning-statistics**
  grid (total XP, active days, sessions, reviews, saved words, mastered
  grammar, badges, postcards), a month **learning calendar** shaded by daily
  XP, **streak freezes** (buy with coins, max 2, auto-consumed to cover one
  missed day), a **milestones** timeline, and downloadable **certificates**
  (Bronze/Argent/Or/Assiduité) rendered to PNG on demand.
- **Culture** — a dedicated tab with eight themed sections of authored,
  factual content: cultural notes (la bise, tu/vous, laïcité), customs (the
  apéro, bread etiquette, host gifts, la galette des rois), etiquette
  (always «bonjour», table manners, le quart d’heure), festivals (le 14
  juillet, Fête de la Musique, Noël, la Chandeleur), food (meal order, the
  cheese course, the boulangerie, café culture), history (the Gauls, 1789,
  Napoléon, la Résistance), geography (l’Hexagone, rivers & regions,
  outre-mer, Paris vs la province) and regional differences (regional
  languages, chocolatine vs pain au chocolat, septante/nonante, north vs
  south). Each note carries a spoken French phrase (TTS) and a "did you
  know" tip, and a shuffled **culture quiz** pays XP into the motivation
  loop.
- **Real-world practice** — a survival hub (opened from Home) with a
  phrasebook grouped by situation — travel phrases, restaurant, airport,
  shopping, medical emergencies, business communication and interviews —
  each phrase spoken via TTS. Situations that map to an Arena roleplay have
  a "rehearse this live" jump straight into the matching conversation (a new
  **pharmacie / medical-emergency** scenario was added for this), and a
  10-question **mock exam** across grammar, vocabulary and usage returns an
  estimated CEFR band and pays XP.
- **Personalisation** — a "Personalise" panel (from Home) where you choose a
  **learning style** (balanced / conversation-first / grammar-focused /
  vocabulary-builder / immersion), a **lesson length** (short/medium/long,
  which sets how many activities a plan holds), and **favourite topics**
  (which bias the suggested conversation scenarios). A local **weakness
  analysis** ranks your weak spots from your own data — recurring mistakes,
  low grammar scores, weak words and due cards, and low session sub-scores —
  each with a one-tap jump to drill it. **Daily recommendations** are then
  ordered by your style with a boost toward those weaknesses and capped to
  your lesson length. **Adaptive difficulty** (toggle) nudges the CEFR level
  fed to the AI up or down from your recent session scores.
- **Offline & devices** — Le Studio is an installable **PWA**: a service
  worker (network-first, cache-fallback) caches the whole app so lessons,
  stories, drills and grammar all work with no connection, and audio is
  generated on-device by the browser's speech engine so listening and
  pronunciation work offline too (only the live AI conversation/correction
  features need the network). An **Offline & devices** panel shows online
  status and offline readiness, lets you **download any story or podcast
  transcript** as a text file, and — since there's no backend — moves
  progress **across devices** by exporting a JSON backup and importing it on
  another device (the API key is never included). The app is **installable**:
  a full manifest (maskable PNG icons at 192/512, apple-touch-icon) plus an
  in-app **Install** affordance — a Home banner and an "Install the app"
  section in this panel that fire the browser's native install prompt, with
  Add-to-Home-Screen instructions on iOS and an "already installed" state
  once it's running standalone.
- **Analytics** — a dashboard (from Home) built from locally-recorded data:
  headline metrics for **time studied** (a visible-time tracker), **words
  learned** (SRS), **grammar mastered**, **retention rate** (forgetting-curve
  recall), **speaking accuracy**, **pronunciation** and **listening** scores;
  a six-way **skill breakdown**; **weekly** and **monthly reports** (time,
  XP, activities, average score, best day); and an **XP heatmap**. Scored
  drills (pronunciation, dictée, listening & reading quizzes, writing
  feedback) now log a per-skill score so these numbers reflect real practice.
- **Reference & tools** — a hub (from Home) of advanced offline reference
  tools: **verb conjugation tables** (ten key verbs across présent, passé
  composé, imparfait, futur, conditionnel and subjonctif, hand-verified,
  with IPA and TTS on every form); a **minimal pairs** ear-training drill
  (play a word, pick which of a tricky sound-contrast pair you heard);
  **cloze tests** (grammar-in-context gap-fill with explanations); and an
  **offline dictionary / frequency list** — a ~570-word frequency-ranked core
  lexicon (the most common French words, banded by frequency, many with IPA),
  merged live with the vocabulary library and your notebook into one
  searchable, TTS-enabled dictionary — plus **import custom word lists** (paste «French, English»
  lines straight into your notebook and SRS queue). Selected from a longer
  "advanced features" wishlist; camera/PDF/web-page OCR, a browser
  extension and multi-language support were left out as out-of-scope for a
  single-file, French-only, no-backend app.
- **Focus & habits** — a hub (from Home) for building the study habit: a
  **Pomodoro timer** (25-minute focus blocks, short breaks, a long break
  every four) and a count-up **study timer**, both with a distraction-free
  full-screen **focus mode** and a chime/vibration/notification on phase
  change; a **habit tracker** where you define daily habits, tick them off
  and watch each one's streak; and a **goal-streak calendar** marking every
  day you hit your daily XP goal. Daily notifications already exist as the
  opt-in review reminders. (OS home-screen widgets and lock-screen reminders
  aren't included — a web PWA can't create those.)
- **Onboarding** — a 14-step first-run wizard for new visitors: welcome,
  name, why-you're-learning, CEFR level, daily goal, learning style,
  favourite topics, lesson length, avatar, reminders opt-in, habit picks, AI
  key / demo mode, a feature tour and a personalised sign-off — writing all
  of it (settings, preferences, avatar, habits, key) on the final step. It
  shows only for genuinely new users (no key, XP or sessions), sets a flag so
  it never nags again, has a Skip at every step, and can be replayed any time
  from Settings.
- **Dev Panel** — token totals, latency pings, raw payload log, Mock Mode.

TTS uses the browser's `speechSynthesis` with the best available `fr-FR`
voice and a 0.5×–1.5× speed slider. Haptics via `navigator.vibrate` on mobile.
