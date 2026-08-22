'use strict';

const DEFAULTS = { headLines: 20, tailLines: 5, maxChars: 4000 };

function truncate(output, options = {}) {
  const { headLines, tailLines, maxChars } = { ...DEFAULTS, ...options };
  const lines = output.split('\n');

  if (output.length <= maxChars && lines.length <= headLines + tailLines) {
    return { emitted: output, truncated: false };
  }

  // Clamp the windows so short-but-wide outputs can't overlap and duplicate lines.
  const headEnd = Math.min(headLines, lines.length);
  const tailStart = Math.max(headEnd, tailLines > 0 ? lines.length - tailLines : lines.length);
  const head = lines.slice(0, headEnd);
  const tail = tailLines > 0 ? lines.slice(tailStart) : [];
  const omitted = lines.length - head.length - tail.length;
  if (omitted <= 0) return { emitted: output, truncated: false };

  const emitted = [...head, `… ${omitted} lines omitted …`, ...tail].join('\n');
  // Never emit more than we were given — this is a token saver.
  if (emitted.length >= output.length) return { emitted: output, truncated: false };
  return { emitted, truncated: true };
}

module.exports = { truncate };
