// analytics.js — volume/frequency + actionable trend helpers.
// Pure helpers used by ProgressView visualizations.

export function weeklyVolume(history){
  const byWeek = {};
  for(const h of history||[]){
    const d = new Date(h.dateISO + "T00:00:00");
    const key = weekKey(d);
    let vol=0; for(const b of h.blocks||[]) for(const s of b.sets||[]) vol += (Number(s.reps)||0)*(Number(s.weightKg)||0);
    byWeek[key] = (byWeek[key]||0) + vol;
  }
  return Object.entries(byWeek).sort(([a],[b])=> a.localeCompare(b)).map(([week, vol])=> ({ week, vol: Math.round(vol) }));
}
function weekKey(d){ const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d-jan1)/86400000); const wk=Math.ceil((days+d.getDay()+1)/7); return `${d.getFullYear()}-W${String(wk).padStart(2,"0")}`; }

export function frequencyByMuscle(history){
  const counts={};
  for(const h of history||[]) for(const b of h.blocks||[]){
    const m = (awaitImportMuscle(b.exerciseId));
    if(m) counts[m]=(counts[m]||0)+1;
  }
  return counts;
}
let _byId=null; function awaitImportMuscle(id){ try{ if(!_byId){ _byId = require("./data.js").EXERCISE_BY_ID; } }catch{ return null; } return _byId?.[id]?.muscle || null; }

export function frequencyByMuscleSync(history, byId){
  const counts={};
  for(const h of history||[]) for(const b of h.blocks||[]){
    const m = byId?.[b.exerciseId]?.muscle; if(m) counts[m]=(counts[m]||0)+1;
  }
  return counts;
}

export function strengthSeries(history, exerciseId){
  const pts=[];
  for(const h of history||[]) for(const b of h.blocks||[]) if(b.exerciseId===exerciseId) for(const s of b.sets||[]){
    const w=Number(s.weightKg)||0, r=Number(String(s.reps).match(/\d+/)?.[0]||s.reps)||0; if(w&&r){ const e1rm=w*(1+r/30); pts.push({ dateISO:h.dateISO, e1rm: Math.round(e1rm), w, r }); }
  }
  return pts;
}

// Muscle-volume landmarks — cautious presentation (weekly sets per muscle vs rough ranges)
export function volumeLandmarks(history, byId){
  // Count weekly sets per muscle (last 4 weeks)
  const byMuscleWeek = {};
  for(const h of history||[]){
    const d = new Date(h.dateISO + "T00:00:00");
    const key = weekKey(d);
    for(const b of h.blocks||[]){
      const m = byId?.[b.exerciseId]?.muscle || 'Other';
      if(m==='Cardio') continue;
      const k = `${m}|${key}`;
      byMuscleWeek[k] = (byMuscleWeek[k]||0) + (b.sets||[]).length;
    }
  }
  // Average weekly sets per muscle over available weeks
  const byMuscle = {};
  for(const [k, sets] of Object.entries(byMuscleWeek)){
    const [muscle] = k.split('|');
    if(!byMuscle[muscle]) byMuscle[muscle] = [];
    byMuscle[muscle].push(sets);
  }
  const out = {};
  for(const [muscle, weekly] of Object.entries(byMuscle)){
    const avg = weekly.reduce((a,b)=>a+b,0)/weekly.length;
    // Cautious landmarks: these are rough, not prescriptions
    let band = 'low';
    if(avg >= 10) band = 'high';
    else if(avg >= 6) band = 'moderate';
    else if(avg >= 3) band = 'maintenance';
    out[muscle] = { avgWeeklySets: Math.round(avg*10)/10, band, weeks: weekly.length, note: 'Rough landmark — individual needs vary. Use as context, not a target.' };
  }
  return out;
}

export function volumeDistribution(history, byId){
  const byMuscle = {};
  let totalSets=0;
  for(const h of history||[]) for(const b of h.blocks||[]){
    const m = byId?.[b.exerciseId]?.muscle || 'Other';
    const n = (b.sets||[]).length;
    byMuscle[m] = (byMuscle[m]||0)+n;
    totalSets+=n;
  }
  const dist = Object.entries(byMuscle).map(([muscle, sets])=> ({ muscle, sets, pct: totalSets? Math.round(sets/totalSets*100):0 }));
  dist.sort((a,b)=> b.sets - a.sets);
  return { totalSets, byMuscle: dist };
}

export function strengthSeriesWithConfidence(history, exerciseId){
  const pts = strengthSeries(history, exerciseId);
  if(pts.length < 3) return { pts, slope: 0, confidence: 'low', n: pts.length };
  const ys = pts.map(p=> p.e1rm);
  const xs = ys.map((_,i)=> i);
  const mean = ys.reduce((a,b)=>a+b,0)/ys.length;
  const mx = xs.reduce((a,b)=>a+b,0)/xs.length;
  let num=0, den=0; for(let i=0;i<ys.length;i++){ num+=(xs[i]-mx)*(ys[i]-mean); den+=(xs[i]-mx)**2; }
  const slope = den ? num/den : 0;
  const ssTot = ys.reduce((a,y)=> a + (y-mean)**2,0);
  if(ssTot===0) return { pts, slope: Math.round(slope*100)/100, confidence: 'high', n: pts.length, r2: 1 };
  const yhat = xs.map(x=> mean + slope*(x-mx));
  const ssRes = ys.reduce((a,y,i)=> a + (y-yhat[i])**2,0);
  const r2 = Math.max(0, 1 - ssRes/ssTot);
  const confidence = r2>0.6 ? 'high' : r2>0.3 ? 'medium' : 'low';
  return { pts, slope: Math.round(slope*100)/100, r2: Math.round(r2*100)/100, confidence, n: pts.length };
}

// Extract future recommendations from workout notes (e.g. "next time try 22kg", "add a set")
export function extractNoteRecommendations(history){
  const out=[];
  for(const h of history||[]) if(h.note && h.note.trim()){
    const note = h.note.trim();
    const lower = note.toLowerCase();
    const hints=[];
    const loadM = note.match(/(\d+(?:\.\d+)?)\s*kg/);
    if(loadM) hints.push(`suggested load ${loadM[1]}kg`);
    if(/add.*set|extra set/.test(lower)) hints.push('add a set');
    if(/deload|easier|lighter/.test(lower)) hints.push('consider deload');
    if(/form|technique|rom|depth/.test(lower)) hints.push('form focus noted');
    if(hints.length) out.push({ dateISO: h.dateISO, note, hints });
  }
  return out;
}

export function actionAdvice({ weeklyVolume: wv, freq }){
  if(!wv.length) return "Log a couple sessions — then trends appear.";
  const last = wv[wv.length-1]?.vol||0, prev = wv[wv.length-2]?.vol||0;
  if(last > prev*1.2) return `Volume up ${Math.round((last/prev-1)*100)}% vs last week — hold steady or deload if RPE was high.`;
  if(last < prev*0.8 && prev>0) return "Volume dipped — good if planned deload, otherwise add a session.";
  const entries=Object.entries(freq||{}).sort((a,b)=> b[1]-a[1]);
  const top=entries[0], bot=entries[entries.length-1];
  if(entries.length>=3 && top && bot && top[1] > bot[1]*3) return `${top[0]} is ${top[1]}× more frequent than ${bot[0]} — add a ${bot[0]} day for balance.`;
  return "Trends look steady — keep progressing load or reps where RIR ≥2.";
}

// Planned vs completed helper is in data.js; re-export a thin wrapper for analytics consumers
export function plannedVsCompletedStats(schedule, history){
  // kept here for convenience; implementation lives in data.js to avoid cycle — inline simple version
  const doneIds = new Set((history||[]).map(h=> h.id));
  const total = schedule?.sessions?.length||0;
  const done = (schedule?.sessions||[]).filter(s=> doneIds.has(s.id) || s.status==='done').length;
  return { total, done, adherence: total? Math.round(done/total*100)/100 : null };
}
