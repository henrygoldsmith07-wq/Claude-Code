import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendNext, isPlateau, isMeaningfulPR, rirFromRpe, readinessScore } from "../src/lib/progression.js";
import { scoreSubstitution, rankedSubstitutions } from "../src/lib/substitutions.js";
import { weeklyVolume, frequencyByMuscleSync, strengthSeries } from "../src/lib/analytics.js";
import { generateSession } from "../src/lib/sessionGenerator.js";
import { runMigrations } from "../src/lib/store.js";
import { syncUp, syncDown } from "../src/lib/sync.js";
import { EXERCISE_BY_ID } from "../src/lib/data.js";

describe("progression", ()=>{
  it("recommendNext: no history returns low reps", ()=>{
    const r=recommendNext({ exerciseId:"bench-press-dumbbell", history:[], targetReps:"8–12"});
    assert.equal(r.reps, 8);
  });
  it("bodyweight adds reps until top", ()=>{
    const hist=[{ dateISO:"2026-01-01", blocks:[{ exerciseId:"push-up", sets:[{reps:"10", weightKg:""}]}]}];
    const r=recommendNext({ exerciseId:"push-up", history: hist, targetReps:"8–12"});
    assert.equal(r.reps, 11);
  });
  it("isPlateau false for rising, true for flat", ()=>{
    assert.equal(isPlateau([{reps:8,weightKg:20},{reps:9,weightKg:20},{reps:10,weightKg:20}]), false);
    assert.equal(isPlateau([{reps:8,weightKg:20},{reps:8,weightKg:20},{reps:8,weightKg:20}]), true);
  });
  it("rirFromRpe", ()=>{ assert.equal(rirFromRpe(8),2); assert.equal(rirFromRpe(null), null); });
  it("meaningful PR filters noise", ()=>{ assert.equal(isMeaningfulPR(100,101), false); assert.equal(isMeaningfulPR(100,103), true); });
  it("readiness 1..5 maps 0..100", ()=>{ assert.ok(readinessScore({sleep:5,soreness:1,motivation:5})>80); assert.ok(readinessScore({sleep:1,soreness:5,motivation:1})<25); });
});
describe("substitutions", ()=>{
  it("ranks by muscle+pattern, respects equipment", ()=>{
    const ranked=rankedSubstitutions("bench-press-barbell", ["dumbbells","bench","bodyweight"]);
    assert.ok(ranked.length>0);
    assert.ok(ranked.every(r=> r.equipment.every(eq=>["dumbbells","bench","bodyweight"].includes(eq)) || (r.equipment.length===1 && r.equipment[0]==="bodyweight")));
  });
  it("scoreSubstitution higher for same muscle", ()=>{
    const target=EXERCISE_BY_ID["bench-press-barbell"], same=EXERCISE_BY_ID["bench-press-dumbbell"], diff=EXERCISE_BY_ID["run-easy"];
    assert.ok(scoreSubstitution(target,same) > scoreSubstitution(target,diff));
  });
});
describe("analytics + generator + sync + migrations", ()=>{
  it("weeklyVolume groups", ()=>{
    const h=[{dateISO:"2026-01-05", blocks:[{exerciseId:"bench-press-dumbbell", sets:[{reps:"8",weightKg:"20"}]}]}, {dateISO:"2026-01-06", blocks:[{exerciseId:"bench-press-dumbbell", sets:[{reps:"8",weightKg:"20"}]}]}];
    const w=weeklyVolume(h); assert.ok(w.length>=1); assert.ok(w[0].vol>0);
  });
  it("frequencyByMuscleSync counts via byId", ()=>{
    const h=[{dateISO:"2026-01-01", blocks:[{exerciseId:"push-up", sets:[{reps:"10",weightKg:""}]}]}];
    const f=frequencyByMuscleSync(h, EXERCISE_BY_ID); assert.equal(f["Chest"],1);
  });
  it("generateSession respects equipment and explains why", ()=>{
    const s=generateSession({ goal:"strength", availableEquipment:["bodyweight"], history:[], length:3});
    assert.ok(s.blocks.length===3); assert.ok(s.blocks.every(b=> b.why && b.why.length>5));
  });
  it("runMigrations adds syncEnabled", ()=>{ const m=runMigrations({ version:1, onboarding:null, history:[], preferences:{ units:"kg", theme:null }}); assert.equal(m.version,2); assert.equal(m.preferences.syncEnabled,false); });
  it("syncUp/Down merge", async()=>{
    const store={ version:2, onboarding:null, history:[{ id:"a", dateISO:"2026-01-01", blocks:[]}], preferences:{units:"kg",theme:null}, activeSchedule:null};
    let pushed=null;
    const up=await syncUp(store, { push: async (p)=>{ pushed=p; }});
    assert.ok(pushed);
    const down=await syncDown({ ...store, history: [] }, { pull: async()=> JSON.stringify(up)}, "merge");
    assert.ok(down.history.some(h=> h.id==="a"));
  });
});
