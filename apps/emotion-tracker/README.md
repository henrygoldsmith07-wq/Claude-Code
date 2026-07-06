# Reflect

An emotion tracker that goes deeper than a mood log. Instead of just logging
"angry" or "sad", you describe a situation and Claude asks follow-up
questions to help you find what's actually underneath the surface emotion,
before you act on it. Data is stored locally in the browser (localStorage) —
no account or backend required.

## How it works

1. Describe a situation and how it made you feel.
2. Claude asks one probing question at a time (at least 3, at most 5) to dig
   past the first label — anger is often hurt, fear, shame, or insecurity in
   disguise.
3. Claude is deliberately built to avoid confirming your framing. It checks
   for self-serving bias, mind-reading, catastrophizing, and moral licensing
   ("they wronged me, so I'm entitled to X") — being wronged by someone
   doesn't make every reaction to it justified, and the model is instructed
   to say so directly rather than just validate you.
4. Once there's enough to go on, it concludes with: the core emotion, what
   actually triggered it, any biases it noticed, how the other side might see
   it, an honest (not necessarily flattering) assessment, caution flags for
   any rash or retaliatory decision you mentioned, and concrete next steps.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` for a server-wide fallback key, or
leave it unset and let each visitor paste their own key in the app.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint the app
