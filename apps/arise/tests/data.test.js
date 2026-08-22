import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchExercises, recommendExercises, validateContent, availablePrograms, scheduleProgram, EXERCISES, PROGRAMS } from '../src/lib/data.js';

describe('arise data', ()=>{
  it('validates', ()=>{
    const errs = validateContent();
    assert.equal(errs.length, 0, errs.join('\n'));
  });

  it('searchExercises filters by muscle', ()=>{
    const res = searchExercises({ muscle: 'Chest' });
    assert.ok(res.length>0);
    assert.ok(res.every(r=> r.muscle==='Chest'));
  });

  it('only-my-kit gates correctly', ()=>{
    const res = searchExercises({ availableEquipment: ['bodyweight'] });
    // bodyweight moves should remain, barbell bench should not without barbell
    const hasPushup = res.some(r=> r.id==='push-up');
    const hasBarbellBench = res.some(r=> r.id==='bench-press-barbell');
    assert.ok(hasPushup);
    assert.equal(hasBarbellBench, false);
  });

  it('recommendations change with equipment', ()=>{
    const a = recommendExercises({ goal:'strength', availableEquipment:['bodyweight'], limit: 8 }).map(x=>x.id);
    const b = recommendExercises({ goal:'strength', availableEquipment:['barbell','dumbbells','bench','pullup-bar'], limit: 8 }).map(x=>x.id);
    assert.notDeepEqual(a,b);
  });

  it('availablePrograms filters by kit', ()=>{
    const onlyBody = availablePrograms(['bodyweight','bands']).map(p=>p.id);
    assert.ok(onlyBody.includes('move-anywhere'));
    assert.equal(onlyBody.includes('strength-4x'), false);
  });

  it('scheduleProgram creates dated sessions', ()=>{
    const sched = scheduleProgram({ programId: PROGRAMS[0].id, startDateISO: '2026-01-05' });
    assert.ok(sched.sessions.length>0);
    assert.ok(sched.sessions[0].dateISO==='2026-01-05');
    assert.ok(sched.sessions.every(s=> s.status==='planned'));
  });
});

describe('expanded exercise library', ()=>{
  const MUSCLES = [...new Set(EXERCISES.map(e=> e.muscle))];

  it('grew past the original 39-exercise library with no duplicate identities', ()=>{
    assert.ok(EXERCISES.length >= 75, `library has ${EXERCISES.length} exercises`);
    const ids = new Set(EXERCISES.map(e=> e.id));
    assert.equal(ids.size, EXERCISES.length);
    const names = new Set(EXERCISES.map(e=> e.name));
    assert.equal(names.size, EXERCISES.length);
  });

  it('covers every muscle with a floor and a bodyweight option', ()=>{
    for(const muscle of MUSCLES){
      const inMuscle = EXERCISES.filter(e=> e.muscle===muscle);
      assert.ok(inMuscle.length >= 3, `${muscle} has only ${inMuscle.length}`);
      assert.ok(inMuscle.some(e=> e.equipment.includes('bodyweight')), `${muscle} has no bodyweight option`);
    }
  });

  it('declares valid progression modes and cues on every record', ()=>{
    for(const e of EXERCISES){
      assert.ok(['load','reps','time'].includes(e.progression), `${e.id}: ${e.progression}`);
      assert.ok(Array.isArray(e.cues) && e.cues.length > 0, `${e.id}: no cues`);
      assert.ok(Array.isArray(e.equipment) && e.equipment.length > 0, `${e.id}: no equipment`);
    }
  });

  it('keeps the substitution graph fully reciprocal after expansion', ()=>{
    const byId = new Map(EXERCISES.map(e=> [e.id, e]));
    for(const e of EXERCISES) for(const t of e.substitution||[]){
      assert.ok(byId.has(t), `${e.id} → unknown ${t}`);
      assert.ok(byId.get(t).substitution.includes(e.id), `${e.id} → ${t} is one-way`);
    }
  });

  it('bodyweight-only users keep at least one pure-bodyweight option per muscle', ()=>{
    for(const muscle of MUSCLES){
      const bw = EXERCISES.filter(e=> e.muscle===muscle && e.equipment.every(eq=> eq==='bodyweight'));
      assert.ok(bw.length >= 1, `${muscle}: bodyweight-only users stuck with ${bw.length}`);
    }
  });
});
