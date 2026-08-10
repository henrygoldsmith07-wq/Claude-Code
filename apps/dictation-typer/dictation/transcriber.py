"""Groq Whisper transcription with streaming, offline fallback, and retry."""

from __future__ import annotations

import time

import requests

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def _try_groq(wav_bytes: bytes, api_key: str, model: str, language: str, prompt: str = "", timeout: int = 60) -> str:
    files = {"file": ("dictation.wav", wav_bytes, "audio/wav")}
    data = {"model": model, "response_format": "text", "temperature": "0"}
    if language:
        data["language"] = language
    if prompt:
        data["prompt"] = prompt[:224]
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        files=files,
        data=data,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(f"Groq transcription failed ({resp.status_code}): {resp.text[:300]}")
    return resp.text.strip()


def _try_offline(wav_bytes: bytes, model_size: str = "tiny", language: str = "") -> str:
    """Local transcription via faster-whisper if available; otherwise raises."""
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("Offline model not installed (pip install faster-whisper)") from exc
    import io
    import tempfile
    import os
    # faster-whisper expects a file path
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(wav_bytes)
        tmp_path = tmp.name
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        kwargs = {}
        if language:
            kwargs["language"] = language
        segments, _ = model.transcribe(tmp_path, **kwargs)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def transcribe(
    wav_bytes: bytes,
    api_key: str = "",
    model: str = "whisper-large-v3-turbo",
    language: str = "",
    prompt: str = "",
    timeout: int = 60,
    provider: str = "groq",
    offline_model: str = "",
    retry_attempts: int = 2,
    privacy_mode: bool = False,
) -> str:
    """Transcribe with provider fallback and retry.

    provider: groq | offline | auto (try groq, fall back to offline).
    privacy_mode: when true and api_key is empty, skip cloud and use offline only.
    """
    if privacy_mode and not api_key:
        if offline_model:
            return _try_offline(wav_bytes, model_size=offline_model, language=language)
        raise RuntimeError("Privacy mode enabled but no offline model configured (set offline_model).")

    last_exc: Exception | None = None
    providers = []
    if provider == "groq":
        providers = ["groq"]
    elif provider == "offline":
        providers = ["offline"]
    else:  # auto
        providers = ["groq", "offline"] if offline_model else ["groq"]

    for prov in providers:
        for attempt in range(max(1, retry_attempts + 1)):
            try:
                if prov == "groq":
                    if not api_key:
                        raise RuntimeError("GROQ_API_KEY not set and no offline fallback available.")
                    return _try_groq(wav_bytes, api_key, model, language, prompt=prompt, timeout=timeout)
                else:
                    return _try_offline(wav_bytes, model_size=offline_model or "tiny", language=language)
            except Exception as exc:
                last_exc = exc
                # Don't retry offline missing-dependency errors
                if "Offline model not installed" in str(exc):
                    break
                if attempt < retry_attempts:
                    time.sleep(0.6 * (attempt + 1))
                continue
        # If groq failed, fall through to next provider in auto mode
        if provider == "auto" and prov == "groq":
            continue
        break
    raise last_exc or RuntimeError("Transcription failed")
