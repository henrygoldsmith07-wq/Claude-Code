// progression.js — real progression engine.
// Pure: takes history + current schedule/exercise and returns next-load advice,
// plateau/deload signals, and explanations. Offline, no AI.

export function e1rm(weightKg, reps){ if(!(weightKg>0 && reps>0)) return 0; return weightKg * (1 + reps/30); }
export function epleyToLoad(e1rmVal, reps){ return e1rmVal / (1 + reps/30); }

// Exercise-specific progression strategies (conservative defaults)
// strength = load-first, hypertrophy = double progression, endurance = reps-first
export const PROGRESSION_STRATEGY = {
  strength: { repRange: '3–6', incPct: 0.05, prefer: 'load' },
  hypertrophy: { repRange: '8–12', incPct: 0.025, prefer: 'double' },
  endurance: { repRange: '12–20', incPct: 0.02, prefer: 'reps' },
};
const STRATEGY_BY_EXERCISE = {
  'barbell-squat': 'strength', 'bench-press-barbell': 'strength', 'romanian-deadlift': 'strength',
  'barbell-bench-press': 'strength',
  'plank': 'endurance', 'run-easy': 'endurance', 'brisk-walk': 'endurance', 'cycle': 'endurance', 'jump-rope': 'endurance', 'burpee': 'endurance', 'dead-bug': 'endurance',
};
export function strategyForExercise(exerciseId){
  if(!exerciseId) return 'hypertrophy';
  if(STRATEGY_BY_EXERCISE[exerciseId]) return STRATEGY_BY_EXERCISE[exerciseId];
  // fallback by name/muscle heuristic — keep deterministic
  if(/squat|deadlift|bench|press/.test(exerciseId) && !/lateral|band/.test(exerciseId)) return 'strength';
  return 'hypertrophy';
}

// Personalised progression rate: learned weekly rep/load deltas per exercise.
// Returns { weeklyLoadPct, weeklyRepGain, n, spanDays } or null if insufficient data.
export function personalisedRate(history, exerciseId){
  const logs = logsFor(history, exerciseId);
  if(logs.length < 4) return null;
  const pts = logs.map(l=> ({ t: Date.parse(l.dateISO || '2026-01-01'), y: e1rm(l.weightKg||0,l.reps)||l.reps }));
  pts.sort((a,b)=> a.t - b.t);
  const spanDays = Math.max(1, (pts[pts.length-1].t - pts[0].t)/86400000);
  if(spanDays < 7) return null;
  const k = Math.max(1, Math.ceil(pts.length/3));
  const first = pts.slice(0,k).reduce((a,b)=> a+b.y,0)/k;
  const last = pts.slice(-k).reduce((a,b)=> a+b.y,0)/k;
  const weeks = spanDays/7;
  // clamp to realistic: -2% .. +10% per week
  const weeklyLoadPct = Math.max(-0.02, Math.min(0.10, (last/Math.max(1,first) - 1)/weeks));
  const weeklyRepGain = (last - first)/weeks;
  return { weeklyLoadPct: Math.round(weeklyLoadPct*1000)/1000, weeklyRepGain: Math.round(weeklyRepGain*10)/10, n: logs.length, spanDays: Math.round(spanDays) };
}

// Longitudinal validation: how well would recommendNext have predicted the next logged set?
// Returns { n, meanAbsErrorKg, meanAbsErrorReps, hitRate }
export function validateProgression(history){
  const byEx = new Map();
  for(const h of history||[]) for(const b of h.blocks||[]) {
    if(!byEx.has(b.exerciseId)) byEx.set(b.exerciseId, []);
    // flatten to session-level best e1RM per exercise
    const sets = b.sets||[];
    const best = sets.map(s=> ({ w:Number(s.weightKg)||0, r:Number(String(s.reps).match(/\d+/)?.[0]||s.reps)||0 })).filter(x=> x.w>0||x.r>0);
    if(best.length) byEx.get(b.exerciseId).push({ dateISO:h.dateISO, sets: best });
  }
  let errsKg=[], errsReps=[], hits=0, total=0;
  for(const [exId, sessions] of byEx){
    if(sessions.length<3) continue;
    for(let i=1;i<sessions.length;i++){
      const historySlice = history.filter(h=> h.dateISO < sessions[i].dateISO);
      // need at least 1 prior session for this exercise
      if(!historySlice.some(h=> (h.blocks||[]).some(b=> b.exerciseId===exId))) continue;
      const rec = recommendNext({ exerciseId: exId, history: historySlice });
      const actual = sessions[i].sets[0];
      if(rec.load!=null && actual.w) errsKg.push(Math.abs((rec.load||actual.w) - actual.w));
      if(rec.reps!=null && actual.r) errsReps.push(Math.abs(rec.reps - actual.r));
      total++;
      // hit if within 1 rep or 5% load
      const loadOk = rec.load==null || rec.load===0 || Math.abs((rec.load||actual.w)-actual.w)/Math.max(1,actual.w) < 0.05;
      const repOk = Math.abs((rec.reps||actual.r)-actual.r) <=1;
      if(loadOk && repOk) hits++;
    }
  }
  const mean = arr=> arr.length? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  return {
    n: total,
    meanAbsErrorKg: mean(errsKg)!=null? Math.round(mean(errsKg)*10)/10 : null,
    meanAbsErrorReps: mean(errsReps)!=null? Math.round(mean(errsReps)*10)/10 : null,
    hitRate: total? Math.round(hits/total*100)/100 : null,
  };
}

// Recommend next load/reps from last N sessions for an exercise.
// Conservative double-progression: first add reps, then add load.
// Now strategy-aware + personalised + plateau-aware.
export function recommendNext({ exerciseId, history, targetReps = "8–12", conservative = true, strategy }){
  const logs = logsFor(history, exerciseId).slice(-6);
  if(!logs.length) {
    const strat = strategy || strategyForExercise(exerciseId);
    return { load: null, reps: parseLow(targetReps), reason: "No history — use program prescription.", strategy: strat };
  }
  const last = logs[logs.length-1];
  const reps = last.reps, load = last.weightKg || 0;
  const [lo, hi] = parseRange(targetReps);
  const strat = strategy || strategyForExercise(exerciseId);
  const sCfg = PROGRESSION_STRATEGY[strat] || PROGRESSION_STRATEGY.hypertrophy;
  const prate = personalisedRate(history, exerciseId);
  // Plateau v2 check (real vs noise) — if true, hold
  const plat = isPlateauV2(logs);
  if(plat.isPlateau) return { load, reps, reason: plat.reason, plateau: plat, strategy: strat, personalised: prate };
  // also keep original 3-session plateau as conservative fallback
  if(!plat.isPlateau && isPlateau(logs)) return { load, reps, reason: "Plateau — hold load, consider deload.", plateau: plat, strategy: strat, personalised: prate };

  if(load === 0 && isBodyweight(exerciseId)){
    if(reps < hi) return { load: null, reps: reps + 1, reason: `Bodyweight: add a rep (${reps}→${reps+1}).`, strategy: strat, personalised: prate };
    return { load: null, reps, reason: "Top of range — try harder variant (decline/weighted/tempo).", strategy: strat, personalised: prate, suggestWeighted: true };
  }
  const rpe = last.rpe != null && String(last.rpe).trim()!=='' ? Number(last.rpe) : null;
  const rir = rpe !== null && Number.isFinite(rpe) ? Math.max(0, 10 - rpe) : 2;
  const incPct = prate ? Math.max(0.015, Math.min(0.06, prate.weeklyLoadPct || sCfg.incPct)) : sCfg.incPct;

  // Strategy-aware
  if(sCfg.prefer === 'load' && load>0){
    if(rir <= 1 && reps < hi) {
      // strength prefers load even with reps left when near failure — but be conservative
    }
  }
  if(sCfg.prefer === 'reps'){
    if(reps < hi) return { load, reps: Math.min(hi, reps+1), reason: `Endurance — add a rep (${reps}→${Math.min(hi, reps+1)}).`, strategy: strat, personalised: prate };
  }
  // Double progression (default for hypertrophy, and fallback)
  if(reps < hi) {
    if(rir >= 2) return { load, reps: Math.min(hi, reps + 1), reason: `Room at RPE ${rpe ?? "/"} — add a rep (${reps}→${Math.min(hi, reps+1)}).`, strategy: strat, personalised: prate };
    const nextLoad = snapLoad(load * (1 + incPct));
    return { load: nextLoad, reps: lo, reason: `Close to failure (RIR ~${rir}) — add a little load, reset to ${lo} reps.`, strategy: strat, personalised: prate };
  }
  const nextLoad = snapLoad(load > 0 ? load * (conservative ? (1 + incPct) : (1 + incPct*1.6)) : 0);
  return { load: nextLoad || load, reps: lo, reason: `Hit top of ${lo}–${hi} — nudge load, back to ${lo} reps.`, strategy: strat, personalised: prate };
}

// Plateau: last 3 sessions no meaningful e1RM gain (<1%) and >=3 sessions (kept for backwards compat)
export function isPlateau(logs){ if(!logs || logs.length < 3) return false; const last3 = logs.slice(-3).map(l=> e1rm(l.weightKg||0,l.reps)|| l.reps); const best = Math.max(...last3.slice(0,2).map(v=>v)); const last = last3[last3.length-1]; return (last - best)/Math.max(1,best) < 0.01; }

// Plateau v2: distinguishes real plateau from poor sessions/noise.
// Requires >=4 sessions, flat best-gain + flat trend, and not explained by high RPE variance or single bad session.
export function isPlateauV2(logs){
  if(!logs || logs.length < 4) return { isPlateau: false, reason: logs?.length < 4 ? 'Need 4+ sessions to judge plateau.' : '', gain: 0, trend: strengthTrend(logs||[]) };
  const vals = logs.slice(-4).map(l=> e1rm(l.weightKg||0,l.reps)|| l.reps);
  const bestRecent = Math.max(...vals.slice(-2));
  const bestPrior = Math.max(...vals.slice(0,2));
  const gain = (bestRecent - bestPrior)/Math.max(1,bestPrior);
  const trend = strengthTrend(logs.slice(-6));
  const rpes = logs.slice(-4).map(l=> Number(l.rpe)).filter(n=> Number.isFinite(n));
  const highVariance = rpes.length>=3 ? (Math.max(...rpes)-Math.min(...rpes) >=3) : false;
  const minVal = Math.min(...vals), maxVal = Math.max(...vals);
  const singleBad = vals.length>=3 ? (minVal < maxVal*0.85 && vals[vals.length-1] > maxVal*0.88) : false;
  // need both flat gain and flat/negative trend to call plateau
  if(gain < 0.015 && Math.abs(trend) < 0.6){
    if(highVariance || singleBad) return { isPlateau: false, reason: 'Flat on average but sessions are noisy — not a real plateau yet.', gain: Math.round(gain*1000)/1000, trend: Math.round(trend*100)/100, noisy: true };
    return { isPlateau: true, reason: '4 sessions with <1.5% gain and flat trend — real plateau.', gain: Math.round(gain*1000)/1000, trend: Math.round(trend*100)/100 };
  }
  return { isPlateau: false, reason: 'Still progressing.', gain: Math.round(gain*1000)/1000, trend: Math.round(trend*100)/100 };
}

// Deload: conservative 2-of-3 + readiness EMA as 4th signal
export function shouldDeload({ logs, recentRpes, weeklyVolumeTrend, readinessHistory }){
  let flags=0; const signals=[];
  if((recentRpes||[]).filter(r=> Number(r)>=9).length >= 2){ flags++; signals.push('high RPE ≥9 twice'); }
  const plat = isPlateauV2(logs||[]);
  if(plat.isPlateau || isPlateau(logs||[])){ flags++; signals.push('plateau'); }
  if((weeklyVolumeTrend||[]).slice(-2).some(v=> v > 1.15)){ flags++; signals.push('volume +15% spike'); }
  if(readinessHistory && readinessHistory.length>=3){
    const ema = readinessEMA(readinessHistory);
    if(ema.value < 35 && ema.confidence !== 'low'){ flags++; signals.push(`readiness EMA ${ema.value} (low)`); }
  }
  if(flags >= 2) return { yes: true, cut: 0.6, reason: `Multiple fatigue signals (${signals.join(', ')}) — cut volume ~40% next week, keep loads moderate.`, signals };
  return { yes: false, signals };
}

// Adapt program blocks for next week based on performance: explain why
export function explainAdaptation({ original, recommended }){
  if(recommended.load == null && original.loadHint) return `Holding prescription (${original.reps}, ${original.loadHint}) — no load change advised.`;
  if(recommended.load != null) return `${recommended.reason}`;
  return recommended.reason || "No change.";
}

// Strength trend (linear slope over e1RM series)
export function strengthTrend(logs){
  if(!logs || logs.length < 3) return 0;
  const ys = logs.map(l=> e1rm(l.weightKg||0, l.reps) || l.reps);
  const n = ys.length; const xs = ys.map((_,i)=>i);
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0; for(let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
  return den ? num/den : 0;
}
export function strengthTrendWithConfidence(logs){
  if(!logs || logs.length < 3) return { slope: 0, r2: 0, confidence: 'low', n: logs?.length||0 };
  const ys = logs.map(l=> e1rm(l.weightKg||0,l.reps)||l.reps);
  const slope = strengthTrend(logs);
  const mean = ys.reduce((a,b)=>a+b,0)/ys.length;
  const ssTot = ys.reduce((a,y)=> a + (y-mean)**2, 0);
  if(ssTot===0) return { slope: Math.round(slope*100)/100, r2: 1, confidence: 'high', n: logs.length };
  const xs = ys.map((_,i)=>i);
  const mx = xs.reduce((a,b)=>a+b,0)/xs.length;
  const b = slope;
  const yhat = xs.map(x=> mean + b*(x - mx));
  const ssRes = ys.reduce((a,y,i)=> a + (y - yhat[i])**2, 0);
  const r2 = Math.max(0, 1 - ssRes/ssTot);
  const confidence = r2 > 0.6 ? 'high' : r2 > 0.3 ? 'medium' : 'low';
  return { slope: Math.round(slope*100)/100, r2: Math.round(r2*100)/100, confidence, n: logs.length };
}

// Meaningful PR vs noise: require >2% above prior best and not a one-rep jitter
// opts.techniqueChange — if true, PR is invalid (ROM/technique change)
export function isMeaningfulPR(priorBestE1rm, newE1rm, opts={}){
  if(opts && opts.techniqueChange) return false;
  return newE1rm > priorBestE1rm * 1.02;
}
export function classifyPR({ priorBestE1rm, newE1rm, note, priorNote }){
  const text = `${note||''} ${priorNote||''}`.toLowerCase();
  const techniqueChange = /rom|depth|range|technique|form|paused|tempo|assisted|band|partial/.test(text);
  const meaningful = isMeaningfulPR(priorBestE1rm, newE1rm, { techniqueChange });
  return { meaningful, techniqueChange, reason: techniqueChange ? 'Technique/ROM change — not a like-for-like PR.' : meaningful ? 'Genuine overload.' : 'Within noise (<2%).' };
}

// RIR from RPE; single source of truth
export function rirFromRpe(rpe){ if(rpe==null || rpe==="") return null; const n=Number(rpe); if(!Number.isFinite(n)) return null; return Math.max(0, Math.min(10, 10 - n)); }
export function proximityLabel(rir){
  if(rir==null) return "";
  if(rir===0) return "Failure";
  if(rir<=1) return "~1 in tank";
  if(rir<=2) return "~2 in tank";
  if(rir<=3) return "~3 in tank";
  return "Easy";
}

// Recovery/readiness: 3 light signals (sleep, soreness, motivation) → readiness 0..100
export function readinessScore({ sleep=3, soreness=3, motivation=3 }={}){
  const s = ((Number(sleep)-1)/4), so=((5-Number(soreness))/4), m=((Number(motivation)-1)/4);
  return Math.round(Math.max(0, Math.min(100, (s*0.4 + so*0.3 + m*0.3)*100)));
}
export function readinessEMA(scores){
  if(!scores || !scores.length) return { value: 50, confidence: 'low' };
  if(scores.length === 1) return { value: scores[0], confidence: 'low' };
  let ema = scores[0];
  const alpha = 0.35;
  for(let i=1;i<scores.length;i++) ema = alpha*scores[i] + (1-alpha)*ema;
  const v = Math.round(ema);
  const slice = scores.slice(-5);
  const spread = Math.max(...slice) - Math.min(...slice);
  const confidence = spread > 40 ? 'low' : spread > 20 ? 'medium' : 'high';
  const last = scores[scores.length-1];
  if(Math.abs(last - v) > 30 && confidence==='high' && scores.length>=4){
    const damped = Math.round(ema*0.8 + last*0.2);
    return { value: damped, confidence: 'medium', dampened: true, raw: last };
  }
  return { value: v, confidence };
}
export function readinessWithUncertainty(args, history){
  const now = readinessScore(args);
  if(!history || history.length<2) return { score: now, ema: { value: now, confidence: 'low' }, uncertainty: 'insufficient data — treat as estimate' };
  const all = [...history, now];
  const ema = readinessEMA(all);
  const uncertainty = ema.confidence==='low' ? 'high — recent readiness is volatile' : ema.confidence==='medium' ? 'moderate — trend is forming' : 'low — stable trend';
  return { score: now, ema, uncertainty };
}

// Unilateral helpers: per-side tracking
export function isUnilateralExercise(exerciseId){ return /lunge|split|single|bulgarian|pistol|unilateral/i.test(exerciseId||''); }
export function sideImbalance(sets){
  const l = sets.filter(s=> s.side==='L').reduce((a,s)=> a + (Number(s.reps)||0),0);
  const r = sets.filter(s=> s.side==='R').reduce((a,s)=> a + (Number(s.reps)||0),0);
  if(!l && !r) return null;
  const total = l+r || 1;
  const weaker = l<r ? 'L' : l>r ? 'R' : null;
  return { left: l, right: r, imbalancePct: Math.round(Math.abs(l-r)/total*100), weaker };
}

// Helpers
function logsFor(history, exerciseId){
  const out=[];
  for(const h of history||[]) for(const b of h.blocks||[]) if(b.exerciseId===exerciseId) for(const s of b.sets||[]){
    const reps = Number(String(s.reps).match(/\d+/)?.[0] || s.reps)||0; const w = Number(s.weightKg)||0; const rpe = s.rpe ?? null;
    if(reps) out.push({ reps, weightKg: w, rpe, dateISO: h.dateISO, side: s.side||null, rom: s.rom||null, assistedKg: s.assistedKg ?? null });
  }
  return out;
}
function parseLow(s){ const m=String(s).match(/\d+/); return m? Number(m[0]) : 8; }
function parseRange(s){ const nums = (String(s).match(/\d+/g)||[]).map(Number); if(nums.length>=2) return [nums[0], nums[1]]; if(nums.length===1) return [nums[0], nums[0]]; return [8,12]; }
function snapLoad(v){ if(v<=0) return 0; if(v<20) return Math.round(v/1)*1; if(v<60) return Math.round(v/2.5)*2.5; return Math.round(v/5)*5; }
function isBodyweight(id){ return id?.includes("bodyweight") || id==="push-up" || id==="plank" || id==="dead-bug" || id==="glute-bridge" || id==="lunge" || id==="burpee" || id==="pull-up" || id==="pike-push-up" || id==="incline-push-up"; }
