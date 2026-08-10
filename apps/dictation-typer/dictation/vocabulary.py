"""Custom vocabulary, proper names, and coding-mode transformations."""

from __future__ import annotations

import re

# Common coding dictation shorthands
CODING_REPLACEMENTS = {
    "arrow function": "=>",
    "fat arrow": "=>",
    "open brace": "{",
    "close brace": "}",
    "open paren": "(",
    "close paren": ")",
    "equals equals": "==",
    "triple equals": "===",
    "not equals": "!=",
    "dot": ".",
    "semicolon": ";",
}


def apply_vocabulary(text: str, vocabulary: list[str], custom_names: list[str]) -> str:
    """Expand known vocabulary: if a vocabulary term appears as a multi-word
    phrase but was split by transcription, rejoin with expected casing."""
    if not text:
        return text
    # Build a case-insensitive map from lower -> canonical
    vocab_map = {v.lower(): v for v in (vocabulary + custom_names) if v}
    out = text
    for lower, canonical in vocab_map.items():
        # Replace case-insensitive occurrences of the lower form with canonical
        pattern = re.compile(r"\b" + re.escape(lower) + r"\b", re.IGNORECASE)
        # Only replace if the matched text differs in case/spacing
        if pattern.search(out):
            out = pattern.sub(canonical, out)
    return out


def apply_coding_mode(text: str, enabled: bool = False) -> str:
    if not enabled or not text:
        return text
    out = text
    for phrase, repl in CODING_REPLACEMENTS.items():
        pattern = re.compile(r"\b" + re.escape(phrase) + r"\b", re.IGNORECASE)
        out = pattern.sub(repl, out)
    # Coding mode: keep snake_case and camelCase as-is, lower-case plain words less aggressively
    return out


def prompt_hint(vocabulary: list[str], custom_names: list[str], language: str = "", coding: bool = False) -> str:
    """Build a Whisper prompt hint to bias recognition toward custom terms."""
    parts = []
    if vocabulary:
        parts.append("Vocabulary: " + ", ".join(vocabulary[:30]))
    if custom_names:
        parts.append("Names: " + ", ".join(custom_names[:20]))
    if coding:
        parts.append("Code dictation mode — preserve identifiers and punctuation.")
    if language:
        parts.append(f"Language: {language}")
    return "  ".join(parts)
