"""AI-powered email intelligence.

Classifies emails into a strict structured verdict used by the orchestrator:

    SPAM     -> immediate deletion (\\Deleted + expunge / provider delete)
    URGENT   -> priority alert hook
    SUMMARY  -> 1-2 sentence digest of legitimate mail
    CATEGORY -> routing label: Work | Personal | Receipts | Newsletters

Two interchangeable backends, picked automatically from configuration:

  * anthropic  — used when ANTHROPIC_API_KEY is set. Structured output is
    enforced with the Messages API ``output_config.format`` (JSON schema),
    so the response is guaranteed valid JSON.
  * openrouter — free-tier fallback used when only OPENROUTER_API_KEY is
    set. Talks to OpenRouter's chat-completions endpoint with a free model
    (default meta-llama/llama-3.3-70b-instruct:free) and parses the JSON
    defensively, since free models can't guarantee schema conformance.

Either way a failed/unparseable classification returns None and the caller
takes no action on that email (fail safe).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import anthropic
import requests

from config import Config

log = logging.getLogger("ai_engine")

ANTHROPIC_MODEL = "claude-opus-4-8"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

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

# Appended for backends without server-enforced schemas.
JSON_ONLY_SUFFIX = """
Respond with ONLY a raw JSON object in exactly this shape:
{"spam": true|false, "urgent": true|false, "summary": "...",
 "category": "Work"|"Personal"|"Receipts"|"Newsletters"}
No markdown fences, no explanation, no text before or after the JSON.
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
        self.config = config
        if config.anthropic_api_key:
            self.backend = "anthropic"
            self.client = anthropic.Anthropic(api_key=config.anthropic_api_key)
        elif config.openrouter_api_key:
            self.backend = "openrouter"
            self.client = None
        else:
            raise RuntimeError(
                "set ANTHROPIC_API_KEY or OPENROUTER_API_KEY to enable "
                "email intelligence"
            )
        model = ANTHROPIC_MODEL if self.backend == "anthropic" else config.openrouter_model
        log.info("email intelligence backend: %s (%s)", self.backend, model)

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

        if self.backend == "anthropic":
            data = self._classify_anthropic(email.id, payload)
        else:
            data = self._classify_openrouter(email.id, payload)
        if data is None:
            return None

        category = str(data.get("category", ""))
        if category not in CATEGORIES:
            log.info("email %s: unknown category %r, defaulting to Personal",
                     email.id, category)
            category = "Personal"
        spam = data.get("spam") is True
        verdict = Verdict(
            spam=spam,
            urgent=data.get("urgent") is True and not spam,
            summary=str(data.get("summary", "")).strip(),
            category=category,
        )
        log.info(
            "verdict %s: spam=%s urgent=%s category=%s | %s",
            email.id, verdict.spam, verdict.urgent, verdict.category, verdict.summary,
        )
        return verdict

    # ------------------------------------------------------------------ #
    # backend: Anthropic (schema-enforced structured output)
    # ------------------------------------------------------------------ #
    def _classify_anthropic(self, email_id: str, payload: str) -> dict | None:
        try:
            response = self.client.messages.create(
                model=ANTHROPIC_MODEL,
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
            log.warning("rate limited while classifying %s; skipping", email_id)
            return None
        except anthropic.APIStatusError as exc:
            log.error("API error classifying %s: %s %s",
                      email_id, exc.status_code, exc.message)
            return None
        except anthropic.APIConnectionError:
            log.error("network error classifying %s; skipping", email_id)
            return None

        if response.stop_reason == "refusal":
            log.warning("classifier refused email %s; taking no action", email_id)
            return None
        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            log.error("no text block in classification response for %s", email_id)
            return None
        return _extract_json(email_id, text)

    # ------------------------------------------------------------------ #
    # backend: OpenRouter (free-tier models, defensive JSON parsing)
    # ------------------------------------------------------------------ #
    def _classify_openrouter(self, email_id: str, payload: str) -> dict | None:
        try:
            resp = requests.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {self.config.openrouter_api_key}"},
                json={
                    "model": self.config.openrouter_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT + JSON_ONLY_SUFFIX},
                        {"role": "user", "content": payload},
                    ],
                    "temperature": 0,
                    "max_tokens": 1024,
                },
                timeout=120,
            )
        except requests.RequestException:
            log.error("network error classifying %s via OpenRouter; skipping", email_id)
            return None
        if resp.status_code == 429:
            log.warning("OpenRouter rate limited while classifying %s; skipping", email_id)
            return None
        if resp.status_code >= 400:
            log.error("OpenRouter error classifying %s: %s %.200s",
                      email_id, resp.status_code, resp.text)
            return None
        try:
            text = resp.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            log.error("malformed OpenRouter response for %s", email_id)
            return None
        return _extract_json(email_id, text or "")


def _extract_json(email_id: str, text: str) -> dict | None:
    """Pull a JSON object out of a model response, tolerating markdown
    fences and surrounding prose (free models add these despite prompts)."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        log.error("no JSON object in verdict for %s: %.200s", email_id, text)
        return None
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        log.error("unparseable verdict for %s: %.200s", email_id, text)
        return None
    if not isinstance(data, dict):
        log.error("verdict for %s is not an object: %.200s", email_id, text)
        return None
    return data
