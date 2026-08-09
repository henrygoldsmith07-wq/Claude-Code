"""Configuration loading and validation.

Settings come from two places: secrets/model from environment variables (or a
sibling ``.env`` file), and behaviour (hotkey, mode) from ``config.json``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

VALID_MODES = {"push_to_talk", "toggle"}
VALID_INSERT = {"paste", "type"}

APP_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so we don't require python-dotenv as a dependency."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Don't clobber a value already present in the real environment.
        os.environ.setdefault(key, value)


@dataclass
class Config:
    groq_api_key: str
    model: str = "whisper-large-v3-turbo"
    language: str = ""  # blank = auto-detect
    hotkey: str = "ctrl+alt"
    mode: str = "push_to_talk"
    insert_method: str = "paste"
    sample_rate: int = 16000
    beep: bool = True
    min_seconds: float = 0.3

    @classmethod
    def load(cls, config_path: Path | None = None) -> "Config":
        _load_dotenv(APP_DIR / ".env")

        data: dict = {}
        path = config_path or (APP_DIR / "config.json")
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))

        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            raise SystemExit(
                "GROQ_API_KEY is not set. Copy .env.example to .env and add your key "
                "(get one free at https://console.groq.com)."
            )

        cfg = cls(
            groq_api_key=api_key,
            model=os.environ.get("GROQ_TRANSCRIBE_MODEL", data.get("model", cls.model)),
            language=os.environ.get("DICTATION_LANGUAGE", data.get("language", "")).strip(),
            hotkey=str(data.get("hotkey", cls.hotkey)).lower(),
            mode=str(data.get("mode", cls.mode)),
            insert_method=str(data.get("insert_method", cls.insert_method)),
            sample_rate=int(data.get("sample_rate", cls.sample_rate)),
            beep=bool(data.get("beep", cls.beep)),
            min_seconds=float(data.get("min_seconds", cls.min_seconds)),
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        if self.mode not in VALID_MODES:
            raise SystemExit(f"Invalid mode '{self.mode}'. Use one of {sorted(VALID_MODES)}.")
        if self.insert_method not in VALID_INSERT:
            raise SystemExit(
                f"Invalid insert_method '{self.insert_method}'. Use one of {sorted(VALID_INSERT)}."
            )
        if self.sample_rate < 8000:
            raise SystemExit("sample_rate must be at least 8000 Hz.")
