// sessionGenerator.js — build a session from goal + availableEquipment + recent history.
// Explains why each block was chosen.
import { EXERCISES, EXERCISE_BY_ID } from "./data.js";
import { recommendNext } from "./progression.js";
import { rankedSubstitutions } from "./substitutions.js";

export function generateSession({ goal="general", availableEquipment=[], history=[], length=5, includeWarmup=true }){
  const has = new Set(availableEquipment);
  let pool = EXERCISES.filter(e=> e.equipment.every(eq=> has.has(eq)) || (e.equipment.length===1 && e.equipment[0]==="bodyweight"));
  if(!pool.length) pool = EXERCISES.filter(e=> e.equipment.length===1 && e.equipment[0]==="bodyweight");
  const bias = { strength: ["Legs","Back","Chest","Shoulders","Glutes"], muscle: ["Chest","Back","Legs"], endurance: ["Cardio","Full body","Core"], "fat-loss": ["Full body","Cardio","Legs"], general: [] }[goal] || [];
  pool.sort((a,b)=> {
    const ai = bias.indexOf(a.muscle), bi = bias.indexOf(b.muscle);
    const av = ai===-1? 99: ai; const bv = bi===-1? 99: bi; return av - bv;
  });
  // Ensure variety: pick one per muscle round-robin
  const seenMuscle=new Set(); const picked=[];
  for(const ex of pool){ if(picked.length>=length) break; if(!seenMuscle.has(ex.muscle) || picked.length>2){ picked.push(ex); seenMuscle.add(ex.muscle); } }
  // Fill remainder
  for(const ex of pool){ if(picked.length>=length) break; if(!picked.some(p=> p.id===ex.id)) picked.push(ex); }
  const blocks = picked.map(ex=>{
    const rec = recommendNext({ exerciseId: ex.id, history, targetReps: "8–12" });
    const sets = 3, reps = rec.reps || "8", loadHint = rec.load != null && rec.load>0 ? `${rec.load}kg` : (rec.load===null? "bodyweight": "as prescribed");
    const isUnilateral = /lunge|split|single|bulgarian/i.test(ex.id);
    return {
      exerciseId: ex.id, sets, reps: String(reps), restSec: ex.muscle==="Cardio"?0:90, loadHint,
      why: rec.reason, unilateral: isUnilateral, includeWarmup,
    };
  });
  // Superset hint: pair push+pull or legs+core as supersets when length>=4
  const supersets = [];
  if(blocks.length>=4){
    supersets.push([blocks[0].exerciseId, blocks[1].exerciseId]);
  }
  return { blocks, supersets };
}
