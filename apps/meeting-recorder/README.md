# Meeting Recorder

A Fathom-style AI meeting recorder, built from the "build it in an afternoon"
guide. Two parts:

- **`web/`** — Next.js dashboard (deploy to Vercel). Lists meetings, plays the
  recording, shows a clickable transcript synced to the video, and lets you chat
  with Claude about the meeting. Public share links included.
- **`desktop/`** — Electron recorder (Windows-native audio). Captures your
  screen + system audio + microphone, uploads straight to Cloudflare R2, and
  kicks off transcription.

## Stack

| Concern        | Service                          |
| -------------- | -------------------------------- |
| Metadata / DB  | MongoDB (Atlas free tier works)  |
| File storage   | Cloudflare R2 (S3-compatible)    |
| Transcription  | Groq (hosted Whisper large v3)   |
| Chat / summary | Anthropic (`claude-sonnet-5`)    |
| Hosting        | Vercel                           |

All of these have free / near-zero-cost tiers.

## How it fits together

```
Desktop recorder ──record──▶ webm (screen+audio)
        │
        ├─ POST /api/meetings ───────────▶ Mongo doc + presigned R2 upload URL
        ├─ PUT  <presigned URL> ─────────▶ Cloudflare R2   (needs CORS, see below)
        └─ POST /api/meetings/:id/transcribe
                                          │
        Groq Whisper ◀── server pulls file from R2 ── transcript + timestamps
        Anthropic    ◀── summary + Q&A over transcript
                                          │
Web dashboard ── player + synced transcript + chat + share link
```

---

## 1. Web app setup (`web/`)

```bash
cd apps/meeting-recorder/web
cp .env.example .env.local     # fill in the values below
npm install
npm run dev                    # http://localhost:3000
```

### Environment variables

See `web/.env.example`. You need:

- **MongoDB**: `MONGODB_URI`, `MONGODB_DB`. A free Atlas cluster is fine.
- **Cloudflare R2**: create a bucket, then an R2 API token (Account → R2 →
  Manage API Tokens). Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Leave `R2_PUBLIC_BASE_URL` empty to keep
  the bucket private (playback uses short-lived presigned GET URLs).
- **Groq**: `GROQ_API_KEY` from <https://console.groq.com>.
- **Anthropic**: `ANTHROPIC_API_KEY` from <https://console.anthropic.com>.
- **App**: `NEXT_PUBLIC_APP_URL` (public URL of this app) and `DESKTOP_API_KEY`
  (a long random string the desktop recorder must send to authorize uploads).

### Fix the R2 CORS policy **before** testing uploads

The desktop recorder uploads directly to R2 with a presigned `PUT`, so the
bucket must allow cross-origin `PUT`/`GET`. Apply the policy in
[`r2-cors.json`](./r2-cors.json):

**Dashboard:** R2 → your bucket → Settings → CORS Policy → paste `r2-cors.json`.

**Wrangler CLI:**

```bash
npx wrangler r2 bucket cors put <your-bucket> --file apps/meeting-recorder/r2-cors.json
```

`AllowedOrigins` is `*` here for simplicity. For production, restrict it to your
Vercel domain (and the Electron origin, which is `null`/`file://`).

If uploads fail with a CORS error, this is almost always the cause.

### Deploy to Vercel

```bash
cd apps/meeting-recorder/web
npx vercel        # set the project root to apps/meeting-recorder/web
```

Add every variable from `.env.example` in the Vercel project settings, set
`NEXT_PUBLIC_APP_URL` to your deployed URL, and redeploy. Anyone with a
`/share/<id>` link can view a recording; the dashboard and chat stay behind your
own access.

---

## 2. Desktop recorder setup (`desktop/`)

```bash
cd apps/meeting-recorder/desktop
npm install
npm start
```

In the app:

1. Open **Connection settings** → set the **Web app URL** (your local or Vercel
   URL) and the **Desktop API key** (same value as `DESKTOP_API_KEY`). Save.
2. Pick a screen/window, choose whether to capture mic and system audio.
3. **Record**, then **Stop & upload**. The recording uploads to R2 and
   transcription starts automatically — watch it turn "Ready" in the dashboard.

Build a Windows installer with `npm run dist` (produces an NSIS installer in
`dist/`).

### Audio notes

- **Windows** captures system audio natively (Chromium `loopback`), so meeting
  audio from Zoom/Meet/Teams is included out of the box.
- **macOS** has no system-audio loopback. Install
  [BlackHole](https://github.com/ExistentialAudio/BlackHole), route system output
  through it, and select it as the input — otherwise you'll only capture the mic.

---

## Notes & limits

- Groq caps upload size (~25MB free tier, ~100MB dev tier). Long meetings may
  exceed this; `web/src/lib/groq.ts` guards against it. Chunking long recordings
  is the natural next step.
- Recordings are stored privately in R2; the app streams them with short-lived
  presigned URLs. Set `R2_PUBLIC_BASE_URL` only if you intentionally make the
  bucket/domain public.
- The chat and summary are grounded strictly in the transcript and cite
  clickable `[m:ss]` timestamps that seek the player.
