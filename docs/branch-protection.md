# Branch protection for `main`

`main` is the branch every production app in this monorepo deploys from, so it
is the one place where a bad merge is expensive. This document is the intent;
`scripts/apply-branch-protection.sh` is the executable version of it.

```bash
./scripts/apply-branch-protection.sh --dry-run   # inspect the payload
./scripts/apply-branch-protection.sh             # apply it
./scripts/apply-branch-protection.sh --show      # read back what GitHub has
```

Everything below can also be clicked in
**Settings → Branches → Branch protection rules → `main`**.

---

## 1. The constraint that shapes everything: path filters

Every workflow in this repository except `Engineering gates` carries a `paths:`
filter, so it runs only when its own app changes. That is the right design for
a monorepo — nobody wants all fourteen suites on a one-line docs change — but it
collides with required status checks:

> When a `paths:` filter excludes a workflow, GitHub does not report a failing
> status or a skipped status. It reports **nothing at all**. A required check
> that is never reported leaves the pull request stuck on
> *"Expected — Waiting for status to be reported"*, forever.

So a path-filtered check can never be a required check. Marking
`Pulse / verify` as required would block every pull request that does not touch
`apps/pulse/`, which is most of them.

That left the repository with **no workflow eligible to be required**, which is
why `.github/workflows/engineering.yml` had its `paths:` filter removed. It now
runs on every pull request, which is what makes it safe to require. Its jobs are
repo-wide by design, so running them unconditionally is also correct on the
merits — not just a workaround.

**If you add a required check later, verify it comes from a workflow with no
`paths:` filter.**

---

## 2. Required status checks

| Check (job name) | Runs | Why it is required |
|---|---|---|
| `repository-gates` | every PR, ~5s | Repo-wide gates: smoke, CODEOWNERS coverage, deploy config, deployment smoke, hard-fail E2E policy, ecosystem smoke, rollback/collision tests, perf-budget config. Pure Node, no install, no network. |
| `integration-contracts (revise-content-and-ai)` | every PR, ~25s | Cross-app content-schema and AI structured-output contracts. |
| `integration-contracts (forq-cloud-and-migrations)` | every PR, ~25s | Cloud data integration and the migration runner — the paths where a bad merge corrupts production data. |

Total added latency: well under a minute.

### Check names are job names

For GitHub Actions, a check run is named after the **job**, not the
`workflow / job` string shown in the PR UI. The API `contexts` array therefore
takes `repository-gates`, not `Engineering gates / repository-gates`.

The two `integration-contracts` legs are a matrix. Without an explicit `name:`,
GitHub derives a matrix job's name from *every* matrix value, which produced:

```
integration-contracts (forq-cloud-and-migrations, apps/food-shopping-os, npm test -- --run tests/cloud-data-integration.test.js tests/migration-runner.test.js)
```

That name embeds the test command, so editing the command silently renames the
check and breaks branch protection. `engineering.yml` now sets
`name: integration-contracts (${{ matrix.name }})` to pin the names to the short
matrix `name` field. **Changing a matrix `name:` value means updating the
required-checks list in the same pull request.**

---

## 3. Workflows deliberately *not* required

Assessed over 120 workflow runs (2026-08-18 → 2026-08-19).

| Workflow | Pass rate | Status |
|---|---|---|
| `Ecosystem` | 21/21 | Healthy, but path-filtered → cannot be required. |
| `Deploy config` | 9/9 | Healthy, but path-filtered. Its script already runs inside `repository-gates`, so requiring it would be redundant. |
| `Arise`, `French Practice`, `Emotion Tracker`, `Habit Tracker`, `Rapport` | 100% | Healthy, path-filtered. |
| `Revise` | 5/7 decided (2 failures, 4 cancelled) | Playwright E2E plus `npx playwright install --with-deps` on every run — a network and apt dependency on the critical path. Not stable enough to be mandatory. |
| `Pulse` | 2/3 decided | Same Playwright install pattern in its `e2e` job. |
| **`Food Shopping OS`** | **0/9 — fails 100%** | `npm test` fails on `main` itself, not just on branches. A real, currently-red test suite. **Must be fixed before it can be considered.** |
| **`RTK`** | **0/22 — fails 100%** | Was a YAML syntax error, fixed in this change (see below). Needs a green run history before anyone trusts it. |

### `RTK` had no CI at all

`.github/workflows/rtk.yml` line 58 used a `${{ }}` expression inside a YAML
flow mapping:

```yaml
env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

The `{` opens a nested flow mapping, so the file never parsed. All 22 runs
failed at startup with **zero jobs**, meaning `apps/rtk` has been merging with
no test coverage whatsoever. GitHub also never parsed the file well enough to
read its `name:`, which is why the Actions list still shows this workflow as
`.github/workflows/rtk.yml` rather than `RTK`.

It is now block-form. Semantics are unchanged — the `release` job's conditions
and the `chore(release)` publish guard are byte-for-byte identical. Expect
`RTK / verify` to actually execute for the first time; it may well be red, and
that is new information rather than a regression.

> Because the workflow could never run, its `release` job never ran either. Now
> that it parses, a push to `main` whose commit message starts with
> `chore(release)` will publish `apps/rtk` to npm. That was always the intent in
> the file; it just could not fire. Worth knowing before writing that commit.

---

## 4. Settings, and the reasoning

### Pull requests

- **Require a pull request before merging** — on.
- **Required approvals: 0.**

Zero deserves an explanation, because it looks like the weak choice and is not.

GitHub does not let anyone approve their own pull request. In a
single-developer repository, "require 1 approval" is unsatisfiable: the only way
to ever merge is to leave **admins exempt**, and an admin exemption is not a
narrow carve-out for approvals — it lets the owner bypass *every* rule,
including "CI must pass". You would trade genuine enforcement for one setting
that was never enforceable.

So the configuration takes the other side of that trade:

| Setting | Value | Effect |
|---|---|---|
| Required approvals | 0 | The one rule a solo developer cannot satisfy. |
| **Include administrators** | **on** | Every *other* rule binds absolutely, with no bypass. |

The result is that pull requests are still mandatory, CI must still pass, the
branch must still be up to date, and conversations must still be resolved — and
none of it can be clicked past. That is strictly more protection than
"1 approval + admin bypass", which enforces nothing.

**When a second reviewer exists**, flip both:

```bash
APPROVALS=1 CODE_OWNER_REVIEWS=true ./scripts/apply-branch-protection.sh
```

- **Dismiss stale approvals on new commits** — on. Harmless at 0 approvals, and
  correct the moment approvals are raised.
- **Require review from Code Owners** — off, for the same self-approval reason:
  GitHub never requests review from the pull request's own author, so with one
  developer it can never be satisfied. `.github/CODEOWNERS` is still the source
  of truth for which paths are sensitive, is enforced by `repository-gates`, and
  is ready to switch on.
- **Require approval of the most recent push** — off. It requires an approver
  other than the pusher, so it deadlocks for the same reason.

### Status checks

- **Require status checks to pass** — on, with the three checks in §2.
- **Require branches to be up to date before merging** (`strict: true`) — on.
  This is the setting that matters most in a monorepo: it stops two individually
  green pull requests from merging into a broken `main`. The cost is a
  *Update branch* click when something else merges first.

### History and destructive operations

- **Allow force pushes** — off. Force-pushing `main` destroys history that every
  deployment and rollback references.
- **Allow deletions** — off.
- **Require linear history** — off, deliberately. This repository merges pull
  requests with merge commits (`Merge pull request #167 …`); turning it on would
  force squash or rebase merges and change an established workflow. It is a
  style preference, not a safety control. Turn it on only if you want that
  style.
- **Lock branch** — off (that is read-only mode).

### Conversations

- **Require conversation resolution before merging** — on. Cheap, and it stops
  review comments from being merged past.

---

## 5. Applying it by hand

If you would rather not run the script, in
**Settings → Branches → Add branch protection rule**:

1. **Branch name pattern**: `main`
2. ☑ Require a pull request before merging
   - Required approvals: **0**
   - ☑ Dismiss stale pull request approvals when new commits are pushed
   - ☐ Require review from Code Owners
   - ☐ Require approval of the most recent reviewable push
3. ☑ Require status checks to pass before merging
   - ☑ Require branches to be up to date before merging
   - Search for and add exactly these three:
     - `repository-gates`
     - `integration-contracts (revise-content-and-ai)`
     - `integration-contracts (forq-cloud-and-migrations)`
   - If a name does not appear in the search box, it has not reported on a
     recent commit yet. Push a commit, let `Engineering gates` run once, and
     search again. Do not type a name GitHub does not offer — a required check
     that never reports blocks every pull request.
4. ☑ Require conversation resolution before merging
5. ☐ Require signed commits *(optional; not configured here)*
6. ☐ Require linear history — see §4
7. ☑ **Do not allow bypassing the above settings** *(this is "Include administrators")*
8. ☐ Allow force pushes
9. ☐ Allow deletions

### Also worth setting

**Settings → General → Pull Requests**

- ☑ Automatically delete head branches — keeps the branch list honest.
- ☑ Allow auto-merge — with required checks, this is what removes the friction:
  open the PR, enable auto-merge, and it lands when the three checks go green.

**Settings → Actions → General**

- Workflow permissions: **Read repository contents and packages permissions**.
  `RTK`'s `release` job requests `contents: write` at job level, which is the
  correct narrow grant and keeps working under a read-only default.

---

## 6. Verifying it worked

```bash
./scripts/apply-branch-protection.sh --show
```

Then confirm the protection is real rather than merely configured:

```bash
git checkout main
git commit --allow-empty -m "probe" && git push origin main
# expected: rejected — protected branch hook declined
git reset --hard origin/main
```

A push that succeeds means the rule is not applied to `main`, or the pattern
does not match the branch name.

---

## 7. Keeping this honest

`repository-gates` runs `scripts/check-codeowners.mjs`, which fails the build if
`.github/CODEOWNERS` develops a rule with no owner, an owner that is not a valid
handle, or a sensitive path that has stopped resolving to an explicit rule. A
CODEOWNERS file otherwise fails completely silently — an unmatched pattern
produces no warning anywhere, it just leaves the path unguarded.

The two things this document cannot enforce, because they live only in GitHub:

1. The branch protection rule itself — re-run the script if it drifts.
2. The required-checks list — if a matrix `name:` in `engineering.yml` changes,
   update `REQUIRED_CHECKS` in `scripts/apply-branch-protection.sh` and re-run.
