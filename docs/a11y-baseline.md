# Accessibility Baseline

Practical baseline for every app and every `-site` landing page. Automate what can reasonably be automated; do not claim automated checks prove full accessibility.

---

## 1. Must-have per page

| Requirement | How to check |
|-------------|--------------|
| **Skip link** `<a class="skip" href="#main">Skip to content</a>` with visible `:focus` state | Tab from address bar — first focus must be the skip link |
| **`lang="en-GB"` on `<html>`** | View source |
| **`theme-color` meta** for light/dark | View source |
| **`<title>` ≤60 chars + `<meta name="description">`** on every site/app | View source; `node scripts/check-links.mjs` checks link integrity |
| **Focus ring** via `a:focus-visible` or theme ring tokens | Tab through — every interactive element has a visible ring |
| **`prefers-reduced-motion`** respected | Emulate in DevTools |
| **Landmarks**: `<header>`, `<main id="main">`, `<nav>`, `<footer>` | axe-core / Lighthouse |

## 2. Must-have per component

| Pattern | Baseline |
|---------|----------|
| **Keyboard** | All primary actions reachable by Tab; no keyboard trap; `Esc` dismisses dialogs/menus |
| **Focus** | Focus moves to dialog when opened, returns to trigger when closed; dialogs use `role=dialog aria-modal="true"` |
| **Labels** | Every input has a label or `aria-label`; icon-only buttons have `aria-label`; decorative images `alt="" aria-hidden="true"` |
| **Semantic structure** | Headings without skips; lists are lists; buttons are `<button>` not clickable `<div>`s |
| **Dialogs** | `role=dialog`, `aria-modal`, labelled via `aria-labelledby`, backdrop click + `Esc` to close |
| **Contrast** | WCAG AA: 4.5:1 normal text, 3:1 large text/controls |
| **Touch targets** | ≥44×44px (or ≥24×24px with adequate spacing) |
| **Live regions** | Announce updates without flooding; keep announcements atomic, avoid nested live regions (enforced by Forq's invariants test) |

## 3. Per-app notes

| App | Key surfaces to check |
|-----|-----------------------|
| Arise | dialog semantics on SessionRunner, labelled reps inputs, live status counts, nav `aria-current` |
| Revise / Forq / Pulse | labelled selects/sorts, hidden decorative icons, `role=alert` for rate-limit/error messages |
| Daily Debate / Reflect | focus management in debate/reflection rooms |
| Noticed | realtime item list announces new items politely without flooding |
| Le Studio French | PWA routes maintain heading hierarchy; arena controls labelled |

## 4. Automation (what CI can do)

- **`jsx-a11y` via `eslint-config-next`**: lint must be clean. Catches missing `alt`, bad `aria-*`, label mismatches.
- **`axe-core`** where installed: run accessibility checks in Playwright on each route (Revise has the pattern).
- **Invariant tests**: Forq's `tests/invariants.test.js` enforces structural rules (atomic live regions).

**Manual remains mandatory**: Tab through each site + one app flow with VoiceOver/NVDA. No automated run can claim conformance.

## 5. Verification

```bash
npm --prefix apps/<app> run lint          # jsx-a11y
npm --prefix apps/<app> run test:e2e      # axe where configured
# Manual: keyboard-only pass, screen-reader spot check, 200% zoom, reduced motion
```

Reference: `docs/a11y.md` remains the detailed Le Studio family checklist; this document is the repo-wide baseline.
