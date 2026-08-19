import { test } from 'node:test';
import assert from 'node:assert/strict';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('exam boundaries, human marks and real results persist locally', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?exam-features=${Date.now()}`);

  storage.saveExamBoundarySet({ id: 'aqa-june-2025', boardId: 'aqa-gcse', tier: 'higher', boundaries: { 9: 85, 8: 76 } });
  storage.recordExaminerMark({ boardId: 'aqa-gcse', appPercent: 72, examinerPercent: 70 });
  storage.recordRealExamResult({ boardId: 'aqa-gcse', predictedGrade: '7', actualGrade: '7' });

  assert.equal(storage.getExamBoundarySets().length, 1);
  assert.equal(storage.getExaminerScripts()[0].examinerPercent, 70);
  assert.equal(storage.getRealExamResults()[0].actualGrade, '7');
});
