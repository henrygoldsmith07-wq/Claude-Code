"""AI workspace administrator daemon — main orchestrator.

Each cycle:
  1. Email pass (Gmail + Outlook): classify every unread message with Claude;
     delete spam, alert on urgent mail, route the rest into category folders.
  2. Storage pass (Google Drive + OneDrive): purge old trash, archive stale
     temp/download files, organize loose root files.

Providers are optional — whichever credentials are configured get used.
Run once with ``python main.py --once`` or continuously (default) on the
``RUN_INTERVAL_MINUTES`` schedule. DRY_RUN=true (the default) logs every
destructive action instead of executing it.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
import urllib.request

from ai_engine import AIEngine, EmailMessage, Verdict
from config import Config, load_config
from janitor import Janitor

log = logging.getLogger("daemon")


def build_mail_clients(config: Config) -> list:
    """Instantiate every provider whose credentials are configured."""
    clients = []
    import os
    if os.path.exists(config.google_token_file):
        try:
            from google_client import GoogleClient
            clients.append(GoogleClient(config))
            log.info("Google Workspace connected")
        except Exception:
            log.exception("Google Workspace setup failed; continuing without it")
    else:
        log.info("no Google token file at %s — skipping Google", config.google_token_file)

    if config.msft_client_id:
        try:
            from msft_client import MsftClient
            clients.append(MsftClient(config))
            log.info("Microsoft 365 connected")
        except Exception:
            log.exception("Microsoft 365 setup failed; continuing without it")
    else:
        log.info("MSFT_CLIENT_ID not set — skipping Microsoft 365")
    return clients


def alert_urgent(config: Config, email: EmailMessage, verdict: Verdict) -> None:
    """Priority hook for urgent mail: prominent log line + optional webhook."""
    log.warning("URGENT [%s] from %s — %s | %s",
                email.provider, email.sender, email.subject, verdict.summary)
    if not config.alert_webhook_url:
        return
    payload = json.dumps({
        "provider": email.provider,
        "from": email.sender,
        "subject": email.subject,
        "summary": verdict.summary,
        "category": verdict.category,
    }).encode()
    try:
        req = urllib.request.Request(
            config.alert_webhook_url, data=payload,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=15)
    except OSError:
        log.exception("urgent-alert webhook delivery failed")


def process_mailbox(config: Config, engine: AIEngine, client) -> None:
    try:
        unread = client.fetch_unread()
    except Exception:
        log.exception("%s: failed to fetch unread mail", client.provider)
        return
    log.info("%s: %d unread message(s)", client.provider, len(unread))

    for email in unread:
        verdict = engine.classify_email(email)
        if verdict is None:
            continue  # fail safe: never act without a verdict
        try:
            if verdict.spam:
                client.delete_email(email)
            else:
                if verdict.urgent:
                    alert_urgent(config, email, verdict)
                client.route_email(email, verdict.category)
        except Exception:
            log.exception("%s: action failed for '%s'", client.provider, email.subject)


def run_cycle(config: Config, engine: AIEngine | None, clients: list) -> None:
    if engine is not None:
        for client in clients:
            process_mailbox(config, engine, client)
    janitor = Janitor(config)
    for client in clients:
        janitor.run(client)


def main() -> int:
    parser = argparse.ArgumentParser(description="AI workspace administrator daemon")
    parser.add_argument("--once", action="store_true",
                        help="run a single cycle and exit")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    config = load_config()
    log.info("starting workspace daemon — %s", config.summary())
    if config.dry_run:
        log.info("DRY_RUN is enabled: no email will be deleted and no file "
                 "will be moved or removed. Set DRY_RUN=false to go live.")

    engine: AIEngine | None = None
    if config.anthropic_api_key or config.openrouter_api_key:
        engine = AIEngine(config)
    else:
        log.warning("neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is set — "
                    "email intelligence disabled; only the storage janitor "
                    "will run")

    clients = build_mail_clients(config)
    if not clients:
        log.error("no providers configured; nothing to do")
        return 1

    while True:
        started = time.monotonic()
        try:
            run_cycle(config, engine, clients)
        except KeyboardInterrupt:
            raise
        except Exception:
            log.exception("cycle failed; will retry on next interval")
        if args.once:
            return 0
        elapsed = time.monotonic() - started
        delay = max(60.0, config.run_interval_minutes * 60 - elapsed)
        log.info("cycle finished in %.1fs — next run in %.0f min", elapsed, delay / 60)
        try:
            time.sleep(delay)
        except KeyboardInterrupt:
            log.info("shutting down")
            return 0


if __name__ == "__main__":
    sys.exit(main())
