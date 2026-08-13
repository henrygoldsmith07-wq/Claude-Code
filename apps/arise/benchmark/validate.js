// benchmark/validate.js — Arise progression validation harness.
// Simulates months of realistic training data (seeded, deterministic) and scores the
// progression engine against it: recommendation hit-rate, readiness↔performance
// correlation, deload outcomes, mesocycle trends, and recommendation follow-through.
// The simulator plants real structure (novice growth → plateau → deload →
// supercompensation rebound, readiness tracking session effort, assisted-exercise
// deloading); the harness checks the engine's validators recover that structure.
//
// Usage: node benchmark/validate.js [--write]   (--write updates results.md)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProgression, recommendSets, romProgression, trainingAgeInfo } from "../src/lib/progression.js";
import {
  readinessPerformanceCorrelation, deloadOutcomes, mesocycleComparison,
  recommendationFollowThrough,
} from "../src/lib/analytics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Seeded PRNG (deterministic across runs and CI) ─────────────────────
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rand = mulberry32(20260703);
const rf = (lo,hi)=> lo + rand()*(hi-lo);
const clamp = (v,lo,hi)=> Math.max(lo, Math.min(hi,v));

function snapLoad(v){
  if(v<=0) return 0;
  if(v<20) return Math.round(v/1)*1;
  if(v<60) return Math.round(v/2.5)*2.5;
  return Math.round(v/5)*5;
}
function snapAssist(v){ return v<=0 ? 0 : Math.round(v/2.5)*2.5; }
function weekDate(w, slot){ return new Date(Date.UTC(2026,0,5 + w*7 + slot)).toISOString().slice(0,10); }

// ── Simulated athlete: 18 weeks × 3 sessions/week × 5 exercises ────────
const EX = [
  { id:"squat",   name:"barbell-squat",        repsLo:5,  repsHi:8,  base:40, growth:0.015, romFrom:"parallel", romTo:"full" },
  { id:"bench",   name:"bench-press-dumbbell", repsLo:8,  repsHi:12, base:20, growth:0.015 },
  { id:"rdl",     name:"romanian-deadlift",    repsLo:6,  repsHi:10, base:50, growth:0.015, romFrom:"partial",  romTo:"full" },
  { id:"pullup",  name:"pull-up",              repsLo:8,  repsHi:12, base:0,  growth:0.02,  assist:25 },
  { id:"pushup",  name:"push-up",              repsLo:8,  repsHi:12, base:0,  growth:0.02 },
];
const WEEKS = 18, SLOTS = [0,2,4];

const state = Object.fromEntries(EX.map(e=> [e.id, { reps: e.repsLo, weight: e.base, assist: e.assist ?? 0 }]));
const history = [], readinessLog = [];
let sessionId = 0;

for(let w=0; w<WEEKS; w++){
  const deload = (w === 11);                          // week 12: planned deload
  const plateau = (w === 8 || w === 9);                // weeks 9-10: flat block
  const rebound = (w === 12 || w === 13 || w === 14);  // supercompensation: double growth after deload
  const weekGrowth = deload ? 0.005 : (rebound ? 0.03 : (plateau ? 0 : 0.015));
  for(const slot of SLOTS){
    // Planted readiness: tracks the effort this session will take (higher readiness ↔ lower RPE)
    const rpe = Math.round(clamp(6 + rf(0,3.5), 6, 10) + (rand() < 0.12 ? 1 : 0));
    const readiness = Math.round(clamp(88 - rpe*5 + rf(-8,8), 5, 95));
    const dateISO = weekDate(w, slot);
    readinessLog.push({ dateISO, score: readiness, sleep: 4, soreness: 3, motivation: 4, at: dateISO+"T08:00:00.000Z" });

    const exCount = deload ? 2 : 4;
    const picks = EX.slice(0, exCount);
    let tough = false;
    const blocks = picks.map(e=> {
      const s = state[e.id];
      const bad = (rand() < 0.14 || readiness < 30);
      if(bad) tough = true;
      if(!bad){
        s.reps++;
        if(s.reps > e.repsHi){
          s.reps = e.repsLo;
          if(e.assist != null){ s.assist = snapAssist(Math.max(0, s.assist - 2.5)); }
          else if(s.weight > 0){ s.weight = snapLoad(s.weight * (1 + weekGrowth + rf(-0.004,0.004))); }
        }
      }
      const sets = Array.from({ length: deload ? 2 : 3 }, ()=> {
        const set = { reps: String(s.reps), weightKg: s.weight > 0 ? String(s.weight) : "", rpe: String(bad ? 9 + Math.round(rf(0,1)) : rpe) };
        if(e.assist != null) set.assistedKg = String(s.assist);
        if(e.romFrom){
          const progressed = w >= 6;
          set.rom = progressed ? e.romTo : e.romFrom;
        }
        return set;
      });
      return { exerciseId: e.name, sets };
    });
    history.push({ id: "sim-"+(sessionId++), dateISO, programId: "sim", week: w+1, day: slot, title: `Sim session ${w+1}.${slot}`, note: tough ? "tough session" : "", blocks });
  }
}

// ── Score the engine against the simulated reality ─────────────────────
const vp = validateProgression(history);
const rpc = readinessPerformanceCorrelation(history, readinessLog);
const del = deloadOutcomes(history);
const mc = mesocycleComparison(history);
const ft = recommendationFollowThrough(history);
const setAdvice = recommendSets(history, "bench-press-dumbbell");
const romAdvice = romProgression(history, "barbell-squat");
const age = trainingAgeInfo(history);

const checks = [
  { name: "recommendation hit-rate on 18 weeks of data", pass: vp.n >= 100 && vp.hitRate >= 0.4, detail: `n=${vp.n}, hitRate=${vp.hitRate}, MAE ${vp.meanAbsErrorKg}kg/${vp.meanAbsErrorReps}reps` },
  { name: "readiness correlates with session effort", pass: rpc.n >= 30 && rpc.rRPE < -0.2, detail: `n=${rpc.n}, r(RPE)=${rpc.rRPE}` },
  { name: "deload triggers validated against rebound", pass: del.n >= 1 && del.improvedRate >= 50, detail: `deloads=${del.n}, improvedRate=${del.improvedRate}%` },
  { name: "mesocycle comparison shows upward trend", pass: !!mc.comparison && mc.comparison.e1rmChangePct > 0, detail: `cycle ${mc.last?.index} vs ${mc.previous?.index}: e1RM ${mc.comparison?.e1rmChangePct}%, volume ${mc.comparison?.volumeChangePct}%` },
  { name: "follow-through measurement: gains follow recommendations", pass: ft.n >= 50 && ft.followedPct >= 20 && ft.differential >= 0, detail: `n=${ft.n}, followed=${ft.followedPct}%, Δgain=${ft.differential}` },
  { name: "set progression stays conservative", pass: setAdvice.sets >= 3 && setAdvice.sets <= 5, detail: `sets=${setAdvice.sets} (${setAdvice.reason})` },
  { name: "ROM progression resolves to full depth", pass: romAdvice.supported && (romAdvice.next === null), detail: romAdvice.reason },
  { name: "training age derived from history", pass: ["novice","intermediate"].includes(age.phase), detail: `${age.phase} (${age.months} months, multiplier ${age.multiplier})` },
];

const failures = checks.filter(c=> !c.pass);
console.log("Arise validation benchmark (seed 20260703, 18 simulated weeks)\n");
for(const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}\n        ${c.detail}`);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
if(failures.length){ console.error(failures.map(f=> `FAILED: ${f.name}`).join("\n")); process.exit(1); }

// ── Evidence artifact ──────────────────────────────────────────────────
if(process.argv.includes("--write")){
  const lines = [
    "# Arise — progression validation benchmark",
    "",
    "Seeded simulation (`mulberry32(20260703)`) of an 18-week training block: novice-rate growth, a",
    "flat plateau block, a planned deload week followed by a supercompensation rebound, occasional",
    "tough sessions, and readiness that tracks session effort. The harness checks that the engine's",
    "validators recover that planted structure. Deterministic — rerun any time with `npm run benchmark`.",
    "",
    "| Check | Result |",
    "|-------|--------|",
    `| Recommendation hit-rate (validateProgression) | n=${vp.n}, hitRate=${vp.hitRate}, MAE ${vp.meanAbsErrorKg} kg / ${vp.meanAbsErrorReps} reps |`,
    `| Readiness ↔ performance (readinessPerformanceCorrelation) | n=${rpc.n}, r(RPE)=${rpc.rRPE}, r(volume)=${rpc.rVolume} |`,
    `| Deload outcomes (deloadOutcomes) | ${del.n} deloads, improved in next fortnight ${del.improvedRate}% of the time |`,
    `| Mesocycle comparison (mesocycleComparison) | cycle ${mc.last?.index} vs ${mc.previous?.index}: e1RM ${mc.comparison?.e1rmChangePct}%, volume ${mc.comparison?.volumeChangePct}%, sessions ${mc.comparison?.sessionChange} |`,
    `| Follow-through (recommendationFollowThrough) | n=${ft.n}, followed ${ft.followedPct}%, Δgain followed − not = ${ft.differential} |`,
    `| Set progression (recommendSets) | ${setAdvice.sets} sets — ${setAdvice.reason} |`,
    `| ROM progression (romProgression) | ${romAdvice.reason} |`,
    `| Training age (trainingAgeInfo) | ${age.phase}, ${age.months} months, rate multiplier ${age.multiplier} |`,
    "",
  ];
  fs.writeFileSync(path.join(__dirname, "results.md"), lines.join("\n"));
  console.log("Wrote benchmark/results.md");
}
