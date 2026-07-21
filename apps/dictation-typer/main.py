"""Entry point for the push-to-talk dictation typer.

Usage:
    python main.py            # uses config.json + .env in this folder
"""

from __future__ import annotations

from dictation import Config, DictationApp


def main() -> None:
    config = Config.load()
    DictationApp(config).run()


if __name__ == "__main__":
    main()
