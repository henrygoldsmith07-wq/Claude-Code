'use strict';

// Fuzz/property harness — hostile inputs across every parser and core transform.
// Contract under test: nothing throws on any input shape (malformed UTF-8,
// huge lines, broken ANSI, binary noise, non-English text, Windows/UNC paths,
// shell-specific errors), truncation never grows output meaningfully, exit-0
// always collapses to one line, and everything is deterministic.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PARSERS } = require('../src/parsers');
const { filterErr } = require('../src/filter');
const { truncate } = require('../src/truncate');
const { applyStructural } = require('../src/structural');

const ALL = Object.values(PARSERS);

// ---------------------------------------------------------------------------
// Generators — each returns a string of hostile output.
// ---------------------------------------------------------------------------

// 1. Malformed UTF-8: lone surrogates, U+FFFD runs, BOM mid-stream
function genMalformedUtf8() {
  return [
    'ok build start',
    '\uD800\uD800 broken surrogate pair at start',
    'text with trailing lone low surrogate \uDE00 end',
    '\uFFFD\uFFFD\uFFFD\uFFFD replacement char run',
    'progress \uFEFF mid-stream BOM after text',
    '\uFFFDerror TS2345: bad types here\uFFFD',
    'mix \uDC00 and unpaired \uD83D tail',
    '\uD800high surrogate glued to ASCII',
  ].join('\n');
}

// 2. Extremely long lines: single 500k-char line; 100k-char token; many 5k lines
function genLongLines() {
  return [
    'x'.repeat(500_000),
    'token: ' + 'y'.repeat(100_000),
    ...Array.from({ length: 50 }, (_, i) => `line ${i} ${'z'.repeat(5_000)} Error: boom`),
  ].join('\n');
}

// 3. Weird ANSI: bracketed paste, OSC title, broken trailing escape,
//    cursor hide, RGB SGR, alternating SGR per char
function genWeirdAnsi() {
  return [
    '\x1b[200~pasted chunk\x1b[201~ after paste end',
    '\x1b]0;window title\x07body after bel',
    '\x1b]2;title no terminator still open',
    'broken trailing escape \x1b[31',
    'cursor hide \x1b[?25l mid line \x1b[?25h restored',
    '\x1b[38;2;255;0;0mred rgb truecolor\x1b[0m reset',
    'alt per char: a\x1b[1mb\x1b[22mc\x1b[31md\x1b[39me\x1b[4mf\x1b[24mg',
    '\x1b[2K\rprogress overwrite line',
    'plain end',
  ].join('\n');
}

// 4. Interleaved parallel logs: two builds' lines shuffled with [1]/[2] prefixes
function genInterleaved() {
  const out = [];
  for (let i = 0; i < 60; i++) {
    out.push(`[1] build step ${i}: compiling module ${i}`);
    if (i % 7 === 0) out.push(`[2] task ${i}: warning deprecated api`);
    out.push(`[2] task ${i}${i === 59 ? ' FAILED: cannot find module ./missing' : ': ok'}`);
    if (i === 30) out.push('[1] Error: webpack exited with code 1');
  }
  return out.join('\n');
}

// 5. Nested exception chains: Caused by x3, jest internal frames,
//    python traceback inside cargo panic text
function genNestedExceptions() {
  return [
    'Error: outer failure while building',
    '    at run (src/index.ts:10:5)',
    'Caused by: middle failure during compile',
    'Caused by: inner failure in plugin',
    'Caused by: root cause unexpected EOF',
    '    at node:internal/modules/cjs/loader:1024:15',
    '    at VitestRunner.runFiles (node_modules/vitest/dist/runner.js:88:20)',
    '    at runTest (node_modules/jest-runner/build/index.js:120:9)',
    '    at user.spec.ts:4:1',
    "thread 'main' panicked at 'assertion failed', src/lib.rs:42:9",
    'note: python traceback embedded:',
    '  File "test_app.py", line 17, in test_thing',
    'E       AssertionError: assert False is True',
    'stack backtrace:',
    '   0: rust_begin_unwind',
  ].join('\n');
}

// 6a. Truncation edge cases: cut mid-line, mid-escape, mid-surrogate-pair
function genTruncationEdges() {
  const escSeq = '\x1b[38;2;10;20;30ma colorful message that gets chopped';
  return (
    [
      'starts fine then cut mid-w'.slice(0, 20),
      escSeq.slice(0, 18),
      'emoji family \uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC66 cut'.slice(0, 16),
      'orphan half surrogate follows \uD83D',
      'lone low next \uDE0A',
      '\uFFFD already-replaced tail',
    ].join('\n') + '\x1b[33'
  );
}

// 6b. Empty input
function genEmptyInput() {
  return '';
}

// 6c. Lone newline
function genLoneNewline() {
  return '\n';
}

// 7. Binary contamination: NUL bytes, control chars, high-byte noise
function genBinaryContamination() {
  return [
    'a\x00b\x00c\x00d nul-separated tokens',
    '\x01\x02\x03\x04\x05\x06\x07\x08 control char run',
    'high bytes: \xC3\xA9\xFF\xFE\x80\x81\xBF latin mojibake',
    'mixed \x00\x07\x1b[31m red after nul-bell',
    'backspace over\x08\x08write',
    'end\x00',
  ].join('\n');
}

// 8. Localization / non-English: German, Japanese full-width, French/Spanish
//    accents, RTL Arabic mixed with ASCII error tokens
function genLocalized() {
  return [
    'Fehler: Test fehlgeschlagen',
    'Tests fehlgeschlagen: 3',
    'Ｗａｒｎｉｎｗ：全角文字のテスト実行中にエラー：２件失敗しました',
    'Échec du test : résultat attendu « réussite », reçu « échec »',
    'Error: se esperaba una cadena, se recibió un número',
    'خطأ: فشل الاختبار error TS2345 mixed rtl ascii token',
    'Zusammenfassung: 12 bestanden, 3 fehlgeschlagen',
    '日本語のファイルパス: src/テスト/app.ts:8:1 - error TS2307',
  ].join('\n');
}

// 9. Windows paths: drive letters, UNC, mixed separators, spaces
function genWindowsPaths() {
  return [
    'C:\\repo\\src\\app.ts(42,13): error TS2345: Argument of type "number" is not assignable',
    '\\\\server\\share\\a.ts:9:1: error TS2307: Cannot find module',
    'C:/repo/src\\mixed/separators.ts:3:5 - error TS2322: Type mismatch',
    'C:\\Program Files\\repo\\my file with spaces\\index.js:12:1 - error TS7006',
    '    at C:\\repo\\node_modules\\vitest\\dist\\runner.js:88:20',
    'diff --git a/src/lib.ts b/C:\\other\\lib.ts',
  ].join('\n');
}

// 10. Shell differences: cmd.exe, pwsh, POSIX sh error phrasing
function genShellMessages() {
  return [
    "The system cannot find the file specified.",
    "'foo' is not recognized as an internal or external command,\roperable program or batch file.",
    "At line:1 char:1\r\n+ foo-bar\r\n+ ~~~~~~~\r\nThe term 'foo-bar' is not recognized as a name of a cmdlet",
    'sh: 1: foo: not found',
    '/bin/sh: npm: command not found',
    'cat: no such file or directory: config.yml',
    'exit status 127',
  ].join('\n');
}

const GENERATORS = {
  malformedUtf8: genMalformedUtf8,
  longLines: genLongLines,
  weirdAnsi: genWeirdAnsi,
  interleavedParallel: genInterleaved,
  nestedExceptions: genNestedExceptions,
  truncationEdges: genTruncationEdges,
  emptyInput: genEmptyInput,
  loneNewline: genLoneNewline,
  binaryContamination: genBinaryContamination,
  localizedNonEnglish: genLocalized,
  windowsPaths: genWindowsPaths,
  shellDifferences: genShellMessages,
};

// ---------------------------------------------------------------------------
// A. Every parser survives every generator without throwing.
// ---------------------------------------------------------------------------

for (const [category, gen] of Object.entries(GENERATORS)) {
  test(`fuzz ${category}: every parser filters without throwing`, () => {
    for (const exitCode of [0, 1]) {
      const output = gen();
      for (const parser of ALL) {
        let res;
        try {
          res = parser.filter(output, exitCode);
        } catch (e) {
          throw new Error(
            `parser ${parser.name} threw on ${category} (${output.length}-char input, exit ${exitCode}): ${e.message}`
          );
        }
        assert.equal(
          typeof res.emitted,
          'string',
          `parser ${parser.name} emitted non-string on ${category}, exit ${exitCode}`
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// B. Core transforms survive every generator too.
// ---------------------------------------------------------------------------

test('fuzz: filterErr / truncate / applyStructural survive every generator', () => {
  for (const [category, gen] of Object.entries(GENERATORS)) {
    const output = gen();
    for (const exitCode of [0, 1]) {
      let filtered;
      try {
        filtered = filterErr(output, exitCode);
      } catch (e) {
        throw new Error(`filterErr threw on ${category} (exit ${exitCode}): ${e.message}`);
      }
      assert.equal(typeof filtered.emitted, 'string', `filterErr non-string on ${category}`);
    }

    let truncated;
    try {
      truncated = truncate(output);
    } catch (e) {
      throw new Error(`truncate threw on ${category}: ${e.message}`);
    }
    assert.equal(typeof truncated.emitted, 'string', `truncate non-string on ${category}`);

    let structural;
    try {
      structural = applyStructural(output.split('\n').filter(Boolean), output, {});
    } catch (e) {
      throw new Error(`applyStructural threw on ${category}: ${e.message}`);
    }
    assert.ok(Array.isArray(structural), `applyStructural non-array on ${category}`);
  }
});

// ---------------------------------------------------------------------------
// C. Needle preservation spot-checks.
// ---------------------------------------------------------------------------

test('fuzz needles: vitest keeps FAIL from an ANSI-wrapped failing line', () => {
  const output = ['\x1b[31m\x1b[1mFAIL something broke\x1b[0m', 'Tests 1 failed'].join('\n');
  const res = PARSERS.vitest.filter(output, 1);
  assert.ok(res.emitted.includes('FAIL something broke'), `lost needle, got: ${JSON.stringify(res.emitted)}`);
});

test('fuzz needles: pytest keeps AssertionError', () => {
  const output = ['_______ test_thing _______', 'E       AssertionError: assert 1 == 2', '1 failed'].join('\n');
  const res = PARSERS.pytest.filter(output, 1);
  assert.ok(res.emitted.includes('AssertionError'), `lost needle, got: ${JSON.stringify(res.emitted)}`);
});

test('fuzz needles: tsc keeps error TS2345', () => {
  const output = ['watching for changes', 'src/app.ts(42,13): error TS2345: Argument of type "number"'].join('\n');
  const res = PARSERS.tsc.filter(output, 1);
  assert.ok(res.emitted.includes('error TS2345'), `lost needle, got: ${JSON.stringify(res.emitted)}`);
});

test('fuzz needles: gotest keeps --- FAIL:', () => {
  const output = ['=== RUN   TestThing', '--- FAIL: TestThing (0.00s)', 'FAIL'].join('\n');
  const res = PARSERS.gotest.filter(output, 1);
  assert.ok(res.emitted.includes('--- FAIL:'), `lost needle, got: ${JSON.stringify(res.emitted)}`);
});

// ---------------------------------------------------------------------------
// D. Invariants: size bound, exit-0 collapse to one line, determinism.
// ---------------------------------------------------------------------------

test('fuzz invariant: truncate emitted length <= input + 200 marker overhead', () => {
  for (const [category, gen] of Object.entries(GENERATORS)) {
    const output = gen();
    const { emitted } = truncate(output);
    assert.ok(
      emitted.length <= output.length + 200,
      `${category}: truncate grew ${output.length} -> ${emitted.length} chars`
    );
  }
});

test('fuzz invariant: filterErr exitCode=0 emits exactly one line', () => {
  for (const [category, gen] of Object.entries(GENERATORS)) {
    const { emitted } = filterErr(gen(), 0);
    assert.equal(emitted.split('\n').length, 1, `${category}: exit-0 emit was not a single line`);
  }
});

test('fuzz invariant: same input twice -> identical emitted everywhere', () => {
  for (const [, gen] of Object.entries(GENERATORS)) {
    const output = gen();
    for (const exitCode of [0, 1]) {
      assert.equal(filterErr(output, exitCode).emitted, filterErr(output, exitCode).emitted);
      assert.equal(truncate(output).emitted, truncate(output).emitted);
      for (const parser of ALL) {
        const first = parser.filter(output, exitCode).emitted;
        const second = parser.filter(output, exitCode).emitted;
        assert.equal(first, second, `parser ${parser.name} is nondeterministic`);
      }
    }
  }
});
