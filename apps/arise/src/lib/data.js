// data.js — single source of truth for Arise.
// Franchise-adjacent terminology has been removed; neutral fitness language only.
// All game attributes derive from logged history (see attributes.js).

export const EQUIPMENT = [
  { id: 'bodyweight', label: 'Bodyweight only', icon: '🤸' },
  { id: 'dumbbells', label: 'Dumbbells', icon: '🏋️' },
  { id: 'barbell', label: 'Barbell & rack', icon: '🏗️' },
  { id: 'bands', label: 'Resistance bands', icon: '〰️' },
  { id: 'kettlebell', label: 'Kettlebell', icon: '🔔' },
  { id: 'pullup-bar', label: 'Pull-up bar', icon: '🧱' },
  { id: 'bench', label: 'Bench', icon: '🪑' },
  { id: 'cable', label: 'Cable machine', icon: '🔗' },
  { id: 'machine', label: 'Machines', icon: '⚙️' },
];

export const LOCATIONS = [
  { id: 'home', label: 'Home', hint: 'No commute, minimal kit' },
  { id: 'gym', label: 'Gym', hint: 'Full equipment access' },
  { id: 'outdoor', label: 'Outdoors', hint: 'Park, track, street' },
  { id: 'limited', label: 'Small space / travel', hint: 'Hotel room, tight flat' },
];

export const MUSCLES = ['Chest','Back','Legs','Glutes','Shoulders','Arms','Core','Full body','Cardio'];
export const LEVELS = ['Beginner','Intermediate','Advanced'];
export const GOALS = [
  { id: 'strength', label: 'Get stronger', hint: 'Progressive overload, heavier lifts' },
  { id: 'muscle', label: 'Build muscle', hint: 'Volume + hypertrophy' },
  { id: 'endurance', label: 'Move longer', hint: 'Conditioning & stamina' },
  { id: 'fat-loss', label: 'Lean out', hint: 'Consistency + conditioning' },
  { id: 'general', label: 'Feel better', hint: 'Balanced, sustainable' },
];

// Exercise library: one module per muscle group under data/exercises/,
// re-exported here so data.js remains the single source of truth for every
// consumer. Split ahead of library expansion to stay well under 500 lines.
import { CHEST_EXERCISES } from './data/exercises/chest.js';
import { BACK_EXERCISES } from './data/exercises/back.js';
import { LEGS_EXERCISES } from './data/exercises/legs.js';
import { GLUTES_EXERCISES } from './data/exercises/glutes.js';
import { SHOULDERS_EXERCISES } from './data/exercises/shoulders.js';
import { ARMS_EXERCISES } from './data/exercises/arms.js';
import { CORE_EXERCISES } from './data/exercises/core.js';
import { CONDITIONING_EXERCISES } from './data/exercises/conditioning.js';

export const EXERCISES = [
  ...CHEST_EXERCISES,
  ...BACK_EXERCISES,
  ...LEGS_EXERCISES,
  ...GLUTES_EXERCISES,
  ...SHOULDERS_EXERCISES,
  ...ARMS_EXERCISES,
  ...CORE_EXERCISES,
  ...CONDITIONING_EXERCISES,
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// Programme templates — reusable blueprints that can be instantiated with different start dates / tweaks.
// level/goal/daysPerWeek drive template recommendation; version drives template versioning.
export const PROGRAM_TEMPLATES = [
  { id: 'tpl-starter', programId: 'starter-3x', name: 'Starter Template', description: '3× full-body, minimal kit — good default for most users.', level: 'Beginner', goal: 'general', daysPerWeek: 3, version: 1 },
  { id: 'tpl-strength', programId: 'strength-4x', name: 'Strength Template', description: 'Upper/lower 4×, heavier compounds first.', level: 'Intermediate', goal: 'strength', daysPerWeek: 4, version: 1 },
  { id: 'tpl-anywhere', programId: 'move-anywhere', name: 'Anywhere Template', description: 'Bodyweight + bands only.', level: 'Beginner', goal: 'endurance', daysPerWeek: 3, version: 1 },
];

// Template version history (append-only). Program-level versions live in PROGRAM_VERSION_HISTORY.
export const TEMPLATE_VERSION_HISTORY = [
  { templateId: 'tpl-starter', version: 1, date: '2026-08-13', changes: 'Template engine: equipment-aware instantiation with substitution, profile-based recommendation.' },
  { templateId: 'tpl-strength', version: 1, date: '2026-08-13', changes: 'Template engine: equipment-aware instantiation with substitution, profile-based recommendation.' },
  { templateId: 'tpl-anywhere', version: 1, date: '2026-08-13', changes: 'Template engine: equipment-aware instantiation with substitution, profile-based recommendation.' },
];

export function templateHistory(templateId){
  return TEMPLATE_VERSION_HISTORY.filter(h=> h.templateId===templateId).sort((a,b)=> a.version - b.version);
}

export function searchExercises({ q = '', muscle = '', equipment = '', level = '', availableEquipment = null }) {
  const qq = q.trim().toLowerCase();
  return EXERCISES.filter(e => {
    if (qq && !(e.name.toLowerCase().includes(qq) || e.muscle.toLowerCase().includes(qq) || e.id.includes(qq))) return false;
    if (muscle && e.muscle !== muscle) return false;
    if (level && e.level !== level) return false;
    if (equipment) {
      if (!e.equipment.includes(equipment)) return false;
    }
    if (availableEquipment && availableEquipment.length) {
      const has = new Set(availableEquipment);
      const doable = e.equipment.every(eq => has.has(eq));
      const bodyOnly = e.equipment.length === 1 && e.equipment[0] === 'bodyweight';
      if (!doable && !bodyOnly) return false;
    }
    return true;
  });
}

export function recommendExercises({ goal, availableEquipment, limit = 8 }) {
  let pool = searchExercises({ availableEquipment });
  const bias = {
    strength: ['Legs','Back','Chest','Shoulders'],
    muscle: ['Chest','Back','Legs','Glutes','Shoulders','Arms'],
    endurance: ['Cardio','Full body','Legs','Core'],
    'fat-loss': ['Full body','Cardio','Legs','Core'],
    general: MUSCLES,
  }[goal] || MUSCLES;
  pool.sort((a,b) => bias.indexOf(a.muscle) - bias.indexOf(b.muscle));
  const minimal = !availableEquipment || availableEquipment.length <= 2;
  if (minimal) pool.sort((a,b) => (a.level === 'Beginner' ? -1 : 1));
  return pool.slice(0, limit);
}

// Programmes are scheduled training: each program has weeks → workouts → blocks.
export const PROGRAMS = [
  {
    id: 'starter-3x',
    name: 'Starter 3×Week',
    tagline: 'Full-body, minimal kit. Consistency over intensity.',
    level: 'Beginner',
    daysPerWeek: 3,
    mesocycle: { weeks: 4, deloadWeek: 4, progression: 'linear' },
    version: 2,
    equipment: ['bodyweight','dumbbells','bench','bands'],
    weeks: [
      {
        week: 1,
        workouts: [
          { day: 1, title: 'Push + Legs', blocks: [
            { exerciseId: 'bodyweight-squat', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bodyweight' },
            { exerciseId: 'push-up', sets: 3, reps: '6–12', restSec: 90, loadHint: 'bodyweight' },
            { exerciseId: 'dumbbell-row', sets: 3, reps: '8–12 each', restSec: 90, loadHint: 'light dumbbells' },
            { exerciseId: 'plank', sets: 3, reps: '30–45s', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 2, title: 'Hinge + Pull', blocks: [
            { exerciseId: 'romanian-deadlift', sets: 3, reps: '8–10', restSec: 90, loadHint: 'light pair' },
            { exerciseId: 'band-row', sets: 3, reps: '12–15', restSec: 60, loadHint: 'band' },
            { exerciseId: 'glute-bridge', sets: 3, reps: '10–15', restSec: 60, loadHint: 'bodyweight' },
            { exerciseId: 'dead-bug', sets: 3, reps: '8 each', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 3, title: 'Conditioning + Core', blocks: [
            { exerciseId: 'brisk-walk', sets: 1, reps: '20 min', restSec: 0, loadHint: 'outdoors' },
            { exerciseId: 'lunge', sets: 3, reps: '8 each', restSec: 90, loadHint: 'bodyweight' },
            { exerciseId: 'overhead-press-dumbbell', sets: 3, reps: '8–12', restSec: 90, loadHint: 'light' },
            { exerciseId: 'plank', sets: 3, reps: '30–45s', restSec: 60, loadHint: 'bodyweight' },
          ]},
        ]
      },
      {
        week: 2,
        workouts: [
          { day: 1, title: 'Push + Legs', blocks: [
            { exerciseId: 'goblet-squat', sets: 3, reps: '8–10', restSec: 90, loadHint: 'one dumbbell' },
            { exerciseId: 'push-up', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bodyweight' },
            { exerciseId: 'dumbbell-row', sets: 3, reps: '8–12 each', restSec: 90, loadHint: 'moderate' },
            { exerciseId: 'plank', sets: 3, reps: '35–50s', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 2, title: 'Hinge + Pull', blocks: [
            { exerciseId: 'romanian-deadlift', sets: 3, reps: '8–10', restSec: 90, loadHint: 'moderate pair' },
            { exerciseId: 'band-row', sets: 3, reps: '12–15', restSec: 60, loadHint: 'band' },
            { exerciseId: 'hip-thrust', sets: 3, reps: '10–12', restSec: 75, loadHint: 'bench + dumbbell' },
            { exerciseId: 'dead-bug', sets: 3, reps: '10 each', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 3, title: 'Conditioning + Core', blocks: [
            { exerciseId: 'run-easy', sets: 1, reps: '15–20 min', restSec: 0, loadHint: 'easy pace' },
            { exerciseId: 'split-squat', sets: 3, reps: '6–8 each', restSec: 90, loadHint: 'bodyweight' },
            { exerciseId: 'overhead-press-dumbbell', sets: 3, reps: '8–12', restSec: 90, loadHint: 'light' },
            { exerciseId: 'hanging-knee-raise', sets: 3, reps: '6–10', restSec: 90, loadHint: 'bar, or plank sub' },
          ]},
        ]
      },
    ],
  },
  {
    id: 'strength-4x',
    name: 'Strength 4×Week',
    tagline: 'Upper / lower split. Barbell when available, dumbbell subs included.',
    level: 'Intermediate',
    daysPerWeek: 4,
    mesocycle: { weeks: 4, deloadWeek: 4, progression: 'weekly-load' },
    version: 2,
    equipment: ['barbell','dumbbells','bench','pullup-bar'],
    weeks: [
      {
        week: 1,
        workouts: [
          { day: 1, title: 'Lower A', blocks: [
            { exerciseId: 'barbell-squat', sets: 4, reps: '5', restSec: 150, loadHint: 'barbell — leave 2 in tank' },
            { exerciseId: 'romanian-deadlift', sets: 3, reps: '6–8', restSec: 120, loadHint: 'barbell or dumbbells' },
            { exerciseId: 'lunge', sets: 3, reps: '8 each', restSec: 90, loadHint: 'dumbbells optional' },
            { exerciseId: 'plank', sets: 3, reps: '40s', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 2, title: 'Upper A', blocks: [
            { exerciseId: 'bench-press-barbell', sets: 4, reps: '5', restSec: 150, loadHint: 'barbell' },
            { exerciseId: 'pull-up', sets: 4, reps: '3–6', restSec: 120, loadHint: 'bar, band assist ok' },
            { exerciseId: 'overhead-press-dumbbell', sets: 3, reps: '8–10', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'bicep-curl', sets: 3, reps: '10–12', restSec: 60, loadHint: 'dumbbells' },
          ]},
          { day: 3, title: 'Lower B', blocks: [
            { exerciseId: 'goblet-squat', sets: 3, reps: '8–10', restSec: 90, loadHint: 'heavy dumbbell' },
            { exerciseId: 'hip-thrust', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bench' },
            { exerciseId: 'split-squat', sets: 3, reps: '6–8 each', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'dead-bug', sets: 3, reps: '10 each', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 4, title: 'Upper B', blocks: [
            { exerciseId: 'bench-press-dumbbell', sets: 3, reps: '8–10', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'dumbbell-row', sets: 3, reps: '8–10 each', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'lateral-raise', sets: 3, reps: '12–15', restSec: 60, loadHint: 'light' },
            { exerciseId: 'hanging-knee-raise', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bar' },
          ]},
        ]
      },
      {
        week: 2,
        workouts: [
          { day: 1, title: 'Lower A +5%', blocks: [
            { exerciseId: 'barbell-squat', sets: 4, reps: '4–5', restSec: 150, loadHint: 'add a little if form held' },
            { exerciseId: 'romanian-deadlift', sets: 3, reps: '6–8', restSec: 120, loadHint: 'progress load' },
            { exerciseId: 'lunge', sets: 3, reps: '8 each', restSec: 90, loadHint: 'dumbbells optional' },
            { exerciseId: 'plank', sets: 3, reps: '45s', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 2, title: 'Upper A', blocks: [
            { exerciseId: 'bench-press-barbell', sets: 4, reps: '4–5', restSec: 150, loadHint: 'barbell' },
            { exerciseId: 'pull-up', sets: 4, reps: '4–7', restSec: 120, loadHint: 'progression target +1 rep' },
            { exerciseId: 'overhead-press-dumbbell', sets: 3, reps: '8–10', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'bicep-curl', sets: 3, reps: '10–12', restSec: 60, loadHint: 'dumbbells' },
          ]},
          { day: 3, title: 'Lower B', blocks: [
            { exerciseId: 'goblet-squat', sets: 3, reps: '8–10', restSec: 90, loadHint: 'heavy dumbbell' },
            { exerciseId: 'hip-thrust', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bench' },
            { exerciseId: 'split-squat', sets: 3, reps: '6–8 each', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'dead-bug', sets: 3, reps: '10 each', restSec: 60, loadHint: 'bodyweight' },
          ]},
          { day: 4, title: 'Upper B', blocks: [
            { exerciseId: 'bench-press-dumbbell', sets: 3, reps: '8–10', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'dumbbell-row', sets: 3, reps: '8–10 each', restSec: 90, loadHint: 'dumbbells' },
            { exerciseId: 'lateral-raise', sets: 3, reps: '12–15', restSec: 60, loadHint: 'light' },
            { exerciseId: 'hanging-knee-raise', sets: 3, reps: '8–12', restSec: 90, loadHint: 'bar' },
          ]},
        ]
      },
    ],
  },
  {
    id: 'move-anywhere',
    name: 'Move Anywhere',
    tagline: 'Bodyweight + bands. For gyms, parks, and tight spaces.',
    level: 'Beginner',
    daysPerWeek: 3,
    mesocycle: { weeks: 3, deloadWeek: null, progression: 'reps' },
    version: 2,
    equipment: ['bodyweight','bands'],
    weeks: [
      {
        week: 1,
        workouts: [
          { day: 1, title: 'Body foundations', blocks: [
            { exerciseId: 'bodyweight-squat', sets: 3, reps: '12–15', restSec: 60, loadHint: 'bodyweight' },
            { exerciseId: 'push-up', sets: 3, reps: '6–12', restSec: 75, loadHint: 'bodyweight, incline if needed' },
            { exerciseId: 'band-row', sets: 3, reps: '12–15', restSec: 60, loadHint: 'band' },
            { exerciseId: 'plank', sets: 3, reps: '30–45s', restSec: 45, loadHint: 'bodyweight' },
          ]},
          { day: 2, title: 'Move & breathe', blocks: [
            { exerciseId: 'brisk-walk', sets: 1, reps: '20–30 min', restSec: 0, loadHint: 'outside' },
            { exerciseId: 'glute-bridge', sets: 3, reps: '12–15', restSec: 45, loadHint: 'bodyweight' },
            { exerciseId: 'band-lateral-raise', sets: 3, reps: '12–15', restSec: 45, loadHint: 'band' },
            { exerciseId: 'dead-bug', sets: 3, reps: '8 each', restSec: 45, loadHint: 'bodyweight' },
          ]},
          { day: 3, title: 'Circuit', blocks: [
            { exerciseId: 'lunge', sets: 3, reps: '8 each', restSec: 60, loadHint: 'bodyweight' },
            { exerciseId: 'incline-push-up', sets: 3, reps: '8–12', restSec: 60, loadHint: 'bodyweight' },
            { exerciseId: 'band-curl', sets: 3, reps: '12–15', restSec: 45, loadHint: 'band' },
            { exerciseId: 'jump-rope', sets: 3, reps: '60s', restSec: 45, loadHint: 'rope or imaginary' },
          ]},
        ]
      },
      { week: 2, workouts: [
        { day: 1, title: 'Body foundations +1', blocks: [
          { exerciseId: 'bodyweight-squat', sets: 3, reps: '15–18', restSec: 60, loadHint: 'add a rep each set' },
          { exerciseId: 'push-up', sets: 3, reps: '8–14', restSec: 75, loadHint: 'bodyweight' },
          { exerciseId: 'band-row', sets: 3, reps: '15–18', restSec: 60, loadHint: 'band' },
          { exerciseId: 'plank', sets: 3, reps: '40–50s', restSec: 45, loadHint: 'bodyweight' },
        ]},
        { day: 2, title: 'Move & breathe', blocks: [
          { exerciseId: 'brisk-walk', sets: 1, reps: '25–35 min', restSec: 0, loadHint: 'outside' },
          { exerciseId: 'glute-bridge', sets: 3, reps: '15–18', restSec: 45, loadHint: 'bodyweight' },
          { exerciseId: 'band-lateral-raise', sets: 3, reps: '12–15', restSec: 45, loadHint: 'band' },
          { exerciseId: 'dead-bug', sets: 3, reps: '10 each', restSec: 45, loadHint: 'bodyweight' },
        ]},
        { day: 3, title: 'Circuit', blocks: [
          { exerciseId: 'lunge', sets: 3, reps: '10 each', restSec: 60, loadHint: 'bodyweight' },
          { exerciseId: 'incline-push-up', sets: 3, reps: '10–14', restSec: 60, loadHint: 'bodyweight' },
          { exerciseId: 'band-curl', sets: 3, reps: '15–18', restSec: 45, loadHint: 'band' },
          { exerciseId: 'jump-rope', sets: 3, reps: '75s', restSec: 45, loadHint: 'rope' },
        ]},
      ]},
    ],
  },
];

export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map(p => [p.id, p]));

// Programme version history (append-only)
export const PROGRAM_VERSION_HISTORY = [
  { programId: 'starter-3x', version: 1, date: '2026-01-01', changes: 'Initial release — 2 weeks, full-body.' },
  { programId: 'starter-3x', version: 2, date: '2026-08-10', changes: 'Added mesocycle metadata, progression fields, videoUrl slots.' },
  { programId: 'strength-4x', version: 1, date: '2026-01-01', changes: 'Initial release — upper/lower 2 weeks.' },
  { programId: 'strength-4x', version: 2, date: '2026-08-10', changes: 'Added mesocycle (4-week, weekly-load progression), version bump.' },
  { programId: 'move-anywhere', version: 1, date: '2026-01-01', changes: 'Initial release — bodyweight + bands.' },
  { programId: 'move-anywhere', version: 2, date: '2026-08-10', changes: 'Added mesocycle, version bump.' },
];

export function programHistory(programId){
  return PROGRAM_VERSION_HISTORY.filter(h=> h.programId===programId).sort((a,b)=> a.version - b.version);
}

// Equipment constraints: can this exercise be performed with the user's kit?
export function exerciseAvailable(exerciseId, availableEquipment){
  const ex = EXERCISE_BY_ID[exerciseId];
  if(!ex) return false;
  if(!availableEquipment || !availableEquipment.length) return true;
  const has = new Set(availableEquipment);
  const doable = ex.equipment.every(eq=> has.has(eq));
  if(doable) return true;
  const bodyOnly = ex.equipment.length===1 && ex.equipment[0]==='bodyweight';
  return bodyOnly;
}

// Filter programs to those actually doable with user's equipment.
export function availablePrograms(availableEquipment) {
  if (!availableEquipment || !availableEquipment.length) return PROGRAMS;
  const has = new Set(availableEquipment);
  return PROGRAMS.filter(p => p.equipment.every(eq => has.has(eq) || eq === 'bodyweight'));
}

// Schedule helpers: turn a program into dated sessions so "programs = scheduled training".
export function scheduleProgram({ programId, startDateISO }) {
  const program = PROGRAM_BY_ID[programId];
  if (!program) throw new Error(`Unknown program ${programId}`);
  // Use UTC date arithmetic so a schedule never shifts by a day on devices
  // west of UTC (the ISO date is a calendar date, not a local timestamp).
  const start = new Date(startDateISO + 'T00:00:00Z');
  const sessions = [];
  let cursor = new Date(start);
  for (const wk of program.weeks) {
    for (const w of wk.workouts) {
      sessions.push({
        id: `${programId}-w${wk.week}-d${w.day}`,
        programId,
        week: wk.week,
        day: w.day,
        title: w.title,
        dateISO: toISO(cursor),
        blocks: w.blocks.map(b=> ({ ...b, version: program.version || 1 })),
        status: 'planned',
      });
      cursor.setUTCDate(cursor.getUTCDate() + 2);
    }
    const nextWeekStart = new Date(start);
    nextWeekStart.setUTCDate(start.getUTCDate() + wk.week * 7);
    if (cursor < nextWeekStart) cursor = nextWeekStart;
  }
  return { programId, startDateISO, sessions, programVersion: program.version || 1 };
}

// Planned vs completed comparison
export function plannedVsCompleted(schedule, history){
  const byId = new Map((history||[]).map(h=> [h.id, h]));
  return (schedule?.sessions||[]).map(s=>{
    const actual = byId.get(s.id) || null;
    if(!actual) return { session: s, status: s.status, completed: false, delta: null };
    const plannedSets = s.blocks.reduce((a,b)=> a + (Number(b.sets)||0), 0);
    const actualSets = (actual.blocks||[]).reduce((a,b)=> a + (b.sets||[]).length, 0);
    // Planned volume is only computable when the hint states an explicit load
    // ("20kg"). Parsing any digit out of prose ("leave 2 in tank") produced noise.
    const plannedVol = s.blocks.reduce((a,b)=>{
      const kg = Number(String(b.loadHint||'').match(/(\d+(?:\.\d+)?)\s*kg/i)?.[1]);
      const reps = Number(String(b.reps).match(/\d+/)?.[0]||0)||0;
      return a + (Number.isFinite(kg) ? reps*kg : 0);
    }, 0);
    const hasPlannedLoad = s.blocks.some(b=> /(\d+(?:\.\d+)?)\s*kg/i.test(String(b.loadHint||'')));
    const actualVol = (actual.blocks||[]).reduce((a,b)=> a + b.sets.reduce((x,s)=> x + (Number(s.reps)||0)*(Number(s.weightKg)||0),0),0);
    return { session: s, status: 'done', completed: true, actual, delta: { sets: actualSets - plannedSets, volumeKg: hasPlannedLoad ? Math.round(actualVol - plannedVol) : null } };
  });
}

// Format the local calendar date instead of slicing toISOString(). The latter
// can move a midnight schedule back one day on devices west of UTC.
function toISO(d){
  const pad = value=> String(value).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}

// Simple content validation used by scripts/lint-content.mjs
const PROGRESSION_MODES = ['load', 'reps', 'time'];
const MIN_EXERCISES_PER_MUSCLE = 3;

export function validateContent(){
  const errors=[];
  const ids = new Set();
  const names = new Map();
  for(const e of EXERCISES){
    if(ids.has(e.id)) errors.push(`Duplicate exercise id ${e.id}`);
    ids.add(e.id);
    // Display names must be unique: the browser, swap UI and history views all
    // identify exercises by name, and duplicate names fragment PR history.
    if(names.has(e.name)) errors.push(`Duplicate exercise name "${e.name}" (${e.id} and ${names.get(e.name)})`);
    names.set(e.name, e.id);
    if(!MUSCLES.includes(e.muscle)) errors.push(`Exercise ${e.id} has unknown muscle ${e.muscle}`);
    if(!LEVELS.includes(e.level)) errors.push(`Exercise ${e.id} has unknown level ${e.level}`);
    for(const eq of e.equipment){
      if(!EQUIPMENT.some(x=>x.id===eq)) errors.push(`Exercise ${e.id} has unknown equipment ${eq}`);
    }
    if(!PROGRESSION_MODES.includes(e.progression)) errors.push(`Exercise ${e.id} has invalid progression "${e.progression}" (expected one of ${PROGRESSION_MODES.join('|')})`);
    if(!Array.isArray(e.cues) || e.cues.length===0) errors.push(`Exercise ${e.id} declares no cues — every exercise needs at least one form cue`);
    if(e.videoUrl && !/^https:\/\//.test(e.videoUrl)) errors.push(`Exercise ${e.id} has non-https videoUrl`);
    if(!Array.isArray(e.substitution) || e.substitution.length===0) errors.push(`Exercise ${e.id} declares no substitutions — every exercise needs an alternative chain`);
  }
  // Substitution graph integrity: every target must exist, and the relation is
  // reciprocal (A lists B ⇒ B lists A). A dangling or one-way edge silently
  // degrades the swap UI and generated-programme fallbacks.
  for(const e of EXERCISES){
    for(const targetId of e.substitution||[]){
      const target = EXERCISE_BY_ID[targetId];
      if(!target){ errors.push(`Exercise ${e.id} substitutes unknown exercise ${targetId}`); continue; }
      if(!(target.substitution||[]).includes(e.id)) errors.push(`Substitution not reciprocal: ${e.id} → ${targetId}, but ${targetId} does not list ${e.id}`);
    }
  }
  // Coverage floors: a bulk-authored library is only useful if every muscle is
  // trainable, and bodyweight-only users must never hit a dead end (roadmap P1 #4).
  const perMuscle = {};
  const bodyweightMuscles = new Set();
  for(const e of EXERCISES){
    perMuscle[e.muscle] = (perMuscle[e.muscle]||0) + 1;
    if(e.equipment.includes('bodyweight')) bodyweightMuscles.add(e.muscle);
  }
  for(const m of MUSCLES){
    if((perMuscle[m]||0) < MIN_EXERCISES_PER_MUSCLE) errors.push(`Muscle ${m} has only ${perMuscle[m]||0} exercise(s) — minimum is ${MIN_EXERCISES_PER_MUSCLE}`);
    if(!bodyweightMuscles.has(m)) errors.push(`Muscle ${m} has no bodyweight option — bodyweight-only users hit a dead end`);
  }
  for(const p of PROGRAMS){
    for(const w of p.weeks) for(const wk of w.workouts) for(const b of wk.blocks){
      if(!EXERCISE_BY_ID[b.exerciseId]) errors.push(`Program ${p.id} references unknown exercise ${b.exerciseId}`);
    }
  }
  for(const t of PROGRAM_TEMPLATES){
    if(!PROGRAM_BY_ID[t.programId]) errors.push(`Template ${t.id} references unknown program ${t.programId}`);
    if(!LEVELS.includes(t.level)) errors.push(`Template ${t.id} has unknown level ${t.level}`);
    if(!GOALS.some(g=> g.id===t.goal)) errors.push(`Template ${t.id} has unknown goal ${t.goal}`);
  }
  return errors;
}
