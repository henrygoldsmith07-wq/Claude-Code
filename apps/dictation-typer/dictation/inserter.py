"""Insert transcribed text into whatever window currently has focus.

Two strategies:
- ``paste``: put the text on the clipboard and send Ctrl+V. Most reliable across
  apps and handles any Unicode. The previous clipboard contents are restored.
- ``type``: synthesize keystrokes directly. Slower, but leaves the clipboard
  untouched.
"""

from __future__ import annotations

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
        previous = ""
        try:
            previous = pyperclip.paste()
        except Exception:
            previous = ""

        pyperclip.copy(text)
        # Small delay so the clipboard is settled before the paste keystroke.
        time.sleep(0.05)
        with self._keyboard.pressed(Key.ctrl):
            self._keyboard.press("v")
            self._keyboard.release("v")

        # Restore the user's clipboard once the paste has been consumed.
        time.sleep(0.15)
        try:
            pyperclip.copy(previous)
        except Exception:
            pass
