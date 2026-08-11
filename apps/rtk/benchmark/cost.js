'use strict';

// Shared cost table for benchmarks. Re-exports from src/tokens so there is one source of truth.
const { COST_TABLE, costForTokens, formatCost } = require('../src/tokens');

module.exports = { COST_TABLE, costForTokens, formatCost };
