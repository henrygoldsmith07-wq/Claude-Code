'use strict';

const vitest = require('./vitest');
const tsc = require('./tsc');
const nextBuild = require('./next');
const generic = require('./generic');

const PARSERS = { vitest, tsc, nextBuild, generic };

/**
 * Choose a parser from the argv label. Heuristic — deliberately cheap.
 * tsc / next get their own shapes; everything running under vitest/jest wins vitest parser.
 */
function pickParser(argv) {
  const joined = argv.join(' ').toLowerCase();
  if (/(^|\s)tsc(\s|$)/.test(joined) || joined.includes('typescript') && joined.includes('tsc')) return PARSERS.tsc;
  if (joined.includes('next build')) return PARSERS.nextBuild;
  if (joined.includes('vitest') || joined.includes('jest') || joined.includes('npm test') || joined.includes('npm run test')) return PARSERS.vitest;
  if (joined.includes('eslint')) return PARSERS.generic;
  return PARSERS.generic;
}

module.exports = { PARSERS, pickParser };
