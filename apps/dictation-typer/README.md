# Dictation Typer

Hold a hotkey, speak, release — the transcript is typed straight into whatever
window has focus (Slack, VS Code, your browser, anywhere). Transcription runs on
Groq's hosted Whisper, so it's fast and near-free.

Windows-native. Works on macOS/Linux too, with the notes below.

## How it works

```
Hold hotkey ──▶ record mic (in memory) ──release──▶ Groq Whisper ──▶ paste into active window
```

Nothing touches disk; audio is streamed to Groq as an in-memory WAV.

## Setup

```bash
cd apps/dictation-typer
python -m venv .venv && .venv\Scripts\activate      # Windows
# python3 -m venv .venv && source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

copy .env.example .env                                # Windows  (cp on macOS/Linux)
# edit .env and add your GROQ_API_KEY (free at https://console.groq.com)

copy config.example.json config.json                  # optional — tweak the hotkey
python main.py
```

Then hold **Ctrl+Alt**, speak, and release. The text appears at your cursor.
Press **Ctrl+C** in the console to quit.

## Configuration (`config.json`)

| Key             | Default                   | Meaning                                                        |
| --------------- | ------------------------- | ------------------------------------------------------------- |
| `hotkey`        | `ctrl+alt`                | Combo that triggers dictation. e.g. `ctrl+alt+space`, `f8`.   |
| `mode`          | `push_to_talk`            | `push_to_talk` (hold) or `toggle` (press to start, press to stop). |
| `insert_method` | `paste`                   | `paste` (clipboard + Ctrl+V, restores clipboard) or `type` (keystrokes). |
| `sample_rate`   | `16000`                   | Mic sample rate. 16 kHz is what Whisper expects.              |
| `beep`          | `true`                    | Windows-only start/stop beeps.                                |
| `min_seconds`   | `0.3`                     | Ignore accidental sub-threshold taps.                         |

Secrets and the model live in `.env`:

| Var                     | Meaning                                              |
| ----------------------- | ---------------------------------------------------- |
| `GROQ_API_KEY`          | Your Groq key (required).                            |
| `GROQ_TRANSCRIBE_MODEL` | Default `whisper-large-v3-turbo` (fastest). Use `whisper-large-v3` for max accuracy. |
| `DICTATION_LANGUAGE`    | Force a language (e.g. `en`); blank = auto-detect.   |

### Hotkey format

`+`-separated. Modifiers: `ctrl`, `alt`, `shift`, `win`. Optionally one regular
key (`space`, `f8`, a letter). A modifiers-only combo like `ctrl+alt` triggers
while all of them are held.

## Platform notes

- **Windows** — works out of the box. If keystroke injection is blocked while an
  elevated (admin) app is focused, run this app as administrator too.
- **macOS** — grant the terminal **Accessibility** and **Microphone** permission
  (System Settings → Privacy & Security). `win` maps to ⌘.
- **Linux** — needs an X server for global hotkeys (`pynput` limitation on
  Wayland) and PortAudio (`sudo apt install libportaudio2`).

## Notes

- `paste` mode is the most reliable across apps and handles any Unicode; it
  briefly uses the clipboard and restores your previous contents.
- Groq caps upload size (~25MB), which is minutes of speech — far more than a
  normal dictation burst.
