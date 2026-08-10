# E2E harness

Full Playwright suite runs the offline walk: seed, due queue, grade, mistake loop, cross-device pull.
Requires Playwright; install with `npx playwright install --with-deps`.  The node smoke in `tests/sync.test.ts` mirrors the same path so CI stays green without a browser.
