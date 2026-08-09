"""Push-to-talk dictation typer: hold a hotkey, speak, and the transcript is
typed into whatever window has focus. Transcription runs on Groq's Whisper."""

__all__ = ["Config", "Recorder", "transcribe", "TextInserter", "DictationApp"]

from .config import Config
from .recorder import Recorder
from .transcriber import transcribe
from .inserter import TextInserter
from .app import DictationApp
