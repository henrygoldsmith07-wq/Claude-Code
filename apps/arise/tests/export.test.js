import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportPayload, parseImportFile, mergeStores } from '../src/lib/export.js';

describe('export / import', ()=>{
  it('round-trips and merges', ()=>{
    const store = { version:1, onboarding:{goal:'strength',equipment:['dumbbells'],location:'home'}, activeSchedule:null, history:[{id:'a',dateISO:'2026-01-01'}], preferences:{units:'kg'}};
    const payload = buildExportPayload(store);
    const parsed = parseImportFile(JSON.stringify(payload));
    assert.deepEqual(parsed, store);

    const current = { version:1, onboarding:null, activeSchedule:null, history:[{id:'a',dateISO:'2026-01-01'},{id:'b',dateISO:'2026-01-02'}], preferences:{} };
    const imported = { version:1, onboarding:{goal:'general'}, activeSchedule:null, history:[{id:'a',dateISO:'2026-01-01'},{id:'c',dateISO:'2026-01-03'}], preferences:{} };
    const merged = mergeStores(current, imported, 'merge');
    assert.equal(merged.history.length, 3);
    const replaced = mergeStores(current, imported, 'replace');
    assert.equal(replaced.history.length, 2);
  });

  it('rejects non-json', ()=>{
    assert.throws(()=> parseImportFile('not json'));
  });
});
