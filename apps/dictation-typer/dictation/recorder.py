"""Microphone capture with device selection and streaming support.

Records mono audio into memory while active and returns an in-memory WAV
buffer. Supports selecting a specific input device and an optional streaming
callback for low-latency partial transcripts.
"""

from __future__ import annotations

import io
import threading
import time

import numpy as np
import sounddevice as sd
import soundfile as sf

from .devices import resolve_microphone


class Recorder:
    def __init__(self, sample_rate: int = 16000, device: str | int | None = None) -> None:
        self.sample_rate = sample_rate
        self._device_selector = device
        self._device_index: int | None = None
        if device is not None and str(device).strip() != "":
            self._device_index = resolve_microphone(str(device))
        self._frames: list[np.ndarray] = []  # type: ignore[type-arg]
        self._stream: sd.InputStream | None = None
        self._lock = threading.Lock()
        self._recording = False
        self._start_time: float = 0.0
        self._stream_callback = None  # optional callable for streaming chunks

    @property
    def is_recording(self) -> bool:
        return self._recording

    @property
    def elapsed(self) -> float:
        if not self._recording:
            return 0.0
        return time.monotonic() - self._start_time

    def set_stream_callback(self, fn) -> None:
        self._stream_callback = fn

    def _callback(self, indata, _frames, _time, status) -> None:  # noqa: ANN001
        if status:
            print(f"[recorder] {status}")
        with self._lock:
            self._frames.append(indata.copy())
        if self._stream_callback:
            try:
                self._stream_callback(indata.copy())
            except Exception:
                pass

    def start(self) -> None:
        if self._recording:
            return
        with self._lock:
            self._frames = []
        kwargs = dict(samplerate=self.sample_rate, channels=1, dtype="float32", callback=self._callback)
        if self._device_index is not None:
            kwargs["device"] = self._device_index
        self._stream = sd.InputStream(**kwargs)  # type: ignore[arg-type]
        self._stream.start()
        self._recording = True
        self._start_time = time.monotonic()

    def stop(self) -> tuple[bytes, float]:
        """Stop and return (wav_bytes, duration_seconds)."""
        if not self._recording:
            return b"", 0.0
        self._recording = False
        assert self._stream is not None
        self._stream.stop()
        self._stream.close()
        self._stream = None

        with self._lock:
            frames = self._frames
            self._frames = []

        if not frames:
            return b"", 0.0

        audio = np.concatenate(frames, axis=0)
        duration = len(audio) / self.sample_rate

        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV", subtype="PCM_16")
        buffer.seek(0)
        return buffer.read(), duration
