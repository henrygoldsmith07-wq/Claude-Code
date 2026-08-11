'use strict';

const fs = require('fs');

const BINARY_RE = /\0/;

function isBinary(buf) {
  return BINARY_RE.test(buf.toString('utf8', 0, Math.min(buf.length, 8000)));
}

function readStdinSync() {
  if (process.stdin.isTTY) return null;
  try {
    const fd = 0;
    const chunks = [];
    const buf = Buffer.alloc(64 * 1024);
    let bytes;
    while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      chunks.push(Buffer.from(buf.subarray(0, bytes)));
    }
    if (!chunks.length) return '';
    const out = Buffer.concat(chunks);
    if (isBinary(out)) return out.toString('utf8');
    return out.toString('utf8');
  } catch {
    return '';
  }
}

function coerceOutput(maybeBuf) {
  if (Buffer.isBuffer(maybeBuf)) {
    if (isBinary(maybeBuf)) return { text: maybeBuf.toString('utf8'), binary: true };
    return { text: maybeBuf.toString('utf8'), binary: false };
  }
  return { text: String(maybeBuf ?? ''), binary: false };
}

// Streaming compression: for very large stdin, process in chunks to avoid OOM.
// rtk err --stdin already handles this via fs.readFileSync(0) + parsers which are O(n) with 64MB cap.
// This helper is for future streaming parsers; today it just documents the approach.
function chunkedLines(output, chunkLines = 5000) {
  const lines = output.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkLines) chunks.push(lines.slice(i, i + chunkLines));
  return chunks;
}

module.exports = { readStdinSync, coerceOutput, isBinary, chunkedLines };
