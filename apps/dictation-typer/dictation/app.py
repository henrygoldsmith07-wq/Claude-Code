"""Wires the hotkey listener to the recorder, transcriber, and text inserter."""

from __future__ import annotations

import platform
import sys
import threading

from pynput import keyboard

from .config import Config
from .recorder import Recorder
from .transcriber import transcribe
from .inserter import TextInserter

# pynput modifier keys grouped under a single canonical name each.
_MOD_ALIASES: dict[str, str] = {
    "ctrl": "ctrl", "control": "ctrl",
    "alt": "alt", "option": "alt", "altgr": "alt",
    "shift": "shift",
    "win": "win", "cmd": "win", "super": "win", "meta": "win",
}
_MOD_KEYS: dict[keyboard.Key, str] = {
    keyboard.Key.ctrl: "ctrl", keyboard.Key.ctrl_l: "ctrl", keyboard.Key.ctrl_r: "ctrl",
    keyboard.Key.alt: "alt", keyboard.Key.alt_l: "alt", keyboard.Key.alt_r: "alt",
    keyboard.Key.shift: "shift", keyboard.Key.shift_l: "shift", keyboard.Key.shift_r: "shift",
    keyboard.Key.cmd: "win", keyboard.Key.cmd_l: "win", keyboard.Key.cmd_r: "win",
}
if hasattr(keyboard.Key, "alt_gr"):
    _MOD_KEYS[keyboard.Key.alt_gr] = "alt"


def _beep(on: bool, enabled: bool) -> None:
    if not enabled or platform.system() != "Windows":
        return
    try:
        import winsound

        winsound.Beep(880 if on else 440, 90)
    except Exception:
        pass


class _Hotkey:
    """Parses a hotkey string like 'ctrl+alt' or 'ctrl+alt+space' and tracks
    whether the full combination is currently held."""

    def __init__(self, spec: str) -> None:
        self.required_mods: set[str] = set()
        self.required_key: str | None = None
        for token in (t.strip().lower() for t in spec.split("+") if t.strip()):
            if token in _MOD_ALIASES:
                self.required_mods.add(_MOD_ALIASES[token])
            else:
                self.required_key = token
        if not self.required_mods and not self.required_key:
            raise SystemExit(f"Could not parse hotkey '{spec}'.")

        self._pressed_mods: set[str] = set()
        self._key_down = False

    def _token(self, key) -> tuple[str, str] | None:  # noqa: ANN001
        if key in _MOD_KEYS:
            return ("mod", _MOD_KEYS[key])
        if isinstance(key, keyboard.Key):
            return ("key", key.name)
        char = getattr(key, "char", None)
        if char:
            return ("key", char.lower())
        return None

    def update(self, key, pressed: bool) -> None:  # noqa: ANN001
        token = self._token(key)
        if token is None:
            return
        kind, name = token
        if kind == "mod":
            if pressed:
                self._pressed_mods.add(name)
            else:
                self._pressed_mods.discard(name)
        elif self.required_key is not None and name == self.required_key:
            self._key_down = pressed

    @property
    def active(self) -> bool:
        mods_ok = self.required_mods.issubset(self._pressed_mods)
        key_ok = self.required_key is None or self._key_down
        return mods_ok and key_ok


class DictationApp:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.recorder = Recorder(sample_rate=config.sample_rate)
        self.inserter = TextInserter(method=config.insert_method)
        self.hotkey = _Hotkey(config.hotkey)
        self._active = False  # last computed hotkey state (for edge detection)
        self._toggle_on = False
        self._lock = threading.Lock()

    # -- recording lifecycle -------------------------------------------------

    def _begin(self) -> None:
        if self.recorder.is_recording:
            return
        self.recorder.start()
        _beep(True, self.config.beep)
        print("🎙️  Listening… (release to transcribe)" if self.config.mode == "push_to_talk"
              else "🎙️  Listening… (press hotkey again to stop)")

    def _end(self) -> None:
        if not self.recorder.is_recording:
            return
        wav, duration = self.recorder.stop()
        _beep(False, self.config.beep)
        if duration < self.config.min_seconds or not wav:
            print(f"… too short ({duration:.1f}s), ignored.")
            return
        print(f"⏳ Transcribing {duration:.1f}s…")
        threading.Thread(target=self._process, args=(wav,), daemon=True).start()

    def _process(self, wav: bytes) -> None:
        try:
            text = transcribe(
                wav,
                api_key=self.config.groq_api_key,
                model=self.config.model,
                language=self.config.language,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"❌ {exc}")
            return
        if not text:
            print("… nothing recognised.")
            return
        with self._lock:  # serialise inserts so keystrokes don't interleave
            self.inserter.insert(text)
        print(f"✅ {text}")

    # -- hotkey handling -----------------------------------------------------

    def _reevaluate(self) -> None:
        now = self.hotkey.active
        if now == self._active:
            return
        self._active = now
        if self.config.mode == "push_to_talk":
            self._begin() if now else self._end()
        else:  # toggle — act only on the rising edge
            if now:
                self._toggle_on = not self._toggle_on
                self._begin() if self._toggle_on else self._end()

    def _on_press(self, key) -> None:  # noqa: ANN001
        self.hotkey.update(key, True)
        self._reevaluate()

    def _on_release(self, key) -> None:  # noqa: ANN001
        self.hotkey.update(key, False)
        self._reevaluate()

    def run(self) -> None:
        print(f"Dictation Typer ready. Hotkey: {self.config.hotkey}  |  mode: {self.config.mode}")
        print(f"Model: {self.config.model}  |  insert: {self.config.insert_method}")
        print("Press Ctrl+C in this window to quit.\n")
        listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        listener.start()
        try:
            listener.join()
        except KeyboardInterrupt:
            print("\nBye.")
            if self.recorder.is_recording:
                self.recorder.stop()
            listener.stop()
            sys.exit(0)
