# CI Coverage Audit — generated 2026-08-21

Generated from `.github/workflows/*.yml` and `apps/registry.json`. Items marked **[NEW]** were added in the engineering-standards pass.

| App | Workflow | install | lint | type-check | unit tests | integration | build | E2E (hard-fail) | security | performance | deployment |
|-----|----------|---------|------|------------|------------|-------------|-------|-----------------|----------|-------------|------------|
| **Arise** | `arise.yml` | ✅ | ✅ `lint:content` | ✅ `tsc --noEmit` | ✅ `node --test` + benchmarks | — (local-first) | ✅ | — (SPA; size check) | — | ✅ size check | Vercel |
| **Daily Debate** | `daily-debate.yml` | ✅ | ✅ lint | ✅ type-check | ✅ vitest (+ graph validation, reliability suites) | ◐ | ✅ | ✅ Playwright specs landed (solo/pvp/source) | rate limit + RLS + source-fetch guards | ✅ budget 16 MB | Vercel |
| **Reflect** (emotion-tracker) | `emotion-tracker.yml` | ✅ | ✅ lint | ✅ type-check | ✅ vitest (+ output validation, human review, privacy audit) | — | ✅ | e2e specs present | hedged-output gates + rate limit | ✅ budget 16 MB | Vercel |
| **Forq** (food-shopping-os) | `food-shopping-os.yml` | ✅ | — (no eslint config yet) | — | ✅ vitest (~90 files) | ✅ cloud-data + migration-runner (required check) | ✅ | ✅ Playwright chromium+mobile, hard-fail | ✅ npm audit advisory + invariants | ✅ 16 MB | Vercel |
| **Le Studio French** | `french-practice.yml` | ✅ | content/type safety via app scripts | ✅ type-check | ✅ node --test + relay tests | ✅ relay suite | ✅ | E2E landed with relay work | relay auth/quota/validation | ✅ budget 3 MB | Vercel |
| **Habit** | `habit-tracker.yml` | ✅ | ✅ lint | ✅ tsc --noEmit | ✅ vitest (+ RLS, security, storage, streak correctness) | ✅ security.integration | ✅ | Playwright spec landed | RLS isolation migration + tests | ✅ budget 12 MB | Vercel |
| **Noticed** (mental-load) | **[NEW]** `mental-load-tracker.yml` | ✅ | ✅ lint | ✅ type-check | ✅ test:app | ✅ test:security | ✅ build | playwright.config present (wire when stable) | RLS + token-hash + RPC (audited) | ✅ budget 12 MB | Vercel |
| **Pulse** | `pulse.yml` | ✅ | ✅ | ✅ | ✅ vitest | ✅ ecosystem contracts | ✅ | ✅ hard-fail | — | ✅ 5 MB | Vercel |
| **Rapport** | `rapport.yml` | ✅ | ✅ | ✅ + content validation | ✅ vitest | ✅ pulse-history | ✅ | ✅ chromium+mobile hard-fail | safety gates | ✅ 16 MB | Vercel |
| **Revise** | `revise.yml` | ✅ | ✅ | ✅ + curriculum validator | ✅ 14 suites / 245 tests | ✅ content-schema + ai contracts (required check) | ✅ | ✅ chromium hard-fail | security.test.ts + RLS | ✅ 16 MB | Vercel |
| **RTK** | `rtk.yml` | ✅ | — | ✅ | ✅ matrix 18/20/22 + benchmarks | — | pack dry-run | — (CLI) | — | benchmarks | npm publish on release commit |
| **Ecosystem Shell** | `ecosystem.yml` | — | — | — | — | ✅ smoke + collision tests | — | — | — | — | Vercel rewrites |

### Repo-wide workflows

| Workflow | Covers | Required? |
|----------|--------|-----------|
| `engineering.yml` | repository-gates (smoke, CODEOWNERS, deploy config, deployment smoke, hard-fail policy, ecosystem smoke, rollback/collision, perf config, **[NEW]** static security audit) + integration-contracts (revise AI/content, forq cloud/migrations) | **YES** — three required checks on main |
| `deploy-config.yml` | vercel.json contract, registry validation, theme sync, tokens | Path-filtered; already inside repository-gates |
| `ecosystem.yml` | Shell + five app contracts | Path-filtered |
| **[NEW]** `security.yml` | Static security audit + weekly prod-only npm audit triage + CodeQL | Weekly + on lockfile changes |

### Gaps closed in this pass

1. Noticed had no CI → new workflow.
2. Lint/type-check added to daily-debate, emotion-tracker, french-practice, habit-tracker workflows.
3. Performance budgets 4 → 10 apps.
4. Dependency security: weekly prod-only triage + CodeQL + Dependabot per app.
5. Registry lists a workflow for every product.

### Remaining gaps (intentional)

| App | Gap | Why not yet a gate |
|-----|-----|--------------------|
| Forq | `lint` step | No ESLint config exists yet |
| Noticed | E2E in workflow | Needs Supabase auth fixture harness first |
| All | Prod-only audit as blocking gate | Advisory triage avoids CI unusable on dev-only warnings |

Rule: one product = one workflow (extend it, don't duplicate); repo-wide gates live only in `engineering.yml`/`security.yml`; budgets live only in `performance-budgets.json`.
