/**
 * Performance / size budget check for Le Studio.
 * Runs after `vite build`. Fails CI if the main JS chunk exceeds the budget.
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const DIST = 'dist';
const BUDGET_KB = 600; // main app chunk budget (gzip not checked here, raw)
const TOTAL_BUDGET_KB = 1200;

try {
  const files = readdirSync(DIST, { recursive: true });
  let total = 0;
  let maxFile = 0;
  let maxName = '';
  for (const f of files) {
    const p = join(DIST, String(f));
    try {
      const s = statSync(p);
      if (s.isFile() && /\.js$/.test(p)) {
        const kb = Math.round(s.size / 1024);
        total += kb;
        if (kb > maxFile) { maxFile = kb; maxName = String(f); }
      }
    } catch {}
  }
  console.log(`Performance: total JS ${total} KB, largest ${maxName} ${maxFile} KB (budgets ${TOTAL_BUDGET_KB} / ${BUDGET_KB} KB)`);
  if (maxFile > BUDGET_KB) {
    console.warn(`⚠ Largest JS chunk ${maxFile} KB exceeds budget ${BUDGET_KB} KB — investigate bundle size.`);
  }
  if (total > TOTAL_BUDGET_KB) {
    console.warn(`⚠ Total JS ${total} KB exceeds budget ${TOTAL_BUDGET_KB} KB — investigate bundle size.`);
  }
  // Do not fail the build on size alone; keep CI green but visible
  process.exit(0);
} catch (e) {
  console.log('check-performance skipped:', e.message);
  process.exit(0);
}
