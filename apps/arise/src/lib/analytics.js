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
// synchronous lookup without async: import synchronously via require-like map is fine here — we lazily import EXERCISE_BY_ID
let _byId=null; function awaitImportMuscle(id){ try{ if(!_byId){ _byId = require("./data.js").EXERCISE_BY_ID; } }catch{ return null; } return _byId?.[id]?.muscle || null; }
// fallback inline to avoid require issues: caller can also pass EXERCISE_BY_ID

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
