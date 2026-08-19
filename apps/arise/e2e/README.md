# Arise E2E coverage

- **a11y**: axe-core check on Today, Train and Exercises
- **perf**: Lighthouse budgets (LCP < 2.5s, JS < 200kB)
- **data**: JSON export/import, schema migration and event-history restore
- **Pulse**: adapter push/pull smoke path via `runPulseIntegrationE2E()`
- **field**: real-gym checklist in [`REAL_GYM_FIELD_TESTS.md`](./REAL_GYM_FIELD_TESTS.md)

Run the deterministic checks with `npm test`, `npm run benchmark` and
`npm run benchmark:logging`. Run Playwright once the host app supplies a
browser runner.
