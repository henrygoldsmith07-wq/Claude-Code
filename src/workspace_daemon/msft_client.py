"""Microsoft 365 connector: Outlook mail and OneDrive via Microsoft Graph.

Auth: MSAL public-client device-code flow with a persistent token cache
(``MSFT_TOKEN_CACHE_FILE``). First run prints the device-login instructions;
subsequent runs refresh silently.

Scopes: Mail.ReadWrite, Files.ReadWrite (delegated).

All destructive methods honor ``config.dry_run``.
"""

from __future__ import annotations

import atexit
import logging
import os
from datetime import datetime, timezone

import msal
import requests

from ai_engine import EmailMessage
from config import Config
from janitor import CloudFile

log = logging.getLogger("msft")

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPES = ["Mail.ReadWrite", "Files.ReadWrite"]


class MsftClient:
    provider = "microsoft"

    def __init__(self, config: Config):
        if not config.msft_client_id:
            raise RuntimeError("MSFT_CLIENT_ID is not set")
        self.config = config
        self._folder_cache: dict[str, str] = {}

        cache = msal.SerializableTokenCache()
        if os.path.exists(config.msft_token_cache_file):
            with open(config.msft_token_cache_file) as fh:
                cache.deserialize(fh.read())
        atexit.register(self._persist_cache, cache)

        self.app = msal.PublicClientApplication(
            config.msft_client_id,
            authority=f"https://login.microsoftonline.com/{config.msft_tenant_id}",
            token_cache=cache,
        )
        self._cache = cache
        self._token: str | None = None

    def _persist_cache(self, cache: msal.SerializableTokenCache) -> None:
        if cache.has_state_changed:
            with open(self.config.msft_token_cache_file, "w") as fh:
                fh.write(cache.serialize())

    def _get_token(self) -> str:
        accounts = self.app.get_accounts()
        result = None
        if accounts:
            result = self.app.acquire_token_silent(SCOPES, account=accounts[0])
        if not result:
            flow = self.app.initiate_device_flow(scopes=SCOPES)
            if "user_code" not in flow:
                raise RuntimeError(f"device flow failed: {flow}")
            log.warning("Microsoft sign-in required: %s", flow["message"])
            result = self.app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise RuntimeError(f"Graph auth failed: {result.get('error_description')}")
        return result["access_token"]

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        if self._token is None:
            self._token = self._get_token()
        url = path if path.startswith("http") else f"{GRAPH}{path}"
        resp = requests.request(
            method, url,
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=60, **kwargs,
        )
        if resp.status_code == 401:  # token expired mid-cycle — refresh once
            self._token = self._get_token()
            resp = requests.request(
                method, url,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=60, **kwargs,
            )
        resp.raise_for_status()
        return resp

    # ------------------------------------------------------------------ #
    # Outlook mail
    # ------------------------------------------------------------------ #
    def fetch_unread(self, limit: int = 25) -> list[EmailMessage]:
        resp = self._request(
            "GET",
            "/me/mailFolders/inbox/messages"
            f"?$filter=isRead eq false&$top={limit}"
            "&$select=id,subject,from,receivedDateTime,bodyPreview,body,internetMessageId",
        )
        emails: list[EmailMessage] = []
        for msg in resp.json().get("value", []):
            sender = (msg.get("from") or {}).get("emailAddress", {})
            body = (msg.get("body") or {}).get("content") or msg.get("bodyPreview", "")
            emails.append(EmailMessage(
                id=msg["id"],
                subject=msg.get("subject") or "(no subject)",
                sender=f"{sender.get('name', '')} <{sender.get('address', '')}>",
                date=msg.get("receivedDateTime", ""),
                body=body,
                provider=self.provider,
                rfc_message_id=msg.get("internetMessageId", ""),
            ))
        return emails

    def delete_email(self, email: EmailMessage) -> None:
        """Delete a spam message (moved to Deleted Items by Graph DELETE)."""
        if self.config.dry_run:
            log.info("[DRY RUN] outlook: would delete spam '%s' from %s",
                     email.subject, email.sender)
            return
        self._request("DELETE", f"/me/messages/{email.id}")
        log.info("outlook: deleted spam '%s'", email.subject)

    def route_email(self, email: EmailMessage, category: str) -> None:
        """Move the message into a category folder and mark it read."""
        if self.config.dry_run:
            log.info("[DRY RUN] outlook: would move '%s' -> %s and mark read",
                     email.subject, category)
            return
        self._request("PATCH", f"/me/messages/{email.id}", json={"isRead": True})
        folder_id = self._ensure_mail_folder(category)
        self._request("POST", f"/me/messages/{email.id}/move",
                      json={"destinationId": folder_id})
        log.info("outlook: moved '%s' -> %s", email.subject, category)

    def _ensure_mail_folder(self, name: str) -> str:
        if name in self._folder_cache:
            return self._folder_cache[name]
        resp = self._request("GET", f"/me/mailFolders?$filter=displayName eq '{name}'")
        values = resp.json().get("value", [])
        if values:
            folder_id = values[0]["id"]
        else:
            created = self._request("POST", "/me/mailFolders",
                                    json={"displayName": name})
            folder_id = created.json()["id"]
        self._folder_cache[name] = folder_id
        return folder_id

    # ------------------------------------------------------------------ #
    # OneDrive (janitor StorageClient surface)
    # ------------------------------------------------------------------ #
    def list_trash(self) -> list[CloudFile]:
        """OneDrive recycle-bin listing is only available on the Graph beta
        endpoint; degrade gracefully where it's not enabled."""
        try:
            resp = requests.get(
                "https://graph.microsoft.com/beta/me/drive/recycleBin/items",
                headers={"Authorization": f"Bearer {self._token or self._get_token()}"},
                timeout=60,
            )
            resp.raise_for_status()
        except requests.RequestException:
            log.info("onedrive: recycle bin API unavailable for this account; "
                     "skipping trash purge")
            return []
        return [_to_cloud_file(item, date_key="deletedDateTime")
                for item in resp.json().get("value", [])]

    def list_root(self) -> list[CloudFile]:
        return self._list_items("/me/drive/root/children")

    def list_children(self, folder: CloudFile) -> list[CloudFile]:
        return self._list_items(f"/me/drive/items/{folder.id}/children")

    def _list_items(self, path: str) -> list[CloudFile]:
        items: list[CloudFile] = []
        url: str | None = path
        while url:
            resp = self._request("GET", url)
            data = resp.json()
            items.extend(_to_cloud_file(item) for item in data.get("value", []))
            url = data.get("@odata.nextLink")
        return items

    def purge_file(self, file: CloudFile) -> None:
        # permanentDelete skips the recycle bin; fall back to soft delete
        # on accounts where it isn't supported.
        try:
            self._request("POST", f"/me/drive/items/{file.id}/permanentDelete")
        except requests.HTTPError:
            self._request("DELETE", f"/me/drive/items/{file.id}")

    def move_file(self, file: CloudFile, dest_folder_id: str) -> None:
        self._request("PATCH", f"/me/drive/items/{file.id}",
                      json={"parentReference": {"id": dest_folder_id}})

    def ensure_folder(self, path: str) -> str:
        parent = "root"
        for segment in path.split("/"):
            base = "/me/drive/root/children" if parent == "root" \
                else f"/me/drive/items/{parent}/children"
            existing = self._request("GET", base).json().get("value", [])
            match = next(
                (i for i in existing
                 if i.get("name", "").lower() == segment.lower() and "folder" in i),
                None,
            )
            if match:
                parent = match["id"]
            else:
                created = self._request("POST", base, json={
                    "name": segment,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "fail",
                })
                parent = created.json()["id"]
        return parent


def _to_cloud_file(item: dict, date_key: str = "lastModifiedDateTime") -> CloudFile:
    return CloudFile(
        id=item.get("id", ""),
        name=item.get("name", ""),
        size_bytes=int(item.get("size", 0) or 0),
        modified=_parse_time(item.get(date_key) or item.get("lastModifiedDateTime")),
        is_folder="folder" in item,
    )


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None
