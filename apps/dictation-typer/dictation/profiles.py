"""Application-specific profiles: per-app language, vocabulary, coding mode."""

from __future__ import annotations

import platform

# Heuristic: try to get the active window title/app name cross-platform
def get_active_app() -> str:
    system = platform.system()
    if system == "Windows":
        try:
            import ctypes
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            buf = ctypes.create_unicode_buffer(length + 1)
            ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value or ""
            # Also try process name via psutil if available (optional)
            return title
        except Exception:
            return ""
    elif system == "Darwin":
        try:
            import subprocess
            out = subprocess.check_output(
                ["osascript", "-e", 'tell application "System Events" to get name of first application process whose frontmost is true'],
                text=True, timeout=2,
            )
            return out.strip()
        except Exception:
            return ""
    else:
        # Linux: try xdotool or fallback to env
        try:
            import subprocess
            out = subprocess.check_output(["xdotool", "getactivewindow", "getwindowname"], text=True, timeout=2)
            return out.strip()
        except Exception:
            return ""


def match_profile(active_app: str, profiles: dict) -> str:
    """Return the best-matching profile name for the active app, or 'default'."""
    if not active_app or not profiles:
        return "default"
    lower = active_app.lower()
    for name, cfg in profiles.items():
        if name == "default":
            continue
        keywords = cfg.get("match", []) if isinstance(cfg, dict) else []
        # Also treat profile name itself as a keyword
        candidates = [name.lower()] + [str(k).lower() for k in keywords]
        for cand in candidates:
            if cand and cand in lower:
                return name
    return "default"


def resolve_profile(config, active_app: str | None = None) -> dict:
    """Resolve effective settings for the current app context."""
    app_title = active_app if active_app is not None else get_active_app()
    profile_name = match_profile(app_title, config.app_profiles)
    base = {
        "language": config.language,
        "vocabulary": list(config.vocabulary),
        "custom_names": list(config.custom_names),
        "coding_mode": config.coding_mode,
    }
    if profile_name != "default" and profile_name in config.app_profiles:
        prof = config.app_profiles[profile_name]
        if isinstance(prof, dict):
            if prof.get("language"):
                base["language"] = prof["language"]
            if prof.get("vocabulary"):
                base["vocabulary"] = list(prof["vocabulary"])
            if prof.get("custom_names"):
                base["custom_names"] = list(prof["custom_names"])
            if "coding_mode" in prof:
                base["coding_mode"] = bool(prof["coding_mode"])
    base["profile_name"] = profile_name
    base["active_app"] = app_title
    return base
