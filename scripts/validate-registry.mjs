#!/usr/bin/env node
// Validates apps/registry.json against the filesystem and against docs/README drift.
// Exit 1 on any violation so CI can gate on it. No dependencies.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "apps/registry.json");
const readmePath = path.join(root, "README.md");

function fail(msg) {
  console.error(`validate-registry: ${msg}`);
  process.exitCode = 1;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(`cannot read/parse ${path.relative(root, p)}: ${e.message}`);
    return null;
  }
}

const reg = readJson(registryPath);
if (!reg) process.exit(1);

const validStates = new Set(Object.keys(reg.lifecycleStates ?? {}));
const seenIds = new Set();
const seenPaths = new Set();
let errors = 0;

function checkEntry(e, i, section) {
  const loc = `${section}[${i}] id=${e.id ?? "?"}`;
  if (!e.id) { fail(`${loc}: missing id`); errors++; return; }
  if (seenIds.has(e.id)) { fail(`${loc}: duplicate id '${e.id}'`); errors++; }
  seenIds.add(e.id);
  if (!e.name) { fail(`${loc} (${e.id}): missing name`); errors++; }
  if (!e.lifecycle) { fail(`${loc} (${e.id}): missing lifecycle`); errors++; }
  else if (!validStates.has(e.lifecycle)) { fail(`${loc} (${e.id}): unknown lifecycle '${e.lifecycle}' (expected one of ${[...validStates].join(", ")})`); errors++; }
  if (!e.path) { fail(`${loc} (${e.id}): missing path`); errors++; }
  else {
    const abs = path.join(root, e.path);
    if (!fs.existsSync(abs)) { fail(`${loc} (${e.id}): path does not exist: ${e.path}`); errors++; }
    if (seenPaths.has(e.path)) { fail(`${loc} (${e.id}): duplicate path '${e.path}'`); errors++; }
    seenPaths.add(e.path);
  }
  if (e.site) {
    const sAbs = path.join(root, e.site);
    if (!fs.existsSync(sAbs)) { fail(`${loc} (${e.id}): site path does not exist: ${e.site}`); errors++; }
  }
  if (e.lifecycle === "archived" || e.lifecycle === "superseded") {
    if (!e.description || !/frozen|superseded|provenance|mirror|reference/i.test(e.description)) {
      // soft warning, not hard fail
      console.warn(`validate-registry: ${loc} (${e.id}): archived/superseded entries should note provenance in description`);
    }
  }
}

for (let i = 0; i < (reg.apps ?? []).length; i++) checkEntry(reg.apps[i], i, "apps");
for (let i = 0; i < (reg.auxiliary ?? []).length; i++) checkEntry(reg.auxiliary[i], i, "auxiliary");
for (let i = 0; i < (reg.external ?? []).length; i++) {
  const e = reg.external[i];
  const loc = `external[${i}] id=${e.id ?? "?"}`;
  if (!e.id) { fail(`${loc}: missing id`); errors++; continue; }
  if (seenIds.has(e.id)) { fail(`${loc}: duplicate id '${e.id}' (collides with apps/auxiliary)`); errors++; }
  seenIds.add(e.id);
  if (!e.lifecycle) { fail(`${loc}: missing lifecycle`); errors++; }
}

const entries = [...(reg.apps ?? []), ...(reg.auxiliary ?? []), ...(reg.external ?? [])];

// Filesystem drift: every directory directly under apps/ that is not *-site and not in registry
let appDirs = [];
try { appDirs = fs.readdirSync(path.join(root, "apps"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
const siteSuffix = name => name.endsWith("-site");
const expectedAppDirs = new Set([...(reg.apps ?? []), ...(reg.auxiliary ?? [])].filter(e => e.path.startsWith("apps/")).map(e => e.path.split("/")[1]));
for (const dir of appDirs) {
  if (siteSuffix(dir)) continue;
  if (dir === "__snapshots__" || dir === "__mocks__") continue;
  if (!expectedAppDirs.has(dir)) { fail(`apps/${dir} exists on disk but is not in apps/registry.json`); errors++; }
}

// README drift: every active product app in registry should appear in README
let readme = "";
try { readme = fs.readFileSync(readmePath, "utf8"); } catch {}
const activeAppIds = (reg.apps ?? []).filter(a => a.lifecycle === "active" && a.kind === "product").map(a => a.id);
// also include non-site auxiliary marked active but product-like (agent-os-control-room was the offence)
const activeAuxProductLike = (reg.auxiliary ?? []).filter(a => a.lifecycle === "active" && a.path.startsWith("apps/") && !a.path.includes("packages") && a.kind !== "tooling");
for (const extra of activeAuxProductLike) if (!activeAppIds.includes(extra.id)) activeAppIds.push(extra.id);

const readmeLower = readme.toLowerCase();
for (const id of activeAppIds) {
  const regEntry = entries.find(e => e.id === id);
  const needle = regEntry?.path.toLowerCase() ?? `apps/${id}`;
  if (!readmeLower.includes(needle) && !readmeLower.includes(id.toLowerCase())) {
    fail(`active app '${id}' (${regEntry?.path ?? ""}) is not mentioned in README.md — add it to the Apps table (source of truth: apps/registry.json)`);
    errors++;
  }
}

if (errors === 0) console.log(`validate-registry: OK — ${reg.apps.length} apps, ${reg.auxiliary.length} auxiliary, ${reg.external.length} external`);
else console.error(`validate-registry: ${errors} error(s)`);
process.exitCode = errors > 0 ? 1 : 0;
