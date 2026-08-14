// Longitudinal validation: does the learner model predict real improvement?
// Hold-out retention + speaking trend checks — pure, offline, deterministic.

import { heatmapWeeks } from './memory.js';
import {
  MIN_SAMPLES, brierScore, calibrationError, highConfidenceGap, logLoss, samplesFrom,
} from './fsrsValidation.js';

/**
 * Does the model's prediction match what actually happened?
 *
 * The previous version could not answer that. It compared the retention
 * predicted *now* against whether the card was *currently* in good standing
 * (`reps>=2 && lastRating!=='again'`) — a card's present state, not the outcome
 * of any particular review. Since a card in good standing also tends to have
 * high predicted retention, the two sides moved together and the score came out
 * high whatever the model did. It also ignored the entries passed to it and,
 * despite the comment, applied no time window at all.
 *
 * Each stored review carries the prediction made *before* the learner answered
 * and the answer itself, so a real comparison is available. `accuracy` is kept
 * for the existing callers, now measured against genuine outcomes, alongside
 * the scoring rules that say something accuracy alone cannot.
 */
export function retentionPredictionVsActual(srs, _entries, now=Date.now()){
  void now;
  const samples = samplesFrom(srs);
  if(samples.length < MIN_SAMPLES){
    return { accuracy: null, n: samples.length, needed: MIN_SAMPLES - samples.length };
  }
  const hits = samples.filter((s)=> (s.predicted >= 0.5 ? 1 : 0) === s.recalled).length;
  const atScheduled = highConfidenceGap(samples);
  return {
    accuracy: Math.round(hits/samples.length*100)/100,
    n: samples.length,
    logLoss: logLoss(samples),
    brier: brierScore(samples),
    calibrationError: calibrationError(samples),
    // Positive means recall beats the promise; negative means the schedule is
    // stretching cards further than they hold.
    atScheduledRetention: atScheduled.gap,
  };
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
