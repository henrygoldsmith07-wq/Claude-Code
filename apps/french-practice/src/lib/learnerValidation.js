// Longitudinal validation: does the learner model predict real improvement?
// Hold-out retention + speaking trend checks — pure, offline, deterministic.

import { fsrsRetention } from './fsrs';
import { heatmapWeeks } from './memory';

export function retentionPredictionVsActual(srs, entries, now=Date.now()){
  // For cards reviewed last week, compare predicted retention (FSRS) to whether they were recalled (reps>=2 and not 'again')
  let correct=0, total=0;
  for(const e of entries){
    const s = srs[e.id] || srs[`${e.id}::receptive`];
    if(!s || !s.lastReviewed) continue;
    const pred = fsrsRetention(s, now);
    if(pred==null) continue;
    const recalled = (s.reps||0)>=2 && s.lastRating!=='again';
    const bucket = pred >= 0.6 ? 1 : 0;
    const actual = recalled ? 1 : 0;
    if(bucket===actual) correct++;
    total++;
  }
  return total ? { accuracy: Math.round(correct/total*100)/100, n: total } : { accuracy: null, n: 0 };
}

export function speakingImprovement(metrics, windowDays=30, now=new Date()){
  const cutoff = now.getTime() - windowDays*86400000;
  const recent = metrics.filter(m=> new Date(m.at).getTime()>=cutoff && (m.skill==='pronunciation'||m.skill==='speaking'));
  if(recent.length<4) return { slope: null, n: recent.length };
  const pts = recent.map(m=> ({ x: new Date(m.at).getTime(), y: m.score }));
  pts.sort((a,b)=>a.x-b.x);
  // simple linear regression slope per day
  const n = pts.length;
  const sx = pts.reduce((a,p)=>a+p.x,0)/n, sy = pts.reduce((a,p)=>a+p.y,0)/n;
  const num = pts.reduce((a,p)=>a+(p.x-sx)*(p.y-sy),0);
  const den = pts.reduce((a,p)=>a+(p.x-sx)*(p.x-sx),0);
  const slopePerMs = den ? num/den : 0;
  const slopePerDay = slopePerMs * 86400000;
  return { slope: Math.round(slopePerDay*10)/10, n };
}

export function heatmapValidation(log, weeks=8){
  return heatmapWeeks(log, weeks);
}
