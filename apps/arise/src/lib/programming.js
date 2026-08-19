// programming.js — the user-facing programming layer.
//
// The lower-level progression, scheduling and quality modules are deliberately
// small. This module composes them into decisions the UI can explain and the
// user can act on: what changed, why it changed, and what to do after a missed
// session or a change in available equipment.

import { EXERCISE_BY_ID, exerciseAvailable } from './data.js';
import { rankedSubstitutions } from './substitutions.js';
import { applyEquipmentSubstitutions } from './templates.js';
import {
  e1rm,
  recommendNext,
  strengthTrendWithConfidence,
  trainingAgeInfo,
  isPlateauV2,
  validateProgression,
} from './progression.js';
import { plateauAttribution, deloadReadinessAssessment } from './sessionQuality.js';
import { weeklyVolume, deloadOutcomes, recommendationFollowThrough } from './analytics.js';

const DAY_MS = 86400000;
const DEFAULT_SPACING_DAYS = 2;

export function isoToday(){
  return toISO(new Date());
}

function dateAt(iso){
  return new Date(`${iso}T00:00:00`);
}

function toISO(date){
  const pad = value=> String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function addDays(iso, days){
  const date = dateAt(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function parseReps(value){
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function parseTimeMinutes(value){
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*min/i);
  return match ? Number(match[1]) : null;
}

function numeric(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sessionDateSort(a, b){
  return String(a.dateISO || '').localeCompare(String(b.dateISO || ''));
}

function isDone(session, historyIds){
  return session.status === 'done' || historyIds.has(session.id);
}

function bestSet(block){
  let best = null;
  for(const set of block?.sets || []){
    const reps = parseReps(set.reps);
    const weightKg = numeric(set.weightKg);
    const assistedKg = numeric(set.assistedKg);
    const score = e1rm(weightKg, reps) || reps;
    if(reps > 0 && (!best || score > best.score)) best = { reps, weightKg, assistedKg, rpe: set.rpe ?? null, score };
  }
  return best;
}

function exerciseLogs(history, exerciseId){
  const logs = [];
  for(const session of history || []){
    for(const block of session.blocks || []){
      if(block.exerciseId !== exerciseId) continue;
      const best = bestSet(block);
      if(best) logs.push({ ...best, dateISO: session.dateISO, sessionId: session.id, title: session.title, programId: session.programId });
    }
  }
  return logs.sort((a, b)=> String(a.dateISO || '').localeCompare(String(b.dateISO || '')));
}

// A machine-readable explanation for every next-load decision. The UI can
// show this without exposing implementation details or inventing a reason.
export function transparentProgressionDecision({ exerciseId, history = [], targetReps = '8–12', recommendation = null } = {}){
  const rec = recommendation || recommendNext({ exerciseId, history, targetReps });
  const logs = exerciseLogs(history, exerciseId);
  const last = logs[logs.length - 1] || null;
  const ex = EXERCISE_BY_ID[exerciseId];
  const age = rec.trainingAge || trainingAgeInfo(history);
  const evidence = [];
  if(last){
    evidence.push(`Last best logged set: ${last.weightKg > 0 ? `${last.weightKg}kg × ` : ''}${last.reps} reps${last.rpe != null && String(last.rpe).trim() ? ` at RPE ${last.rpe}` : ''}.`);
  } else {
    evidence.push('No prior logged set for this exercise.');
  }
  evidence.push(`${logs.length} exercise session${logs.length === 1 ? '' : 's'} inform this decision.`);
  if(rec.personalised) evidence.push(`Your observed rate is ${Math.round(rec.personalised.weeklyLoadPct * 1000) / 10}% load per week across ${rec.personalised.n} logged sets.`);
  if(age.phase !== 'unknown') evidence.push(`Training age is treated as ${age.phase}; the default rate is scaled accordingly.`);

  let rule = 'Use the programme prescription until enough evidence is logged.';
  if(rec.plateau?.isPlateau || /plateau/i.test(rec.reason || '')) rule = 'Plateau guard: hold the current prescription and recover or vary the movement before adding load.';
  else if(rec.assistKg != null) rule = 'Assistance rule: add reps through the range, then reduce assistance in a small step.';
  else if(rec.suggestWeighted) rule = 'Bodyweight rule: after the top of the rep range, use a harder variation or add load if the movement supports it.';
  else if(rec.reps != null && rec.load != null) rule = 'Double-progression rule: build reps within the target range, then add a small load step and reset to the lower bound.';
  else if(rec.reps != null) rule = 'Reps-first rule: add one controlled rep while the target range is not full.';

  const confidence = logs.length >= 6 ? 'high' : logs.length >= 3 ? 'medium' : 'low';
  const name = ex?.name || exerciseId || 'this exercise';
  return {
    ...rec,
    exerciseId,
    exerciseName: name,
    targetReps,
    evidence,
    rule,
    confidence,
    summary: `${name}: ${rec.reason || 'follow the programme prescription.'}`,
  };
}

export const progressionExplanation = transparentProgressionDecision;

// One row per completed exposure to an exercise. This is intentionally
// session-level rather than set-level so the history is readable and trends do
// not overweight sessions with more sets.
export function exerciseHistory(history = [], exerciseId){
  const rows = [];
  for(const session of history){
    const blocks = (session.blocks || []).filter(block=> block.exerciseId === exerciseId);
    if(!blocks.length) continue;
    const sets = blocks.flatMap(block=> block.sets || []);
    const best = blocks.map(bestSet).filter(Boolean).sort((a, b)=> b.score - a.score)[0] || null;
    const volumeKg = sets.reduce((total, set)=> total + parseReps(set.reps) * Math.max(0, numeric(set.weightKg) - numeric(set.assistedKg)), 0);
    rows.push({
      sessionId: session.id,
      dateISO: session.dateISO,
      title: session.title,
      programId: session.programId,
      week: session.week,
      day: session.day,
      sets: sets.length,
      volumeKg: Math.round(volumeKg),
      best: best ? { reps: best.reps, weightKg: best.weightKg, assistedKg: best.assistedKg, rpe: best.rpe, e1rm: Math.round(best.score * 10) / 10 } : null,
    });
  }
  return rows.sort((a, b)=> String(a.dateISO || '').localeCompare(String(b.dateISO || '')));
}

export function exerciseHistorySummary(history = [], exerciseId){
  const rows = exerciseHistory(history, exerciseId);
  const logs = exerciseLogs(history, exerciseId);
  const trend = strengthTrendWithConfidence(logs);
  return {
    exerciseId,
    sessions: rows.length,
    rows,
    last: rows[rows.length - 1] || null,
    best: rows.flatMap(row=> row.best ? [{ ...row.best, dateISO: row.dateISO }] : []).sort((a, b)=> b.e1rm - a.e1rm)[0] || null,
    trend,
    recommendation: transparentProgressionDecision({ exerciseId, history }),
  };
}

// Plateau detection with attribution. A flat line after consistently good
// sessions is treated differently from a flat line caused by fatigue or noise.
export function plateauDetection(history = [], exerciseId, { readinessLog = [], window = 4 } = {}){
  const attribution = plateauAttribution(history, exerciseId, { readinessLog, window });
  const logs = exerciseLogs(history, exerciseId).slice(-window);
  const v2 = isPlateauV2(logs);
  const detected = attribution.kind === 'genuine' || (v2.isPlateau && attribution.kind !== 'bad-sessions');
  const status = detected ? 'plateau' : attribution.kind === 'bad-sessions' ? 'fatigue' : attribution.kind;
  const confidence = attribution.kind === 'genuine' ? 'high' : attribution.kind === 'insufficient' ? 'low' : 'medium';
  return {
    exerciseId,
    detected,
    status,
    confidence,
    n: logs.length,
    attribution,
    plateau: v2,
    reason: detected ? attribution.reason : attribution.reason || v2.reason,
  };
}

export function programAdherence(schedule, history = [], { today = isoToday() } = {}){
  const historyIds = new Set(history.map(session=> session.id));
  const sessions = (schedule?.sessions || []).slice().sort(sessionDateSort).map(session=> {
    const completed = isDone(session, historyIds);
    const missed = !completed && session.dateISO < today;
    const due = !completed && session.dateISO <= today;
    return { session, completed, missed, due, upcoming: !completed && session.dateISO > today };
  });
  const dueSessions = sessions.filter(row=> row.due);
  const missedSessions = sessions.filter(row=> row.missed);
  const completedSessions = sessions.filter(row=> row.completed);
  const plannedToDate = sessions.filter(row=> row.session.dateISO <= today);
  const byWeek = new Map();
  for(const row of sessions){
    const key = row.session.week ?? '—';
    const current = byWeek.get(key) || { week: key, total: 0, done: 0, missed: 0 };
    current.total += 1;
    if(row.completed) current.done += 1;
    if(row.missed) current.missed += 1;
    byWeek.set(key, current);
  }
  return {
    total: sessions.length,
    completed: completedSessions.length,
    due: dueSessions.length,
    missed: missedSessions.length,
    upcoming: sessions.filter(row=> row.upcoming).length,
    rate: sessions.length ? Math.round(completedSessions.length / sessions.length * 100) / 100 : null,
    toDateRate: plannedToDate.length ? Math.round(plannedToDate.filter(row=> row.completed).length / plannedToDate.length * 100) / 100 : null,
    sessions,
    byWeek: [...byWeek.values()],
  };
}

export function missedWorkoutRecovery(schedule, history = [], { today = isoToday() } = {}){
  const adherence = programAdherence(schedule, history, { today });
  const missedSessions = adherence.sessions.filter(row=> row.missed).map(row=> row.session);
  if(!missedSessions.length){
    return { needed: false, adherence, missedSessions: [], recommendation: 'No missed sessions — keep the next planned session.' };
  }
  const oldest = missedSessions[0];
  const recommendation = missedSessions.length === 1
    ? `Recover ${oldest.title} next, then continue the programme order. Do not double the next workout.`
    : `${missedSessions.length} sessions are overdue. Re-plan them in order and keep at least one recovery day between sessions.`;
  return {
    needed: true,
    adherence,
    missedSessions,
    recommendation,
    options: ['replan', 'skip'],
  };
}

function scheduleSpacing(schedule){
  const dates = (schedule?.sessions || []).map(session=> Date.parse(`${session.dateISO}T00:00:00`)).filter(Number.isFinite).sort((a, b)=> a - b);
  const gaps = [];
  for(let i = 1; i < dates.length; i++){
    const days = Math.round((dates[i] - dates[i - 1]) / DAY_MS);
    if(days > 0) gaps.push(days);
  }
  if(!gaps.length) return DEFAULT_SPACING_DAYS;
  const sorted = gaps.sort((a, b)=> a - b);
  return Math.max(1, sorted[Math.floor(sorted.length / 2)] || DEFAULT_SPACING_DAYS);
}

// Shift unfinished sessions forward as a sequence. Completed sessions keep
// their original IDs and dates, so history remains attached to the right work.
export function replanSchedule(schedule, history = [], { today = isoToday(), spacingDays = null } = {}){
  if(!schedule?.sessions?.length) return { schedule, changed: false, moved: [], reason: 'No active schedule.' };
  const historyIds = new Set(history.map(session=> session.id));
  const original = schedule.sessions.slice().sort(sessionDateSort);
  const pending = original.filter(session=> !isDone(session, historyIds));
  const missed = pending.filter(session=> session.dateISO < today);
  if(!missed.length) return { schedule, changed: false, moved: [], reason: 'No overdue sessions to re-plan.' };
  const step = Math.max(1, Number(spacingDays) || scheduleSpacing(schedule));
  let cursor = today;
  const moved = [];
  const pendingById = new Map();
  for(const session of pending){
    const nextDate = cursor;
    if(nextDate !== session.dateISO) moved.push({ id: session.id, title: session.title, from: session.dateISO, to: nextDate });
    pendingById.set(session.id, { ...session, dateISO: nextDate, status: 'planned', rescheduledFrom: session.dateISO === nextDate ? session.rescheduledFrom : session.dateISO });
    cursor = addDays(cursor, step);
  }
  const nextSessions = original.map(session=> pendingById.get(session.id) || session).sort(sessionDateSort);
  return {
    schedule: { ...schedule, sessions: nextSessions, lastReplannedISO: today, replannedAt: new Date(`${today}T00:00:00`).toISOString() },
    changed: moved.length > 0,
    moved,
    spacingDays: step,
    reason: moved.length ? `Moved ${moved.length} unfinished session${moved.length === 1 ? '' : 's'} forward in programme order.` : 'No dates changed.',
  };
}

function blockDurationMinutes(block){
  const timed = parseTimeMinutes(block.reps);
  if(timed != null) return Math.max(1, timed);
  const sets = Math.max(1, numeric(block.sets));
  const rest = Math.max(0, numeric(block.restSec)) / 60;
  return sets * 1.4 + Math.max(0, sets - 1) * rest;
}

function blockPriority(block, index){
  const ex = EXERCISE_BY_ID[block.exerciseId];
  const muscle = ex?.muscle || '';
  const compound = ['Legs', 'Back', 'Chest', 'Glutes', 'Full body'].includes(muscle);
  const cardio = muscle === 'Cardio';
  return (compound ? 4 : cardio ? 2 : 3) + (index === 0 ? 0.5 : 0);
}

function shortenBlock(block, ratio, targetMinutes){
  const timed = parseTimeMinutes(block.reps);
  if(timed != null){
    const minutes = Math.max(5, Math.min(timed, Math.round(timed * ratio), targetMinutes));
    return { ...block, reps: `${minutes} min`, shortOriginalReps: block.reps };
  }
  const originalSets = Math.max(1, numeric(block.sets));
  const sets = Math.max(1, Math.min(originalSets, Math.ceil(originalSets * ratio)));
  return { ...block, sets, shortOriginalSets: originalSets };
}

export function shortWorkoutMode(session, { minutes = 20 } = {}){
  if(!session?.blocks?.length) return { session, changed: false, reason: 'No workout blocks to shorten.' };
  const target = Math.max(10, Number(minutes) || 20);
  const originalDurationMin = Math.ceil(session.blocks.reduce((total, block)=> total + blockDurationMinutes(block), 0));
  if(originalDurationMin <= target){
    return { session: { ...session, mode: 'standard', estimatedDurationMin: originalDurationMin }, changed: false, originalDurationMin, estimatedDurationMin: originalDurationMin, omittedExerciseIds: [], reason: 'The planned session already fits the requested time.' };
  }
  const ranked = session.blocks.map((block, index)=> ({ block, index, duration: blockDurationMinutes(block), priority: blockPriority(block, index) }))
    .sort((a, b)=> b.priority - a.priority || a.index - b.index);
  const selected = [];
  let selectedDuration = 0;
  for(const candidate of ranked){
    if(!selected.length || selectedDuration + candidate.duration <= target){
      selected.push(candidate);
      selectedDuration += candidate.duration;
    }
  }
  if(!selected.length) selected.push(ranked[0]);
  const ratio = Math.min(1, target / Math.max(originalDurationMin, 1));
  const selectedIds = new Set(selected.map(item=> item.index));
  const blocks = session.blocks.filter((_, index)=> selectedIds.has(index)).map(block=> shortenBlock(block, ratio, target));
  const estimatedDurationMin = Math.max(1, Math.ceil(blocks.reduce((total, block)=> total + blockDurationMinutes(block), 0)));
  return {
    session: { ...session, blocks, mode: 'short', targetMinutes: target, estimatedDurationMin, originalDurationMin },
    changed: true,
    originalDurationMin,
    estimatedDurationMin,
    omittedExerciseIds: session.blocks.filter((_, index)=> !selectedIds.has(index)).map(block=> block.exerciseId),
    reason: `Kept ${blocks.length} high-value block${blocks.length === 1 ? '' : 's'} and reduced volume to fit about ${target} minutes.`,
  };
}

export function adaptScheduleForEquipment(schedule, availableEquipment = [], history = []){
  if(!schedule?.sessions?.length) return { schedule, substitutions: [], changed: false, unavailable: [] };
  if(!availableEquipment?.length) return { schedule, substitutions: [], changed: false, unavailable: [], reason: 'Kit is not set — keeping the original programme until onboarding is complete.' };
  const kit = [...new Set([...(availableEquipment || []), 'bodyweight'])];
  const unavailable = [];
  for(const session of schedule.sessions){
    for(const block of session.blocks || []){
      if(!exerciseAvailable(block.exerciseId, kit)) unavailable.push({ sessionId: session.id, exerciseId: block.exerciseId, alternatives: rankedSubstitutions(block.exerciseId, kit, 3, history).map(ex=> ex.id) });
    }
  }
  const applied = applyEquipmentSubstitutions(schedule.sessions, kit, history);
  const changed = applied.substitutions.length > 0;
  return {
    schedule: { ...schedule, sessions: applied.sessions, availableEquipment: kit, equipmentAdaptedAt: changed ? new Date().toISOString() : schedule.equipmentAdaptedAt, equipmentSubstitutions: applied.substitutions },
    substitutions: applied.substitutions,
    unavailable,
    changed,
    reason: changed ? `Adapted ${applied.substitutions.length} block${applied.substitutions.length === 1 ? '' : 's'} to the available kit.` : 'Every scheduled exercise fits the available kit.',
  };
}

export function recordProgramStart(entries = [], { programId, version = 1, startDateISO } = {}){
  const next = entries.map(entry=> entry.endDateISO ? entry : { ...entry, endDateISO: addDays(startDateISO, -1) });
  return [...next, { programId, version, startDateISO, endDateISO: null }];
}

export function userProgramHistory(entries = [], activeSchedule = null, history = []){
  return entries.slice().sort((a, b)=> String(b.startDateISO || '').localeCompare(String(a.startDateISO || ''))).map(entry=>{
    const sessions = history.filter(session=> session.programId === entry.programId && (!entry.startDateISO || session.dateISO >= entry.startDateISO) && (!entry.endDateISO || session.dateISO <= entry.endDateISO));
    const active = activeSchedule?.programId === entry.programId && activeSchedule?.startDateISO === entry.startDateISO;
    return { ...entry, active, completedSessions: sessions.length, status: active ? 'active' : entry.endDateISO ? 'ended' : 'paused' };
  });
}

function allSetLogs(history){
  const logs = [];
  for(const session of history || []) for(const block of session.blocks || []) for(const set of block.sets || []){
    const reps = parseReps(set.reps);
    if(reps) logs.push({ reps, weightKg: numeric(set.weightKg), rpe: set.rpe ?? null, dateISO: session.dateISO });
  }
  return logs;
}

export function validateDeloadLogic({ history = [], readinessLog = [] } = {}){
  const volume = weeklyVolume(history);
  const weeklyVolumeTrend = volume.slice(1).map((week, index)=> week.vol / Math.max(1, volume[index].vol));
  const logs = allSetLogs(history);
  const recentRpes = logs.slice(-12).map(log=> log.rpe).filter(value=> value != null && String(value).trim() !== '');
  const decision = deloadReadinessAssessment({ logs, recentRpes, weeklyVolumeTrend, readinessHistory: readinessLog, history });
  const outcomes = deloadOutcomes(history);
  const sample = outcomes.n;
  return {
    decision,
    outcomes,
    weeks: volume.length,
    sample,
    confidence: sample >= 3 ? 'high' : sample >= 1 ? 'medium' : 'low',
    note: sample ? `Validated against ${sample} observed volume-cut week${sample === 1 ? '' : 's'}.` : 'No observed deload outcomes yet — treat the trigger as a conservative rule, not proof.',
  };
}

export function recommendationCalibration(history = [], { minimumSamples = 5 } = {}){
  const validation = validateProgression(history);
  const followThrough = recommendationFollowThrough(history);
  const samples = validation.n;
  const status = samples >= minimumSamples ? 'calibrated' : samples > 0 ? 'warming' : 'insufficient';
  const confidence = samples >= minimumSamples * 2 ? 'high' : samples >= minimumSamples ? 'medium' : 'low';
  return {
    ...validation,
    samples,
    minimumSamples,
    status,
    confidence,
    followThrough,
    note: status === 'calibrated'
      ? `Calibration is based on ${samples} next-session comparisons.`
      : `Need ${Math.max(0, minimumSamples - samples)} more next-session comparison${minimumSamples - samples === 1 ? '' : 's'} before tuning the rule.`,
  };
}
