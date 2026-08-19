// Exam board specifications: structure, timings and assessment criteria.
//
// IMPORTANT, and deliberately loud: specifications change, and this file is a
// model of them, not a copy of them. Every board entry carries `specVersion`
// and `verifyAt` so the UI can tell a learner where to check the authority
// before they rely on a timing. Nothing here reproduces a board's mark scheme
// wording — the band descriptors are our own plain-English restatements of
// what each criterion rewards, written for a learner reading feedback.
//
// What IS reliable here: the shape of the speaking tests (three tasks —
// role-play, a picture/photo task, a conversation), the fact that preparation
// time is supervised, and the criteria families (communication, accuracy,
// range, pronunciation). Those have been stable across the reformed GCSE and
// the A-level specifications.

export const TIER = { FOUNDATION: 'foundation', HIGHER: 'higher' };

export const EXAM_MODE = {
  SPEAKING: 'speaking',
  WRITING: 'writing',
  LISTENING: 'listening',
  READING: 'reading',
};

export const EXAM_MODES = {
  [EXAM_MODE.SPEAKING]: {
    id: EXAM_MODE.SPEAKING,
    label: 'Speaking',
    description: 'Timed role-play, picture task and conversation.',
  },
  [EXAM_MODE.WRITING]: {
    id: EXAM_MODE.WRITING,
    label: 'Writing',
    description: 'A timed original task with word-count and register checks.',
  },
  [EXAM_MODE.LISTENING]: {
    id: EXAM_MODE.LISTENING,
    label: 'Listening',
    description: 'Listen to original French audio and answer without seeing the script.',
  },
  [EXAM_MODE.READING]: {
    id: EXAM_MODE.READING,
    label: 'Reading',
    description: 'Read an original passage and answer exam-style questions.',
  },
};

/**
 * Timings are in seconds and are the *task* allowances, not the whole exam
 * slot. `prep` is supervised preparation time; `target` is the length a
 * candidate should be aiming to fill.
 */
export const BOARDS = {
  'wjec-gcse': {
    id: 'wjec-gcse',
    name: 'WJEC GCSE French',
    qualification: 'GCSE',
    country: 'Wales',
    specVersion: 'Reformed GCSE (first teaching 2024)',
    verifyAt: 'wjec.co.uk — check the current specification before relying on timings',
    tiers: [TIER.FOUNDATION, TIER.HIGHER],
    // Overall speaking assessment weighting within the qualification.
    speakingWeight: 0.25,
    tasks: [
      {
        id: 'roleplay',
        label: 'Role-play',
        prepShared: true,
        target: { foundation: 90, higher: 120 },
        marks: { foundation: 10, higher: 10 },
        blurb: 'A scripted scenario with five prompts, one of which asks a question.',
      },
      {
        id: 'photocard',
        label: 'Photo card',
        prepShared: true,
        target: { foundation: 120, higher: 150 },
        marks: { foundation: 10, higher: 10 },
        blurb: 'Describe a photo, then answer questions connected to its theme.',
      },
      {
        id: 'conversation',
        label: 'Conversation',
        prepShared: false,
        target: { foundation: 180, higher: 240 },
        marks: { foundation: 30, higher: 30 },
        blurb: 'An unscripted conversation across two themes, including your own questions.',
      },
    ],
    prepTotal: 900,
    themes: [
      'Identity and relationships with others',
      'Healthy living and lifestyle',
      'Education and work',
      'Free-time activities',
      'Customs, festivals and celebrations',
      'Celebrity culture',
      'Travel and tourism',
      'Media and technology',
      'The environment and where people live',
    ],
    grades: ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'],
  },

  'wjec-alevel': {
    id: 'wjec-alevel',
    name: 'WJEC A-level French',
    qualification: 'A-level',
    country: 'Wales',
    specVersion: 'A-level French',
    verifyAt: 'wjec.co.uk — confirm current speaking-test structure and timings',
    tiers: [],
    speakingWeight: 0.30,
    tasks: [
      {
        id: 'stimulus',
        label: 'Stimulus card discussion',
        prepShared: true,
        target: { default: 300 },
        marks: { default: 30 },
        blurb: 'Discuss a short French stimulus text, defending a position under questioning.',
      },
      {
        id: 'research',
        label: 'Individual research project',
        prepShared: false,
        target: { default: 600 },
        marks: { default: 30 },
        blurb: 'Present and defend your own research on a francophone topic.',
      },
    ],
    prepTotal: 1200,
    themes: [
      'Being a young person in francophone society',
      'Understanding the francophone world',
      'Diversity and difference',
      'France 1940–1950: the Occupation and the post-war years',
      'Literary texts and films',
    ],
    grades: ['A*', 'A', 'B', 'C', 'D', 'E', 'U'],
  },

  'aqa-gcse': {
    id: 'aqa-gcse',
    name: 'AQA GCSE French',
    qualification: 'GCSE',
    country: 'England',
    specVersion: 'Reformed GCSE 8652 (first teaching 2024)',
    verifyAt: 'aqa.org.uk — the reformed speaking test replaced the photo card with reading aloud',
    tiers: [TIER.FOUNDATION, TIER.HIGHER],
    speakingWeight: 0.25,
    tasks: [
      {
        id: 'roleplay',
        label: 'Role-play',
        prepShared: true,
        target: { foundation: 90, higher: 90 },
        marks: { foundation: 10, higher: 10 },
        blurb: 'A short transactional scenario following printed prompts.',
      },
      {
        id: 'reading-aloud',
        label: 'Reading aloud + short conversation',
        prepShared: true,
        target: { foundation: 120, higher: 150 },
        marks: { foundation: 15, higher: 15 },
        blurb: 'Read a short passage aloud, then answer questions on its topic. Pronunciation is assessed here.',
      },
      {
        id: 'conversation',
        label: 'Conversation',
        prepShared: false,
        target: { foundation: 150, higher: 210 },
        marks: { foundation: 25, higher: 25 },
        blurb: 'An unscripted conversation on two themes.',
      },
    ],
    prepTotal: 900,
    themes: [
      'People and lifestyle: identity and relationships',
      'People and lifestyle: healthy living and lifestyle',
      'People and lifestyle: education and work',
      'Popular culture: free time activities',
      'Popular culture: customs, festivals and celebrations',
      'Popular culture: celebrity culture',
      'Communication and the world around us: travel and tourism',
      'Communication and the world around us: media and technology',
      'Communication and the world around us: the environment',
    ],
    grades: ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'],
  },

  'edexcel-gcse': {
    id: 'edexcel-gcse',
    name: 'Pearson Edexcel GCSE French',
    qualification: 'GCSE',
    country: 'England',
    specVersion: 'Reformed GCSE (first teaching 2024)',
    verifyAt: 'qualifications.pearson.com — confirm task order and timings',
    tiers: [TIER.FOUNDATION, TIER.HIGHER],
    speakingWeight: 0.25,
    tasks: [
      {
        id: 'roleplay',
        label: 'Role-play',
        prepShared: true,
        target: { foundation: 90, higher: 90 },
        marks: { foundation: 10, higher: 10 },
        blurb: 'A transactional scenario from a printed card.',
      },
      {
        id: 'photocard',
        label: 'Picture-based task',
        prepShared: true,
        target: { foundation: 120, higher: 150 },
        marks: { foundation: 12, higher: 12 },
        blurb: 'Describe a picture and answer follow-up questions on the theme.',
      },
      {
        id: 'conversation',
        label: 'Conversation',
        prepShared: false,
        target: { foundation: 180, higher: 240 },
        marks: { foundation: 28, higher: 28 },
        blurb: 'Unscripted conversation, with at least one question asked by you.',
      },
    ],
    prepTotal: 720,
    themes: [
      'My personal world',
      'Lifestyle and wellbeing',
      'My neighbourhood',
      'Media and technology',
      'Studying and my future',
      'Travel and tourism',
    ],
    grades: ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'],
  },
};

export const boardList = () => Object.values(BOARDS);
export const getBoard = (id) => BOARDS[id] || null;
export const getTask = (boardId, taskId) => getBoard(boardId)?.tasks.find((t) => t.id === taskId) || null;

/** Task length for a tier, falling back to the default where tiers do not apply. */
export function targetSeconds(boardId, taskId, tier = TIER.HIGHER) {
  const task = getTask(boardId, taskId);
  if (!task) return null;
  return task.target[tier] ?? task.target.default ?? task.target.higher ?? null;
}

export function taskMarks(boardId, taskId, tier = TIER.HIGHER) {
  const task = getTask(boardId, taskId);
  if (!task) return null;
  return task.marks[tier] ?? task.marks.default ?? task.marks.higher ?? null;
}

// ------------------------------------------------------------ criteria ------

/**
 * Assessment criteria, restated in our own words. Each criterion has bands
 * from 0 to `max`, and each band says what a candidate has actually done —
 * the descriptors are written to be usable as feedback, which is what an
 * examiner's wording is not designed for.
 */
export const CRITERIA = {
  communication: {
    id: 'communication',
    label: 'Communication',
    blurb: 'Did the message get across, and did you complete the task?',
    bands: [
      { min: 0, label: 'Nothing usable', desc: 'No relevant message conveyed.' },
      { min: 20, label: 'Fragments', desc: 'Isolated words; the examiner has to guess your meaning.' },
      { min: 40, label: 'Partial', desc: 'Simple messages get through; some prompts are missed or misread.' },
      { min: 60, label: 'Clear', desc: 'All prompts addressed with straightforward, understandable answers.' },
      { min: 80, label: 'Developed', desc: 'Every prompt answered and extended without being asked — opinions, reasons, detail.' },
    ],
  },
  accuracy: {
    id: 'accuracy',
    label: 'Accuracy',
    blurb: 'Grammar, verb forms, agreement and word order.',
    bands: [
      { min: 0, label: 'Nothing usable', desc: 'No controlled structures.' },
      { min: 20, label: 'Very limited', desc: 'Errors in almost every phrase; meaning frequently blocked.' },
      { min: 40, label: 'Inconsistent', desc: 'Simple structures often right; tenses and agreement unreliable.' },
      { min: 60, label: 'Generally accurate', desc: 'Sound control of common tenses; errors rarely block meaning.' },
      { min: 80, label: 'Secure', desc: 'Accurate across tenses and complex structures; errors are slips, not gaps.' },
    ],
  },
  range: {
    id: 'range',
    label: 'Range of language',
    blurb: 'Variety of vocabulary and structures — did you reach beyond the safe minimum?',
    bands: [
      { min: 0, label: 'Nothing usable', desc: 'No range to assess.' },
      { min: 20, label: 'Minimal', desc: 'A handful of memorised phrases.' },
      { min: 40, label: 'Narrow', desc: 'Common vocabulary, one tense, repeated connectives.' },
      { min: 60, label: 'Varied', desc: 'More than one tense, some opinions with reasons, several connectives.' },
      { min: 80, label: 'Wide', desc: 'Three or more tenses used naturally, idiom, subordination, precise vocabulary.' },
    ],
  },
  pronunciation: {
    id: 'pronunciation',
    label: 'Pronunciation & intonation',
    blurb: 'Could a French listener follow you comfortably? Accent is not penalised — clarity is assessed.',
    bands: [
      { min: 0, label: 'Nothing usable', desc: 'Not comprehensible.' },
      { min: 20, label: 'Hard work', desc: 'The listener strains throughout; many words unrecognisable.' },
      { min: 40, label: 'Understandable with effort', desc: 'Generally followable; some words need repeating.' },
      { min: 60, label: 'Clear', desc: 'Readily understood; recognisably French rhythm.' },
      { min: 80, label: 'Confident', desc: 'Consistently clear, good intonation and liaison; an audible accent is fine.' },
    ],
  },
  spontaneity: {
    id: 'spontaneity',
    label: 'Spontaneity & interaction',
    blurb: 'Responding without a script — dealing with the unexpected, asking your own questions.',
    bands: [
      { min: 0, label: 'Nothing usable', desc: 'No interaction.' },
      { min: 20, label: 'Rehearsed only', desc: 'Prepared material only; unexpected questions stall the exchange.' },
      { min: 40, label: 'Hesitant', desc: 'Answers come but need prompting; long pauses.' },
      { min: 60, label: 'Responsive', desc: 'Handles unprepared questions and keeps the exchange moving.' },
      { min: 80, label: 'Fluent', desc: 'Initiates, asks questions, redirects and recovers from difficulty unaided.' },
    ],
  },
  content: {
    id: 'content',
    label: 'Task fulfilment',
    blurb: 'Did you answer every bullet with relevant, developed detail?',
    bands: [
      { min: 0, label: 'Not attempted', desc: 'The task is missing or does not address the prompt.' },
      { min: 20, label: 'Partial', desc: 'Some relevant ideas, but important bullets are missing.' },
      { min: 40, label: 'Mostly relevant', desc: 'The main task is covered, with limited development.' },
      { min: 60, label: 'Complete', desc: 'All required points are answered with relevant detail.' },
      { min: 80, label: 'Developed', desc: 'Every point is developed with precise, purposeful detail.' },
    ],
  },
  organisation: {
    id: 'organisation',
    label: 'Organisation & register',
    blurb: 'Is the response easy to follow and appropriate for its audience?',
    bands: [
      { min: 0, label: 'Unclear', desc: 'Ideas are not connected or the register is unsuitable.' },
      { min: 20, label: 'Basic', desc: 'A few linked ideas, with abrupt changes or inconsistent register.' },
      { min: 40, label: 'Ordered', desc: 'The response follows a clear enough sequence.' },
      { min: 60, label: 'Controlled', desc: 'Paragraphing, connectives and register support the message.' },
      { min: 80, label: 'Purposeful', desc: 'The structure and register are consistently well judged.' },
    ],
  },
  comprehension: {
    id: 'comprehension',
    label: 'Comprehension',
    blurb: 'How accurately did you understand the French?',
    bands: [
      { min: 0, label: 'Not yet', desc: 'The key information was not identified.' },
      { min: 20, label: 'A little', desc: 'A few isolated details are understood.' },
      { min: 40, label: 'Partial', desc: 'Main points are understood, but detail is inconsistent.' },
      { min: 60, label: 'Secure', desc: 'Main points and most supporting details are understood.' },
      { min: 80, label: 'Detailed', desc: 'Explicit and implied meaning is understood reliably.' },
    ],
  },
};

/** Which criteria apply to a given task. */
export const TASK_CRITERIA = {
  roleplay: ['communication', 'accuracy'],
  photocard: ['communication', 'range', 'accuracy'],
  'reading-aloud': ['pronunciation', 'communication'],
  conversation: ['communication', 'range', 'accuracy', 'spontaneity', 'pronunciation'],
  stimulus: ['communication', 'range', 'accuracy', 'spontaneity'],
  research: ['communication', 'range', 'accuracy', 'spontaneity'],
  writing: ['content', 'accuracy', 'range', 'organisation'],
  listening: ['comprehension'],
  reading: ['comprehension'],
};

/** The band a 0–100 sub-score falls into, with its descriptor. */
export function bandFor(criterionId, score) {
  const c = CRITERIA[criterionId];
  if (!c || !Number.isFinite(score)) return null;
  let hit = c.bands[0];
  for (const b of c.bands) if (score >= b.min) hit = b;
  return { criterion: c.label, ...hit, score: Math.round(score) };
}

/**
 * A caveat string the UI must show wherever a board's timings appear. Making
 * this a function rather than a comment means it is hard to render an exam
 * simulator that quietly implies the numbers are authoritative.
 */
export function specCaveat(boardId) {
  const b = getBoard(boardId);
  if (!b) return '';
  return `Modelled on the ${b.specVersion}. Specifications change — verify timings and task order at ${b.verifyAt}.`;
}

/**
 * Internal consistency checks for the timing table. This is deliberately
 * separate from official-board verification: it catches broken local data,
 * but cannot make a changing specification authoritative.
 */
export function timingQa(boardId = null) {
  const boards = boardId ? [getBoard(boardId)].filter(Boolean) : boardList();
  const issues = [];
  const reports = boards.map((board) => {
    const tiers = board.tiers.length ? board.tiers : [TIER.HIGHER];
    const taskReports = board.tasks.map((task) => {
      const values = tiers.map((tier) => ({
        tier,
        seconds: targetSeconds(board.id, task.id, tier),
        marks: taskMarks(board.id, task.id, tier),
      }));
      for (const value of values) {
        if (!(value.seconds > 0)) issues.push(`${board.id}/${task.id}/${value.tier}: missing timing`);
        if (!(value.marks > 0)) issues.push(`${board.id}/${task.id}/${value.tier}: missing marks`);
      }
      return { id: task.id, values };
    });
    if (!(board.prepTotal > 0)) issues.push(`${board.id}: missing preparation allowance`);
    return { id: board.id, prepSeconds: board.prepTotal, tasks: taskReports };
  });
  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? 'pass' : 'attention',
    boards: reports,
    checks: reports.reduce((n, board) => n + board.tasks.reduce((m, task) => m + task.values.length * 2, 0) + 1, 0),
    issues,
  };
}
