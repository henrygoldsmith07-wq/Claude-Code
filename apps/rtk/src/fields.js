'use strict';

// Extractors for information-retention benchmark.
// Each extractor returns array of strings found in raw output (unique).
// Retention measures whether each raw field instance survives filtering.

const FIELD_DEFS = [
  {
    id: 'filename',
    label: 'filename',
    re: /\b[\w./\\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|kt|tf|yaml|yml|json|toml|tsx?)\b/gi,
    extract: (text) => {
      const m = text.match(/\b[\w./\\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|kt|tf|yaml|yml|json|toml)\b/gi);
      return m ? [...new Set(m.map(s => s.trim()))] : [];
    }
  },
  {
    id: 'path',
    label: 'path',
    re: /(?:^|\s)(?:\.{1,2}\/|\/|src\/|tests?\/|C:\\|\\|\/home\/|\/workspace\/)[\w./\\-]+\.(?:ts|js|tsx|jsx|py|rs|go|java|kt|tf)/gi,
    extract: (text) => {
      const m = text.match(/(?:^|\s)(?:\.{1,2}\/|\/|src\/|tests?\/|C:\\|\\|\/home\/|\/workspace\/)[\w./\\-]+\.(?:ts|js|tsx|jsx|py|rs|go|java|kt|tf)/gi);
      return m ? [...new Set(m.map(s => s.trim()))] : [];
    }
  },
  {
    id: 'line_number',
    label: 'line number',
    re: /:\d+(?::\d+)?/g,
    extract: (text) => {
      const m = text.match(/:\d+:\d+|:\d+/g);
      return m ? [...new Set(m)] : [];
    }
  },
  {
    id: 'column',
    label: 'column',
    re: /:\d+:\d+/g,
    extract: (text) => {
      const m = text.match(/:\d+:\d+/g);
      return m ? [...new Set(m)] : [];
    }
  },
  {
    id: 'error_type',
    label: 'error type',
    re: /error TS\d+|error\[E\d+\]|AssertionError|TypeError|ReferenceError|F\d{3}|E\d{3}|E\d{4}|BUILD (?:FAILURE|FAILED)|CrashLoopBackOff|ImagePullBackOff|Error:|FAIL\b/gi,
    extract: (text) => {
      const m = text.match(/error TS\d+|error\[E\d+\]|AssertionError|TypeError|ReferenceError|F\d{3}|E\d{3}|BUILD (?:FAILURE|FAILED)|CrashLoopBackOff|Error:/gi);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'failed_test_name',
    label: 'failed test name',
    re: /FAIL\s+.*|FAILED\s+.*|--- FAIL:.*|✕\s+.*|×\s+.*/g,
    extract: (text) => {
      const m = text.match(/FAIL\s+.*|FAILED\s+.*|--- FAIL:.*|✕\s+.*|×\s+.*/g);
      return m ? [...new Set(m.map(s=>s.trim()).filter(s=>s.length<200))] : [];
    }
  },
  {
    id: 'expected_value',
    label: 'expected value',
    re: /Expected:\s*.*|-\s*".*".*,|E\s+assert.*==|Expected\s+.*to equal/gi,
    extract: (text) => {
      const m = text.match(/Expected:\s*.*|Expected\s+.*to equal.*|E\s+assert.*==.*/g);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'actual_value',
    label: 'actual value',
    re: /Received:\s*.*|\+\s*".*".*,|E\s+assert \d+ ==/gi,
    extract: (text) => {
      const m = text.match(/Received:\s*.*|\+\s*".*".*,?/g);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'stack_frame',
    label: 'relevant stack frame',
    re: /at\s+.*:\d+:\d+|File ".*", line \d+|❯\s+.*:\d+:\d+/g,
    extract: (text) => {
      const raw = text.match(/at\s+.*:\d+:\d+|File ".*", line \d+|❯\s+.*:\d+:\d+/g);
      if (!raw) return [];
      // Exclude internal/node_modules frames — those are intentionally collapsed
      const filtered = raw.filter(s => !/node:internal|node_modules\/(vitest|jest|typescript)\//i.test(s));
      return [...new Set(filtered.map(s=>s.trim()))];
    }
  },
  {
    id: 'exit_status',
    label: 'exit status',
    re: /exit code \d+|BUILD (?:FAILURE|FAILED|SUCCESS)|Process completed|Tests?\s+\d+ (?:failed|passed)|Test Files.*failed/gi,
    extract: (text) => {
      const m = text.match(/exit code \d+|BUILD (?:FAILURE|FAILED|SUCCESS)|Process completed|Tests?\s+\d+ (?:failed|passed)|Test Files.*failed/gi);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'command',
    label: 'command',
    re: /npm (?:test|run|ci)|yarn|pnpm|cargo test|go test|pytest|tsc|eslint|gradle|mvn|docker|kubectl|terraform/gi,
    extract: (text) => {
      const m = text.match(/npm (?:test|run|ci)|yarn|pnpm|cargo test|go test|pytest|tsc|eslint|gradle|mvn|docker|kubectl|terraform/gi);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'warning_type',
    label: 'warning type',
    re: /warning:\s*.*|WARN.*|Warning\s+.*|✖.*warning/gi,
    extract: (text) => {
      const m = text.match(/warning:\s*.*|Warning\s+.*|WARN.*/gi);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'root_cause',
    label: 'root-cause context',
    re: /Caused by:.*|note:.*|help:.*|Fix the.*|Try:.*/gi,
    extract: (text) => {
      const m = text.match(/Caused by:.*|note:.*|help:.*|Fix the.*|Try:.*/gi);
      return m ? [...new Set(m.map(s=>s.trim()))] : [];
    }
  },
  {
    id: 'remediation',
    label: 'actionable remediation clues',
    re: /Fix.*|--force|--legacy-peer-deps|--fix|Try.*|help:.*|hint:.*/gi,
    extract: (text) => {
      const m = text.match(/Fix.*|--force|--legacy-peer-deps|--fix|Try.*|help:.*|hint:.*/gi);
      return m ? [...new Set(m.map(s=>s.trim().slice(0,120)))] : [];
    }
  },
];

function extractAllFields(text) {
  const out = {};
  for (const def of FIELD_DEFS) {
    out[def.id] = def.extract(text);
  }
  return out;
}

function retentionForField(rawValues, emittedText) {
  if (!rawValues.length) return { applicable: false, total: 0, retained: 0, retentionPct: null, missing: [] };
  let retained = 0;
  const missing = [];
  for (const v of rawValues) {
    if (emittedText.includes(v)) retained++;
    else missing.push(v);
  }
  return { applicable: true, total: rawValues.length, retained, retentionPct: Math.round((retained / rawValues.length)*100), missing };
}

function scoreRetention(rawText, emittedText) {
  const rawFields = extractAllFields(rawText);
  const perField = {};
  for (const def of FIELD_DEFS) {
    perField[def.id] = retentionForField(rawFields[def.id], emittedText);
    perField[def.id].label = def.label;
  }
  return { rawFields, perField };
}

module.exports = { FIELD_DEFS, extractAllFields, retentionForField, scoreRetention };
