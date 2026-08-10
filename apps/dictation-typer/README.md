# Dictation Typer

Hold a hotkey, speak, release — the transcript is typed straight into whatever
window has focus (Slack, VS Code, your browser, anywhere). Transcription runs on
Groq's hosted Whisper (fast, near-free) with an optional offline fallback.

Windows-native. Works on macOS/Linux too, with the notes below.

## How it works

```
Hold hotkey ──▶ record mic (in memory) ──release──▶ Groq Whisper ──▶ paste into active window
                                         ↳ offline (faster-whisper) fallback if configured
```

Nothing touches disk except crash logs (opt-in path); audio is streamed as an
in-memory WAV. In **privacy mode** audio is not sent to the cloud unless you
confirm or no offline model is configured.

## Setup

```bash
cd apps/dictation-typer
python -m venv .venv && .venv\\Scripts\\activate      # Windows
# python3 -m venv .venv && source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
# Optional: pip install faster-whisper  # for offline/local transcription

copy .env.example .env                                # Windows  (cp on macOS/Linux)
# edit .env and add your GROQ_API_KEY (free at https://console.groq.com)

copy config.example.json config.json                  # optional — tweak hotkeys, mic, vocab
python main.py
```

Then hold **Ctrl+Alt**, speak, and release. The text appears at your cursor.
Press **Ctrl+C** in the console to quit. On each dictation the console shows
the session counter, text, audio/transcription timing, and latency (ms).

**Quick checks on launch:** the app prints a permissions & setup summary
(microphone, hotkey, API key, platform quirks) so first-run issues are obvious.

## Configuration (`config.json`)

Most users only touch the first three rows; the rest are opt-in.

| Key | Default | Meaning |
| --- | --- | --- |
| `hotkey` | `ctrl+alt` | Primary dictate combo. e.g. `ctrl+alt+space`, `f8`. |
| `mode` | `push_to_talk` | `push_to_talk` (hold) or `toggle` (press to start, press to stop). |
| `insert_method` | `paste` | `paste` (clipboard + Ctrl/Cmd+V, restores clipboard) or `type` (keystrokes). |
| `sample_rate` | `16000` | Mic sample rate. 16 kHz is what Whisper expects. |
| `beep` | `true` | Start/stop beeps (Windows `winsound`, bell on macOS/Linux). |
| `min_seconds` | `0.3` | Ignore accidental sub-threshold taps. |
| `microphone` | `""` | Mic selector: device index (`"2"`) or name substring (`"Yeti"`). Empty = default. |
| `language` | `""` | Force language (`en`, `fr`, …); blank = auto-detect. Also in `.env` as `DICTATION_LANGUAGE`. |
| `punctuation_commands` | `true` | Speak \"period\", \"comma\", \"new line\", etc. → punctuation. |
| `formatting_commands` | `true` | \"all caps … end caps\", \"cap …\" → casing. |
| `correction_hotkey` | `ctrl+alt+c` | Show last transcript / correction workflow. |
| `coding_hotkey` | `ctrl+alt+k` | Toggle coding mode (preserves identifiers, `=>`, braces). |
| `vocabulary` | `[]` | Custom terms to bias recognition and restore casing. |
| `custom_names` | `[]` | Proper names to preserve. |
| `coding_mode` | `false` | When true, coding shorthands are expanded. |
| `privacy_mode` | `false` | Avoid sending audio to cloud when true (requires `offline_model` to transcribe). |
| `offline_model` | `""` | Local model size (`tiny`, `base`, `small`) via `faster-whisper` (optional dep). |
| `provider` | `groq` | `groq` (cloud only), `offline` (local only), `auto` (groq → offline fallback). |
| `retry_attempts` | `2` | Retries per provider on transient errors. |
| `retry_queue` | `true` | Queue failed dictations for background retry. |
| `app_profiles` | `{}` | Per-app overrides keyed by name, each with `match`, `language`, `vocabulary`, `coding_mode`. |
| `active_profile` | `default` | Default profile. |
| `auto_update` | `false` | Check PyPI for newer `dictation-typer` on launch. |
| `audible_status` | `true` | Audible state feedback (beeps). |
| `visual_status` | `true` | Visual state (icons + messages) in console; also writes `.dictation_status.json`. |

Secrets and the model live in `.env`:

| Var | Meaning |
| --- | --- |
| `GROQ_API_KEY` | Your Groq key (required unless using `offline` provider + `offline_model`). |
| `GROQ_TRANSCRIBE_MODEL` | Default `whisper-large-v3-turbo` (fastest). Use `whisper-large-v3` for max accuracy. |
| `DICTATION_LANGUAGE` | Force a language (e.g. `en`); blank = auto-detect (mirrors `config.json` `language`). |

### Hotkey format

`+`-separated. Modifiers: `ctrl`, `alt`, `shift`, `win`. Optionally one regular
key (`space`, `f8`, a letter). A modifiers-only combo like `ctrl+alt` triggers
while all of them are held. `correction_hotkey` and `coding_hotkey` follow the
same format.

### Voice commands

- **Punctuation:** \"period\", \"comma\", \"question mark\", \"exclamation mark\", \"colon\", \"semicolon\", \"dash\", \"ellipsis\", \"new line\", \"new paragraph\", \"open/close paren/bracket/quote\".
- **Formatting:** \"all caps … end caps\", \"no caps …\", \"cap …\".
- **Coding (when coding mode on):** \"arrow function\" → `=>`, \"open/close brace/paren\", \"equals equals\" → `==`, etc.

Disable either family with `punctuation_commands` / `formatting_commands`.

### Vocabulary, names, and coding mode

Add domain terms and proper names to `vocabulary` / `custom_names` — they bias
Whisper via the prompt and are restored with your casing after transcription.

**Coding mode** (`coding_mode` or `coding_hotkey` toggle) keeps identifiers and
punctuation shorthands. Per-app profiles can enable it automatically, e.g.:

```json
{ "app_profiles": { "vscode": { "match": ["Code"], "coding_mode": true } } }
```

`match` is a list of substrings tested against the active window title/app name
(`xdotool` on Linux, AppleScript on macOS, Win32 on Windows).

### Microphone selector

Set `microphone` to a device index or a substring of the device name. List
devices from the REPL:

```python
from dictation.devices import list_microphones
print(list_microphones())
```

Or run with `python -c "from dictation.devices import list_microphones; print(list_microphones())"`.

### Privacy mode and offline fallback

- `privacy_mode: true` — the app will not send audio to Groq unless a fallback
  is unavailable. Configure `offline_model` (e.g. `\"tiny\"`) and
  `pip install faster-whisper` to transcribe locally.
- `provider: \"auto\"` — try Groq first, fall back to offline on failure;
  respects `retry_attempts` per provider.
- `provider: \"offline\"` — always use the local model.

Offline transcription uses `faster-whisper` (CTranslate2, int8, CPU). Quality is
lower than `whisper-large-v3-turbo` but works without a network or API key.

### Reliability

- **Retry queue** (`retry_queue: true`) — failed transcriptions are queued and
  retried in the background. Transient network blips don't lose your dictation.
- **Crash logging** — unhandled exceptions are appended to `crash.log` (or
  `crash_log` path in config), bounded to ~200KB.
- **Clipboard safety** — `paste` mode restores the previous clipboard contents
  (text or empty) after insertion, with a settled delay; `type` mode leaves the
  clipboard untouched.
- **Status** — audible (beeps) and visual (icons) for `listening` / `transcribing`
  / `error` / `retrying`; also writes `.dictation_status.json` for tray UIs.
- **Permissions onboarding** — on launch the app prints a checklist (mic,
  Accessibility on macOS, admin on Windows, `xdotool` on Linux, API key).

## Benchmarks

Word-error rate (WER) and latency helpers live in `dictation/benchmark.py`:

```bash
python -m dictation.benchmark
```

WER is measured on a small reference corpus (with and without the punctuation
pipeline). Latency is the end-to-end `transcribe()` time; pass your own WAV
to `benchmark_latency(transcribe_fn, wav_bytes)` for real audio. These are
regression benchmarks — they run without network and are safe in CI.

## Packaging

```bash
pip install pyinstaller
python build_installer.py --archive    # zip/tar of dist/ (or source if no exe)
python build_installer.py --installer  # Windows: exe + Inno Setup stub (requires iscc)
```

`pyproject.toml` defines the package `dictation-typer` (`pip install -e .`) and
optional extras `offline` (`faster-whisper`) and `profiles` (`psutil`).

- **Windows installer** — `build_installer.py --installer` uses PyInstaller
  (`--onefile`) and Inno Setup (`iscc`) if available; otherwise it builds the
  exe and skips the installer step.
- **macOS/Linux** — `--archive` builds a zip/tar; no Windows-only steps.

Updates: set `auto_update: true` to check PyPI on launch (prints a notice when
a newer version exists; no auto-install).

## Platform notes

- **Windows** — works out of the box. If keystroke injection is blocked while an
  elevated (admin) app is focused, run this app as administrator too.
- **macOS** — grant the terminal **Accessibility** and **Microphone** permission
  (System Settings → Privacy & Security). `win` maps to ⌘.
- **Linux** — needs an X server for global hotkeys (`pynput` limitation on
  Wayland) and PortAudio (`sudo apt install libportaudio2`). For app profiles,
  install `xdotool`.

## Notes

- `paste` mode is the most reliable across apps and handles any Unicode; it
  briefly uses the clipboard and restores your previous contents.
- Groq caps upload size (~25MB), which is minutes of speech — far more than a
  normal dictation burst.
