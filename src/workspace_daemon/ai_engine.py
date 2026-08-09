"""Claude-powered email intelligence.

Classifies emails into a strict structured verdict used by the orchestrator:

    SPAM     -> immediate deletion (\\Deleted + expunge / provider delete)
    URGENT   -> priority alert hook
    SUMMARY  -> 1-2 sentence digest of legitimate mail
    CATEGORY -> routing label: Work | Personal | Receipts | Newsletters

Structured output is enforced with the Messages API ``output_config.format``
(JSON schema), so the response is guaranteed to be valid, parseable JSON.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import anthropic

from config import Config

log = logging.getLogger("ai_engine")

MODEL = "claude-opus-4-8"

# Email bodies can be arbitrarily large; anything beyond this adds cost but
# no classification signal. The truncation is logged, never silent.
MAX_BODY_CHARS = 20_000

CATEGORIES = ("Work", "Personal", "Receipts", "Newsletters")

SYSTEM_PROMPT = """\
You are an email triage engine inside an automated workspace daemon. You will
receive ONE email (headers plus body text). Analyze it and return ONLY the
structured JSON verdict — no prose, no markdown.

Field rules:
- spam: true ONLY for unambiguous junk — phishing, scams, unsolicited bulk
  advertising, sextortion, malware lures. When in doubt, spam MUST be false;
  a false positive permanently deletes real mail. Legitimate newsletters,
  receipts, and notifications are NOT spam.
- urgent: true only when spam is false AND the email requires the owner's
  attention within ~24 hours (deadlines, security alerts for real accounts,
  travel changes, messages from real people awaiting a reply). Marketing
  urgency ("sale ends tonight!") is never urgent.
- summary: 1-2 plain sentences describing what the email is and what, if
  anything, the owner should do. For spam, briefly state why it is spam.
- category: exactly one of Work, Personal, Receipts, Newsletters.
  Receipts = purchase confirmations, invoices, billing statements.
  Newsletters = periodic digests, marketing, product announcements.
"""

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "spam": {"type": "boolean"},
        "urgent": {"type": "boolean"},
        "summary": {"type": "string"},
        "category": {"type": "string", "enum": list(CATEGORIES)},
    },
    "required": ["spam", "urgent", "summary", "category"],
    "additionalProperties": False,
}


@dataclass
class EmailMessage:
    """Provider-agnostic view of one email."""

    id: str
    subject: str
    sender: str
    date: str
    body: str
    provider: str = ""
    rfc_message_id: str = ""  # RFC 5322 Message-ID, used for IMAP expunge


@dataclass
class Verdict:
    spam: bool
    urgent: bool
    summary: str
    category: str


class AIEngine:
    def __init__(self, config: Config):
        if not config.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self.client = anthropic.Anthropic(api_key=config.anthropic_api_key)

    def classify_email(self, email: EmailMessage) -> Verdict | None:
        """Classify one email. Returns None when classification fails —
        callers must treat None as "take no action" (fail safe)."""
        body = email.body or ""
        if len(body) > MAX_BODY_CHARS:
            log.info(
                "email %s body truncated for classification (%d -> %d chars)",
                email.id, len(body), MAX_BODY_CHARS,
            )
            body = body[:MAX_BODY_CHARS]

        payload = (
            f"From: {email.sender}\n"
            f"Date: {email.date}\n"
            f"Subject: {email.subject}\n\n"
            f"{body}"
        )

        try:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=1024,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        # Same prompt for every email in a sweep — cache it.
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                output_config={
                    "format": {"type": "json_schema", "schema": VERDICT_SCHEMA}
                },
                messages=[{"role": "user", "content": payload}],
            )
        except anthropic.RateLimitError:
            log.warning("rate limited while classifying %s; skipping", email.id)
            return None
        except anthropic.APIStatusError as exc:
            log.error("API error classifying %s: %s %s", email.id, exc.status_code, exc.message)
            return None
        except anthropic.APIConnectionError:
            log.error("network error classifying %s; skipping", email.id)
            return None

        if response.stop_reason == "refusal":
            log.warning("classifier refused email %s; taking no action", email.id)
            return None

        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            log.error("no text block in classification response for %s", email.id)
            return None

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            log.error("unparseable verdict for %s: %.200s", email.id, text)
            return None

        verdict = Verdict(
            spam=bool(data["spam"]),
            urgent=bool(data["urgent"]) and not bool(data["spam"]),
            summary=str(data["summary"]).strip(),
            category=str(data["category"]),
        )
        log.info(
            "verdict %s: spam=%s urgent=%s category=%s | %s",
            email.id, verdict.spam, verdict.urgent, verdict.category, verdict.summary,
        )
        return verdict
