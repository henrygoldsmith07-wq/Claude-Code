"""Retry queue for failed transcriptions with provider fallback."""

from __future__ import annotations

import threading
import time
from collections import deque


class RetryQueue:
    def __init__(self, max_size: int = 10) -> None:
        self._queue: deque[tuple[bytes, float, int]] = deque(maxlen=max_size)
        self._lock = threading.Lock()
        self._retrying = False

    def enqueue(self, wav: bytes, duration: float, attempts: int = 0) -> None:
        with self._lock:
            self._queue.append((wav, duration, attempts))

    def dequeue(self) -> tuple[bytes, float, int] | None:
        with self._lock:
            return self._queue.popleft() if self._queue else None

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._queue)

    def start_worker(self, process_fn, interval: float = 5.0) -> None:
        """Background thread that retries queued items."""

        def _loop() -> None:
            while True:
                time.sleep(interval)
                item = self.dequeue()
                if item is None:
                    continue
                wav, duration, attempts = item
                try:
                    process_fn(wav, duration, is_retry=True)
                except Exception:
                    # Re-queue with incremented attempts if under limit
                    if attempts < 2:
                        self.enqueue(wav, duration, attempts + 1)

        t = threading.Thread(target=_loop, daemon=True, name="retry-queue")
        t.start()
