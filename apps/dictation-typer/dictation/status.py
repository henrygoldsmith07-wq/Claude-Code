"""Audible and visual status indicators for push-to-talk states."""

from __future__ import annotations

import platform
import sys

STATES = {"idle", "listening", "transcribing", "error", "retrying", "offline"}

ICONS = {
    "idle": "○",
    "listening": "🎙️",
    "transcribing": "⏳",
    "error": "❌",
    "retrying": "🔄",
    "offline": "📴",
}

# Simple file-based tray/status signal for external UIs (e.g. system tray)
# Writes a tiny JSON to .dictation_status.json in APP_DIR

def write_status_file(app_dir, state: str, message: str = "") -> None:
    try:
        import json
        p = app_dir / ".dictation_status.json"
        p.write_text(json.dumps({"state": state, "message": message}), encoding="utf-8")
    except Exception:
        pass


def beep_for_state(state: str, enabled: bool) -> None:
    if not enabled:
        return
    system = platform.system()
    try:
        if system == "Windows":
            import winsound
            freq = {"listening": 880, "transcribing": 660, "error": 220, "retrying": 440}.get(state, 440)
            winsound.Beep(freq, 90)
        elif system == "Darwin":
            # Use afplay-free: print bell char for listening
            if state == "listening":
                sys.stdout.write("\a")
                sys.stdout.flush()
        else:
            if state == "listening":
                sys.stdout.write("\a")
                sys.stdout.flush()
    except Exception:
        pass


def print_status(state: str, message: str = "", *, visual: bool = True) -> None:
    if not visual:
        return
    icon = ICONS.get(state, "•")
    if message:
        print(f"{icon}  {message}")
    else:
        print(f"{icon}  {state}")
