# Vercel deployment dependency map

Updated 2026-08-20 against the current `main` checkout.

The repository contains several independently-rooted Vercel projects. A
project's checked-in `vercel.json` now calls:

```text
node "$(git rev-parse --show-toplevel)/scripts/vercel-ignore.mjs" --project <project-id>
```

The command returns `0` to skip the project and `1` to deploy it. The evaluator
reads [`config/affected-deployments.json`](../config/affected-deployments.json),
uses Vercel's previous/current commit SHAs, and fails open when Git cannot
produce a trustworthy diff. The same graph is covered by
[`scripts/vercel-ignore.test.mjs`](../scripts/vercel-ignore.test.mjs).

## Current project roots

These are the 18 active Vercel projects represented by the current checked-in
configs, plus the two explicit guardrails. Each project is independent unless
the shared dependency column says otherwise.

| Project key | Vercel Root Directory | Class | Runtime dependencies that can affect its output |
|---|---|---|---|
| `arise` | `apps/arise` | product | `apps/arise/**`, `packages/theme/**` |
| `arise-site` | `apps/arise-site` | marketing site | `apps/arise-site/**` |
| `daily-debate` | `apps/daily-debate` | product | `apps/daily-debate/**`, `packages/theme/**` |
| `daily-debate-site` | `apps/daily-debate-site` | marketing site | `apps/daily-debate-site/**` |
| `ecosystem-shell` | `apps/ecosystem-shell` | routing infrastructure | `apps/ecosystem-shell/**` |
| `emotion-tracker` | `apps/emotion-tracker` | product / Reflect | `apps/emotion-tracker/**`, `packages/theme/**` |
| `food-shopping-os` | `apps/food-shopping-os` | product / Forq | `apps/food-shopping-os/**`, `packages/theme/**` |
| `forq-site` | `apps/forq-site` | marketing site | `apps/forq-site/**` |
| `french-practice` | `apps/french-practice` | product | `apps/french-practice/**`, `packages/theme/**` |
| `habit-tracker` | `apps/habit-tracker` | product | `apps/habit-tracker/**`, `packages/theme/**` |
| `le-studio-site` | `apps/le-studio-site` | family marketing site | `apps/le-studio-site/**` |
| `mental-load-tracker` | `apps/mental-load-tracker` | product / Noticed | `apps/mental-load-tracker/**`, `packages/theme/**` |
| `pulse` | `apps/pulse` | product | `apps/pulse/**` |
| `rapport` | `apps/rapport` | product | `apps/rapport/**` |
| `reflect-site` | `apps/reflect-site` | marketing site | `apps/reflect-site/**` |
| `revise` | `apps/revise` | product | `apps/revise/**`, `packages/theme/**` |
| `revise-site` | `apps/revise-site` | marketing site | `apps/revise-site/**` |
| `rtk-site` | `apps/rtk-site` | marketing site | `apps/rtk-site/**` |

`apps/rtk` is explicitly marked as a non-deployable retired root in the map;
it is a Node CLI, not a Vercel project. The repository root is also marked
retired and its `vercel.json` fails fast if a dashboard project is still
pointed at `.`.

## Changed path → affected deployments

| Changed path | Projects that rebuild | Reason |
|---|---|---|
| `apps/<product>/**` | That product only | Root Directory ownership is exact. |
| `apps/<product>-site/**` | That marketing site only | Site HTML/assets are not product build inputs. |
| `apps/ecosystem-shell/**` | `ecosystem-shell` only | The shell owns its index, route manifest, redirects and rewrites. |
| `packages/theme/**` | `arise`, `daily-debate`, `emotion-tracker`, `food-shopping-os`, `french-practice`, `habit-tracker`, `mental-load-tracker`, `revise` | These eight apps vendor the canonical CSS through `scripts/sync-theme.sh`. |
| `packages/le-studio-tokens/**` | No Vercel project | Current Vercel builds do not import this package; `check-tokens.mjs` is CI-only. |
| An app-local `package-lock.json` | That app only | The app has its own Root Directory and install tree. |
| Root lockfile, Node/toolchain config, `config/**`, or root `vercel.json` | All active projects | Deliberately conservative: a root build/install/config change must not leave any project serving output built under stale shared assumptions. |
| `README.md`, `docs/**`, `wiki/**`, `output/**`, `raw/**`, registry metadata, workflows, tests, benchmarks, snapshots, or app `README.md` | None | These paths do not enter a Vercel runtime build. |
| `scripts/**`, `src/**`, `vendor/**`, `.claude-flow/**`, and other checked-in tooling/reference paths | None | They are explicitly non-runtime for the current Vercel roots. |
| An unknown `packages/**` path or an unmapped non-documentation runtime path | All active projects | Fail-open protection for a new shared/build input until the map is updated. |

The important negative cases are intentional: a change under `apps/arise`
does not rebuild `arise-site`, a change under `apps/arise-site` does not rebuild
`arise`, a change under `apps/pulse` does not rebuild `ecosystem-shell`, and a
test-only change does not fan out to the monorepo.

Deletion is treated as a runtime change for a currently mapped project, so
removing a source file cannot be hidden by the ignore command. A missing Git
ref, shallow checkout, or other diff failure also deploys rather than skips.

## Shared package evidence

The eight `packages/theme` consumers have a checked-in generated
`le-studio.css` next to the stylesheet that imports it. The copy/sync contract
is maintained by `scripts/sync-theme.sh`; the deployment map treats a source
theme change as affecting every vendored consumer, whether or not a developer
remembered to commit the generated copies.

`packages/le-studio-tokens` is a separate token/reference package. Its current
README shows direct relative imports for standalone consumers, but no active
Vercel app package imports it and the token checker reads the vendored French
copy. It therefore does not cause a product deployment today. If an app starts
importing it at build time, add that app to both `shared.le-studio-tokens.consumers`
and the app's `shared` list before relying on the optimization.

## Remote Vercel inventory and cleanup

A read-only Vercel team inventory on 2026-08-20 contained 30 projects. The
checked-in map covers the 18 current roots above; remote project names do not
all match repository app names because several were created from old
dashboard-generated `claude-code-*` names.

### Safe candidates to disable/remove after the normal custom-domain check

These have no current app root/registry entry or no current shell route:

- `ecosystem-shelll` — apparent typo duplicate of `ecosystem-shell`.
- `agent-control-os` — old Agent OS Control Room deployment; the app directory
  is deleted from current `main`.
- `claude-code-ycm7` and `claude-code-6wxe` — stale deployments associated with
  the deleted Agent OS work and currently failing; neither is in the registry
  or shell route table.
- `world-news` and `world-news-site` — both roots were deleted from current
  `main`; the stale registry/workflow/marketing links have been removed.
- `dictation-typer-site` — its product/site roots were deleted from current
  `main` and it has no registry entry.
- `meeting-recorder-site` — its product/site roots were deleted from current
  `main` and it has no registry entry.

“Safe” here means safe from the current repository dependency perspective. A
Vercel owner should still confirm there is no custom domain, production
traffic, or external webhook before deleting a remote project. This change
does not delete remote projects.

### Keep or migrate before disabling

The shell still points at these upstreams, so they are not safe to remove just
because their names look legacy:

- `claude-code-xuc7` → `/pulse`
- `arise-fitness` → `/arise` (also appears to be an external Arise source)
- `claude-code` → `/french`
- `forq-site` → `/forq`
- `claude-code-y8k6` → `/reflect`
- `claude-code-ybbm` → `/revise`
- `rapport` → `/rapport`

`claude-code-k33v` was present in the remote inventory but is not referenced by
the current registry or shell routes. Verify its domains/source before
retiring it; it is a cleanup candidate, not an automatically safe deletion.

The unrelated `henry-builds`, `paperclip-clone-xtfr`, `life-os`, and `dist`
projects are external/standalone inventory entries, not deployment consumers
of this monorepo.

## Rollout checklist

For every active Vercel project, confirm the dashboard Root Directory equals
the path in the table and that the project uses its checked-in `vercel.json`.
Then verify the first rollout commit: changing a `vercel.json` intentionally
causes the affected project to run its new evaluator; subsequent app-local
commits should only consume the matching rows above. Disable the safe stale
projects after confirming domains/traffic, and migrate shell upstream URLs
before touching any project in the keep/migrate list.
