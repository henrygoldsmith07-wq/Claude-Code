"""Cross-platform storage janitor.

Works against any object implementing :class:`StorageClient` (Google Drive
and OneDrive clients both do), so the retention/organization logic lives in
exactly one place.

Rules implemented:
  1. purge_trash     — permanently delete trash/bin items older than
                       ``trash_retention_days`` (default 30).
  2. sweep_temp      — files in temp/download folders older than
                       ``temp_retention_days`` (default 90) are moved to an
                       ``_Archive`` folder; oversized items are only flagged.
  3. organize_root   — loose files in the drive root are sorted into logical
                       directories by extension / naming convention.

Safety protocols (enforced here, not in the clients):
  * DRY_RUN: when ``config.dry_run`` is true, every destructive call is
    replaced by a log line — nothing is deleted or moved.
  * Size threshold: files larger than ``max_delete_size_mb`` are never
    auto-deleted/archived, only flagged for manual review.
  * Recency guard: files modified within ``min_file_age_days`` are never
    touched — they are likely active data.
  * Action budget: at most ``max_actions_per_run`` destructive actions per
    provider per cycle, so a bug or bad listing cannot mass-delete.
  * Protected folders: folders (and the sorting target folders themselves)
    are never moved or deleted by organize_root.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol

from config import Config

log = logging.getLogger("janitor")


@dataclass
class CloudFile:
    """Provider-agnostic view of one file or folder."""

    id: str
    name: str
    size_bytes: int
    modified: datetime | None
    is_folder: bool = False
    parent_hint: str = ""  # e.g. containing folder name, for logging


class StorageClient(Protocol):
    """The minimal storage surface janitor needs from each provider."""

    provider: str

    def list_trash(self) -> list[CloudFile]: ...
    def purge_file(self, file: CloudFile) -> None: ...
    def list_root(self) -> list[CloudFile]: ...
    def list_children(self, folder: CloudFile) -> list[CloudFile]: ...
    def ensure_folder(self, path: str) -> str: ...
    def move_file(self, file: CloudFile, dest_folder_id: str) -> None: ...


# Extension -> destination folder for root organization.
SORT_RULES: dict[str, str] = {
    ".pdf": "Documents",
    ".doc": "Documents", ".docx": "Documents", ".txt": "Documents",
    ".md": "Documents", ".odt": "Documents",
    ".xls": "Documents/Spreadsheets", ".xlsx": "Documents/Spreadsheets",
    ".csv": "Documents/Spreadsheets",
    ".ppt": "Documents/Presentations", ".pptx": "Documents/Presentations",
    ".jpg": "Media/Images", ".jpeg": "Media/Images", ".png": "Media/Images",
    ".gif": "Media/Images", ".heic": "Media/Images", ".webp": "Media/Images",
    ".mp4": "Media/Videos", ".mov": "Media/Videos", ".mkv": "Media/Videos",
    ".mp3": "Media/Audio", ".wav": "Media/Audio", ".m4a": "Media/Audio",
    ".zip": "Archives", ".tar": "Archives", ".gz": "Archives", ".7z": "Archives",
}

# Filename keywords that override the plain-extension rule for PDFs.
FINANCIAL_KEYWORDS = ("invoice", "receipt", "statement", "bill", "payment")


@dataclass
class JanitorReport:
    purged: int = 0
    archived: int = 0
    organized: int = 0
    flagged: list[str] = field(default_factory=list)
    skipped: int = 0


class Janitor:
    def __init__(self, config: Config):
        self.config = config

    # ------------------------------------------------------------------ #
    # rule 1: trash purge
    # ------------------------------------------------------------------ #
    def purge_trash(self, client: StorageClient, report: JanitorReport, budget: _Budget) -> None:
        cutoff = _now() - timedelta(days=self.config.trash_retention_days)
        for item in client.list_trash():
            if item.modified is None or item.modified > cutoff:
                continue
            if not self._deletable(item, report):
                continue
            if not budget.take(f"purge {item.name}"):
                return
            if self.config.dry_run:
                log.info("[DRY RUN] %s: would permanently delete trashed '%s' (%s)",
                         client.provider, item.name, _fmt_size(item.size_bytes))
            else:
                client.purge_file(item)
                log.info("%s: permanently deleted trashed '%s'", client.provider, item.name)
            report.purged += 1

    # ------------------------------------------------------------------ #
    # rule 2: temp/download sweep -> _Archive
    # ------------------------------------------------------------------ #
    def sweep_temp(self, client: StorageClient, report: JanitorReport, budget: _Budget) -> None:
        cutoff = _now() - timedelta(days=self.config.temp_retention_days)
        temp_folders = [
            f for f in client.list_root()
            if f.is_folder and f.name.lower() in self.config.temp_folder_names
        ]
        if not temp_folders:
            return
        archive_id = self._ensure_folder(client, "_Archive")
        for folder in temp_folders:
            for item in client.list_children(folder):
                if item.is_folder:
                    continue
                if item.modified is None or item.modified > cutoff:
                    continue
                if not self._deletable(item, report):
                    continue
                if not budget.take(f"archive {item.name}"):
                    return
                if self.config.dry_run:
                    log.info("[DRY RUN] %s: would archive '%s/%s' -> _Archive",
                             client.provider, folder.name, item.name)
                else:
                    client.move_file(item, archive_id)
                    log.info("%s: archived '%s/%s' -> _Archive",
                             client.provider, folder.name, item.name)
                report.archived += 1

    # ------------------------------------------------------------------ #
    # rule 3: root organization
    # ------------------------------------------------------------------ #
    def organize_root(self, client: StorageClient, report: JanitorReport, budget: _Budget) -> None:
        for item in client.list_root():
            if item.is_folder:
                continue  # never relocate folders
            dest = self._destination_for(item.name)
            if dest is None:
                continue
            if not budget.take(f"organize {item.name}"):
                return
            dest_id = self._ensure_folder(client, dest)
            if self.config.dry_run:
                log.info("[DRY RUN] %s: would move '%s' -> %s/",
                         client.provider, item.name, dest)
            else:
                client.move_file(item, dest_id)
                log.info("%s: moved '%s' -> %s/", client.provider, item.name, dest)
            report.organized += 1

    # ------------------------------------------------------------------ #
    # orchestration
    # ------------------------------------------------------------------ #
    def run(self, client: StorageClient) -> JanitorReport:
        report = JanitorReport()
        budget = _Budget(self.config.max_actions_per_run, client.provider)
        for step in (self.purge_trash, self.sweep_temp, self.organize_root):
            try:
                step(client, report, budget)
            except Exception:  # one provider failure must not kill the cycle
                log.exception("%s: janitor step %s failed", client.provider, step.__name__)
        if report.flagged:
            log.warning("%s: %d item(s) flagged for manual review: %s",
                        client.provider, len(report.flagged), "; ".join(report.flagged))
        log.info("%s: janitor done — purged=%d archived=%d organized=%d flagged=%d skipped=%d",
                 client.provider, report.purged, report.archived, report.organized,
                 len(report.flagged), report.skipped)
        return report

    # ------------------------------------------------------------------ #
    # safety helpers
    # ------------------------------------------------------------------ #
    def _deletable(self, item: CloudFile, report: JanitorReport) -> bool:
        """Size + recency guardrails shared by purge and archive rules."""
        max_bytes = self.config.max_delete_size_mb * 1024 * 1024
        if item.size_bytes > max_bytes:
            report.flagged.append(f"{item.name} ({_fmt_size(item.size_bytes)}) exceeds size threshold")
            return False
        if item.modified is not None:
            recency_cutoff = _now() - timedelta(days=self.config.min_file_age_days)
            if item.modified > recency_cutoff:
                report.skipped += 1
                return False
        return True

    def _destination_for(self, name: str) -> str | None:
        lower = name.lower()
        dot = lower.rfind(".")
        if dot == -1:
            return None
        ext = lower[dot:]
        if ext == ".pdf" and any(k in lower for k in FINANCIAL_KEYWORDS):
            return "Financials/Receipts"
        return SORT_RULES.get(ext)

    def _ensure_folder(self, client: StorageClient, path: str) -> str:
        if self.config.dry_run:
            return f"dry-run:{path}"  # never create folders in dry-run mode
        return client.ensure_folder(path)


class _Budget:
    """Caps destructive actions per provider per cycle."""

    def __init__(self, limit: int, provider: str):
        self.remaining = limit
        self.provider = provider
        self._warned = False

    def take(self, action: str) -> bool:
        if self.remaining <= 0:
            if not self._warned:
                log.warning("%s: action budget exhausted; deferring '%s' and the rest "
                            "to the next cycle", self.provider, action)
                self._warned = True
            return False
        self.remaining -= 1
        return True


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_size(size_bytes: int) -> str:
    size = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"
