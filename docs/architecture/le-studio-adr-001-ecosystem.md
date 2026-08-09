# ADR-001 — Le Studio product family

**Date:** 2026-07-30  
**Status:** Accepted  

## Context

Three products share a design language and optional interop:

| Product | Path | Runtime |
|---------|------|---------|
| Le Studio French | `apps/french-practice` | Vite + React, local-first |
| Le Studio hub | `apps/le-studio-site` | Static HTML |
| Forq | `apps/food-shopping-os` | Next.js, local-first + optional cloud |
| Chrono | `henrygoldsmith07-wq/chrono-calendar` (standalone) | Vanilla HTML/JS |

## Decisions

1. **Federated products, shared kit** — no super-app merge.
2. **Brand umbrella:** Le Studio; product titles remain French / Chrono / Forq.
3. **Tokens package:** `packages/le-studio-tokens` (`@le-studio/tokens`).
4. **Interop:** open formats first (ICS, JSON). Forq meal plans export ICS; Chrono imports ICS.
5. **Identity:** optional; French and Chrono cores never require accounts.
6. **Honesty:** capability claims must match runtime (Forq register remains canonical for food/health).

## Consequences

- Design changes start in `@le-studio/tokens` (and existing `le-studio.css` sync for Tailwind apps).
- Chrono may stay standalone; consumes token CSS copy or monorepo path later.
- Cross-product features ship as export/import, never silent storage sharing.
