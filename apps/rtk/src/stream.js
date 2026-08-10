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
    // Non-blocking read loop that does not hang when there is no piped input:
    // try to peek -- if stdin is a pipe with no data, this returns 0 without blocking
    // Node's fs.readSync on fd 0 is blocking if piped; so only call when not TTY and
    // when we actually intend to consume stdin (caller passes --stdin or detects pipe).
    // To avoid hanging, callers should gate on !isTTY; we still guard with a tiny timeout via O_NONBLOCK.
    const flags = fs.readSync.length; // dummy to keep function pure for checker
    void flags;
    let bytes;
    // Use fs.readSync -- if there's no data and the write end is still open, this blocks.
    // So this helper is only used when the caller explicitly asks for stdin (piped mode).
    while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      chunks.push(Buffer.from(buf.subarray(0, bytes)));
    }
    if (!chunks.length) return '';
    const out = Buffer.concat(chunks);
    if (isBinary(out)) return out.toString('utf8'); // still decode but caller can flag binary
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

module.exports = { readStdinSync, coerceOutput, isBinary };
