// warmup.js — generate warm-up sets from previous session + target load.
// Conservative, explains every suggestion.

import { epleyToLoad } from './progression.js';

export function warmupSets({ exerciseId, targetLoad, targetReps, lastSets }){
  // targetLoad: number kg (0 or null = bodyweight)
  // Returns array of { reps, weightKg, note } to prepend before work sets
  if(targetLoad==null || targetLoad<=0) {
    // Bodyweight / cardio — activation only
    return [
      { reps: '8', weightKg: '', note: 'Activation — slow, controlled' },
      { reps: '6', weightKg: '', note: 'Build to working tempo' },
    ];
  }
  // Standard ramp: 50% ×5, 70% ×3, 85% ×1-2
  const w1 = Math.max(0, snapWarmup(targetLoad*0.5));
  const w2 = Math.max(0, snapWarmup(targetLoad*0.7));
  const w3 = Math.max(0, snapWarmup(targetLoad*0.85));
  const out = [];
  if(w1) out.push({ reps: '5', weightKg: String(w1), note: 'Warm-up 50%' });
  if(w2 && w2!==w1) out.push({ reps: '3', weightKg: String(w2), note: 'Warm-up 70%' });
  if(w3 && w3!==w2) out.push({ reps: '1', weightKg: String(w3), note: 'Warm-up 85% — feel the load' });
  // If last session was heavier, mention it
  if(lastSets && lastSets[0] && Number(lastSets[0].weightKg) > targetLoad) {
    out.push({ reps: String(targetReps||'5'), weightKg: String(targetLoad), note: `Work sets at ${targetLoad}kg` });
  }
  return out;
}

function snapWarmup(v){
  if(v<20) return Math.round(v/1);
  if(v<60) return Math.round(v/2.5)*2.5;
  return Math.round(v/5)*5;
}

// Estimate rest between sets (seconds) from exercise + load + RPE
export function recommendedRest({ exerciseId, load, rpe, setIndex, totalSets }){
  const heavy = load && load >= 60;
  const nearFailure = rpe!=null && Number(rpe) >= 8;
  let base = 90;
  if(/squat|deadlift|bench|press|pull-up/.test(exerciseId||'')) base = heavy ? 150 : 120;
  if(/isolation|raise|curl|plank|dead-bug/.test(exerciseId||'')) base = 60;
  if(nearFailure) base += 30;
  if(setIndex === totalSets-1) base = Math.max(60, base-15); // last set slightly shorter
  return base;
}

// Predict session duration (minutes) from blocks + warm-ups + rests
export function predictSessionDuration(blocks){
  let totalSec = 0;
  for(const b of blocks||[]){
    const sets = Number(b.sets)||3;
    const rest = Number(b.restSec)||90;
    const warmups = b.warmups ? b.warmups.length : 0;
    // 45s per set execution + rest between sets + warm-up time
    totalSec += sets*45 + Math.max(0, sets-1)*rest + warmups*60;
    totalSec += 90; // transition between exercises
  }
  return Math.max(8, Math.round(totalSec/60));
}

// Superset compatibility scoring (0..1)
export function supersetScore(aId, bId, byId){
  const a = byId?.[aId], b = byId?.[bId];
  if(!a || !b) return 0.5;
  if(a.muscle === b.muscle) return 0.2; // same muscle — poor
  const pushPull = new Set(['Chest|Back','Chest|Glutes','Back|Legs','Shoulders|Legs','Arms|Legs','Core|Legs','Cardio|Core']);
  const key = [a.muscle,b.muscle].sort().join('|');
  if(pushPull.has(key)) return 0.95;
  if(a.muscle==='Cardio' || b.muscle==='Cardio') return 0.3; // don't superset cardio
  return 0.7;
}

export function bestSupersets(blocks, byId){
  if(!blocks || blocks.length < 4) return [];
  const pairs=[];
  for(let i=0;i<blocks.length;i++) for(let j=i+1;j<blocks.length;j++){
    const score = supersetScore(blocks[i].exerciseId, blocks[j].exerciseId, byId);
    pairs.push({ a: blocks[i].exerciseId, b: blocks[j].exerciseId, score });
  }
  pairs.sort((x,y)=> y.score - x.score);
  return pairs.slice(0, 2).map(p=> [p.a, p.b]);
}

// Fatigue-aware ordering: heavy compounds first, isolation/core last, push/pull alternated
export function fatigueAwareOrder(blocks, byId){
  if(!blocks || blocks.length<=2) return blocks;
  const score = (b)=>{
    const ex = byId?.[b.exerciseId];
    if(!ex) return 0;
    let s=0;
    if(/squat|deadlift|bench|barbell/.test(b.exerciseId)) s+=10;
    if(ex.muscle==='Legs' || ex.muscle==='Back') s+=4;
    if(ex.muscle==='Core' || ex.muscle==='Arms') s-=5;
    if(ex.muscle==='Cardio') s-=10;
    return s;
  };
  return [...blocks].sort((a,b)=> score(b)-score(a));
}
