"""Microphone enumeration and selection helpers."""

from __future__ import annotations

def list_microphones() -> list[dict]:
    """Return available input devices as {index, name, channels, sample_rate}."""
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        out = []
        for i, d in enumerate(devices):
            if d.get("max_input_channels", 0) > 0:
                out.append({
                    "index": i,
                    "name": d.get("name", f"device {i}"),
                    "channels": d.get("max_input_channels"),
                    "sample_rate": d.get("default_samplerate"),
                })
        return out
    except Exception:
        return []


def resolve_microphone(selector: str) -> int | None:
    """Resolve a microphone selector to a device index, or None for default.
    selector can be an index string, a name substring, or empty."""
    if not selector or not selector.strip():
        return None
    s = selector.strip()
    # Try integer index
    try:
        return int(s)
    except ValueError:
        pass
    # Try name substring
    for dev in list_microphones():
        if s.lower() in dev["name"].lower():
            return dev["index"]
    return None
