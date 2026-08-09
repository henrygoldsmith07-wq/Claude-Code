"""Central configuration for the AI workspace administrator daemon.

All settings load from environment variables (a local ``.env`` file is
supported via python-dotenv). Nothing in this module performs network I/O.

Environment variables
---------------------
Core:
    DRY_RUN                 "true"/"false" — when true (the default), NO
                            destructive API call is executed; actions are
                            only logged.
    ANTHROPIC_API_KEY       Claude API key used by ai_engine (preferred).
    OPENROUTER_API_KEY      Free alternative: OpenRouter key used when no
                            Anthropic key is set (free-tier models).
    OPENROUTER_MODEL        OpenRouter model id; defaults to the free
                            meta-llama/llama-3.3-70b-instruct:free.
    RUN_INTERVAL_MINUTES    Delay between daemon cycles (default 30).
    ALERT_WEBHOOK_URL       Optional URL that receives a JSON POST when an
                            urgent email is detected.

Google Workspace:
    GOOGLE_TOKEN_FILE       Path to an OAuth token JSON (authorized user
                            credentials with gmail.modify + drive scopes).
    GMAIL_IMAP_USER         Optional. Gmail address for the IMAP path.
    GMAIL_IMAP_PASSWORD     Optional. App password; when both IMAP vars are
                            set, spam is removed with \\Deleted + expunge()
                            instead of the REST API.

Microsoft 365:
    MSFT_CLIENT_ID          Azure AD app registration (public client).
    MSFT_TENANT_ID          Tenant, default "common".
    MSFT_TOKEN_CACHE_FILE   Path where the MSAL token cache is persisted.

Retention / safety policy:
    TRASH_RETENTION_DAYS    Purge trash items older than this (default 30).
    TEMP_RETENTION_DAYS     Archive temp/download files older than this
                            (default 90).
    MAX_DELETE_SIZE_MB      Files larger than this are never auto-deleted or
                            auto-archived — they are flagged for manual
                            review instead (default 500).
    MAX_ACTIONS_PER_RUN     Hard cap on destructive actions (deletes+moves)
                            per provider per cycle (default 50).
    MIN_FILE_AGE_DAYS       Files modified more recently than this are never
                            touched by the janitor (default 7).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Config:
    # --- global -----------------------------------------------------------
    dry_run: bool = field(default_factory=lambda: _env_bool("DRY_RUN", True))
    run_interval_minutes: int = field(
        default_factory=lambda: _env_int("RUN_INTERVAL_MINUTES", 30)
    )
    anthropic_api_key: str | None = field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY")
    )
    # Free-tier alternative backend: any OpenRouter model works; the default
    # is a free one, so classification costs nothing beyond an OpenRouter
    # account (https://openrouter.ai/keys).
    openrouter_api_key: str | None = field(
        default_factory=lambda: os.getenv("OPENROUTER_API_KEY")
    )
    openrouter_model: str = field(
        default_factory=lambda: os.getenv(
            "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
        )
    )
    alert_webhook_url: str | None = field(
        default_factory=lambda: os.getenv("ALERT_WEBHOOK_URL")
    )

    # --- Google -----------------------------------------------------------
    google_token_file: str = field(
        default_factory=lambda: os.getenv("GOOGLE_TOKEN_FILE", "google_token.json")
    )
    gmail_imap_user: str | None = field(
        default_factory=lambda: os.getenv("GMAIL_IMAP_USER")
    )
    gmail_imap_password: str | None = field(
        default_factory=lambda: os.getenv("GMAIL_IMAP_PASSWORD")
    )

    # --- Microsoft --------------------------------------------------------
    msft_client_id: str | None = field(
        default_factory=lambda: os.getenv("MSFT_CLIENT_ID")
    )
    msft_tenant_id: str = field(
        default_factory=lambda: os.getenv("MSFT_TENANT_ID", "common")
    )
    msft_token_cache_file: str = field(
        default_factory=lambda: os.getenv("MSFT_TOKEN_CACHE_FILE", "msal_cache.bin")
    )

    # --- retention & safety -----------------------------------------------
    trash_retention_days: int = field(
        default_factory=lambda: _env_int("TRASH_RETENTION_DAYS", 30)
    )
    temp_retention_days: int = field(
        default_factory=lambda: _env_int("TEMP_RETENTION_DAYS", 90)
    )
    max_delete_size_mb: int = field(
        default_factory=lambda: _env_int("MAX_DELETE_SIZE_MB", 500)
    )
    max_actions_per_run: int = field(
        default_factory=lambda: _env_int("MAX_ACTIONS_PER_RUN", 50)
    )
    min_file_age_days: int = field(
        default_factory=lambda: _env_int("MIN_FILE_AGE_DAYS", 7)
    )

    # Folder names (lowercase) treated as temporary/download locations.
    temp_folder_names: tuple[str, ...] = ("downloads", "temp", "tmp", "scratch")

    # Root folders the janitor must never move or delete.
    protected_folder_names: tuple[str, ...] = (
        "_archive",
        "financials",
        "documents",
        "media",
        "work",
        "personal",
    )

    def summary(self) -> str:
        mode = "DRY RUN (no destructive calls)" if self.dry_run else "LIVE"
        return (
            f"mode={mode} trash>{self.trash_retention_days}d "
            f"temp>{self.temp_retention_days}d "
            f"max_delete={self.max_delete_size_mb}MB "
            f"max_actions/run={self.max_actions_per_run}"
        )


def load_config() -> Config:
    """Build the process-wide configuration object."""
    return Config()
