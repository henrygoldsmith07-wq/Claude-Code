"""Groq Whisper transcription."""

from __future__ import annotations

import requests

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def transcribe(
    wav_bytes: bytes,
    api_key: str,
    model: str = "whisper-large-v3-turbo",
    language: str = "",
    timeout: int = 60,
) -> str:
    """Send a WAV buffer to Groq and return the plain-text transcript."""
    files = {"file": ("dictation.wav", wav_bytes, "audio/wav")}
    data = {"model": model, "response_format": "text", "temperature": "0"}
    if language:
        data["language"] = language

    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        files=files,
        data=data,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(f"Groq transcription failed ({resp.status_code}): {resp.text[:300]}")

    # response_format=text returns the raw transcript, no JSON envelope.
    return resp.text.strip()
