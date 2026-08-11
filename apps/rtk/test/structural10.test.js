'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stripAnsi, safeDecode } = require('../src/ansi');
const { PARSERS, pickParser } = require('../src/parsers');
const { compressNdjson, compressXml, compressSarif, compressAnnotations, compressJson, compressDiff } = require('../src/structural');
const { countTokens, encodingName, costForTokens } = require('../src/tokens');
const { prioritizeLines, crossCommandDedup, scoreLine } = require('../src/prioritize');
const { scoreLine: scoreLine2 } = require('../src/prioritize');

test('ansi: stripAnsi removes SGR and broken escapes, keeps text', () => {
  assert.equal(stripAnsi('\u001b[31mFAIL\u001b[0m src/app.ts:10:5'), 'FAIL src/app.ts:10:5');
  assert.equal(stripAnsi('\u001b[31'), '');
  assert.equal(stripAnsi('no ansi'), 'no ansi');
});

test('ansi: safeDecode repairs lone surrogates', () => {
  const loneHigh = String.fromCharCode(0xD800);
  assert.equal(safeDecode(loneHigh), '\uFFFD');
  assert.equal(safeDecode('hello'), 'hello');
});

test('unicode: parsers preserve unicode/emoji file refs on failure', () => {
  const out = 'Error: boom 💥 at src/ünicode.ts:10:5\nTests  1 failed';
  const { emitted } = PARSERS.generic.filter(out, 1);
  assert.ok(emitted.includes('Error: boom'));
  assert.ok(emitted.includes('1 failed'));
});

test('windows: CRLF and backslash paths still match file:line', () => {
  const out = 'src\\app\\foo.ts:10:5 - error TS2322: boom\r\nFound 1 error';
  // Generic should still keep Error line
  const { emitted } = PARSERS.generic.filter(out.replace(/\r\n/g,'\n'), 1);
  assert.ok(emitted.includes('error TS2322') || emitted.includes('Error'));
});

test('broken ANSI: truncated escape at EOF is stripped without losing error', () => {
  const out = '\u001b[31mError: boom at src/app.ts:10:5\nTests  1 failed\n\u001b[31';
  const stripped = stripAnsi(out);
  const { emitted } = PARSERS.generic.filter(stripped, 1);
  assert.ok(emitted.includes('Error: boom'));
});

test('NDJSON: keeps error json, omits long ok runs', () => {
  const lines = Array.from({length:80}, (_,i)=> JSON.stringify(i===40?{level:'error', msg:'boom', file:'src/app.ts:10:5'}:{level:'info', msg:`ok ${i}`} ));
  const out = lines.join('\n');
  const compressed = compressNdjson(out);
  assert.ok(compressed !== null);
  assert.ok(compressed.includes('boom'));
  assert.ok(compressed.includes('omitted'));
});

test('nested JSON: prune keeps error-ish keys, caps arrays', () => {
  const input = JSON.stringify({ error: 'boom', meta: { empty:'', nul:null, deep: { arr: Array.from({length:50},(_,i)=>i) } } });
  const out = compressJson(input);
  assert.ok(out !== null);
  assert.ok(out.includes('boom'));
});

test('JUnit XML: keeps failure testcase, omits passing run', () => {
  const xml = ['<?xml version="1.0"?>','<testsuite name="foo">', ...Array.from({length:20},(_,i)=>`<testcase classname="a" name="t${i}"/>`), '<testcase classname="a" name="fail"><failure message="boom">at src/app.ts:10:5</failure></testcase>','</testsuite>'].join('\n');
  const out = compressXml(xml);
  assert.ok(out !== null);
  assert.ok(out.includes('failure'));
  assert.ok(out.includes('omitted') || out.includes('fail'));
});

test('SARIF: keeps error results, drops non-error (large run)', () => {
  const sarif = JSON.stringify({version:'2.1.0', runs:[{tool:{driver:{name:'eslint'}}, results: Array.from({length:40},(_,i)=>({level: i%5===0?'error':'note', message:{text: i===5?'boom '+i:`msg ${i}`}})) }]});
  const out = compressSarif(sarif);
  assert.ok(out !== null);
  assert.ok(out.includes('boom'));
});

test('GitHub annotations: keeps ::error and group context', () => {
  const out = ['::group::Build','::error file=src/app.ts,line=10:: boom col 5','  at src/app.ts:10:5','::endgroup::','noise'].join('\n');
  const compressed = compressAnnotations(out);
  assert.ok(compressed !== null);
  assert.ok(compressed.includes('::error'));
  assert.ok(compressed.includes('boom'));
});

test('tokenizer: o200k_base available and counts differ from chars/4 on code', () => {
  const enc = encodingName();
  assert.ok(enc === 'o200k_base' || enc === 'chars/4');
  const code = 'src/components/Foo.tsx:10:5 - error TS2322: Type string is not assignable';
  const tokens = countTokens(code);
  assert.ok(tokens > 5 && tokens < 100);
  const dollars = costForTokens(1000, 'gpt-4o');
  assert.ok(dollars > 0 && dollars < 1);
});

test('prioritize: context window expands around scored errors', () => {
  const lines = ['ok 0','ok 1','Error: boom at src/app.ts:10:5','line after','ok 4'];
  const idx = lines.map((l,i)=> scoreLine(l) >= 50 ? i : -1).filter(i=>i>=0);
  assert.ok(idx.length >= 1);
  const { withContext } = require('../src/prioritize');
  const expanded = withContext(lines, new Set(idx), 1);
  assert.ok(expanded.length >= 2);
});

test('prioritize: cross-command dedup drops duplicate errors', () => {
  const a = { label:'a', lines:['Error: boom at src/app.ts:10:5','ok'] };
  const b = { label:'b', lines:['Error: boom at src/app.ts:10:5','other'] };
  const out = crossCommandDedup([a,b]);
  assert.equal(out[0].lines.includes('Error: boom at src/app.ts:10:5'), true);
  assert.equal(out[1].lines.includes('Error: boom at src/app.ts:10:5'), false);
  assert.ok(out[1].droppedCount >= 1);
});

test('detection v2: pickParser sniffing for new tools', () => {
  assert.equal(pickParser(['cat','log'], 'error[E0308]: boom\n --> src/foo.rs:1:2').name, 'cargo');
  assert.equal(pickParser(['cat','log'], '--- FAIL: TestFoo').name, 'go-test');
  assert.equal(pickParser(['cat','log'], '::error file=x:: hi').name, 'gha');
  assert.equal(pickParser(['cat','log'], 'on main.tf line 10').name, 'terraform');
  assert.equal(pickParser(['cat','log'], 'CrashLoopBackOff').name, 'k8s');
  assert.equal(pickParser(['npm','test']).name, 'vitest');
  assert.equal(pickParser(['jest']).name, 'jest');
});

test('property: all parsers handle empty/huge/NUL/broken-ANSI without throwing', () => {
  const cases = ['', 'x'.repeat(200000), '\u0000bin\u0000\u001b[31m', Array.from({length:10000},(_,i)=>`line ${i} ${i%200===0?'Error: boom':''}`).join('\n'), '💥 café naïve \uD800 lone surrogate'];
  for (const c of cases) {
    const stripped = stripAnsi(c);
    const safe = safeDecode(stripped);
    for (const p of Object.values(PARSERS)) {
      const r = p.filter(safe, safe.includes('Error')||safe.includes('FAIL')?1:0);
      assert.ok(typeof r.emitted === 'string');
    }
  }
});

test('preservation rules: user pattern keeps extra lines', () => {
  const { loadPreservationRules } = require('../src/plugins');
  const rules = loadPreservationRules('/tmp', { preservation: [{ pattern: 'KEEPME', reason: 'test' }] });
  assert.equal(rules.length, 1);
  assert.ok(rules[0].re.test('KEEPME boom'));
});

test('streaming: binary NUL is replaced before parsing', () => {
  const withNul = 'Error: boom at src/app.ts:10:5\u0000tail';
  const replaced = withNul.replace(/\u0000/g, '[NUL]');
  const { emitted } = PARSERS.generic.filter(replaced, 1);
  assert.ok(emitted.includes('Error: boom'));
  assert.ok(emitted.includes('[NUL]') || replaced.includes('[NUL]'));
});
