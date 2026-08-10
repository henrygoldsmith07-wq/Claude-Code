"""Push-to-talk dictation typer."""

__all__ = ["Config", "Recorder", "transcribe", "TextInserter", "DictationApp"]

from .config import Config

# Lazy imports for modules that require optional native deps
def _lazy_import(name: str):
    import importlib
    return importlib.import_module(f"dictation.{name}")

# Eager for lightweight modules; recorder/transcriber/inserter/app lazy
try:
    from .recorder import Recorder  # type: ignore
    from .transcriber import transcribe  # type: ignore
    from .inserter import TextInserter  # type: ignore
    from .app import DictationApp  # type: ignore
except ImportError:
    # Allow importing pure modules (commands, vocabulary, benchmark) without native deps
    Recorder = None  # type: ignore
    transcribe = None  # type: ignore
    TextInserter = None  # type: ignore
    DictationApp = None  # type: ignore
