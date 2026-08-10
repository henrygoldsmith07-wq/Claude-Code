"""Permissions onboarding and platform checks."""

from __future__ import annotations

import platform
import shutil
import sys

CHECKS = []


def check_microphone() -> tuple[bool, str]:
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        has_input = any(d.get("max_input_channels", 0) > 0 for d in devices)
        if has_input:
            return True, "Microphone available"
        return False, "No input devices found — check mic is connected and PortAudio installed."
    except Exception as exc:
        return False, f"Could not query audio devices: {exc}"


def check_permissions() -> list[tuple[str, bool, str]]:
    system = platform.system()
    results: list[tuple[str, bool, str]] = []
    mic_ok, mic_msg = check_microphone()
    results.append(("Microphone", mic_ok, mic_msg))

    if system == "Darwin":
        results.append(("Accessibility", True, "Grant Accessibility to your terminal in System Settings → Privacy & Security."))
        results.append(("Microphone permission", mic_ok, "Grant Microphone to your terminal if prompted." if not mic_ok else "OK"))
    elif system == "Windows":
        results.append(("Hotkey", True, "If injection is blocked in admin windows, run this app as administrator."))
    else:
        has_xdotool = shutil.which("xdotool") is not None
        results.append(("xdotool (app profiles)", has_xdotool, "Install xdotool for app-specific profiles (optional)." if not has_xdotool else "OK"))
        if shutil.which("aplay") is None and shutil.which("paplay") is None:
            results.append(("Audio", False, "Install libportaudio2 / portaudio if recording fails."))
        else:
            results.append(("Audio", True, "OK"))

    # API key check (informational — not fatal due to offline/privacy mode)
    import os
    has_key = bool(os.environ.get("GROQ_API_KEY", "").strip())
    results.append(("Groq API key", has_key, "Set GROQ_API_KEY in .env (or use offline_model)." if not has_key else "OK"))
    return results


def print_onboarding() -> None:
    print("— Permissions & setup —")
    for name, ok, msg in check_permissions():
        icon = "✅" if ok else "⚠️"
        print(f"  {icon} {name}: {msg}")
    print()
