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

// Lesson types map onto the app's activity surfaces:
//   scenario   → a conversation session in the given scenario (≥1 turn + End Session)
//   dictation  → N dictée sentences checked
//   cards      → N flashcards rated
//   quickfire  → one 45s improv completed
//   checkpoint → a scored conversation; pass requires report avg ≥ passScore
const L = {
  scenario: (id, title) => ({ type: 'scenario', scenarioId: id, title, need: 1 }),
  dictation: (title, need = 3) => ({ type: 'dictation', title, need }),
  cards: (title, need = 5) => ({ type: 'cards', title, need }),
  quickfire: (title) => ({ type: 'quickfire', title, need: 1 }),
  checkpoint: (id, title) => ({ type: 'checkpoint', scenarioId: id, title, need: 1, passScore: 70 }),
};

const ROADMAPS = {
  travel: [
    { id: 'tr1', title: 'Café & Restaurant', lessons: [
      L.scenario('bistro', 'Order lunch at a bistro'),
      L.cards('Filler words for small talk'),
      L.dictation('Train your ear: menus & greetings'),
      L.checkpoint('bistro', 'Checkpoint: handle a full bistro visit'),
    ]},
    { id: 'tr2', title: 'Getting Around', lessons: [
      L.scenario('vol', 'Rebook a cancelled flight'),
      L.quickfire('Improv: describe your journey'),
      L.dictation('Train your ear: announcements'),
      L.checkpoint('vol', 'Checkpoint: negotiate with the airline'),
    ]},
    { id: 'tr3', title: 'Markets & Services', lessons: [
      L.scenario('marche', 'Shop at the open-air market'),
      L.scenario('poste', 'Send a package abroad'),
      L.cards('Review your weak vocabulary'),
      L.checkpoint('marche', 'Checkpoint: haggle like a local'),
    ]},
    { id: 'tr4', title: 'Living Local', lessons: [
      L.scenario('colloc', 'View a flat-share'),
      L.quickfire('Improv: your ideal neighbourhood'),
      L.dictation('Train your ear: everyday chat'),
      L.checkpoint('colloc', 'Checkpoint: win over the flatmates'),
    ]},
  ],
  school: [
    { id: 'sc1', title: 'Campus Life', lessons: [
      L.scenario('colloc', 'Find student housing'),
      L.cards('Conversational glue words'),
      L.dictation('Train your ear: campus chatter'),
      L.checkpoint('colloc', 'Checkpoint: settle the flat-share'),
    ]},
    { id: 'sc2', title: 'Professors & Assignments', lessons: [
      L.scenario('cours', 'Office hours with your professor'),
      L.quickfire('Improv: explain what you study'),
      L.dictation('Train your ear: instructions'),
      L.checkpoint('cours', 'Checkpoint: negotiate an extension'),
    ]},
    { id: 'sc3', title: 'Everyday Errands', lessons: [
      L.scenario('poste', 'Post office paperwork'),
      L.scenario('bistro', 'Coffee between lectures'),
      L.cards('Review your weak vocabulary'),
      L.checkpoint('bistro', 'Checkpoint: a full café conversation'),
    ]},
    { id: 'sc4', title: 'Presentations', lessons: [
      L.quickfire('Improv: defend an opinion'),
      L.scenario('cours', 'Discuss your presentation plan'),
      L.dictation('Train your ear: academic French'),
      L.checkpoint('cours', 'Checkpoint: field the professor’s questions'),
    ]},
  ],
  business: [
    { id: 'bu1', title: 'The Interview', lessons: [
      L.scenario('entretien', 'Introduce yourself and your background'),
      L.cards('Professional connectors'),
      L.dictation('Train your ear: formal French'),
      L.checkpoint('entretien', 'Checkpoint: the tough questions'),
    ]},
    { id: 'bu2', title: 'Meetings', lessons: [
      L.scenario('reunion', 'Give a project update'),
      L.quickfire('Improv: pitch an idea in 45s'),
      L.dictation('Train your ear: meeting speak'),
      L.checkpoint('reunion', 'Checkpoint: handle a moved deadline'),
    ]},
    { id: 'bu3', title: 'Business Travel', lessons: [
      L.scenario('vol', 'Rebook a work trip'),
      L.scenario('bistro', 'A client lunch'),
      L.cards('Review your weak vocabulary'),
      L.checkpoint('vol', 'Checkpoint: fix the travel crisis'),
    ]},
    { id: 'bu4', title: 'Office Small Talk', lessons: [
      L.quickfire('Improv: Monday-morning chat'),
      L.scenario('reunion', 'Wrap up the quarter'),
      L.dictation('Train your ear: colleagues talking'),
      L.checkpoint('reunion', 'Checkpoint: run the meeting yourself'),
    ]},
  ],
  fluency: [
    { id: 'fl1', title: 'Everyday Ease', lessons: [
      L.scenario('bistro', 'A natural café exchange'),
      L.cards('Sound-native filler words'),
      L.quickfire('Improv: whatever comes up'),
      L.checkpoint('marche', 'Checkpoint: banter at the market'),
    ]},
    { id: 'fl2', title: 'Handling Friction', lessons: [
      L.scenario('vol', 'Push back politely'),
      L.scenario('poste', 'Bureaucracy without tears'),
      L.dictation('Train your ear: fast French'),
      L.checkpoint('vol', 'Checkpoint: keep cool under pressure'),
    ]},
    { id: 'fl3', title: 'People & Stories', lessons: [
      L.scenario('colloc', 'Talk about yourself naturally'),
      L.quickfire('Improv: tell a story'),
      L.cards('Review your weak vocabulary'),
      L.checkpoint('colloc', 'Checkpoint: be genuinely likeable'),
    ]},
    { id: 'fl4', title: 'The Professional You', lessons: [
      L.scenario('entretien', 'Your story, professionally'),
      L.scenario('reunion', 'Think aloud in a meeting'),
      L.dictation('Train your ear: register shifts'),
      L.checkpoint('entretien', 'Checkpoint: fully in character'),
    ]},
  ],
};

export const getRoadmap = (goal) => ROADMAPS[goal] || ROADMAPS.fluency;

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
    (lesson.type === 'quickfire' && evt.type === 'quickfire');
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
