"""Microphone capture.

Records mono audio into memory while active and returns it as an in-memory WAV
buffer, ready to POST to the transcription API. No temp files touch disk.
"""

from __future__ import annotations

import io
import threading

import numpy as np
import sounddevice as sd
import soundfile as sf


class Recorder:
    def __init__(self, sample_rate: int = 16000) -> None:
        self.sample_rate = sample_rate
        self._frames: list[np.ndarray] = []
        self._stream: sd.InputStream | None = None
        self._lock = threading.Lock()
        self._recording = False

    @property
    def is_recording(self) -> bool:
        return self._recording

    def _callback(self, indata, _frames, _time, status) -> None:  # noqa: ANN001
        if status:
            # Overflows are non-fatal; just note them on stderr via print.
            print(f"[recorder] {status}")
        with self._lock:
            self._frames.append(indata.copy())

    def start(self) -> None:
        if self._recording:
            return
        with self._lock:
            self._frames = []
        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype="float32",
            callback=self._callback,
        )
        self._stream.start()
        self._recording = True

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
