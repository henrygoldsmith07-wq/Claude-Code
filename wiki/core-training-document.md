# Core Training Document

> Source: owner interview, 2026-07-12. This is the system's ground truth for
> goals, constraints, and operating expectations. `/improve-system` reads this
> before proposing anything; proposals that conflict with it are wrong by
> definition. Update it via Tier-2 sign-off only.

## Mission

Ship a high volume of fast, vibecoded projects and let the winners reveal
themselves. Each app in `apps/` is a cheap bet; the goal is for some of them
to grow into larger, profitable products. Volume and speed beat polish —
build, ship, observe, then double down or kill.

Current portfolio (`apps/`): daily-debate, emotion-tracker, french-practice,
le-studio-site, omni-life, podcast-repurposer, rtk, subscription-tracker,
wjec-study-app, world-news.

## Constraints

- **Time**: scarce. The owner's hours should go to direction and sign-off,
  not execution. Claude executes end-to-end and delegates to subagents/swarms
  (per the Agent Comms and Swarm rules in CLAUDE.md) rather than handing work
  back.
- **Tokens**: a real budget. Prefer the cheapest tier that works (3-tier
  routing in CLAUDE.md), batch related work into one session, don't run the
  optional daemon or polling loops, and keep the wiki index lean so raw files
  are rarely parsed.

## Definition of a Great Session

A session succeeds when it ends with a **built project** — working, committed,
pushed, and PR'd (deployed where a deploy target exists). Plans, analyses, and
scaffolding are means, not outcomes. If a session is about to end with only a
plan, that session isn't done.

## Operating Rules

1. **Delegate by default.** Given a goal, take it to done: build, test, commit,
   push, open the PR, watch CI. Don't stop to ask permission for reversible
   steps; make the reasonable call and report what was decided.
2. **No standing restrictions.** The owner declared nothing off-limits. Still
   apply ordinary judgment on irreversible or costly actions (deleting live
   data, spending money, publishing externally) — proceed when clearly implied
   by the task, surface it in the report.
3. **Bias to ship.** When choosing between a robust design and a working
   version today, ship the working version and note the debt.
4. **Kill fast.** Projects and skills that stop earning their keep get
   proposed for archive/removal via `/improve-system` rather than maintained.

## Priorities for /improve-system

Rank proposals by impact on, in order:

1. Time from idea → shipped project (owner time saved most of all)
2. Token spend per shipped project
3. Revenue potential surfaced in existing apps (monetization gaps count as
   findings)

## Open Questions (Tier-3 backlog)

Still unknown — `/improve-system` should ask these in review files when
relevant evidence appears:

- Which current app is closest to profitable, and what does "profitable" mean
  here (first dollar? covers costs? income)?
- Preferred revenue models (subscriptions, one-off, ads, affiliate)?
- Rough weekly hours available for reviewing sign-off files?
