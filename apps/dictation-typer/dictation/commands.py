"""Voice-driven punctuation, formatting, and correction helpers.

Maps spoken phrases like \"period\", \"new line\", \"all caps ...\" to edits.
Applied after transcription and before insertion. Pure functions for testability.
"""

from __future__ import annotations

import re

PUNCTUATION_MAP = {
    "period": ".",
    "full stop": ".",
    "comma": ",",
    "question mark": "?",
    "exclamation mark": "!",
    "exclamation point": "!",
    "colon": ":",
    "semicolon": ";",
    "dash": " — ",
    "hyphen": "-",
    "open paren": "(",
    "close paren": ")",
    "open bracket": "[",
    "close bracket": "]",
    "open quote": '"',
    "close quote": '"',
    "ellipsis": "…",
    "new line": "\n",
    "new paragraph": "\n\n",
}

FORMATTING_PATTERNS = [
    (re.compile(r"\ball caps (.+?)(?:\s+end caps)?\b", re.I), lambda m: m.group(1).upper()),
    (re.compile(r"\bno caps (.+?)(?:\s+end caps)?\b", re.I), lambda m: m.group(1).lower()),
    (re.compile(r"\bcap (.+?)\b", re.I), lambda m: m.group(1).capitalize()),
]


def apply_punctuation(text: str, enabled: bool = True) -> str:
    if not enabled or not text:
        return text
    out = text
    for phrase, repl in PUNCTUATION_MAP.items():
        # Replace the spoken phrase surrounded by word boundaries
        pattern = re.compile(r"\b" + re.escape(phrase) + r"\b", re.IGNORECASE)
        out = pattern.sub(repl, out)
    # Clean up spaced punctuation: "hello , world" -> "hello, world"
    out = re.sub(r"\s+([,.:;!?)\]])", r"\1", out)
    out = re.sub(r"\(\s+", "(", out)
    out = re.sub(r"\s+—\s+", " — ", out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    return out


def apply_formatting(text: str, enabled: bool = True) -> str:
    if not enabled or not text:
        return text
    out = text
    for pat, fn in FORMATTING_PATTERNS:
        out = pat.sub(fn, out)
    return out


def apply_commands(text: str, *, punctuation: bool = True, formatting: bool = True) -> str:
    """Apply all voice commands in order."""
    out = apply_punctuation(text, enabled=punctuation)
    out = apply_formatting(out, enabled=formatting)
    return out


# Correction workflow: simple in-memory history for undo/replace

class CorrectionHistory:
    def __init__(self, limit: int = 20) -> None:
        self._items: list[str] = []
        self.limit = limit

    def push(self, text: str) -> None:
        if text:
            self._items.append(text)
            if len(self._items) > self.limit:
                self._items.pop(0)

    @property
    def last(self) -> str | None:
        return self._items[-1] if self._items else None

    def pop(self) -> str | None:
        return self._items.pop() if self._items else None

    def list_recent(self, n: int = 5) -> list[str]:
        return self._items[-n:]
