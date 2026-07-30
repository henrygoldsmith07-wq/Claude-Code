// Learning Path engine: goals, roadmaps, placement test, adaptive CEFR
// tracking, lesson progression and checkpoints. Pure client-side state.

const KEY = 'fp.path';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const GOALS = [
  { id: 'travel', title: 'Travel', blurb: 'Order, book, haggle and chat your way around France.' },
  { id: 'school', title: 'School', blurb: 'Survive lectures, professors and student life in French.' },
  { id: 'business', title: 'Business', blurb: 'Interviews, meetings and professional small talk.' },
  { id: 'fluency', title: 'Fluency', blurb: 'A bit of everything, pushed toward native-like ease.' },
];

// Roadmap data (twelve units per goal) lives in roadmaps.js; re-exported
// here so consumers keep a single import surface.
import { getRoadmap } from './roadmaps.js';

export { getRoadmap };

// ---- placement test (local, 12 questions, 2 per CEFR level) ----

export const PLACEMENT_QUESTIONS = [
  { level: 'A1', q: '« Bonjour, comment ça ___ ? »', options: ['va', 'vas', 'allez'], answer: 0 },
  { level: 'A1', q: 'Je ___ anglais.', options: ['es', 'suis', 'est'], answer: 1 },
  { level: 'A2', q: 'Hier, nous ___ au cinéma.', options: ['allons', 'sommes allés', 'irons'], answer: 1 },
  { level: 'A2', q: 'Il y a ___ lait dans le frigo.', options: ['du', 'de la', 'des'], answer: 0 },
  { level: 'B1', q: 'Si j’avais le temps, je ___ plus de sport.', options: ['fais', 'ferai', 'ferais'], answer: 2 },
  { level: 'B1', q: 'C’est la ville ___ je suis né.', options: ['que', 'où', 'dont'], answer: 1 },
  { level: 'B2', q: 'Il faut que tu ___ à l’heure.', options: ['es', 'sois', 'seras'], answer: 1 },
  { level: 'B2', q: 'Le rapport ___ tu parles n’existe pas.', options: ['dont', 'que', 'auquel'], answer: 0 },
  { level: 'C1', q: '« Quoi qu’il ___ , je pars demain. »', options: ['arrive', 'arrivera', 'arriverait'], answer: 0 },
  { level: 'C1', q: 'Elle a réussi, ___ tous les obstacles.', options: ['en dépit de', 'à cause de', 'grâce à'], answer: 0 },
  { level: 'C2', q: '« Il n’est pas sans savoir » signifie :', options: ['il ne sait pas', 'il sait parfaitement', 'il hésite'], answer: 1 },
  { level: 'C2', q: '« Encore eût-il fallu que je le ___. »', options: ['susse', 'sache', 'saurais'], answer: 0 },
];

export function placementResult(correctCount) {
  if (correctCount <= 2) return 'A1';
  if (correctCount <= 4) return 'A2';
  if (correctCount <= 7) return 'B1';
  if (correctCount <= 9) return 'B2';
  if (correctCount <= 11) return 'C1';
  return 'C2';
}

// ---- path state ----

export function getPath() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function savePath(path) {
  try {
    localStorage.setItem(KEY, JSON.stringify(path));
  } catch { /* storage unavailable */ }
}

export function createPath(goal, cefr) {
  const path = {
    goal,
    cefr,
    unitIndex: 0,
    lessonIndex: 0,
    progress: {}, // { [unitId.lessonIdx]: countDone }
    completed: {}, // { [unitId.lessonIdx]: { date, score? } }
    checkpoints: [], // [{ unitId, score, passed, date }]
    momentum: 0, // consecutive strong checkpoints → CEFR bump
    startedAt: new Date().toISOString(),
  };
  savePath(path);
  return path;
}

/**
 * Re-run placement / change goal without wiping completed lessons.
 * Progress keys for the previous goal remain in `completed` for stats;
 * unitIndex is rewound only if the new goal's unit list is shorter.
 */
export function retakePlacement(goal, cefr, existing = getPath()) {
  if (!existing) return createPath(goal, cefr);
  const roadmap = getRoadmap(goal);
  const unitIndex = Math.min(existing.unitIndex || 0, Math.max(0, roadmap.length - 1));
  const unit = roadmap[unitIndex];
  const lessonIndex = Math.min(
    existing.lessonIndex || 0,
    Math.max(0, (unit?.lessons?.length || 1) - 1),
  );
  const path = {
    ...existing,
    goal,
    cefr,
    unitIndex,
    lessonIndex,
    momentum: 0,
    lastPlacementAt: new Date().toISOString(),
  };
  savePath(path);
  return path;
}

export const clearPath = () => localStorage.removeItem(KEY);

const lessonKey = (unit, idx) => `${unit.id}.${idx}`;

export function currentUnit(path) {
  const roadmap = getRoadmap(path.goal);
  return roadmap[Math.min(path.unitIndex, roadmap.length - 1)];
}

export const pathFinished = (path) => path.unitIndex >= getRoadmap(path.goal).length;

export function currentLesson(path) {
  if (pathFinished(path)) return null;
  const unit = currentUnit(path);
  const lesson = unit.lessons[path.lessonIndex];
  return lesson ? { ...lesson, unit, key: lessonKey(unit, path.lessonIndex), index: path.lessonIndex } : null;
}

export const lessonProgress = (path, key) => path.progress[key] || 0;

// Record an activity event and advance the path when it satisfies the
// current lesson. Returns { path, changed, completedLesson, unitAdvanced,
// checkpoint: {passed, score} | null, levelChange: 'up' | null }.
export function applyActivity(path, evt) {
  const out = { path, changed: false, completedLesson: null, unitAdvanced: false, checkpoint: null, levelChange: null };
  if (!path || pathFinished(path)) return out;
  const lesson = currentLesson(path);
  if (!lesson) return out;

  const matches =
    (lesson.type === 'scenario' && evt.type === 'session' && evt.scenarioId === lesson.scenarioId) ||
    (lesson.type === 'checkpoint' && evt.type === 'session' && evt.scenarioId === lesson.scenarioId) ||
    (lesson.type === 'dictation' && evt.type === 'dictation') ||
    (lesson.type === 'cards' && evt.type === 'cards') ||
    (lesson.type === 'quickfire' && evt.type === 'quickfire') ||
    (lesson.type === 'grammar' && evt.type === 'grammar' && evt.topicId === lesson.topicId) ||
    (lesson.type === 'reading' && evt.type === 'reading' && evt.textId === lesson.textId) ||
    (lesson.type === 'listening' && evt.type === 'listening' && evt.trackId === lesson.trackId);
  if (!matches) return out;

  out.changed = true;

  if (lesson.type === 'checkpoint') {
    const score = evt.score ?? 0;
    const passed = score >= lesson.passScore;
    path.checkpoints.push({ unitId: lesson.unit.id, score, passed, date: new Date().toISOString() });
    out.checkpoint = { passed, score };
    if (passed) {
      path.completed[lesson.key] = { date: new Date().toISOString(), score };
      path.unitIndex += 1;
      path.lessonIndex = 0;
      out.unitAdvanced = true;
      // Adaptive CEFR: two consecutive strong checkpoints move you up a level.
      if (score >= 85) {
        path.momentum += 1;
        if (path.momentum >= 2) {
          const i = CEFR_LEVELS.indexOf(path.cefr);
          if (i < CEFR_LEVELS.length - 1) {
            path.cefr = CEFR_LEVELS[i + 1];
            out.levelChange = 'up';
          }
          path.momentum = 0;
        }
      } else {
        path.momentum = 0;
      }
    }
    savePath(path);
    return out;
  }

  const done = (path.progress[lesson.key] || 0) + 1;
  path.progress[lesson.key] = done;
  if (done >= lesson.need) {
    path.completed[lesson.key] = { date: new Date().toISOString() };
    path.lessonIndex += 1;
    out.completedLesson = lesson;
  }
  savePath(path);
  return out;
}
