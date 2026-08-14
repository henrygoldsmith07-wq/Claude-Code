// sessionQuality.js — session-quality & recovery helpers.
// Pure, deterministic, offline. Answers three questions:
//   1. Was this session good/ok/bad, and why?
//   2. Is a flat stretch a real plateau or just a run of bad sessions?
//   3. Is a "PR" actually a PR (not technique/ROM change or one-day noise)?
// Reuses the existing readiness EMA (progression.js) so one-day dips never
// get treated as a trend.

import { e1rm, readinessEMA, isPlateauV2 } from "./progression.js";

// ── Workout-note signals ───────────────────────────────────────────────
// Turns free-text notes into structured signals: sentiment (−1..1), tags, and
// whether the note implies a technique/ROM change (which invalidates PRs).
const NEGATIVE_WORDS = {
  sore: "soreness", tired: "fatigue", fatigue: "fatigue", exhausted: "fatigue", drained: "fatigue",
  sick: "illness", ill: "illness", nauseous: "illness", dizzy: "illness",
  pain: "pain", hurt: "pain", injured: "pain",
  failed: "missed", miss: "missed", skipped: "missed",
  poor: "underperformed", weak: "underperformed", struggled: "underperformed", awful: "underperformed", bad: "underperformed",
};
const POSITIVE_WORDS = {
  great: "strong", easy: "strong", strong: "strong", fresh: "strong", awesome: "strong",
  best: "pr", pr: "pr", pb: "pr", good: "positive", solid: "positive",
  energized: "recovered", recovered: "recovered",
};
const TECHNIQUE_WORDS = ["rom", "depth", "form", "technique", "paused", "tempo", "assisted", "band", "partial", "shallow"];

export function noteSignals(note){
  if(!note || !String(note).trim()) return { sentiment: 0, tags: [], techniqueChange: false };
  const text = String(note).toLowerCase();
  const tags = [];
  for(const [word, tag] of Object.entries(NEGATIVE_WORDS)) if(text.includes(word)) tags.push("negative:"+tag);
  for(const [word, tag] of Object.entries(POSITIVE_WORDS)) if(text.includes(word)) tags.push("positive:"+tag);
  const techniqueChange = TECHNIQUE_WORDS.some(w=> text.includes(w));
  if(techniqueChange) tags.push("technique-change");
  const scored = tags.filter(t=> t.startsWith("positive") || t.startsWith("negative"));
  let sentiment = 0;
  for(const t of scored) sentiment += t.startsWith("positive") ? 1 : -1;
  sentiment = scored.length ? sentiment / scored.length : 0;
  return { sentiment: Math.round(sentiment*100)/100, tags: [...new Set(tags)], techniqueChange };
}

// ── Per-session quality classification ─────────────────────────────────
// 'bad' means underperformance (low readiness, failed reps, negative note, or
// near-failure effort on a day that should have been manageable). Effort alone
// (high RPE on a high-readiness day with a positive note) stays 'ok'.
export function sessionQuality(h, { readinessLog = [] } = {}){
  const rpes = [], failed = [];
  for(const b of h.blocks||[]) for(const s of b.sets||[]){
    const r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps)||0;
    const rpe = s.rpe != null && String(s.rpe).trim() !== "" ? Number(s.rpe) : null;
    if(rpe != null && Number.isFinite(rpe)) rpes.push(rpe);
    if(r === 0 || s.failed) failed.push(true);
  }
  const avgRpe = rpes.length ? rpes.reduce((a,b)=> a+b,0)/rpes.length : null;
  const ns = noteSignals(h.note);
  const readinessScore = readinessFor(h.dateISO, readinessLog);
  const reasons = [];
  let score = 50;
  if(readinessScore != null && readinessScore < 35){ score -= 22; reasons.push(`low readiness ${readinessScore}`); }
  else if(readinessScore != null && readinessScore >= 70){ score += 6; reasons.push("high readiness"); }
  if(failed.length){ score -= 18; reasons.push("failed/missed reps"); }
  if(ns.sentiment < 0){ score -= 12; reasons.push("negative note"); }
  if(avgRpe != null && avgRpe >= 9 && readinessScore != null && readinessScore >= 60){
    score -= 12; reasons.push(`near-failure RPE ${avgRpe.toFixed(1)} despite good readiness`);
  } else if(avgRpe != null && avgRpe <= 6 && rpes.length >= 2){
    score += 8; reasons.push(`comfortable RPE ${avgRpe.toFixed(1)}`);
  }
  if(ns.sentiment > 0) score += 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    quality: score >= 60 ? "good" : score >= 40 ? "ok" : "bad",
    score, reasons, avgRpe: avgRpe != null ? Math.round(avgRpe*10)/10 : null,
    readinessScore, noteTags: ns.tags, techniqueChange: ns.techniqueChange,
  };
}

// Fraction of the last N sessions classified 'bad' (0..1).
export function badSessionRatio(history, { window = 5, readinessLog = [] } = {}){
  const recent = (history||[]).slice(-window);
  if(!recent.length) return { ratio: 0, bad: 0, total: 0, quality: [] };
  const quality = recent.map(h=> sessionQuality(h, { readinessLog }));
  const bad = quality.filter(q=> q.quality === "bad").length;
  return { ratio: Math.round(bad/recent.length*100)/100, bad, total: recent.length, quality };
}

// ── Plateau attribution ────────────────────────────────────────────────
// When strength is flat, is it a real plateau (consistent effort, decent
// readiness) or a run of bad sessions (low readiness / near-failure RPE /
// negative notes)? Different advice follows — recover first, then deload.
export function plateauAttribution(history, exerciseId, { readinessLog = [], window = 4 } = {}){
  const sessions = (history||[])
    .filter(h=> (h.blocks||[]).some(b=> b.exerciseId === exerciseId))
    .sort((a,b)=> a.dateISO.localeCompare(b.dateISO));
  if(sessions.length < 4) return { kind: "insufficient", reason: `Need 4+ sessions for this exercise to judge (have ${sessions.length}).`, n: sessions.length };
  const last = sessions.slice(-window);
  const logs = last.map(h=> bestSetFor(h, exerciseId)).filter(Boolean);
  if(logs.length < 3) return { kind: "insufficient", reason: "Need 3+ logged sets for this exercise to judge.", n: sessions.length };
  // Flatness trigger (same formula isPlateauV2 uses): <1.5% best-gain across
  // the window. Attribution below decides whether that flatness is fatigue or
  // a genuine ceiling — isPlateauV2's noise exemption would pre-empt that.
  const vals = logs.map(l=> e1rm(l.weightKg||0, l.reps) || l.reps);
  const bestRecent = Math.max(...vals.slice(-2));
  const bestPrior = Math.max(...vals.slice(0,2));
  const gain = (bestRecent - bestPrior)/Math.max(1,bestPrior);
  if(gain >= 0.015) return { kind: "progressing", reason: "Still progressing.", n: sessions.length };
  const quality = last.map(h=> sessionQuality(h, { readinessLog }));
  const bad = quality.filter(q=> q.quality === "bad").length;
  const highRpe = quality.filter(q=> q.avgRpe != null && q.avgRpe >= 9).length;
  const lowReadiness = quality.filter(q=> q.readinessScore != null && q.readinessScore < 35).length;
  if(bad >= Math.ceil(last.length/2) || (lowReadiness >= 2 && highRpe >= 2)){
    return { kind: "bad-sessions", reason: `Flat performance driven by poor sessions (${bad}/${last.length} bad, ${lowReadiness} low-readiness, ${highRpe} near-failure) — recover first; this isn't a real plateau yet.`, n: sessions.length, bad, highRpe, lowReadiness };
  }
  if(highRpe >= 2){
    return { kind: "mixed", reason: "Flat with several near-failure sessions — fatigue may be a factor, but effort was high. A short deload could help.", n: sessions.length, bad, highRpe };
  }
  return { kind: "genuine", reason: "Flat with consistent effort and decent readiness — real plateau; consider a deload or exercise variation.", n: sessions.length, bad, highRpe };
}

// ── Deload trigger, one-day-safe ───────────────────────────────────────
// Same conservative signals as shouldDeload, plus:
//  - readiness only counts when the LOW is a sustained EMA trend, not one bad
//    day (a single dip is reported but never triggers by itself);
//  - a run of bad-quality sessions counts as its own fatigue signal.
export function deloadReadinessAssessment({ logs, recentRpes, weeklyVolumeTrend, readinessHistory, history, window = 5 } = {}){
  const signals = [];
  let flags = 0;
  if((recentRpes||[]).filter(r=> Number(r) >= 9).length >= 2){ flags++; signals.push("high RPE ≥9 twice"); }
  const plat = isPlateauV2(logs||[]);
  if(plat.isPlateau){ flags++; signals.push("plateau"); }
  if((weeklyVolumeTrend||[]).slice(-2).some(v=> v > 1.15)){ flags++; signals.push("volume +15% spike"); }
  let oneDayDip = false;
  const nums = (readinessHistory||[]).map(r=> typeof r === "object" ? Number(r.score) : Number(r)).filter(n=> Number.isFinite(n));
  if(nums.length >= 3){
    const ema = readinessEMA(nums);
    const last = nums[nums.length-1];
    if(ema.value < 35 && last < 40 && ema.confidence !== "low"){
      flags++; signals.push(`readiness sustained low (EMA ${ema.value})`);
    } else if(last < 35){
      oneDayDip = true; signals.push("readiness dipped today only — not a trend");
    }
  }
  if(history && history.length >= 3){
    const br = badSessionRatio(history, { window, readinessLog: null });
    if(br.ratio >= 0.5){ flags++; signals.push(`${br.bad}/${br.total} recent sessions bad quality`); }
  }
  const confidence = flags >= 3 ? "high" : flags === 2 ? "medium" : "low";
  if(flags >= 2){
    return { yes: true, cut: 0.6, reason: `Fatigue accumulating (${signals.join("; ")}) — cut volume ~40% next week, keep loads moderate.`, signals, confidence, oneDayDip };
  }
  return { yes: false, signals, confidence, oneDayDip, reason: oneDayDip ? "One-day readiness dip only — no deload; re-check after recovery." : "Not enough fatigue signals for a deload." };
}

// ── Longitudinal PR scan ───────────────────────────────────────────────
// Walks all history in date order and classifies every new best e1RM:
//  - meaningful: ≥2% over the prior best AND no technique/ROM change in the note;
//  - flagged: technique/ROM change (invalid), sub-2% jitter, or set on a
//    low-readiness day (caution — could be a false PR from effort, not gains).
export function scanPRs(history, { readinessLog = [] } = {}){
  const bestByEx = new Map();
  const prs = [];
  for(const h of (history||[]).slice().sort((a,b)=> a.dateISO.localeCompare(b.dateISO))){
    for(const b of h.blocks||[]){
      for(const s of b.sets||[]){
        const w = Number(s.weightKg)||0, r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps)||0;
        if(!w || !r) continue;
        const e = e1rm(w, r);
        const st = bestByEx.get(b.exerciseId) || { best: 0 };
        if(e > st.best){
          if(st.best > 0){
            const ns = noteSignals(h.note);
            const flags = [];
            if(ns.techniqueChange) flags.push("technique/ROM change");
            const rd = readinessFor(h.dateISO, readinessLog);
            if(rd != null && rd < 40) flags.push(`low readiness ${rd}`);
            const meaningful = (e >= st.best*1.02) && !ns.techniqueChange;
            prs.push({
              exerciseId: b.exerciseId, dateISO: h.dateISO,
              e1rm: Math.round(e), prevBest: Math.round(st.best),
              gainPct: Math.round((e/st.best - 1)*1000)/10,
              meaningful, flags, note: h.note || "",
            });
          }
          st.best = e; bestByEx.set(b.exerciseId, st);
        }
      }
    }
  }
  const flagged = prs.filter(p=> !p.meaningful);
  return {
    n: prs.length, flagged: flagged.length, prs,
    note: flagged.length ? `${flagged.length} of ${prs.length} records not like-for-like PRs — technique change, sub-2% jitter, or low-readiness days.` : `${prs.length} like-for-like PRs recorded.`,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────
// Best set (by e1RM) for an exercise inside a session — same log shape the
// progression engine uses (reps/weightKg/rpe).
function bestSetFor(h, exerciseId){
  let best = null;
  for(const b of h.blocks||[]) if(b.exerciseId === exerciseId) for(const s of b.sets||[]){
    const r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps)||0;
    const w = Number(s.weightKg)||0;
    const rpe = s.rpe != null && String(s.rpe).trim() !== "" ? Number(s.rpe) : null;
    const e = e1rm(w, r) || r;
    if(!best || e > best.e) best = { e, reps: r, weightKg: w, rpe };
  }
  return best;
}

// Readiness for a date: exact match, else nearest prior log within 3 days.
function readinessFor(dateISO, readinessLog){
  const byDate = new Map((readinessLog||[]).map(r=> [r.dateISO, Number(r.score)]));
  if(byDate.has(dateISO)) return byDate.get(dateISO);
  const t = Date.parse(dateISO + "T00:00:00");
  if(!Number.isFinite(t)) return null;
  let best = null, bestD = 3*86400000;
  for(const [d, s] of byDate){
    const diff = t - Date.parse(d + "T00:00:00");
    if(diff >= 0 && diff <= bestD){ bestD = diff; best = s; }
  }
  return best;
}
