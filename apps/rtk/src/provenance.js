'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function safeExec(cmd, cwd) {
  try { return execSync(cmd, { encoding: 'utf8', cwd, stdio: ['ignore','pipe','ignore'] }).trim(); } catch { return 'unknown'; }
}

function getRtkCommit(cwd) {
  const dir = cwd || path.join(__dirname, '..');
  return safeExec('git rev-parse HEAD', dir);
}

function getRtkShortCommit(cwd) {
  const dir = cwd || path.join(__dirname, '..');
  return safeExec('git rev-parse --short HEAD', dir);
}

function getBenchmarkVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || 'unknown';
  } catch { return 'unknown'; }
}

function getCorpusVersion() {
  // Hash of corpus dir contents as version proxy
  try {
    const dir = path.join(__dirname, '..', 'benchmark', 'corpus');
    if (!fs.existsSync(dir)) return 'empty-0';
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.')).sort();
    let hash = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f));
      hash = (hash * 31 + stat.size + f.length) >>> 0;
    }
    return `corpus-${files.length}-${hash.toString(16)}`;
  } catch { return 'unknown'; }
}

function getEnvironment() {
  return {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    osRelease: os.release(),
    osType: os.type(),
    cpus: os.cpus().length,
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    shell: process.env.SHELL || process.env.ComSpec || 'unknown',
    ci: !!(process.env.CI || process.env.GITHUB_ACTIONS),
  };
}

function collectProvenance(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const rtkCommit = getRtkCommit(path.join(__dirname, '..','..','..'));
  // fallback to local rtk dir
  const rtkCommitLocal = rtkCommit === 'unknown' ? safeExec('git rev-parse HEAD', path.join(__dirname,'..')) : rtkCommit;
  return {
    rtkCommit: rtkCommitLocal,
    rtkShortCommit: rtkCommitLocal !== 'unknown' ? rtkCommitLocal.slice(0,7) : 'unknown',
    benchmarkVersion: getBenchmarkVersion(),
    corpusVersion: getCorpusVersion(),
    repositoryCommit: safeExec('git rev-parse HEAD', cwd),
    taskId: opts.taskId || null,
    model: opts.model || null,
    modelSettings: opts.modelSettings || null,
    environment: getEnvironment(),
    operatingSystem: `${os.type()} ${os.release()} ${os.arch()}`,
    executionDate: new Date().toISOString(),
    nodeVersion: process.version,
    benchmarkName: opts.benchmarkName || 'unknown',
  };
}

function provenanceHeader(prov) {
  return [
    `rtk commit: ${prov.rtkCommit}`,
    `benchmark version: ${prov.benchmarkVersion}`,
    `corpus version: ${prov.corpusVersion}`,
    `repository commit: ${prov.repositoryCommit}`,
    `operating system: ${prov.operatingSystem}`,
    `node: ${prov.nodeVersion}`,
    `execution date: ${prov.executionDate}`,
  ].join('\n');
}

module.exports = { collectProvenance, provenanceHeader, getRtkCommit, getBenchmarkVersion, getCorpusVersion, getEnvironment };
