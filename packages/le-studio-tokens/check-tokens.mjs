/**
 * Ensure shared token hex values stay aligned with french-practice le-studio.css.
 * Run: node packages/le-studio-tokens/check-tokens.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));
const cssPath = path.join(__dirname, '../../apps/french-practice/src/le-studio.css');
const css = fs.readFileSync(cssPath, 'utf8');

const pick = (src, name) => {
  const m = src.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  return m ? m[1].toLowerCase() : null;
};

const pairs = [
  ['bg', 'bg'],
  ['surface', 'surface'],
  ['ink', 'ink'],
  ['line', 'line'],
];

const errors = [];
for (const [tokenKey, cssKey] of pairs) {
  const expected = (tokens.light[tokenKey] || '').toLowerCase();
  const actual = pick(css, cssKey);
  if (!actual) {
    errors.push(`missing --${cssKey} in le-studio.css`);
    continue;
  }
  if (expected && actual !== expected) {
    errors.push(`--${cssKey}: tokens.json=${expected} css=${actual}`);
  }
}

if (errors.length) {
  console.error('Token check failed:');
  errors.forEach((e) => console.error(' ', e));
  process.exit(1);
}
console.log('Token check OK — light palette matches french-practice le-studio.css');
