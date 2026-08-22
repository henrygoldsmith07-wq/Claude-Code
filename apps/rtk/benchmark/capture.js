'use strict';

/**
 * benchmark/capture.js — live corpus capture of GENUINE tool output.
 *
 * Expands benchmark/corpus/ toward hundreds/thousands of real captures with
 * per-item provenance. Categories stay strictly separated:
 *   synthetic / adversarial logs are never overwritten by this tool;
 *   captured-real logs are named <tool>-<scenario>.log and only rewritten
 *   with --force.
 *
 * Flags:
 *   --list           print catalog + availability matrix (no writes)
 *   --summary        counts grouped by category/tool from manifest (no mutation)
 *   --only=<substr>  substring filter on tool
 *   --scenario=<n>   exact scenario filter
 *   --dry-run        show planned writes without touching disk
 *   --force          allow overwrite of previously captured-real logs
 *   --out <dir>      corpus directory (default benchmark/corpus)
 *
 * Ingest mode — contribute an EXISTING log file from anywhere (no tool needed
 * locally); the log is copied into the corpus as captured-real with full
 * provenance and nothing is computed from live runs:
 *   --ingest <file>  path to the log file to ingest
 *   --tool <name>    required with --ingest; plain tool-family token
 *   --scenario <n>   optional with --ingest (default 'contributed')
 *   --note <text>    optional provenance note recorded verbatim
 * Duplicate content (same sha256 already in the manifest) is refused unless
 * --force is given.
 *
 * Catalog families: package managers + test runners (npm, pnpm, bun, pytest,
 * vitest, jest, playwright), CI/infra emulation (act, docker, kubectl,
 * terraform), language toolchains (cargo+clippy, go, maven, gradle, tsc,
 * gcc, cc, javac), linters/type-checkers (eslint, ruff, mypy, shellcheck,
 * pylint, flake8, pyright), cloud CLIs (aws, gcloud, az) and database
 * migrations (prisma, knex, alembic, flyway). Every scenario is offline-safe
 * and hermetic: it runs in a fresh temp cwd over generated fixtures.
 *
 * Exit code is 0 even when tools are unavailable — they are reported+skipped.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const lib = require('./capture-lib');

const DEFAULT_OUT = path.join(__dirname, 'corpus');
const MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;

function parseArgs(argv) {
  const flags = {
    list: false, summary: false, dryRun: false, force: false,
    only: null, scenario: null, out: DEFAULT_OUT,
    ingest: null, tool: null, note: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') flags.list = true;
    else if (a === '--summary') flags.summary = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--force') flags.force = true;
    else if (a.startsWith('--only=')) flags.only = a.slice('--only='.length) || null;
    else if (a.startsWith('--scenario=')) flags.scenario = a.slice('--scenario='.length) || null;
    else if (a === '--scenario') { i += 1; flags.scenario = argv[i] || null; }
    else if (a === '--out') { i += 1; flags.out = argv[i] || DEFAULT_OUT; }
    else if (a.startsWith('--out=')) flags.out = a.slice('--out='.length) || DEFAULT_OUT;
    else if (a === '--ingest') { i += 1; flags.ingest = argv[i] || null; }
    else if (a.startsWith('--ingest=')) flags.ingest = a.slice('--ingest='.length) || null;
    else if (a === '--tool') { i += 1; flags.tool = argv[i] || null; }
    else if (a.startsWith('--tool=')) flags.tool = a.slice('--tool='.length) || null;
    else if (a === '--note') { i += 1; flags.note = argv[i] || null; }
    else if (a.startsWith('--note=')) flags.note = a.slice('--note='.length) || null;
    else throw new Error(`unknown flag: ${a}`);
  }
  return flags;
}

// On Windows most CLIs ship as .cmd/.exe shims that spawnSync cannot resolve
// without a shell; probe candidate names and remember the one that works.
function binCandidates(bin) {
  return process.platform === 'win32' ? [`${bin}.cmd`, `${bin}.exe`, bin] : [bin];
}

function probe(entry, extraPath) {
  const env = { ...process.env, ...(entry.env || {}) };
  if (extraPath) env.PATH = `${extraPath}${path.delimiter}${env.PATH || ''}`;
  for (const bin of binCandidates(entry.tool)) {
    const res = cp.spawnSync(bin, entry.requires, {
      encoding: 'utf8', timeout: DEFAULT_TIMEOUT_MS, windowsHide: true, shell: process.platform === 'win32', env,
    });
    if (!res.error && res.status === 0) return { available: true, bin };
  }
  return { available: false, reason: `not found via ${entry.requires.join(' ')}` };
}

function filteredCatalog(flags) {
  return lib.CATALOG.filter((e) =>
    (!flags.only || e.tool.includes(flags.only)) &&
    (!flags.scenario || e.scenario === flags.scenario));
}

function printList(flags) {
  const entries = filteredCatalog(flags);
  console.log(`catalog: ${entries.length} scenario(s), ${new Set(entries.map((e) => e.tool)).size} tool(s)\n`);
  const rows = [];
  let lastTool = null;
  for (const e of entries) {
    const avail = probe(e);
    rows.push(`${e.tool === lastTool ? '' : e.tool}\t${e.scenario}\t[${e.requires.join(' ')}]\t${avail.available ? 'available' : 'UNAVAILABLE'}`);
    lastTool = e.tool;
  }
  const width = Math.max(...rows.map((r) => r.split('\t')[0].length)) + 2;
  for (const r of rows) {
    const [tool, scen, req, state] = r.split('\t');
    console.log(`${(tool || '').padEnd(width)}${scen.padEnd(14)}${req.padEnd(24)}${state}`);
  }
  console.log('\nunavailable tools are skipped during capture (exit code stays 0)');
}

function loadManifest(outDir) {
  const file = path.join(outDir, 'manifest.json');
  if (!fs.existsSync(file)) return { generatedAt: null, count: 0, files: [] };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.files)) {
    throw new Error(`manifest at ${file} has no files array`);
  }
  return parsed;
}

function printSummary(flags) {
  const m = loadManifest(flags.out);
  const s = lib.summarizeManifest(m.files);
  console.log(`manifest: ${m.files.length ? path.join(flags.out, 'manifest.json') : '(no manifest yet)'}`);
  console.log(`total: ${s.total}`);
  console.log('by category:');
  for (const [cat, n] of Object.entries(s.byCategory).sort((a, b) => b[1] - a[1])) console.log(`  ${cat}: ${n}`);
  console.log('by tool:');
  for (const [tool, n] of Object.entries(s.byTool).sort((a, b) => b[1] - a[1])) console.log(`  ${tool}: ${n}`);
}

// Decide the on-disk filename, preserving strict category separation:
// existing non-captured-real files are never clobbered — fall back to -live.
function planFilename(outDir, entry, manifestFiles) {
  const base = lib.logFilename(entry.tool, entry.scenario);
  const full = path.join(outDir, base);
  if (!fs.existsSync(full)) return { file: base, overwrite: false };
  const prior = manifestFiles.find((f) => f.file === base);
  if (prior && (prior.category === lib.CATEGORY_CAPTURED_REAL || prior.provenance === lib.CATEGORY_CAPTURED_REAL)) {
    return { file: base, overwrite: true };
  }
  const alt = lib.logFilename(`${entry.tool}-${entry.scenario}`, 'live');
  return { file: alt, overwrite: false };
}

function captureOne(entry, tmpRoot, flags, manifestFiles) {
  const plan = planFilename(flags.out, entry, manifestFiles);
  if (plan.overwrite && !flags.force) {
    return { skipped: true, reason: `${plan.file} already captured-real (use --force to overwrite)` };
  }
  const cwd = fs.mkdtempSync(path.join(tmpRoot, `${lib.sanitizeName(entry.tool)}-`));
  try {
    for (const [rel, content] of Object.entries(entry.setup || {})) {
      const target = path.join(cwd, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    const res = cp.spawnSync(entry.bin, entry.argv, {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      cwd,
      timeout: entry.timeoutMs || DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      shell: process.platform === 'win32',
      env: { ...process.env, NO_COLOR: '1', CI: '1', ...(entry.env || {}) },
    });
    const content = `${res.stdout || ''}\n${res.stderr || ''}`;
    const bytes = Buffer.byteLength(content, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const host = lib.buildHostInfo();
    return {
      skipped: false,
      plannedFile: plan.file,
      replacePrior: plan.overwrite,
      result: {
        content,
        entry: lib.buildEntry({
          file: plan.file,
          tool: entry.tool,
          scenario: entry.scenario,
          command: [entry.bin, ...entry.argv].join(' '),
          exitCode: typeof res.status === 'number' ? res.status : -1,
          bytes,
          sha256,
          capturedAt: new Date().toISOString(),
          host,
        }),
      },
    };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

function runCapture(flags) {
  fs.mkdirSync(flags.out, { recursive: true });
  const manifest = loadManifest(flags.out);
  const entries = filteredCatalog(flags);
  let probed = 0;
  let captured = 0;
  let skippedUnavailable = 0;
  let skippedExisting = 0;
  const newEntries = [];
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-capture-'));
  try {
    for (const entry of entries) {
      if (!entry.bin) {
        Object.assign(entry, probe(entry));
        probed += 1;
      }
      if (!entry.available) {
        skippedUnavailable += 1;
        console.log(`skip ${entry.tool}/${entry.scenario}: ${entry.reason || 'unavailable'}`);
        continue;
      }
      if (flags.dryRun) {
        const plan = planFilename(flags.out, entry, manifest.files);
        console.log(`would write ${path.join(flags.out, plan.file)} <- ${[entry.bin, ...entry.argv].join(' ')}`);
        continue;
      }
      const outcome = captureOne(entry, tmpRoot, flags, manifest.files);
      if (outcome.skipped) {
        skippedExisting += 1;
        console.log(`skip ${entry.tool}/${entry.scenario}: ${outcome.reason}`);
        continue;
      }
      fs.writeFileSync(path.join(flags.out, outcome.plannedFile), outcome.result.content);
      newEntries.push(outcome.result.entry);
      captured += 1;
      console.log(`captured ${entry.tool}/${entry.scenario} -> ${outcome.plannedFile} (${outcome.result.entry.bytes}B, exit ${outcome.result.entry.exitCode})`);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  let merged = null;
  if (!flags.dryRun && newEntries.length) {
    const { result } = lib.mergeManifest(manifest, newEntries);
    fs.writeFileSync(path.join(flags.out, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`);
    merged = result.count;
  }

  console.log(`\ncapture done: ${captured} captured, ${skippedUnavailable} unavailable, ${skippedExisting} skipped-existing, ${probed} probed${merged != null ? `, manifest now ${merged} entries` : ''}`);
}

// Ingest an EXISTING log file as contributed real output. No tool is spawned;
// provenance is computed purely from the contributed bytes (sha256 + size).
function runIngest(flags) {
  if (!flags.tool) throw new Error('--ingest requires --tool <name>');
  if (!/^[A-Za-z][A-Za-z0-9._+-]*$/.test(flags.tool)) {
    throw new Error(`--tool must be a plain tool-family token: ${flags.tool}`);
  }
  const scenario = flags.scenario || 'contributed';
  if (!lib.SCENARIO_RE.test(scenario)) throw new Error(`bad --scenario: ${scenario}`);

  const srcPath = path.resolve(flags.ingest);
  let content;
  try {
    content = fs.readFileSync(srcPath);
  } catch (e) {
    throw new Error(`cannot read ingest file ${flags.ingest}: ${e.message}`);
  }
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const bytes = content.byteLength;

  fs.mkdirSync(flags.out, { recursive: true });
  const manifest = loadManifest(flags.out);

  const priorSameSha = manifest.files.find((f) => f && f.sha256 === sha256);
  if (priorSameSha && !flags.force) {
    console.error(`refusing duplicate content: sha256 ${sha256} already present as ${priorSameSha.file || '(unknown entry)'} (use --force to ingest anyway)`);
    return 1;
  }
  const plan = planFilename(flags.out, { tool: flags.tool, scenario }, manifest.files);
  if (plan.overwrite && !flags.force) {
    console.error(`refusing overwrite of captured-real log ${plan.file} (use --force)`);
    return 1;
  }

  fs.writeFileSync(path.join(flags.out, plan.file), content);
  const entry = lib.buildIngestEntry({
    file: plan.file,
    tool: flags.tool,
    scenario,
    capturedAt: new Date().toISOString(),
    bytes,
    sha256,
    host: lib.buildHostInfo(),
    note: flags.note,
  });
  const { result, appended, replaced } = lib.mergeManifest(manifest, [entry]);
  fs.writeFileSync(path.join(flags.out, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`ingested ${srcPath} -> ${path.join(flags.out, plan.file)} (${bytes}B, sha256 ${sha256.slice(0, 12)}...)`);
  console.log(`manifest now ${result.count} entries (${appended.length} appended${replaced.length ? `, ${replaced.length} superseded` : ''})`);
  return 0;
}

function main(argv) {
  let flags;
  try {
    flags = parseArgs(argv);
  } catch (e) {
    console.error(String(e.message));
    return 2;
  }
  try {
    if (flags.list) { printList(flags); return 0; }
    if (flags.summary) { printSummary(flags); return 0; }
    if (flags.ingest) return runIngest(flags);
    runCapture(flags);
    return 0;
  } catch (e) {
    console.error(`capture failed: ${e.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv));
}
module.exports = { parseArgs, probe, planFilename, runCapture, runIngest, main };
