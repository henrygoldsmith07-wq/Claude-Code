// progression.js — real progression engine.
// Pure: takes history + current schedule/exercise and returns next-load advice,
// plateau/deload signals, and explanations. Offline, no AI.

export function e1rm(weightKg, reps){ if(!(weightKg>0 && reps>0)) return 0; return weightKg * (1 + reps/30); }
export function epleyToLoad(e1rm, reps){ return e1rm / (1 + reps/30); }

// Recommend next load/reps from last N sessions for an exercise.
// Conservative double-progression: first add reps, then add load.
export function recommendNext({ exerciseId, history, targetReps = "8–12", conservative = true }){
  const logs = logsFor(history, exerciseId).slice(-6);
  if(!logs.length) return { load: null, reps: parseLow(targetReps), reason: "No history — use program prescription." };
  const last = logs[logs.length-1];
  const reps = last.reps, load = last.weightKg || 0;
  const [lo, hi] = parseRange(targetReps);
  const trend = strengthTrend(logs);
  const plateaud = isPlateau(logs);
  if(plateaud) return { load, reps, reason: "Plateau — hold load, consider deload." };
  if(load === 0 && isBodyweight(exerciseId)){
    // bodyweight: add reps, then harder variant hint
    if(reps < hi) return { load: null, reps: reps + 1, reason: `Bodyweight: add a rep (${reps}→${reps+1}).` };
    return { load: null, reps, reason: "Top of range — try harder variant (decline/weighted/tempo)." };
  }
  // Double progression
  if(reps < hi) {
    // if RIR/RPE indicates room (rpe < 8 or rir >=2), add reps
    const rpe = last.rpe ? Number(last.rpe) : null;
    const rir = rpe !== null ? Math.max(0, 10 - rpe) : 2;
    if(rir >= 2) return { load, reps: Math.min(hi, reps + 1), reason: `Room at RPE ${rpe ?? "/"} — add a rep (${reps}→${Math.min(hi, reps+1)}).` };
    // else small load bump
    const nextLoad = snapLoad(load * 1.025);
    return { load: nextLoad, reps: lo, reason: `Close to failure (RIR ~${rir}) — add a little load, reset to ${lo} reps.` };
  }
  // At top: add load, reset reps low
  const nextLoad = snapLoad(load > 0 ? load * (conservative ? 1.025 : 1.05) : 0);
  return { load: nextLoad || load, reps: lo, reason: `Hit top of ${lo}–${hi} — nudge load, back to ${lo} reps.` };
}

// Plateau: last 3 sessions no meaningful e1RM gain (<1%) and >=3 sessions
export function isPlateau(logs){ if(logs.length < 3) return false; const last3 = logs.slice(-3).map(l=> e1rm(l.weightKg||0,l.reps)|| l.reps); const best = Math.max(...last3.slice(0,2).map(v=>v)); const last = last3[last3.length-1]; return (last - best)/Math.max(1,best) < 0.01; }

// Conservative deload suggestion: 2 of (high RPE, missed reps, volume spike, 3 plateau weeks)
export function shouldDeload({ logs, recentRpes, weeklyVolumeTrend }){
  let flags=0;
  if((recentRpes||[]).filter(r=> Number(r)>=9).length >= 2) flags++;
  if(isPlateau(logs||[])) flags++;
  if((weeklyVolumeTrend||[]).slice(-2).some(v=> v > 1.15)) flags++; // >15% spike
  return flags >= 2 ? { yes: true, cut: 0.6, reason: "Multiple fatigue signals — cut volume ~40% next week, keep loads moderate." } : { yes: false };
}

// Adapt program blocks for next week based on performance: explain why
// Keep conservative — only adapt loads, not exercise selection, unless equipment mismatch.
export function explainAdaptation({ original, recommended }){
  if(recommended.load == null && original.loadHint) return `Holding prescription (${original.reps}, ${original.loadHint}) — no load change advised.`;
  if(recommended.load != null) return `${recommended.reason}`;
  return recommended.reason || "No change.";
}

// Strength trend (linear slope over e1RM series)
export function strengthTrend(logs){
  if(logs.length < 3) return 0;
  const ys = logs.map(l=> e1rm(l.weightKg||0, l.reps) || l.reps);
  const n = ys.length; const xs = ys.map((_,i)=>i);
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0; for(let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
  return den ? num/den : 0;
}

// Meaningful PR vs noise: require >2% above prior best and not a one-rep jitter
export function isMeaningfulPR(priorBestE1rm, newE1rm){ return newE1rm > priorBestE1rm * 1.02; }

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
  // each 1..5, 3 neutral. Map to 0..100 with simple weighting.
  const s = ((Number(sleep)-1)/4), so=((5-Number(soreness))/4), m=((Number(motivation)-1)/4);
  return Math.round(Math.max(0, Math.min(100, (s*0.4 + so*0.3 + m*0.3)*100)));
}

// Helpers
function logsFor(history, exerciseId){
  const out=[];
  for(const h of history||[]) for(const b of h.blocks||[]) if(b.exerciseId===exerciseId) for(const s of b.sets||[]){
    const reps = Number(String(s.reps).match(/\d+/)?.[0] || s.reps)||0; const w = Number(s.weightKg)||0; const rpe = s.rpe ?? null;
    if(reps) out.push({ reps, weightKg: w, rpe, dateISO: h.dateISO });
  }
  return out;
}
function parseLow(s){ const m=String(s).match(/\d+/); return m? Number(m[0]) : 8; }
function parseRange(s){ const nums = (String(s).match(/\d+/g)||[]).map(Number); if(nums.length>=2) return [nums[0], nums[1]]; if(nums.length===1) return [nums[0], nums[0]]; return [8,12]; }
function snapLoad(v){ if(v<=0) return 0; if(v<20) return Math.round(v/1)*1; if(v<60) return Math.round(v/2.5)*2.5; return Math.round(v/5)*5; }
function isBodyweight(id){ return id?.includes("bodyweight") || id==="push-up" || id==="plank" || id==="dead-bug" || id==="glute-bridge" || id==="lunge" || id==="burpee"; }
