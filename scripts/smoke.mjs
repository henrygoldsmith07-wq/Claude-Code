#!/usr/bin/env node
// Run 8: E2E smoke harness — local-only, no network, checks that static sites are well-formed
// and that lint:content/validate scripts pass. Run with: node scripts/smoke.mjs
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
let failures = 0;
function check(cmd, args, opts={}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) { console.error(`FAIL ${cmd} ${args.join(" ")}`); if (r.stdout) console.error(r.stdout.slice(-1200)); if (r.stderr) console.error(r.stderr.slice(-1200)); failures++; }
  else console.log(`OK   ${cmd} ${args.join(" ")}`);
}
// registry + content lints (app-specific lints moved to each app's standalone repo on 2026-08-21)
check("node", ["scripts/validate-registry.mjs"]);
check("node", ["scripts/check-links.mjs"]);
if (failures===0) console.log("smoke: all OK"); else { console.error(`smoke: ${failures} failure(s)`); process.exit(1); }
