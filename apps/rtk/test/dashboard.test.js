'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SOURCES, buildDashboardData, renderHtml } = require('../benchmark/dashboard');
const {
  LEAK_RE,
  sanitizeEntry,
  buildPublicBundle,
  run,
} = require('../benchmark/export-failure-corpus');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function extractEmbeddedJson(html) {
  const m = html.match(/<script type="application\/json" id="dashboard-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'dashboard HTML must embed its data in the dashboard-data script tag');
  return JSON.parse(m[1]);
}

function withSilencedConsole(fn) {
  const origLog = console.log;
  const origErr = console.error;
  const logs = [];
  const errs = [];
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    return { result: fn(), logs, errs };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

function makeTmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rtk-dashboard-${label}-`));
}

// ---------------------------------------------------------------------------
// buildDashboardData
// ---------------------------------------------------------------------------

test('buildDashboardData: all sources missing is graceful (empty dir fixtures)', () => {
  const data = buildDashboardData({
    readJson: () => null,
    now: '2026-08-21T00:00:00.000Z',
    provenance: { rtkCommit: 'f'.repeat(40), benchmarkVersion: '0.0.0-test', corpusVersion: 'corpus-test' },
    failureCorpus: { count: 0, byCategory: {} },
  });

  assert.equal(data.generatedAt, '2026-08-21T00:00:00.000Z');
  for (const name of SOURCES) assert.equal(data.sources[name], 'missing', `${name} should be reported missing`);
  assert.equal(data.headline.overallReductionPct, null);
  assert.equal(data.headline.tokenizer, 'unknown');
  assert.equal(data.reduction, null);
  assert.equal(data.families, null);
  assert.equal(data.detection, null);
  assert.equal(data.paired, null);
  assert.deepEqual(data.failureCorpus, { count: 0, byCategory: {} });

  // provenance override wins and never shells out
  assert.equal(data.provenance.rtkCommit, 'f'.repeat(40));

  // rendering still works with nothing loaded
  const html = renderHtml(data);
  assert.ok(html.includes('(source missing: results.json'));
  assert.deepEqual(extractEmbeddedJson(html), data);
});

test('buildDashboardData: partial sources compute headline + detection + sources map', () => {
  const docs = {
    results: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      tokenizer: 'o200k_base',
      rows: [
        { label: 'big log', parser: 'vitest', rawTokens: 1000, emittedTokens: 100, tokenReductionPct: 90, tokensSaved: 900, criticalRetained: true },
        { label: 'tiny log', parser: 'tsc', rawTokens: 100, emittedTokens: 100, tokenReductionPct: 0, tokensSaved: 0, criticalRetained: true },
      ],
    },
    detection: {
      rows: [
        { label: 'ok case', expectedName: 'tsc', gotName: 'tsc', ok: true },
        { label: 'bad case', expectedName: 'pm', gotName: 'eslint', ok: false },
      ],
    },
  };
  const data = buildDashboardData({
    readJson: (name) => docs[name] || null,
    now: '2026-08-21T00:00:00.000Z',
    failureCorpus: { count: 2, byCategory: { 'parser bug': 2 } },
  });

  assert.equal(data.sources.results, 'ok');
  assert.equal(data.sources.detection, 'ok');
  assert.equal(data.sources.families, 'missing');
  assert.equal(data.sources.paired, 'missing');
  // (1 - (200/1100)) * 100 -> 82 after rounding
  assert.equal(data.headline.overallReductionPct, 82);
  assert.equal(data.headline.tokenizer, 'o200k_base');
  assert.equal(data.detection.ratePct, 50);
  assert.equal(detection_failuresLength(data), 1);
  assert.deepEqual(data.failureCorpus, { count: 2, byCategory: { 'parser bug': 2 } });
});

function detection_failuresLength(data) {
  return data.detection.failures.length;
}

test('buildDashboardData: paired section carries Wilson CIs when computable', () => {
  const docs = {
    paired: {
      count: 300,
      level: 'balanced',
      seed: 12648430,
      stats: {
        total: 300, rawSuccesses: 291, rtkSuccesses: 291,
        rawSuccessRate: 0.97, rtkSuccessRate: 0.97,
        pairedDifference: 0, discordant: 0,
        avgRawTokens: 4190, avgRtkTokens: 106, avgReduction: 97,
      },
      equivalence: {
        n: 300, a: 291, b: 0, c: 0, d: 9,
        difference: 0, lower: -0.01, upper: 0.01,
        equivalent: true, margin: 0.05, note: 'Equivalent.',
      },
      economics: { net: 1224996, netPct: 0.9747, extraRetries: 0, profitable: true, note: 'Saved.' },
    },
  };
  const data = buildDashboardData({ readJson: (name) => docs[name] || null });
  const w = data.paired.wilson;

  assert.ok(w, 'wilson block should be present for a well-formed paired doc');
  assert.equal(w.raw.point, 0.97);
  assert.equal(w.rtk.point, 0.97);
  assert.ok(w.raw.lower > 0 && w.raw.lower < w.raw.point && w.raw.point < w.raw.upper && w.raw.upper < 1);
  assert.ok(w.rtk.lower > 0 && w.rtk.lower < w.rtk.point && w.rtk.point < w.rtk.upper && w.rtk.upper < 1);
  assert.equal(data.headline.pairedEquivalent, true);
  // bulky arrays from source docs must not be carried through
  assert.equal(data.paired.tasks, undefined);
});

// ---------------------------------------------------------------------------
// renderHtml
// ---------------------------------------------------------------------------

function fixtureData() {
  return buildDashboardData({
    readJson: () => null,
    now: '2026-08-21T12:00:00.000Z',
    provenance: { rtkCommit: '8caf81ce61662952bb1f10581eac3d80e0575b07', benchmarkVersion: '0.3.0', corpusVersion: 'corpus-50-777a244a' },
    failureCorpus: { count: 3, byCategory: { 'filename lost': 2, unknown: 1 } },
  });
}

test('renderHtml: embeds valid JSON that parses back to the input data', () => {
  const data = fixtureData();
  const html = renderHtml(data);
  const parsed = extractEmbeddedJson(html);
  assert.deepStrictEqual(parsed, data);
  // deterministic: no wall-clock inside render, only the explicit generatedAt
  assert.strictEqual(renderHtml(data), html);
  assert.ok(html.includes('2026-08-21T12:00:00.000Z'));
  assert.ok(html.includes('corpus-50-777a244a'));
});

test('renderHtml: escapes script injection attempts in strings', () => {
  const data = fixtureData();
  data.reduction = {
    tokenizer: 'x',
    cases: 1,
    totals: { rawTokens: 10, emittedTokens: 5, overallReductionPct: 50 },
    rows: [{
      label: '<script>alert("pwn")</script>',
      parser: '<img src=x onerror=y>',
      rawTokens: 10, emittedTokens: 5, tokenReductionPct: 50, tokensSaved: 5,
      criticalRetained: true,
    }],
  };
  const html = renderHtml(data);

  assert.ok(!html.includes('<script>alert'), 'raw payload must never appear');
  assert.ok(!html.includes('<img src=x'), 'raw payload must never appear');
  assert.ok(html.includes('&lt;script&gt;alert'), 'visible text must be entity-escaped');

  // embedded JSON survives as \u003c escapes but parses back to the original string
  const parsed = extractEmbeddedJson(html);
  assert.equal(parsed.reduction.rows[0].label, '<script>alert("pwn")</script>');
});

// ---------------------------------------------------------------------------
// export-failure-corpus sanitization
// ---------------------------------------------------------------------------

test('sanitizeEntry: redacts fake secrets and strips home/user paths from repros', () => {
  const pub = sanitizeEntry({
    id: 'vitest-23',
    tool: 'vitest',
    classification: 'filename lost',
    missingNeedles: ['FAIL', 'AssertionError'],
    capturedAt: '2026-08-21T14:27:29.089Z',
    rawSample: 'api_key=supersecretvalue123 boom at C:\\Users\\henry\\proj\\src\\a.ts:10 and /home/dev/proj/b.ts:20',
    rtkSample: '(no output)',
  });

  assert.equal(pub.id, 'vitest-23');
  assert.equal(pub.tool, 'vitest');
  assert.equal(pub.category, 'filename lost');
  assert.equal(pub.rawSucceeded, true);
  assert.equal(pub.rtkFailed, true);
  assert.equal(pub.addedAt, '2026-08-21T14:27:29.089Z');

  const serialized = JSON.stringify(pub.minimalRepro);
  assert.ok(!LEAK_RE.test(serialized), 'no local paths may survive into the public entry');
  assert.ok(!serialized.includes('supersecret'), 'secrets must be redacted');
  assert.ok(pub.minimalRepro.raw.includes('[LOCAL-PATH]'), 'paths replaced with placeholder');
  assert.ok(pub.minimalRepro.raw.includes('[REDACTED]'), 'secret value replaced with marker');
  assert.deepEqual(pub.minimalRepro.missingNeedles, ['FAIL', 'AssertionError']);
});

test('buildPublicBundle: poison entry triggers refusal with offender ids', () => {
  const good = { id: 'ok-1', tool: 'vitest', classification: 'unknown', missingNeedles: [], capturedAt: '2026-08-21T00:00:00.000Z', rawSample: 'plain text', rtkSample: '' };
  // id fields are kept verbatim, so a path-bearing id must trip the leak gate
  const poison = { id: 'poison-C:\\Users\\evil', tool: 'vitest', classification: 'unknown', missingNeedles: [], capturedAt: '2026-08-21T00:00:00.000Z', rawSample: '', rtkSample: '' };

  const bundle = buildPublicBundle([good, poison]);
  assert.equal(bundle.ok, false);
  assert.deepEqual(bundle.offenders, ['poison-C:\\Users\\evil']);

  const clean = buildPublicBundle([good]);
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.offenders, []);
});

test('export run(): poison registry refuses to write (exit code 1)', () => {
  const tmp = makeTmp('refuse');
  try {
    const failuresDir = path.join(tmp, 'failures');
    fs.mkdirSync(failuresDir);
    fs.writeFileSync(path.join(failuresDir, 'poison.json'), JSON.stringify({
      id: 'poison-C:\\Users\\evil',
      tool: 'vitest',
      classification: 'unknown',
      missingNeedles: [],
      capturedAt: '2026-08-21T00:00:00.000Z',
      rawSample: '',
      rtkSample: '',
    }));
    const outDir = path.join(tmp, 'public');

    const { result: code } = withSilencedConsole(() => run(['--out', outDir], { failuresDir }));

    assert.equal(code, 1);
    assert.ok(!fs.existsSync(outDir), 'nothing may be written on refusal');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('export run(): clean registry publishes sanitized json + md', () => {
  const tmp = makeTmp('publish');
  try {
    const failuresDir = path.join(tmp, 'failures');
    fs.mkdirSync(failuresDir);
    fs.writeFileSync(path.join(failuresDir, 'a.json'), JSON.stringify({
      id: 'case-a', tool: 'vitest', classification: 'parser bug',
      missingNeedles: ['Found 4 errors'], capturedAt: '2026-08-21T00:00:00.000Z',
      rawSample: 'token=ghp_aaaaaaaaaaaaaaaaaaaa at C:\\Users\\x\\y.ts', rtkSample: '',
    }));
    fs.writeFileSync(path.join(failuresDir, 'b.json'), JSON.stringify({
      id: 'case-b', tool: 'pytest', classification: 'context removed',
      missingNeedles: [], capturedAt: '2026-08-20T00:00:00.000Z',
      rawSample: '/home/u/log.txt failed', rtkSample: '',
    }));
    const outDir = path.join(tmp, 'public');

    const { result: code } = withSilencedConsole(() => run(['--out', outDir], { failuresDir }));

    assert.equal(code, 0);
    const jsonPath = path.join(outDir, 'failure-corpus.json');
    const mdPath = path.join(outDir, 'failure-corpus.md');
    assert.ok(fs.existsSync(jsonPath));
    assert.ok(fs.existsSync(mdPath));

    const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(doc.count, 2);
    assert.equal(doc.entries.length, 2);
    assert.ok(doc.entries.every((e) => !LEAK_RE.test(JSON.stringify(e))));
    assert.ok(doc.entries[0].minimalRepro.raw.includes('[LOCAL-PATH]'));
    assert.ok(doc.entries[0].minimalRepro.raw.includes('[REDACTED]'));

    const md = fs.readFileSync(mdPath, 'utf8');
    assert.ok(md.includes('# RTK public failure corpus'));
    assert.ok(md.includes('case-a'));
    assert.ok(md.includes('case-b'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('export run(): empty or absent registry exits gracefully without writing', () => {
  const tmp = makeTmp('empty');
  try {
    const outDir = path.join(tmp, 'public');
    const absent = withSilencedConsole(() => run(['--out', outDir], { failuresDir: path.join(tmp, 'does-not-exist') }));
    assert.equal(absent.result, 0);

    const emptyDir = path.join(tmp, 'failures-empty');
    fs.mkdirSync(emptyDir);
    const empty = withSilencedConsole(() => run(['--out', outDir], { failuresDir: emptyDir }));
    assert.equal(empty.result, 0);
    assert.ok(empty.logs[0].includes('registry is empty'));

    assert.ok(!fs.existsSync(outDir), 'no artifacts for an empty registry');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
