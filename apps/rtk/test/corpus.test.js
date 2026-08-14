'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TARGETS,
  emptyAgentCorpus,
  emptyCiCorpus,
  corpusStats,
  corpusEligibility,
  corpusReport,
} = require('../src/corpus');

function task(i, tool, repo) {
  return { id: `t${i}`, tool, repo, command: `${tool} run`, exitCode: 1, capturedAt: '2026-08-14T00:00:00Z', output: 'x', fixNeedles: ['error'] };
}

function fullCorpus({ count = TARGETS.agentTasks, tools = TARGETS.minToolsCovered, repos = TARGETS.minRepos } = {}) {
  return {
    provenance: 'captured',
    collectedFrom: [],
    tasks: Array.from({ length: count }, (_, i) => task(i, `tool${i % tools}`, `repo${i % repos}`)),
  };
}

test('the shipped corpora are empty and say so', () => {
  assert.equal(corpusStats(emptyAgentCorpus()).count, 0);
  assert.match(corpusStats(emptyAgentCorpus()).summary, /Nothing here can be reported/);
  assert.equal(corpusStats(emptyCiCorpus()).count, 0);
});

test('an empty corpus is not reportable and lists what is missing', () => {
  const e = corpusEligibility(emptyAgentCorpus());
  assert.equal(e.eligible, false);
  assert.ok(e.reasons.some((r) => /at least 1000/.test(r)));
  assert.ok(e.reasons.some((r) => /tool\(s\) covered/.test(r)));
});

test('a synthetic corpus is blocked however large', () => {
  const e = corpusEligibility({ ...fullCorpus(), provenance: 'synthetic' });
  assert.equal(e.eligible, false);
  assert.ok(e.reasons.some((r) => /synthetic/i.test(r)));
});

test('a large but narrow corpus is blocked', () => {
  // 1000 cases from one repo and one tool satisfies the sample-size maths and
  // still says nothing about anything else.
  const e = corpusEligibility(fullCorpus({ tools: 1, repos: 1 }));
  assert.equal(e.eligible, false);
  assert.ok(e.reasons.some((r) => /1 tool\(s\) covered/.test(r)));
  assert.ok(e.reasons.some((r) => /1 repo\(s\)/.test(r)));
});

test('unscorable tasks are named rather than silently skipped', () => {
  const corpus = fullCorpus();
  corpus.tasks[0].fixNeedles = [];
  const e = corpusEligibility(corpus);
  assert.equal(e.eligible, false);
  assert.ok(e.reasons.some((r) => /no fixNeedles/.test(r)));
});

test('a real, large, broad corpus passes', () => {
  assert.equal(corpusEligibility(fullCorpus()).eligible, true);
});

test('the CI corpus has its own lower bar', () => {
  const ci = {
    provenance: 'captured',
    collectedFrom: [],
    logs: Array.from({ length: TARGETS.ciLogs }, (_, i) => ({ id: `l${i}`, tool: `tool${i % 8}`, repo: `repo${i % 5}` })),
  };
  assert.equal(corpusEligibility(ci).eligible, true);
});

test('the report states the sample size the statistics require', () => {
  const r = corpusReport(emptyAgentCorpus(), emptyCiCorpus());
  assert.match(r.text, /Reportable: no/);
  assert.match(r.text, /paired cases are needed/);
});
