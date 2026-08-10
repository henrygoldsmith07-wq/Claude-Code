"""Benchmark helpers for word-error rate (WER) and latency.

WER is computed against a small reference transcript corpus without requiring
model calls — useful for regression checks on the post-processing pipeline
(punctuation, vocabulary, coding mode). Latency is measured end-to-end for
the transcribe path using mocked or offline providers.

Run: python -m dictation.benchmark
"""

from __future__ import annotations

import time
from dataclasses import dataclass


def wer(reference: str, hypothesis: str) -> float:
    """Word error rate: (S + D + I) / N via Levenshtein on word tokens."""
    ref = reference.strip().split()
    hyp = hypothesis.strip().split()
    if not ref:
        return 0.0 if not hyp else 1.0
    # DP for edit distance
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1].lower() == hyp[j - 1].lower():
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[n][m] / n


@dataclass
class LatencySample:
    audio_seconds: float
    transcribe_seconds: float


def benchmark_latency(transcribe_fn, wav: bytes, runs: int = 3) -> dict:
    samples: list[LatencySample] = []
    for _ in range(runs):
        t0 = time.monotonic()
        try:
            transcribe_fn(wav)
        except Exception:
            pass
        elapsed = time.monotonic() - t0
        # Approximate audio duration from WAV header if available
        audio_s = 1.0
        samples.append(LatencySample(audio_seconds=audio_s, transcribe_seconds=elapsed))
    avg = sum(s.transcribe_seconds for s in samples) / max(1, len(samples))
    return {"runs": runs, "avg_latency_s": round(avg, 3), "samples": [{"audio_s": s.audio_seconds, "latency_s": round(s.transcribe_seconds, 3)} for s in samples]}


CORPUS = [
    ("hello world", "hello world"),
    ("The quick brown fox jumps over the lazy dog", "the quick brown fox jumps over the lazy dog"),
    ("period comma question mark", "period comma question mark"),  # will be transformed by punctuation
]


def run_wer_suite(transform_fn=None) -> dict:
    """Run WER over the small corpus; transform_fn is applied to hypothesis before scoring."""
    total = 0.0
    rows = []
    for ref, hyp in CORPUS:
        h = transform_fn(hyp) if transform_fn else hyp
        score = wer(ref, h)
        total += score
        rows.append({"reference": ref, "hypothesis": h, "wer": round(score, 3)})
    avg = total / max(1, len(rows))
    return {"corpus_size": len(rows), "avg_wer": round(avg, 3), "rows": rows}


if __name__ == "__main__":
    print("WER suite (raw):", run_wer_suite())
    from .commands import apply_commands
    print("WER suite (with punctuation):", run_wer_suite(lambda s: apply_commands(s)))
