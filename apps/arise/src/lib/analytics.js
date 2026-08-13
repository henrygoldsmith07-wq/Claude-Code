// analytics.js — volume/frequency + actionable trend helpers.
// Pure helpers used by ProgressView visualizations.

import { recommendNext } from "./progression.js";

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
// Monday-start week keys (week 1 = the week containing Jan 1). The old ceil formula
// split a Monday-start week across two keys (e.g. Mon 5 Jan → W01 but Wed 7 Jan → W02),
// which diluted volume-based signals like deload detection. offset = days since Monday.
function weekKey(d){ const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d-jan1)/86400000); const offset=(d.getDay()+6)%7; const wk=Math.floor((days-offset+7)/7); return `${d.getFullYear()}-W${String(wk).padStart(2,"0")}`; }

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

// ── Validation analytics ──────────────────────────────────────────────
// These turn logged history + readiness into evidence about whether the engine's
// rules (readiness, deloads, recommendations) actually track real performance.

function pearson(xs, ys){
  const n = xs.length;
  if(n < 2) return null;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for(let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); dx += (xs[i]-mx)**2; dy += (ys[i]-my)**2; }
  if(dx===0 || dy===0) return null;
  return num/Math.sqrt(dx*dy);
}

// Readiness ↔ performance: correlate each session's readiness score (same day, or
// nearest prior log within 3 days) with how that session actually went — average set
// RPE (lower = better) and total volume. Validates the readiness model against
// real logged effort instead of trusting the score on faith.
export function readinessPerformanceCorrelation(history, readinessLog){
  const byDate = new Map((readinessLog||[]).map(r=> [r.dateISO, Number(r.score)]));
  const scoreFor = (dateISO)=>{
    if(byDate.has(dateISO)) return byDate.get(dateISO);
    const t = Date.parse(dateISO+'T00:00:00');
    let best=null, bestD=3*86400000;
    for(const [d, s] of byDate){ const diff = t - Date.parse(d+'T00:00:00'); if(diff>=0 && diff<=bestD){ bestD=diff; best=s; } }
    return best;
  };
  const rpePairs=[], volPairs=[];
  for(const h of history||[]){
    const s = scoreFor(h.dateISO);
    if(s==null) continue;
    let vol=0; const rpes=[];
    for(const b of h.blocks||[]) for(const st of b.sets||[]){
      vol += (Number(st.reps)||0)*(Number(st.weightKg)||0);
      if(st.rpe != null && String(st.rpe).trim()!==''){ const r=Number(st.rpe); if(Number.isFinite(r)) rpes.push(r); }
    }
    if(rpes.length) rpePairs.push([s, rpes.reduce((a,b)=>a+b,0)/rpes.length]);
    if(vol>0) volPairs.push([s, vol]);
  }
  const rRPE = pearson(rpePairs.map(p=>p[0]), rpePairs.map(p=>p[1]));
  const rVolume = pearson(volPairs.map(p=>p[0]), volPairs.map(p=>p[1]));
  const round = v=> v==null? null : Math.round(v*1000)/1000;
  let interpretation;
  if(rpePairs.length < 5) interpretation = 'Not enough matched sessions to judge readiness yet.';
  else if(rRPE != null && rRPE < -0.2) interpretation = 'Readiness tracks session difficulty — higher readiness precedes easier sessions.';
  else if(rRPE != null && rRPE > 0.2) interpretation = 'Readiness is inverted — sessions feel harder on high-readiness days.';
  else interpretation = 'Weak link between readiness and session RPE — treat the score as a light signal.';
  return { n: rpePairs.length, nVolume: volPairs.length, rRPE: round(rRPE), rVolume: round(rVolume), interpretation };
}

// Deload outcomes: find volume-cut weeks (≤75% of the prior week) and measure whether
// strength (mean e1RM) improved in the following fortnight. Validates deload triggers
// against real post-deload performance.
export function deloadOutcomes(history){
  const wv = weeklyVolume(history||[]);
  if(wv.length < 4) return { n: 0, events: [], improvedRate: null, note: 'Need 4+ weeks of data to judge deloads.' };
  const events=[];
  const meanE1rmForWeeks = (weeks)=>{
    const wk = new Set(weeks.filter(Boolean));
    const vals=[];
    for(const h of history||[]){
      if(!wk.has(weekKey(new Date(h.dateISO+'T00:00:00')))) continue;
      for(const b of h.blocks||[]) for(const s of b.sets||[]){
        const w=Number(s.weightKg)||0, r=Number(String(s.reps).match(/\d+/)?.[0]||s.reps)||0;
        if(w>0 && r>0) vals.push(w*(1+r/30));
      }
    }
    return vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  for(let i=1;i<wv.length;i++){
    const prev=wv[i-1].vol, cur=wv[i].vol;
    if(prev>0 && cur <= prev*0.75){
      const before = meanE1rmForWeeks([wv[i-2]?.week, wv[i-1]?.week]);
      const after = meanE1rmForWeeks([wv[i+1]?.week, wv[i+2]?.week]);
      if(before && after){
        const change = (after-before)/Math.max(1,before);
        events.push({ deloadWeek: wv[i].week, volumeCutPct: Math.round((1-cur/prev)*100), next2wE1rmChangePct: Math.round(change*1000)/10, improved: change > 0.005 });
      }
    }
  }
  const improvedRate = events.length ? Math.round(events.filter(e=>e.improved).length/events.length*100) : null;
  return { n: events.length, events, improvedRate, note: improvedRate==null ? 'No deload weeks detected.' : `Deloads preceded strength gains in the next fortnight ${improvedRate}% of the time.` };
}

// Mesocycle comparison: chunk history into ~4-week blocks and compare the last cycle
// to the previous one (avg e1RM, volume, session count).
export function mesocycleComparison(history){
  const sessions = (history||[]).filter(h=> h.dateISO).sort((a,b)=> a.dateISO.localeCompare(b.dateISO));
  if(sessions.length < 8) return { cycles: [], note: 'Need 8+ sessions (roughly two cycles) to compare.' };
  const blocks=[];
  let cur=null, curStart=0;
  for(const h of sessions){
    const t = Date.parse(h.dateISO+'T00:00:00');
    if(!cur){ cur={sessions:1, e1rms:[], volume:0}; curStart=t; blocks.push(cur); }
    else if(t - curStart >= 28*86400000){ cur={sessions:1, e1rms:[], volume:0}; curStart=t; blocks.push(cur); }
    else cur.sessions++;
    for(const b of h.blocks||[]) for(const s of b.sets||[]){
      const w=Number(s.weightKg)||0, r=Number(String(s.reps).match(/\d+/)?.[0]||s.reps)||0;
      cur.volume += (Number(s.reps)||0)*w;
      if(w>0 && r>0) cur.e1rms.push(w*(1+r/30));
    }
  }
  const cycles = blocks.map((bl,i)=> ({
    index: i+1, sessions: bl.sessions,
    volume: Math.round(bl.volume),
    avgE1rm: bl.e1rms.length? Math.round(bl.e1rms.reduce((a,b)=>a+b,0)/bl.e1rms.length*10)/10 : null,
  }));
  const last = cycles[cycles.length-1], prev = cycles[cycles.length-2];
  if(!prev) return { cycles, note: 'One cycle so far — log another to compare.' };
  const comparison = {
    e1rmChangePct: last.avgE1rm && prev.avgE1rm ? Math.round((last.avgE1rm/prev.avgE1rm - 1)*1000)/10 : null,
    volumeChangePct: prev.volume ? Math.round((last.volume/prev.volume - 1)*1000)/10 : null,
    sessionChange: last.sessions - prev.sessions,
  };
  return { cycles, last, previous: prev, comparison, note: `Cycle ${last.index} vs cycle ${prev.index}.` };
}

// Completion by exercise: which planned exercises get skipped most. Deepens the
// planned-vs-completed view from a single adherence number to per-exercise detail.
export function completionByExercise(schedule, history){
  const planned = new Map();
  for(const s of (schedule?.sessions||[])) for(const b of s.blocks||[]) planned.set(b.exerciseId, (planned.get(b.exerciseId)||0)+1);
  if(!planned.size) return { total: 0, byExercise: [] };
  const done = new Map();
  const doneIds = new Set((history||[]).map(h=> h.id));
  for(const s of (schedule?.sessions||[])){
    if(!doneIds.has(s.id) && s.status!=='done') continue;
    for(const b of s.blocks||[]) done.set(b.exerciseId, (done.get(b.exerciseId)||0)+1);
  }
  const byExercise = [...planned.entries()].map(([id, n])=> {
    const d = done.get(id)||0;
    return { exerciseId: id, planned: n, done: d, skipped: n-d, completionPct: Math.round(d/n*100) };
  }).sort((a,b)=> b.skipped - a.skipped);
  return { total: byExercise.length, byExercise };
}

// Recommendation follow-through: when the user logs at least what recommendNext advised,
// did their e1RM gain on that exercise beat sessions where they under-delivered?
// Measures both acceptance and whether recommendations improve future performance.
export function recommendationFollowThrough(history){
  const byEx = new Map();
  for(const h of history||[]) for(const b of h.blocks||[]) {
    if(!byEx.has(b.exerciseId)) byEx.set(b.exerciseId, []);
    const best = (b.sets||[]).map(s=> ({ w:Number(s.weightKg)||0, r:Number(String(s.reps).match(/\d+/)?.[0]||s.reps)||0 })).filter(x=> x.w>0||x.r>0);
    if(best.length) byEx.get(b.exerciseId).push({ dateISO:h.dateISO, sets: best });
  }
  let followed=0, total=0; const gainsF=[], gainsN=[];
  const e1 = s=> (s.w||0)*(1+(s.r||0)/30);
  for(const [exId, sessions] of byEx){
    if(sessions.length < 3) continue;
    for(let i=1;i<sessions.length;i++){
      const slice = history.filter(h=> h.dateISO < sessions[i].dateISO);
      if(!slice.some(h=> (h.blocks||[]).some(b=> b.exerciseId===exId))) continue;
      const rec = recommendNext({ exerciseId: exId, history: slice });
      const actual = sessions[i].sets[0], prev = sessions[i-1].sets[0];
      if(!actual || !prev) continue;
      if(rec.reps == null && (rec.load==null || rec.load<=0)) continue;
      const gain = e1(actual) - e1(prev);
      const met = (rec.reps==null || actual.r >= rec.reps) && (rec.load==null || rec.load<=0 || actual.w >= rec.load);
      total++; if(met) followed++;
      (met? gainsF : gainsN).push(gain);
    }
  }
  const avg = arr=> arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const avgF = avg(gainsF), avgN = avg(gainsN);
  const round = v=> v==null? null : Math.round(v*10)/10;
  return {
    n: total,
    followedPct: total? Math.round(followed/total*100) : null,
    avgE1rmGainFollowed: round(avgF),
    avgE1rmGainNotFollowed: round(avgN),
    differential: (avgF!=null && avgN!=null)? round(avgF-avgN) : null,
    note: total ? 'Positive differential = following recommendations precedes better e1RM gains.' : 'Not enough data yet.',
  };
}
