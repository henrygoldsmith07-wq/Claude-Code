# Definition of Done — Claude-Code Monorepo

Applies to every **user-facing product** (`kind: product` and lifecycle `active` or `incubating` in `apps/registry.json`).  
Supporting sites (`kind: site`), tooling, and archived references are explicitly out of scope — their gates are lighter by design.

---

## 1. Minimum gates for any product

A change to a product is not done until **all** of the following pass on a clean checkout (no cached `node_modules`) in CI or locally with `npm ci`:

| Gate | Command (representative) | Required when |
|------|--------------------------|---------------|
| **install succeeds** | `npm ci` | Always. Lockfile must be committed and reproducible. |
| **lint where configured** | `npm run lint` / `lint:check` / `lint:content` | If the app has an ESLint or content-lint config. Missing config is itself a gap to close. |
| **type-check where applicable** | `npm run type-check` or `tsc --noEmit` | If the app is TypeScript. Pure JS apps must state why they opted out. |
| **unit tests** | `npm test` | Always. At least one suite that exercises domain logic, not just smoke. |
| **integration tests** | `npm test -- --run <integration>` or `node --test tests/*.mjs` | When the app has a database, external integration, or migration runner. Must cover the integration boundary, not just mocks. |
| **production build** | `npm run build` | Always. Must complete with zero warnings that hide failures. |

**Failure of any required gate blocks merge.** `continue-on-error: true` is forbidden for these steps (advisory audits are a separate job).

---

## 2. Additional gates by app shape

### 2a. Meaningful web applications → browser E2E

Any app where the user does primary work in the browser (Revise, Rapport, Forq, Pulse) **must** have a hard-fail Playwright suite:

- Runs on `chromium` at minimum (plus `mobile-chrome` where touch targets matter).
- Installed with `npx playwright install --with-deps chromium` inside the job — no pre-cached bureau.
- Fails the workflow on any test failure (`continue-on-error` forbidden; checked by `scripts/check-hard-fail-e2e.mjs`).
- Uploads `playwright-report` / `test-results` on failure for post-mortem.

Static Vite SPAs with no critical multi-step flow (Arise, Le Studio French content) may satisfy this with component-level tests plus a size check instead — document the rationale in the app README.

### 2b. Apps with provider/AI → security + AI standard

In addition to §1, AI-enabled products must satisfy the [AI Engineering Standard](./ai-standard.md) pipeline (input validation → structured schema → schema validation → deterministic validation → confidence → provenance → user output) and [Security Standard](./security-standard.md) (secrets, rate limiting, RLS, external URL validation).

### 2c. Apps with a database → migration quality

See [Migration & Backup Quality](./migration-backup.md): migrations must be re-runnable, RLS must be re-verified after migration, and a backup/export path must be documented.

---

## 3. Security, performance, accessibility expectations

| Concern | Baseline | Automation |
|---------|----------|------------|
| **Security** | Auth, authorisation, RLS, tenancy, secrets handling, SSRF, rate limiting, deletion/exports, logs — see [Security Standard](./security-standard.md) | `npm audit --audit-level=high` advisory per app; repository `security.yml` weekly; static `scripts/security-audit.mjs`; no high-severity prod vulnerability ships without triage. |
| **Performance** | Budgets defined in `scripts/performance-budgets.json` for every substantial app. See [Performance](./perf-budgets.md). | `scripts/check-performance-budgets.mjs --require-builds` in each product workflow. |
| **Accessibility** | Baseline in [Accessibility](./a11y-baseline.md): keyboard, focus, labels, semantic structure, dialogs, contrast, 44px touch targets. | ESLint `jsx-a11y` (via `eslint-config-next`) + `axe-core` in E2E where installed. Automated checks do **not** prove full accessibility. |
| **Observability** | Privacy-safe telemetry for errors, API failures, provider failures — see [Observability](./observability.md) and [`packages/observability`](../packages/observability/). No sensitive user content logged. | Structured JSON log lines with `AI_LOG=1` or central `record()` API. |

---

## 4. Evidence honesty

A product is **implemented** the moment its code exists. It is **proven effective** only when a registry entry in `evidence/registry.json` reaches `demonstrated` or `externally validated` with a cited source, sample size, and benchmark date.

Never upgrade a claim because test count increased. Tests prove the code runs; they do not prove users benefit.

See [Evidence Registry](./evidence-registry.md) and [Validation State](./validation-state.md).

---

## 5. How this document is enforced

- `scripts/engineering-gates.mjs` runs repo-wide gates on every PR (unfiltered — safe to require in branch protection).
- `scripts/check-hard-fail-e2e.mjs` fails if any required E2E job is advisory.
- `scripts/check-performance-budgets.mjs` fails if any budget is exceeded.
- Each product workflow in `.github/workflows/<app>.yml` encodes that app's DoD subset. The audit table in [CI Coverage Audit](./ci-coverage-audit.md) is the live map of which gate runs where — gaps there are treated as work, not documentation debt.

### Adding a new product

1. Add an entry to `apps/registry.json` (validated by `scripts/validate-registry.mjs`).
2. Add `.github/workflows/<id>.yml` with at least the §1 gates, plus §2a/§2b/§2c as they apply.
3. Add a performance budget entry when the first production build exists.
4. Add an evidence registry stub for any product claim that will later be evaluated.
5. Document backup/export if the app is database-backed.
