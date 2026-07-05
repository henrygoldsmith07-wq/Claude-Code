#!/usr/bin/env python3
"""Skill Finder — scan installed Claude Code skills and rank them against a query.

Reads the YAML frontmatter (`name` + `description`) from every SKILL.md under the
skills roots, scores each skill against the user's query using simple token/phrase
overlap, and prints the best matches ranked by relevance.

Usage:
    python3 find_skills.py "review a pull request"
    python3 find_skills.py --top 10 "generate charts"
    python3 find_skills.py --list                 # list every installed skill
    python3 find_skills.py --json "deploy a site"  # machine-readable output
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Skills can live in the project or the user's home directory.
DEFAULT_ROOTS = [
    Path.cwd() / ".claude" / "skills",
    Path.home() / ".claude" / "skills",
]

STOPWORDS = {
    "a", "an", "the", "to", "of", "for", "and", "or", "in", "on", "with", "my",
    "me", "i", "it", "is", "are", "how", "do", "can", "use", "using", "this",
    "that", "when", "want", "need", "please", "help", "some", "any", "from",
    "into", "your", "you", "skill", "skills",
}

WORD_RE = re.compile(r"[a-z0-9]+")


def stem(word: str) -> str:
    """Crude singular/plural normalizer so 'charts' matches 'chart'."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("es") and not word.endswith(("ses", "zes")):
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def tokenize(text: str) -> list[str]:
    return [
        stem(w)
        for w in WORD_RE.findall(text.lower())
        if w not in STOPWORDS and len(w) > 1
    ]


def parse_frontmatter(path: Path) -> dict[str, str]:
    """Extract name/description from a SKILL.md YAML frontmatter block.

    Deliberately lightweight — no YAML dependency. Handles the two fields we
    care about, including simple quoting and folded multi-line descriptions.
    """
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    block = text[3:end]

    fields: dict[str, str] = {}
    current_key: str | None = None
    for raw in block.splitlines():
        line = raw.rstrip()
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if m and not raw.startswith((" ", "\t")):
            key, val = m.group(1).lower(), m.group(2).strip()
            # A bare block-scalar indicator (| or >, with optional chomping)
            # means the value continues on the following indented lines.
            if re.fullmatch(r"[|>][+-]?", val):
                val = ""
            fields[key] = _unquote(val)
            current_key = key
        elif current_key and (raw.startswith((" ", "\t")) or fields.get(current_key) == ""):
            # continuation of a folded/multi-line value
            fields[current_key] = (fields[current_key] + " " + line.strip()).strip()
    return fields


def _unquote(val: str) -> str:
    if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
        return val[1:-1]
    return val


def discover_skills(roots: list[Path]) -> list[dict]:
    seen: set[str] = set()
    skills: list[dict] = []
    for root in roots:
        if not root.is_dir():
            continue
        for skill_md in sorted(root.glob("*/SKILL.md")):
            slug = skill_md.parent.name
            if slug in seen:
                continue
            fm = parse_frontmatter(skill_md)
            if not fm:
                continue
            seen.add(slug)
            name = fm.get("name") or slug
            description = fm.get("description", "")
            skills.append({
                "slug": slug,
                "name": name,
                "description": description,
                "path": str(skill_md),
                "haystack": f"{slug} {name} {description}".lower(),
            })
    return skills


def score(query: str, skill: dict) -> float:
    q_tokens = tokenize(query)
    if not q_tokens:
        return 0.0
    haystack = skill["haystack"]
    h_tokens = set(tokenize(haystack))
    name_tokens = set(tokenize(f"{skill['slug']} {skill['name']}"))

    s = 0.0
    matched = 0
    for tok in q_tokens:
        if tok in name_tokens:
            s += 3.0          # match in the skill name/slug is strong signal
            matched += 1
        elif tok in h_tokens:
            s += 1.0          # match in the description
            matched += 1
        elif tok in haystack:
            s += 0.5          # substring match (e.g. plural/partial)
            matched += 1

    if matched == 0:
        return 0.0

    # Reward covering more of the query.
    coverage = matched / len(q_tokens)
    s *= 0.5 + 0.5 * coverage

    # Bonus for an exact phrase appearing in the description.
    phrase = " ".join(q_tokens)
    if phrase and phrase in haystack:
        s += 2.0
    return s


def main() -> int:
    ap = argparse.ArgumentParser(description="Find the most relevant installed Claude Code skills for a query.")
    ap.add_argument("query", nargs="*", help="What you want to do.")
    ap.add_argument("--top", type=int, default=5, help="Max results to show (default 5).")
    ap.add_argument("--list", action="store_true", help="List every installed skill and exit.")
    ap.add_argument("--json", action="store_true", help="Emit results as JSON.")
    ap.add_argument("--root", action="append", help="Extra skills root to scan (repeatable).")
    args = ap.parse_args()

    roots = list(DEFAULT_ROOTS)
    if args.root:
        roots = [Path(r) for r in args.root] + roots

    skills = discover_skills(roots)
    if not skills:
        print("No skills found. Looked in:", file=sys.stderr)
        for r in roots:
            print(f"  {r}", file=sys.stderr)
        return 1

    if args.list:
        if args.json:
            print(json.dumps([{k: v for k, v in s.items() if k != "haystack"} for s in skills], indent=2))
        else:
            print(f"{len(skills)} skills installed:\n")
            for s in sorted(skills, key=lambda x: x["slug"]):
                print(f"  {s['slug']:<32} {s['description'][:90]}")
        return 0

    query = " ".join(args.query).strip()
    if not query:
        ap.error("provide a query, or use --list")

    ranked = sorted(
        ((score(query, s), s) for s in skills),
        key=lambda x: x[0],
        reverse=True,
    )
    hits = [(sc, s) for sc, s in ranked if sc > 0][: args.top]

    if args.json:
        print(json.dumps([
            {"score": round(sc, 2), "slug": s["slug"], "name": s["name"], "description": s["description"], "path": s["path"]}
            for sc, s in hits
        ], indent=2))
        return 0

    if not hits:
        print(f'No skills matched "{query}".')
        print("Try broader terms, or run with --list to browse all installed skills.")
        return 0

    print(f'Top {len(hits)} skill(s) for "{query}":\n')
    for rank, (sc, s) in enumerate(hits, 1):
        print(f"{rank}. {s['slug']}  (score {sc:.1f})")
        desc = s["description"].strip()
        if len(desc) > 200:
            desc = desc[:197].rstrip() + "..."
        print(f"   {desc}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        # e.g. `find_skills.py --list | head` — consumer closed the pipe.
        try:
            sys.stdout.close()
        except OSError:
            pass
        os._exit(0)
