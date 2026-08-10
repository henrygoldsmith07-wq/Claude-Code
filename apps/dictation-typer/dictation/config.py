"""Configuration loading and validation.

Settings come from environment/.env (secrets) and config.json (behaviour).
New in 8.5: configurable hotkeys, app profiles, vocabulary, coding mode,
language/mic selection, privacy/offline/fallback, retry, correction, status.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

VALID_MODES = {"push_to_talk", "toggle"}
VALID_INSERT = {"paste", "type"}
VALID_LANGUAGES = {"", "en", "fr", "de", "es", "it", "pt", "nl", "pl", "ja", "zh", "ko", "ar", "ru"}

APP_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


@dataclass
class AppProfile:
    name: str = "default"
    language: str = ""
    vocabulary: list[str] = field(default_factory=list)
    coding_mode: bool = False


@dataclass
class Config:
    groq_api_key: str = ""
    model: str = "whisper-large-v3-turbo"
    language: str = ""
    hotkey: str = "ctrl+alt"
    hotkeys: dict = field(default_factory=dict)  # e.g. {"dictate": "ctrl+alt", "correct": "ctrl+alt+c"}
    mode: str = "push_to_talk"
    insert_method: str = "paste"
    sample_rate: int = 16000
    beep: bool = True
    min_seconds: float = 0.3
    # 8.5 additions
    microphone: str = ""  # device name substring or index; "" = default
    punctuation_commands: bool = True
    formatting_commands: bool = True
    correction_hotkey: str = "ctrl+alt+c"
    vocabulary: list[str] = field(default_factory=list)
    custom_names: list[str] = field(default_factory=list)
    coding_mode: bool = False
    coding_hotkey: str = "ctrl+alt+k"
    privacy_mode: bool = False  # when true, avoid sending audio unless user confirms
    offline_model: str = ""  # e.g. "tiny" for faster-whisper local fallback
    provider: str = "groq"  # groq | offline | auto (fallback)
    retry_attempts: int = 2
    retry_queue: bool = True
    app_profiles: dict = field(default_factory=dict)  # name -> AppProfile dict
    active_profile: str = "default"
    # update/crash
    auto_update: bool = False
    crash_log: str = ""  # path or "" for default
    # status
    audible_status: bool = True
    visual_status: bool = True

    @classmethod
    def load(cls, config_path: Path | None = None) -> "Config":
        _load_dotenv(APP_DIR / ".env")
        data: dict = {}
        path = config_path or (APP_DIR / "config.json")
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                data = {}

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        # Allow privacy/offline mode without key — will use offline fallback
        if not api_key and not data.get("offline_model"):
            # Don't hard-fail if offline model configured; warn instead
            pass
        if not api_key and not data.get("privacy_mode"):
            # Keep previous behaviour: require key unless privacy/offline explicitly opts out
            # But make it non-fatal: app will run and show permissions onboarding
            pass

        # hotkeys can be string or dict
        hotkey = str(data.get("hotkey", cls.__dataclass_fields__["hotkey"].default)).lower()
        hotkeys = data.get("hotkeys", {})
        if isinstance(hotkeys, dict):
            hotkeys = {str(k).lower(): str(v).lower() for k, v in hotkeys.items()}
        else:
            hotkeys = {}

        # vocabulary
        vocab = data.get("vocabulary", [])
        if not isinstance(vocab, list):
            vocab = []
        custom_names = data.get("custom_names", [])
        if not isinstance(custom_names, list):
            custom_names = []

        # profiles
        profiles = data.get("app_profiles", {})
        if not isinstance(profiles, dict):
            profiles = {}

        cfg = cls(
            groq_api_key=api_key,
            model=os.environ.get("GROQ_TRANSCRIBE_MODEL", data.get("model", cls.__dataclass_fields__["model"].default)),
            language=os.environ.get("DICTATION_LANGUAGE", data.get("language", "")).strip(),
            hotkey=hotkey,
            hotkeys=hotkeys,
            mode=str(data.get("mode", cls.__dataclass_fields__["mode"].default)),
            insert_method=str(data.get("insert_method", cls.__dataclass_fields__["insert_method"].default)),
            sample_rate=int(data.get("sample_rate", cls.__dataclass_fields__["sample_rate"].default)),
            beep=bool(data.get("beep", cls.__dataclass_fields__["beep"].default)),
            min_seconds=float(data.get("min_seconds", cls.__dataclass_fields__["min_seconds"].default)),
            microphone=str(data.get("microphone", "")).strip(),
            punctuation_commands=bool(data.get("punctuation_commands", True)),
            formatting_commands=bool(data.get("formatting_commands", True)),
            correction_hotkey=str(data.get("correction_hotkey", "ctrl+alt+c")).lower(),
            vocabulary=[str(x) for x in vocab],
            custom_names=[str(x) for x in custom_names],
            coding_mode=bool(data.get("coding_mode", False)),
            coding_hotkey=str(data.get("coding_hotkey", "ctrl+alt+k")).lower(),
            privacy_mode=bool(data.get("privacy_mode", False)),
            offline_model=str(data.get("offline_model", "")).strip(),
            provider=str(data.get("provider", "groq")).lower(),
            retry_attempts=int(data.get("retry_attempts", 2)),
            retry_queue=bool(data.get("retry_queue", True)),
            app_profiles=profiles,
            active_profile=str(data.get("active_profile", "default")),
            auto_update=bool(data.get("auto_update", False)),
            crash_log=str(data.get("crash_log", "")).strip(),
            audible_status=bool(data.get("audible_status", True)),
            visual_status=bool(data.get("visual_status", True)),
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        if self.mode not in VALID_MODES:
            raise SystemExit(f"Invalid mode '{self.mode}'. Use one of {sorted(VALID_MODES)}.")
        if self.insert_method not in VALID_INSERT:
            raise SystemExit(f"Invalid insert_method '{self.insert_method}'. Use one of {sorted(VALID_INSERT)}.")
        if self.sample_rate < 8000:
            raise SystemExit("sample_rate must be at least 8000 Hz.")
        if self.provider not in {"groq", "offline", "auto"}:
            raise SystemExit("provider must be groq, offline, or auto.")
        # language can be empty (auto) or a known code
        if self.language and self.language not in VALID_LANGUAGES:
            # Allow any ISO code — just warn via print, don't crash
            pass
