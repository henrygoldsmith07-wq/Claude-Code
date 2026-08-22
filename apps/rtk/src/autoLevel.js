'use strict';

/**
 * Adaptive compression selection — picks the strength from output shape
 * instead of forcing one user level onto every command. Small outputs are
 * passed through nearly untouched; huge ones are compressed hard; the
 * middle gets the default balance.
 */

function pickAutoLevel(output, exitCode) {
  void exitCode;
  const len = output ? String(output).length : 0;
  const lines = len === 0 ? 0 : String(output).split('\n').length;
  if (len <= 4000 && lines <= 60) return 'conservative';
  if (len > 100000 || lines > 2000) return 'aggressive';
  return 'balanced';
}

module.exports = { pickAutoLevel };
