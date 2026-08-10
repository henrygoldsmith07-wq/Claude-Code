"""Packaging helpers: Windows installer and macOS/Linux archives.

Usage:
  python build_installer.py --installer   # Windows: builds Inno Setup stub if iscc is on PATH
  python build_installer.py --archive     # macOS/Linux: builds zip/tar

Requires: pyinstaller (pip install pyinstaller) for exe builds; Inno Setup for Windows installer.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build_exe() -> Path | None:
    if shutil.which("pyinstaller") is None:
        print("pyinstaller not found — pip install pyinstaller")
        return None
    cmd = [sys.executable, "-m", "PyInstaller", "--onefile", "--name", "dictation-typer", "--console", "main.py"]
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)
    exe = ROOT / "dist" / ("dictation-typer.exe" if sys.platform == "win32" else "dictation-typer")
    if exe.exists():
        print(f"Built {exe} ({exe.stat().st_size / 1_000_000:.1f} MB)")
        return exe
    return None


def build_archive() -> Path:
    import datetime
    name = f"dictation-typer-{datetime.date.today().isoformat()}"
    exe = build_exe()
    # Fallback: archive the source if no exe
    if exe and exe.exists():
        archive = shutil.make_archive(str(ROOT / name), "zip", root_dir=ROOT, base_dir="dist")
        print(f"Archive: {archive}")
        return Path(archive)
    else:
        # Source archive
        archive = shutil.make_archive(str(ROOT / name), "gztar", root_dir=ROOT.parent, base_dir=ROOT.name)
        print(f"Source archive: {archive}")
        return Path(archive)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--installer", action="store_true", help="Build Windows installer (requires Inno Setup)")
    ap.add_argument("--archive", action="store_true", help="Build zip/tar archive")
    args = ap.parse_args()
    if args.installer:
        exe = build_exe()
        if exe and shutil.which("iscc"):
            iss = ROOT / "installer.iss"
            if not iss.exists():
                iss.write_text(f"""
[Setup]
AppName=Dictation Typer
AppVersion=0.8.5
DefaultDirName={{autopf}}\\DictationTyper
DefaultGroupName=Dictation Typer
OutputBaseFilename=dictation-typer-setup
Compression=lzma

[Files]
Source: \"{exe}\"; DestDir: \"{{app}}\"
Source: \"README.md\"; DestDir: \"{{app}}\"
Source: \"config.example.json\"; DestDir: \"{{app}}\"

[Icons]
Name: \"{{group}}\\Dictation Typer\"; Filename: \"{{app}}\\{exe.name}\"
""".strip(), encoding="utf-8")
            subprocess.run(["iscc", str(iss)], check=True)
            print("Installer built in Output/")
        else:
            print("iscc (Inno Setup) not on PATH — exe built, installer skipped.")
    if args.archive or not (args.installer or args.archive):
        build_archive()


if __name__ == "__main__":
    main()
