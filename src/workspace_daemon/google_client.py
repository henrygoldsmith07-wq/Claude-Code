"""Google Workspace connector: Gmail (API + optional IMAP) and Google Drive.

Auth: authorized-user OAuth credentials loaded from ``GOOGLE_TOKEN_FILE``
(a token JSON produced by the standard InstalledAppFlow consent dance) with
scopes ``gmail.modify`` (+ ``https://mail.google.com/`` for hard delete) and
``drive``.

Spam removal: when ``GMAIL_IMAP_USER``/``GMAIL_IMAP_PASSWORD`` are set, spam
is deleted the classic way — ``\\Deleted`` flag + ``expunge()`` over IMAP.
Otherwise the Gmail REST API ``messages.delete`` endpoint is used.

All destructive methods honor ``config.dry_run``.
"""

from __future__ import annotations

import base64
import imaplib
import logging
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from ai_engine import EmailMessage
from config import Config
from janitor import CloudFile

log = logging.getLogger("google")

SCOPES = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/drive",
]

FILE_FIELDS = "id, name, size, modifiedTime, trashedTime, mimeType, parents"
FOLDER_MIME = "application/vnd.google-apps.folder"


class GoogleClient:
    provider = "google"

    def __init__(self, config: Config):
        self.config = config
        creds = Credentials.from_authorized_user_file(config.google_token_file, SCOPES)
        self.gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)
        self.drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        self._label_cache: dict[str, str] = {}

    # ------------------------------------------------------------------ #
    # Gmail
    # ------------------------------------------------------------------ #
    def fetch_unread(self, limit: int = 25) -> list[EmailMessage]:
        resp = self.gmail.users().messages().list(
            userId="me", q="is:unread in:inbox", maxResults=limit
        ).execute()
        emails: list[EmailMessage] = []
        for ref in resp.get("messages", []):
            msg = self.gmail.users().messages().get(
                userId="me", id=ref["id"], format="full"
            ).execute()
            headers = {
                h["name"].lower(): h["value"]
                for h in msg.get("payload", {}).get("headers", [])
            }
            emails.append(EmailMessage(
                id=msg["id"],
                subject=headers.get("subject", "(no subject)"),
                sender=headers.get("from", "(unknown)"),
                date=headers.get("date", ""),
                body=_extract_body(msg.get("payload", {})),
                provider=self.provider,
                rfc_message_id=headers.get("message-id", ""),
            ))
        return emails

    def delete_email(self, email: EmailMessage) -> None:
        """Delete a spam message. IMAP \\Deleted + expunge when configured,
        otherwise the Gmail API hard delete."""
        if self.config.dry_run:
            log.info("[DRY RUN] gmail: would delete spam '%s' from %s",
                     email.subject, email.sender)
            return
        if self.config.gmail_imap_user and self.config.gmail_imap_password:
            self._imap_expunge(email)
        else:
            self.gmail.users().messages().delete(userId="me", id=email.id).execute()
        log.info("gmail: deleted spam '%s'", email.subject)

    def _imap_expunge(self, email: EmailMessage) -> None:
        conn = imaplib.IMAP4_SSL("imap.gmail.com")
        try:
            conn.login(self.config.gmail_imap_user, self.config.gmail_imap_password)
            conn.select("INBOX")
            if email.rfc_message_id:
                typ, data = conn.search(
                    None, "HEADER", "Message-ID", email.rfc_message_id
                )
                for num in (data[0].split() if typ == "OK" and data and data[0] else []):
                    conn.store(num, "+FLAGS", "\\Deleted")
                conn.expunge()
        finally:
            conn.logout()

    def route_email(self, email: EmailMessage, category: str) -> None:
        """Label the message with its category and clear it from unread."""
        if self.config.dry_run:
            log.info("[DRY RUN] gmail: would label '%s' as %s and mark read",
                     email.subject, category)
            return
        label_id = self._ensure_label(category)
        self.gmail.users().messages().modify(
            userId="me", id=email.id,
            body={"addLabelIds": [label_id], "removeLabelIds": ["UNREAD"]},
        ).execute()
        log.info("gmail: labeled '%s' as %s", email.subject, category)

    def _ensure_label(self, name: str) -> str:
        if name in self._label_cache:
            return self._label_cache[name]
        labels = self.gmail.users().labels().list(userId="me").execute().get("labels", [])
        for lb in labels:
            if lb["name"].lower() == name.lower():
                self._label_cache[name] = lb["id"]
                return lb["id"]
        created = self.gmail.users().labels().create(
            userId="me", body={"name": name}
        ).execute()
        self._label_cache[name] = created["id"]
        return created["id"]

    # ------------------------------------------------------------------ #
    # Google Drive (janitor StorageClient surface)
    # ------------------------------------------------------------------ #
    def list_trash(self) -> list[CloudFile]:
        return self._list(q="trashed = true", date_field="trashedTime")

    def list_root(self) -> list[CloudFile]:
        return self._list(q="'root' in parents and trashed = false")

    def list_children(self, folder: CloudFile) -> list[CloudFile]:
        return self._list(q=f"'{folder.id}' in parents and trashed = false")

    def purge_file(self, file: CloudFile) -> None:
        self.drive.files().delete(fileId=file.id).execute()

    def move_file(self, file: CloudFile, dest_folder_id: str) -> None:
        meta = self.drive.files().get(fileId=file.id, fields="parents").execute()
        previous = ",".join(meta.get("parents", []))
        self.drive.files().update(
            fileId=file.id, addParents=dest_folder_id, removeParents=previous
        ).execute()

    def ensure_folder(self, path: str) -> str:
        parent = "root"
        for segment in path.split("/"):
            query = (
                f"name = '{segment}' and mimeType = '{FOLDER_MIME}' "
                f"and '{parent}' in parents and trashed = false"
            )
            found = self.drive.files().list(q=query, fields="files(id)").execute()
            files = found.get("files", [])
            if files:
                parent = files[0]["id"]
            else:
                created = self.drive.files().create(
                    body={"name": segment, "mimeType": FOLDER_MIME, "parents": [parent]},
                    fields="id",
                ).execute()
                parent = created["id"]
        return parent

    def _list(self, q: str, date_field: str = "modifiedTime") -> list[CloudFile]:
        items: list[CloudFile] = []
        page_token = None
        while True:
            resp = self.drive.files().list(
                q=q, pageSize=200, pageToken=page_token,
                fields=f"nextPageToken, files({FILE_FIELDS})",
            ).execute()
            for f in resp.get("files", []):
                items.append(CloudFile(
                    id=f["id"],
                    name=f.get("name", ""),
                    size_bytes=int(f.get("size", 0)),
                    modified=_parse_time(f.get(date_field) or f.get("modifiedTime")),
                    is_folder=f.get("mimeType") == FOLDER_MIME,
                ))
            page_token = resp.get("nextPageToken")
            if not page_token:
                return items


def _extract_body(payload: dict) -> str:
    """Walk a Gmail message payload and return the first text/plain body,
    falling back to text/html."""
    plain, html = _walk_parts(payload)
    return plain or html or ""


def _walk_parts(part: dict) -> tuple[str, str]:
    plain, html = "", ""
    mime = part.get("mimeType", "")
    data = part.get("body", {}).get("data")
    if data:
        try:
            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        except (ValueError, TypeError):
            decoded = ""
        if mime == "text/plain":
            plain = decoded
        elif mime == "text/html":
            html = decoded
    for child in part.get("parts", []) or []:
        p, h = _walk_parts(child)
        plain = plain or p
        html = html or h
    return plain, html


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None
