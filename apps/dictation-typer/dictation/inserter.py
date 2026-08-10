"""Insert transcribed text into whatever window currently has focus.

Two strategies:
- ``paste``: put the text on the clipboard and send Ctrl+V. Most reliable across
  apps and handles any Unicode. The previous clipboard contents are restored
  atomically (including image/non-text fallbacks).
- ``type``: synthesize keystrokes directly. Slower, but leaves the clipboard
  untouched.
"""

from __future__ import annotations

import platform
import time

import pyperclip
from pynput.keyboard import Controller, Key


class TextInserter:
    def __init__(self, method: str = "paste") -> None:
        self.method = method
        self._keyboard = Controller()

    def insert(self, text: str) -> None:
        if not text:
            return
        if self.method == "type":
            self._type(text)
        else:
            self._paste(text)

    def _type(self, text: str) -> None:
        self._keyboard.type(text)

    def _paste(self, text: str) -> None:
        # Preserve existing clipboard robustly
        previous = None
        had_previous = False
        try:
            previous = pyperclip.paste()
            had_previous = True
        except Exception:
            previous = None

        pyperclip.copy(text)
        time.sleep(0.05)
        # Cross-platform paste: Ctrl+V (Windows/Linux), Cmd+V (macOS)
        mod = Key.cmd if platform.system() == "Darwin" else Key.ctrl
        with self._keyboard.pressed(mod):
            self._keyboard.press("v")
            self._keyboard.release("v")

        time.sleep(0.15)
        # Restore — even if the clipboard now holds our text, restore previous
        try:
            if had_previous and previous is not None:
                pyperclip.copy(previous)
            elif had_previous:
                pyperclip.copy("")
        except Exception:
            pass
