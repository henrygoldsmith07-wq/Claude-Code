---
name: skill-finder
description: Find the most relevant installed Claude Code skill for a task by scanning every SKILL.md and ranking by relevance. Use when the user asks "which skill should I use for X", "is there a skill for X", "what skill does X", "find me a skill", "search skills", "list skills", or when you're about to do a task and want to check whether a purpose-built skill already exists. Triggers on "skill finder", "find a skill", "which skill", "search skills", "/skill-finder".
allowed-tools: Bash, Read, Glob, Grep
---

# Skill Finder

Discover which installed skill best fits a task. It scans the YAML frontmatter
(`name` + `description`) of every `SKILL.md` under the project and user skills
roots, scores each against a query, and returns a ranked shortlist — so you (or
the user) invoke the right purpose-built skill instead of reinventing it.

## When to use

- The user asks *"which skill should I use for X?"*, *"is there a skill for…"*,
  *"find/search skills"*, or *"list skills"*.
- **Proactively**, before doing a substantial task: check whether a dedicated
  skill already covers it. If a strong match exists, invoke that skill instead.

## Quick start

Run the finder script with a plain-language description of the task:

```bash
python3 .claude/skills/skill-finder/find_skills.py "review a pull request"
```

Example output:

```
Top 3 skill(s) for "review a pull request":

1. code-review  (score 6.5)
   Review the changes since a fixed point ...
2. github-code-review  (score 3.8)
   Comprehensive GitHub code review with AI-powered swarm coordination
3. review  (score 3.0)
   Review a GitHub pull request ...
```

## Usage

| Goal | Command |
|------|---------|
| Rank skills for a task | `find_skills.py "deploy a landing page"` |
| Show more results | `find_skills.py --top 10 "generate charts"` |
| List every installed skill | `find_skills.py --list` |
| Machine-readable output | `find_skills.py --json "clean my inbox"` |
| Scan an extra location | `find_skills.py --root /path/to/skills "…"` |

Paths are relative to the repo root; use the absolute path
`.../.claude/skills/skill-finder/find_skills.py` if you're elsewhere.

## How it works

1. **Discover** — globs `*/SKILL.md` under `./.claude/skills` and
   `~/.claude/skills` (project entries win on slug collisions).
2. **Parse** — extracts `name` and `description` from the frontmatter with a
   dependency-free reader (handles quoting and folded multi-line values).
3. **Score** — tokenizes the query (dropping stopwords) and rewards matches:
   name/slug hit = 3, description hit = 1, substring = 0.5, plus bonuses for
   query coverage and exact-phrase matches.
4. **Rank** — prints the top *N* by score, with scores and trimmed descriptions.

Pure standard library (Python 3.8+), no network, no dependencies.

## Acting on results

1. Run the finder with the user's intent as the query.
2. If the top hit is a clear match, tell the user and invoke it via the `Skill`
   tool (or suggest the matching `/slash-command`).
3. If several are close, present the shortlist and let the user pick.
4. If nothing scores, say so and fall back to `--list` so the user can browse.

## Notes

- Ranking is lexical, not semantic — phrase the query with words a skill's
  author would plausibly use (e.g. "pull request" rather than "PR").
- Only installed skills with a valid `SKILL.md` frontmatter are indexed.
