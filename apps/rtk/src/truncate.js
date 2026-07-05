'use strict';

const DEFAULTS = { headLines: 20, tailLines: 5, maxChars: 4000 };

function truncate(output, options = {}) {
  const { headLines, tailLines, maxChars } = { ...DEFAULTS, ...options };
  const lines = output.split('\n');

  if (output.length <= maxChars && lines.length <= headLines + tailLines) {
    return { emitted: output, truncated: false };
  }

  const head = lines.slice(0, headLines);
  const tail = tailLines > 0 ? lines.slice(-tailLines) : [];
  const omitted = lines.length - head.length - tail.length;
  const emitted = [...head, `… ${omitted} lines omitted …`, ...tail].join('\n');
  return { emitted, truncated: true };
}

module.exports = { truncate };
