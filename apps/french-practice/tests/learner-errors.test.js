import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLearnerErrorModel,
  recordLearnerError,
  recordLearnerSuccess,
  prioritiseLearnerErrors,
  learnerErrorSummary,
} from '../src/lib/learnerErrors.js';

test('learner errors persist across modes and resolve only after two clean passes', () => {
  let model = createLearnerErrorModel();
  model = recordLearnerError(model, {
    category: 'grammar',
    key: 'articles',
    label: 'Articles & partitives',
    mode: 'conversation',
    score: 45,
    detail: 'Conversation classification',
  }, { at: '2026-08-01T10:00:00.000Z' });
  model = recordLearnerSuccess(model, {
    category: 'grammar',
    key: 'articles',
    mode: 'grammar',
    score: 82,
  }, { at: '2026-08-02T10:00:00.000Z' });
  model = recordLearnerSuccess(model, {
    category: 'grammar',
    key: 'articles',
    mode: 'grammar',
    score: 91,
  }, { at: '2026-08-03T10:00:00.000Z' });

  let entry = model.entries[0];
  assert.equal(entry.status, 'resolved');
  assert.deepEqual(entry.modes, ['conversation', 'grammar']);
  assert.equal(entry.cleanPasses, 2);

  model = recordLearnerError(model, {
    category: 'grammar',
    key: 'articles',
    label: 'Articles & partitives',
    mode: 'writing',
    score: 55,
  }, { at: '2026-08-04T10:00:00.000Z' });
  entry = model.entries[0];
  assert.equal(entry.status, 'active');
  assert.equal(entry.recurrenceCount, 1);
  assert.deepEqual(entry.modes, ['conversation', 'grammar', 'writing']);
});

test('error prioritisation and category summaries expose the reusable gap model', () => {
  let model = createLearnerErrorModel();
  model = recordLearnerError(model, { category: 'vocabulary', key: 'item:bonjour', label: 'bonjour', mode: 'cards', count: 3 }, { at: '2026-08-01T10:00:00.000Z' });
  model = recordLearnerError(model, { category: 'listening', key: 'dictation', label: 'Dictée', mode: 'dictation' }, { at: '2026-08-02T10:00:00.000Z' });
  model = recordLearnerError(model, { category: 'pronunciation', key: 'mode:pronunciation', label: 'Read-aloud clarity', mode: 'pronunciation' }, { at: '2026-08-03T10:00:00.000Z' });

  const prioritised = prioritiseLearnerErrors(model, { limit: 10 });
  assert.equal(prioritised[0].category, 'vocabulary');
  assert.deepEqual(new Set(prioritised.slice(1).map((entry) => entry.category)), new Set(['listening', 'pronunciation']));
  const summary = learnerErrorSummary(model);
  assert.equal(summary.totalEntries, 3);
  assert.equal(summary.totalErrors, 5);
  assert.equal(summary.byCategory.listening.active, 1);
  assert.equal(summary.byCategory.pronunciation.entries, 1);
});
