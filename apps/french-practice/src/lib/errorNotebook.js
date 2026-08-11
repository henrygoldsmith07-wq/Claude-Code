// Error notebook — every correction is stored with why + recurrence and surfaced as drills.
// Require learner correction (retype) rather than just showing the answer.

const KEY = 'fp.errorNotebook';

function readRaw(){ try{ const v=localStorage.getItem(KEY); return v? JSON.parse(v): []; }catch{ return []; } }
function writeRaw(v){ try{ localStorage.setItem(KEY, JSON.stringify(v.slice(0,200))); }catch{} }

export function getErrorNotebook(){ return readRaw(); }

export function addErrorNotebook({ original, corrected, why, ruleId }){
  if(!original || !corrected || original===corrected) return readRaw();
  const list = readRaw();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const existing = list.find(e=> e.corrected===corrected && e.original===original);
  if(existing){ existing.count = (existing.count||1)+1; existing.lastAt = new Date().toISOString(); existing.recurrence = (existing.recurrence||0)+1; writeRaw(list); return list; }
  list.unshift({ id, original, corrected, why: why||'', ruleId: ruleId||null, at: new Date().toISOString(), count: 1, recurrence: 0, correctedByLearner: false });
  writeRaw(list);
  return list;
}

export function markCorrectedByLearner(id, typed){
  const list = readRaw();
  const e = list.find(x=> x.id===id);
  if(!e) return false;
  const ok = e.corrected.trim().toLowerCase() === String(typed).trim().toLowerCase();
  if(ok) e.correctedByLearner = true;
  writeRaw(list);
  return ok;
}

export function errorNotebookStats(){
  const list = readRaw();
  const recurrences = list.reduce((a,e)=>a+(e.recurrence||0),0);
  const pending = list.filter(e=> !e.correctedByLearner).length;
  return { total: list.length, recurrences, pending };
}
