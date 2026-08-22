import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lastExerciseSets, prsHitBySession, normaliseHistory, upsertHistory, saveStore, loadStore, runMigrations, STORE_SCHEMA_VERSION } from '../src/lib/store.js';

describe('store — lastExerciseSets / prsHitBySession (Life OS port)', () => {
  const hist = [
    { id: 'a', dateISO: '2026-01-01', title: 'Push + Legs', blocks: [{ exerciseId: 'bench-press-dumbbell', sets: [{ reps: '8', weightKg: '20' }, { reps: '8', weightKg: '20' }] }, { exerciseId: 'bodyweight-squat', sets: [{ reps: '12', weightKg: '' }] }] },
    { id: 'b', dateISO: '2026-01-03', title: 'Upper A', blocks: [{ exerciseId: 'bench-press-dumbbell', sets: [{ reps: '6', weightKg: '24' }] }] },
  ];

  it('returns most recent prior sets for an exercise', () => {
    const got = lastExerciseSets(hist, 'bench-press-dumbbell');
    assert.ok(got);
    assert.equal(got.dateISO, '2026-01-03');
    assert.equal(got.sets[0].weightKg, '24');
  });

  it('returns null when exercise never logged', () => {
    const got = lastExerciseSets(hist, 'pull-up');
    assert.equal(got, null);
  });

  it('detects new PR vs prior history (Epley)', () => {
    const prior = hist.slice(0, 1);
    const session = hist[1]; // 24×6 → 28.8 e1RM vs prior 20×8 → 25.3
    const hits = prsHitBySession(session, prior);
    const hit = hits.find(h => h.exerciseId === 'bench-press-dumbbell');
    assert.ok(hit, 'should hit a PR');
    assert.ok(hit.e1rm > 25);
  });

  it('does not flag bodyweight-only sets as PRs', () => {
    const session = { id: 'c', dateISO: '2026-01-05', title: 'Legs', blocks: [{ exerciseId: 'bodyweight-squat', sets: [{ reps: '15', weightKg: '' }] }] };
    const hits = prsHitBySession(session, hist);
    assert.ok(!hits.some(h => h.exerciseId === 'bodyweight-squat'));
  });

  it('upserts duplicate session ids and keeps the newer edited record', () => {
    const older = { id: 'same', dateISO: '2026-01-05', savedAt: '2026-01-05T10:00:00Z', blocks: [] };
    const newer = { id: 'same', dateISO: '2026-01-05', savedAt: '2026-01-05T11:00:00Z', blocks: [{ exerciseId: 'push-up', sets: [] }] };
    assert.equal(upsertHistory([older], newer).length, 1);
    assert.equal(upsertHistory([older], newer)[0].blocks[0].exerciseId, 'push-up');
    assert.equal(normaliseHistory([newer, older]).length, 1);
    assert.equal(normaliseHistory([newer, older])[0].savedAt, newer.savedAt);
  });
});

describe('store — resilience', () => {
  it('survives malformed rows that used to crash normalisation', () => {
    // A null block previously threw during the substitution scan, and the
    // caller's catch replaced ALL history with factory defaults.
    const good = { id: 'good', dateISO: '2026-01-01', blocks: [{ exerciseId: 'bench-press-dumbbell', sets: [{ reps: '8', weightKg: '20' }] }] };
    const messy = { id: 'messy', dateISO: '2026-01-02', blocks: [null] };
    const out = normaliseHistory([good, messy]);
    assert.equal(out.filter(e=> e?.id === 'good').length, 1);
    assert.equal(out.find(e=> e.id === 'good').blocks[0].substitutionFrom ?? null, null);
    // Junk entries are tolerated without destroying valid ones.
    const mixed = normaliseHistory([null, good, 'junk']);
    assert.equal(mixed.filter(e=> e?.id === 'good').length, 1);
  });

  it('reports persistence success instead of swallowing quota errors', () => {
    const mem = {};
    globalThis.localStorage = {
      getItem: k=> (k in mem ? mem[k] : null),
      setItem: (k, v)=> { mem[k] = String(v); },
      removeItem: k=> { delete mem[k]; },
    };
    try{
      assert.equal(saveStore({ version: STORE_SCHEMA_VERSION, history: [] }), true);
      globalThis.localStorage.setItem = ()=> { throw new Error('QuotaExceededError'); };
      assert.equal(saveStore({ version: STORE_SCHEMA_VERSION, history: [] }), false);
      // loadStore still returns a usable default when storage is unreadable.
      globalThis.localStorage.getItem = ()=> { throw new Error('SecurityError'); };
      assert.equal(loadStore().version, STORE_SCHEMA_VERSION);
    }finally{
      delete globalThis.localStorage;
    }
  });

  it('migrates a v5 store to the current schema with autoRest defaulted on', () => {
    const migrated = runMigrations({ version: 5, preferences: {}, history: [] });
    assert.equal(migrated.version, STORE_SCHEMA_VERSION);
    assert.equal(migrated.preferences.autoRest, true);
    // Explicit user choice survives migration.
    const kept = runMigrations({ version: 5, preferences: { autoRest: false }, history: [] });
    assert.equal(kept.preferences.autoRest, false);
  });
});
