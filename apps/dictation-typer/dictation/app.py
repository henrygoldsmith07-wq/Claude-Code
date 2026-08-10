"""Wires the hotkey listener to the recorder, transcriber, and text inserter."""

from __future__ import annotations

import platform
import sys
import threading
import time

from pynput import keyboard

from .benchmark import wer
from .commands import CorrectionHistory, apply_commands
from .config import Config
from .crash import log_crash
from .devices import list_microphones
from .inserter import TextInserter
from .onboarding import print_onboarding
from .profiles import get_active_app, resolve_profile
from .recorder import Recorder
from .retry_queue import RetryQueue
from .status import beep_for_state, print_status, write_status_file
from .transcriber import transcribe
from .vocabulary import apply_coding_mode, apply_vocabulary, prompt_hint

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


def _parse_hotkey_spec(spec: str):
    mods: set[str] = set()
    key = None
    for token in (t.strip().lower() for t in spec.split("+") if t.strip()):
        if token in _MOD_ALIASES:
            mods.add(_MOD_ALIASES[token])
        else:
            key = token
    return mods, key


class _Hotkey:
    def __init__(self, spec: str) -> None:
        self.required_mods, self.required_key = _parse_hotkey_spec(spec)
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
        self.recorder = Recorder(sample_rate=config.sample_rate, device=config.microphone)
        self.inserter = TextInserter(method=config.insert_method)
        # Primary dictate hotkey + optional secondary hotkeys
        self.hotkey = _Hotkey(config.hotkey)
        self.correction_hotkey = _Hotkey(config.correction_hotkey) if config.correction_hotkey else None
        self.coding_hotkey = _Hotkey(config.coding_hotkey) if config.coding_hotkey else None
        self._active = False
        self._correction_active = False
        self._coding_toggle = config.coding_mode
        self._toggle_on = False
        self._lock = threading.Lock()
        self._session_count = 0
        self._history = CorrectionHistory(limit=30)
        self._retry_queue = RetryQueue(max_size=10)
        self._last_text: str | None = None
        if config.retry_queue:
            self._retry_queue.start_worker(lambda wav, dur, is_retry=False: self._process(wav, dur, is_retry=is_retry))

    def _begin(self) -> None:
        if self.recorder.is_recording:
            return
        # Resolve per-app profile for this session
        self._current_profile = resolve_profile(self.config)
        self.recorder.start()
        beep_for_state("listening", self.config.audible_status and self.config.beep)
        write_status_file(self.config.__class__.__dict__.get("APP_DIR", self.config.__class__), "listening", "Listening…")
        msg = "Listening… (release to transcribe)" if self.config.mode == "push_to_talk" else "Listening… (press hotkey again to stop)"
        print_status("listening", msg, visual=self.config.visual_status)
        if self._current_profile.get("profile_name") != "default":
            print(f"  Profile: {self._current_profile['profile_name']}  App: {self._current_profile['active_app'][:40]}")

    def _end(self) -> None:
        if not self.recorder.is_recording:
            return
        wav, duration = self.recorder.stop()
        beep_for_state("transcribing", self.config.audible_status and self.config.beep)
        write_status_file(self.config.__class__.__dict__.get("APP_DIR", self.config.__class__), "transcribing", f"{duration:.1f}s audio")
        if duration < self.config.min_seconds or not wav:
            print_status("idle", f"… too short ({duration:.1f}s), ignored.", visual=self.config.visual_status)
            write_status_file(self.config.__class__.__dict__.get("APP_DIR", self.config.__class__), "idle", "")
            return
        print_status("transcribing", f"Transcribing {duration:.1f}s…", visual=self.config.visual_status)
        threading.Thread(target=self._process, args=(wav, duration), daemon=True).start()

    def _process(self, wav: bytes, duration: float, is_retry: bool = False) -> None:
        started = time.monotonic()
        profile = getattr(self, "_current_profile", None) or resolve_profile(self.config)
        language = profile.get("language", self.config.language) or self.config.language
        vocab = profile.get("vocabulary", self.config.vocabulary)
        names = profile.get("custom_names", self.config.custom_names)
        coding = profile.get("coding_mode", self._coding_toggle)
        hint = prompt_hint(vocab, names, language=language, coding=coding)

        # Privacy mode: confirm before sending if no offline fallback
        if self.config.privacy_mode and not self.config.groq_api_key and not self.config.offline_model:
            print("🔒 Privacy mode: no cloud key and no offline model — skipping transcription.")
            print("   Set offline_model (e.g. 'tiny') or add GROQ_API_KEY to .env.")
            return

        try:
            text = transcribe(
                wav,
                api_key=self.config.groq_api_key,
                model=self.config.model,
                language=language,
                prompt=hint,
                provider=self.config.provider,
                offline_model=self.config.offline_model,
                retry_attempts=self.config.retry_attempts,
                privacy_mode=self.config.privacy_mode,
            )
        except Exception as exc:  # noqa: BLE001
            beep_for_state("error", self.config.audible_status)
            print_status("error", f"Transcription failed: {exc}", visual=self.config.visual_status)
            print("   Check GROQ_API_KEY / network, or set offline_model for local fallback.")
            if self.config.retry_queue and not is_retry:
                self._retry_queue.enqueue(wav, duration)
                print_status("retrying", f"Queued for retry (queue: {self._retry_queue.size})", visual=self.config.visual_status)
            try:
                from .config import APP_DIR
                log_crash(exc, APP_DIR, custom_path=self.config.crash_log)
            except Exception:
                pass
            return

        if not text:
            print_status("idle", "… nothing recognised.", visual=self.config.visual_status)
            return

        # Post-processing pipeline
        text = apply_vocabulary(text, vocab, names)
        text = apply_coding_mode(text, enabled=coding)
        text = apply_commands(text, punctuation=self.config.punctuation_commands, formatting=self.config.formatting_commands)

        if not text.strip():
            print_status("idle", "… empty after post-processing.", visual=self.config.visual_status)
            return

        with self._lock:
            self.inserter.insert(text)
        self._history.push(text)
        self._last_text = text
        self._session_count += 1
        elapsed = time.monotonic() - started
        latency_ms = int(elapsed * 1000)
        print(f"✅ [{self._session_count}] {text}")
        print(f"   ({duration:.1f}s audio → {elapsed:.1f}s transcription, {latency_ms}ms)  WER hint: use python -m dictation.benchmark")
        print_status("idle", "", visual=False)
        write_status_file(self.config.__class__.__dict__.get("APP_DIR", self.config.__class__), "idle", "")

    def _do_correction(self) -> None:
        """Correction workflow: undo last insert and show history."""
        last = self._history.last
        if not last:
            print("… nothing to correct (no history).")
            return
        print(f"— Last: {last}")
        print("  (Edit and re-paste manually, or press correction hotkey again to undo)")
        # Undo via select-all + delete isn't safe cross-app; just inform

    # -- hotkey handling -----------------------------------------------------

    def _reevaluate(self) -> None:
        now = self.hotkey.active
        if now != self._active:
            self._active = now
            if self.config.mode == "push_to_talk":
                self._begin() if now else self._end()
            else:
                if now:
                    self._toggle_on = not self._toggle_on
                    self._begin() if self._toggle_on else self._end()

        # Correction hotkey (rising edge)
        if self.correction_hotkey:
            corr_now = self.correction_hotkey.active
            if corr_now and not self._correction_active:
                self._do_correction()
            self._correction_active = corr_now

        # Coding toggle hotkey (rising edge) — flips per-session coding mode
        if self.coding_hotkey:
            code_now = self.coding_hotkey.active
            if code_now and not getattr(self, "_coding_active", False):
                self._coding_toggle = not self._coding_toggle
                state = "ON" if self._coding_toggle else "OFF"
                print(f"⌨️  Coding mode: {state}")
            self._coding_active = code_now

    def _on_press(self, key) -> None:  # noqa: ANN001
        self.hotkey.update(key, True)
        if self.correction_hotkey:
            self.correction_hotkey.update(key, True)
        if self.coding_hotkey:
            self.coding_hotkey.update(key, True)
        self._reevaluate()

    def _on_release(self, key) -> None:  # noqa: ANN001
        self.hotkey.update(key, False)
        if self.correction_hotkey:
            self.correction_hotkey.update(key, False)
        if self.coding_hotkey:
            self.coding_hotkey.update(key, False)
        self._reevaluate()

    def run(self) -> None:
        print("=" * 48)
        print("  Dictation Typer ready  (7 → 8.5)")
        print("=" * 48)
        print(f"  Hotkey : {self.config.hotkey}  Mode: {self.config.mode}")
        print(f"  Insert : {self.config.insert_method}  Beep: {self.config.beep}")
        print(f"  Model  : {self.config.model}  Provider: {self.config.provider}")
        if self.config.language:
            print(f"  Language: {self.config.language}")
        if self.config.microphone:
            print(f"  Mic    : {self.config.microphone}")
        else:
            mics = list_microphones()
            if mics:
                print(f"  Mic    : default ({mics[0]['name']}) — {len(mics)} device(s) available")
        if self.config.vocabulary or self.config.custom_names:
            print(f"  Vocab  : {len(self.config.vocabulary)} terms, {len(self.config.custom_names)} names")
        if self.config.app_profiles:
            print(f"  Profiles: {', '.join(self.config.app_profiles.keys())}")
        print(f"  Punct  : {self.config.punctuation_commands}  Format: {self.config.formatting_commands}  Coding: {self._coding_toggle}")
        print(f"  Privacy: {self.config.privacy_mode}  Offline: {self.config.offline_model or '—'}  Retry: {self.config.retry_attempts}")
        print("  Press Ctrl+C in this window to quit.")
        print()
        print_onboarding()
        if self.config.auto_update:
            try:
                from .crash import check_for_updates
                latest = check_for_updates()
                if latest:
                    print(f"  Update available: {latest} (pip install -U dictation-typer)")
            except Exception:
                pass
        listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        listener.start()
        try:
            listener.join()
        except KeyboardInterrupt:
            print(f"\nBye. ({self._session_count} dictation(s) this session)")
            if self.recorder.is_recording:
                self.recorder.stop()
            listener.stop()
            sys.exit(0)
        except Exception as exc:
            try:
                from .config import APP_DIR
                log_crash(exc, APP_DIR, custom_path=self.config.crash_log)
            except Exception:
                pass
            raise
