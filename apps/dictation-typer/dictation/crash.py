"""Crash logging and update checks."""

from __future__ import annotations

import traceback
from pathlib import Path
from datetime import datetime


def log_crash(exc: BaseException, app_dir: Path, custom_path: str = "") -> Path | None:
    try:
        p = Path(custom_path) if custom_path else (app_dir / "crash.log")
        stamp = datetime.now().isoformat()
        entry = f"\n[{stamp}] {type(exc).__name__}: {exc}\n{''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}\n"
        # Keep log bounded
        existing = p.read_text(encoding="utf-8") if p.exists() else ""
        if len(existing) > 200_000:
            existing = existing[-100_000:]
        p.write_text(existing + entry, encoding="utf-8")
        return p
    except Exception:
        return None


def check_for_updates(current_version: str = "7.0.0") -> str | None:
    """Check PyPI for a newer version; return version string if newer, else None."""
    try:
        import requests
        resp = requests.get("https://pypi.org/pypi/dictation-typer/json", timeout=5)
        if resp.ok:
            latest = resp.json().get("info", {}).get("version", "")
            if latest and latest != current_version:
                return latest
    except Exception:
        pass
    return None
