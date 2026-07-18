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
- **Vocabulary** — nine themed packs (~70 entries): food, travel, work,
  feelings, a picture deck of everyday objects, idioms, slang & argot,
  regional French (Québec/Belgium/South) and filler words. Every card has a
  frequency rank (Top 100 → Niche), example sentence with translation, TTS
  pronunciation (word, sentence, 0.75× slow), synonyms/antonyms,
  collocations and register notes — plus an LLM-verified "use it in a
  sentence" challenge. One-click save any word to a personal notebook (with
  your own custom entries), and review everything through a cross-pack
  spaced-repetition queue.
- **Grammar** — a reference library of six CEFR-tagged topics (present tense
  through subjunctive), each an interactive lesson: explanation with spoken
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
- **Memory & revision** — a dashboard inside Vocab built on an exponential
  forgetting-curve model (recall R(t)=e^(−t/S), stability from the SRS
  interval): retention buckets (strong/fading/at-risk/new), a plotted
  forgetting curve, **weak-word review** (high-lapse cards drilled worst
  first), **mistake review** (flip through the recurring-mistake bank and
  burn entries down to zero), **custom flashcards** (notebook words join the
  SRS queue and study as cards), a GitHub-style **review heatmap** (15
  weeks, per-day counts), a daily outlook ("N due now, M slip below 80% by
  tomorrow"), and opt-in **smart reminders** — one browser notification per
  day when cards are waiting.
- **Dev Panel** — token totals, latency pings, raw payload log, Mock Mode.

TTS uses the browser's `speechSynthesis` with the best available `fr-FR`
voice and a 0.5×–1.5× speed slider. Haptics via `navigator.vibrate` on mobile.
