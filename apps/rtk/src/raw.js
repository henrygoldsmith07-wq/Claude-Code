'use strict';

const fs = require('fs');
const path = require('path');
const { findRtkDir } = require('./stats');

const RAW_DIR = 'raw';
const MAX_RAW_BYTES = 1024 * 1024 * 5; // 5MB per invocation cap

function rawDir(cwd) {
  const dir = path.join(findRtkDir(cwd), RAW_DIR);
  return dir;
}

function writeRaw(cwd, label, output) {
  try {
    const dir = rawDir(cwd);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = String(label).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40) || 'cmd';
    const file = path.join(dir, `${stamp}__${safe}.log`);
    const toWrite = output.length > MAX_RAW_BYTES ? output.slice(0, MAX_RAW_BYTES) + '\n… [truncated raw log]\n' : output;
    fs.writeFileSync(file, toWrite, 'utf8');
    return { path: file, bytes: Buffer.byteLength(toWrite, 'utf8') };
  } catch {
    return null;
  }
}

function latestRaw(cwd) {
  try {
    const dir = rawDir(cwd);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.log')).sort();
    return files.length ? path.join(dir, files[files.length - 1]) : null;
  } catch {
    return null;
  }
}

module.exports = { rawDir, writeRaw, latestRaw, MAX_RAW_BYTES };
