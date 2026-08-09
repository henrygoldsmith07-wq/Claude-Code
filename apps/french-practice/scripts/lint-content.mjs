/**
 * Content lint for Le Studio French learning path.
 * Ensures each goal roadmap has 12 units × 5 lessons and required fields.
 * Exit 1 on failure (CI-friendly).
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// roadmaps.js is ESM-free data with export — load via dynamic import after path resolve
const roadmapsUrl = pathToFileURL(path.join(__dirname, '../src/lib/roadmaps.js')).href;

const LESSON_TYPES = new Set([
  'scenario', 'conversation', 'cards', 'grammar', 'dictation', 'reading', 'listening',
  'quickfire', 'pronunciation', 'culture', 'quiz', 'checkpoint', 'speaking',
  'roleplay', 'review', 'shadowing', 'write', 'writing',
]);

const errors = [];
const warnings = [];

const { getRoadmap } = await import(roadmapsUrl);

const goals = ['travel', 'school', 'business', 'fluency'];

for (const goal of goals) {
  const units = getRoadmap(goal);
  if (!units) {
    errors.push(`[${goal}] missing roadmap`);
    continue;
  }
  if (units.length !== 12) {
    errors.push(`[${goal}] expected 12 units, got ${units.length}`);
  }
  let lessons = 0;
  let hasSpeaking = 0;
  let hasNonSpeaking = 0;
  units.forEach((unit, ui) => {
    if (!unit.id) errors.push(`[${goal}] unit ${ui} missing id`);
    if (!unit.title) errors.push(`[${goal}] unit ${ui} missing title`);
    if (!Array.isArray(unit.lessons)) {
      errors.push(`[${goal}] unit ${unit.id || ui} missing lessons[]`);
      return;
    }
    if (unit.lessons.length !== 5) {
      errors.push(`[${goal}/${unit.id}] expected 5 lessons, got ${unit.lessons.length}`);
    }
    unit.lessons.forEach((lesson, li) => {
      lessons += 1;
      if (!lesson.type) errors.push(`[${goal}/${unit.id}#${li}] missing type`);
      else if (!LESSON_TYPES.has(lesson.type) && !String(lesson.type).includes('check')) {
        warnings.push(`[${goal}/${unit.id}#${li}] unusual type "${lesson.type}"`);
      }
      if (!lesson.title && !lesson.label) {
        warnings.push(`[${goal}/${unit.id}#${li}] missing title/label`);
      }
      const t = String(lesson.type || '');
      if (/scenario|checkpoint|conversation|roleplay|speaking|quickfire|pronunciation|shadowing/.test(t)) {
        hasSpeaking += 1;
      } else {
        hasNonSpeaking += 1;
      }
    });
  });
  if (lessons !== 60 && units.length === 12) {
    errors.push(`[${goal}] expected 60 lessons, got ${lessons}`);
  }
  if (hasSpeaking < 12) {
    warnings.push(`[${goal}] only ${hasSpeaking} speaking-tagged lessons (want ≥12)`);
  }
  if (hasNonSpeaking < 12) {
    warnings.push(`[${goal}] only ${hasNonSpeaking} non-speaking lessons`);
  }
}

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log('  ·', w));
}
if (errors.length) {
  console.error('Content lint failed:');
  errors.forEach((e) => console.error('  ✗', e));
  process.exit(1);
}
console.log(`Content lint OK — ${goals.length} goals, roadmaps valid.`);
