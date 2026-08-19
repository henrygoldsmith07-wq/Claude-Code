// The exam simulator: timing engine, mark-scheme scoring, and the examiner
// benchmark.
//
// The timing engine is the part that matters pedagogically. Candidates lose
// marks for running short far more often than for being wrong, and the only
// way to learn the length of two minutes of continuous French is to be held
// to it. So the simulator runs real clocks — supervised preparation, then a
// per-task allowance that does not pause when you panic.

import {
  CRITERIA, EXAM_MODE, TASK_CRITERIA, bandFor, getBoard, getTask, specCaveat, targetSeconds, taskMarks, TIER,
} from './boards.js';
import {
  pickConversation, pickExamTask, pickPhotocard, pickReadingPassage, pickRoleplay,
} from './tasks.js';

export const PHASE = {
  BRIEFING: 'briefing',
  PREP: 'prep',
  SPEAKING: 'speaking',
  REVIEW: 'review',
  DONE: 'done',
};

/**
 * Build a paper. `mode` is 'full' (every task, in order, one prep block —
 * exam conditions) or 'single' (one task, prep included — practice).
 */
export function buildPaper({
  boardId = 'wjec-gcse',
  tier = TIER.HIGHER,
  mode = 'full',
  examMode = EXAM_MODE.SPEAKING,
  taskId = null,
  theme = null,
  boundaries = null,
  boundarySource = null,
} = {}) {
  const board = getBoard(boardId);
  if (!board) throw new Error(`Unknown exam board: ${boardId}`);

  const isSpeaking = examMode === EXAM_MODE.SPEAKING;
  const wanted = isSpeaking
    ? (mode === 'single' && taskId
      ? board.tasks.filter((t) => t.id === taskId)
      : board.tasks)
    : [materialFor(examMode, { boardId, theme, tier })];

  const sections = wanted.filter(Boolean).map((task) => {
    const material = isSpeaking
      ? materialFor(task.id, { boardId, theme, tier })
      : task;
    return {
      taskId: isSpeaking ? task.id : examMode,
      materialId: material?.id || null,
      label: isSpeaking ? task.label : material?.title || `${examMode} task`,
      blurb: isSpeaking ? task.blurb : 'Original board-style practice task — verify your live specification before relying on timings.',
      seconds: isSpeaking ? targetSeconds(boardId, task.id, tier) : material?.targetSeconds || 1800,
      marks: isSpeaking ? taskMarks(boardId, task.id, tier) : material?.marks || 40,
      criteria: isSpeaking ? (TASK_CRITERIA[task.id] || ['communication']) : (material?.criteria || TASK_CRITERIA[examMode] || ['comprehension']),
      material,
      examMode,
    };
  });

  if (!sections.length) throw new Error(`No ${examMode} practice task is available for this board.`);

  const prepSeconds = isSpeaking
    ? (mode === 'single'
      ? Math.round((board.prepTotal || 600) / Math.max(1, board.tasks.length))
      : board.prepTotal || 600)
    : sections[0].material?.prepSeconds || 300;

  return {
    boardId,
    boardName: board.name,
    tier: board.tiers.length ? tier : null,
    mode,
    examMode,
    prepSeconds,
    sections,
    totalMarks: sections.reduce((a, s) => a + (s.marks || 0), 0),
    totalSpeakingSeconds: sections.reduce((a, s) => a + (s.seconds || 0), 0),
    totalTaskSeconds: sections.reduce((a, s) => a + (s.seconds || 0), 0),
    boundaries: boundaries && typeof boundaries === 'object' ? boundaries : null,
    boundarySource: boundarySource || null,
    caveat: specCaveat(boardId),
    createdAt: new Date().toISOString(),
  };
}

function materialFor(taskId, { boardId, theme, tier }) {
  switch (taskId) {
    case 'roleplay': return pickRoleplay({ theme, tier, boardId });
    case 'photocard': return pickPhotocard({ theme, tier, boardId });
    case 'reading-aloud': return pickReadingPassage({ tier, boardId });
    case 'conversation':
    case 'stimulus':
    case 'research':
      return pickConversation({ theme, boardId });
    case EXAM_MODE.WRITING:
    case EXAM_MODE.LISTENING:
    case EXAM_MODE.READING:
      return pickExamTask(taskId, { theme, boardId });
    default: return null;
  }
}

// ---------------------------------------------------------------- clock -----

/**
 * A pure clock. The component owns the interval; this owns the rules — which
 * phase we are in, how long is left, and whether the candidate may still see
 * their notes (they may during prep, and during the role-play and photo card,
 * but not during the conversation).
 */
export function initRun(paper, { now = Date.now() } = {}) {
  return {
    paper,
    phase: PHASE.BRIEFING,
    sectionIndex: 0,
    startedAt: null,
    phaseStartedAt: now,
    elapsed: 0,
    transcripts: [],
    overrunSeconds: 0,
  };
}

export function beginPrep(run, { now = Date.now() } = {}) {
  return { ...run, phase: PHASE.PREP, phaseStartedAt: now, startedAt: run.startedAt || now };
}

export function beginSpeaking(run, { now = Date.now() } = {}) {
  return { ...run, phase: PHASE.SPEAKING, phaseStartedAt: now };
}

/** Seconds allowed in the current phase, or null when the phase is untimed. */
export function phaseAllowance(run) {
  if (run.phase === PHASE.PREP) return run.paper.prepSeconds;
  if (run.phase === PHASE.SPEAKING) return run.paper.sections[run.sectionIndex]?.seconds ?? null;
  return null;
}

export function timeLeft(run, now = Date.now()) {
  const allowance = phaseAllowance(run);
  if (allowance === null) return null;
  const spent = Math.floor((now - run.phaseStartedAt) / 1000);
  return Math.max(0, allowance - spent);
}

export function isExpired(run, now = Date.now()) {
  const left = timeLeft(run, now);
  return left !== null && left <= 0;
}

/** Whether the candidate may look at their prepared notes right now. */
export function notesAllowed(run) {
  if (run.phase === PHASE.PREP) return true;
  const section = run.paper.sections[run.sectionIndex];
  if (run.paper.examMode && run.paper.examMode !== EXAM_MODE.SPEAKING) return false;
  return run.phase === PHASE.SPEAKING && section && section.taskId !== 'conversation';
}

/** Finish the current section and move on (or to review). */
export function completeSection(run, {
  transcript = '',
  spokenSeconds = 0,
  spentSeconds = null,
  responseData = null,
  submitted = true,
  usedNotes = false,
  candidateAsked = false,
  unexpectedHandled = false,
  now = Date.now(),
} = {}) {
  const section = run.paper.sections[run.sectionIndex];
  const allowance = section?.seconds ?? 0;
  const cleanSpoken = Number.isFinite(Number(spokenSeconds)) ? Math.max(0, Number(spokenSeconds)) : 0;
  const cleanSpent = Number.isFinite(Number(spentSeconds))
    ? Math.max(0, Number(spentSeconds))
    : cleanSpoken;
  const transcripts = [...run.transcripts, {
    taskId: section?.taskId,
    transcript,
    spokenSeconds: cleanSpoken,
    spentSeconds: cleanSpent,
    allowance,
    responseData,
    submitted: Boolean(submitted),
    usedNotes: Boolean(usedNotes),
    candidateAsked: Boolean(candidateAsked),
    unexpectedHandled: Boolean(unexpectedHandled),
    // Under-running is the commonest lost mark, so it is recorded explicitly.
    shortfall: section?.examMode && section.examMode !== EXAM_MODE.SPEAKING
      ? 0
      : Math.max(0, allowance - cleanSpoken),
  }];

  const nextIndex = run.sectionIndex + 1;
  if (nextIndex >= run.paper.sections.length) {
    return { ...run, transcripts, phase: PHASE.REVIEW, sectionIndex: run.sectionIndex };
  }
  return { ...run, transcripts, sectionIndex: nextIndex, phase: PHASE.SPEAKING, phaseStartedAt: now };
}

// -------------------------------------------------------------- scoring -----

/**
 * Convert per-criterion 0–100 sub-scores into marks for a task, then a paper
 * total. Criteria are equally weighted within a task: no board publishes a
 * weighting we could faithfully reproduce, and inventing one would be worse
 * than the honest equal split.
 */
export function scoreTask({ boardId, taskId, tier = TIER.HIGHER, scores = {}, outOf = null, automaticScore = null }) {
  const criteria = TASK_CRITERIA[taskId] || ['communication'];
  const available = criteria.filter((c) => Number.isFinite(Number(scores[c])));
  const automatic = Number.isFinite(Number(automaticScore)) && criteria.includes('comprehension');
  if (!available.length) {
    if (!automatic) {
      return { taskId, marks: null, outOf: outOf ?? taskMarks(boardId, taskId, tier), bands: [], note: 'Not scored.' };
    }
    const percent = Math.max(0, Math.min(100, Number(automaticScore)));
    const resolvedOutOf = outOf ?? taskMarks(boardId, taskId, tier) ?? 0;
    return {
      taskId,
      percent: Math.round(percent),
      marks: Math.round((percent / 100) * resolvedOutOf),
      outOf: resolvedOutOf,
      bands: [bandFor('comprehension', percent)],
      unscored: [],
      automatic: true,
    };
  }
  const mean = available.reduce((a, c) => a + Number(scores[c]), 0) / available.length;
  const resolvedOutOf = outOf ?? (taskMarks(boardId, taskId, tier) || 0);
  return {
    taskId,
    percent: Math.round(mean),
    marks: Math.round((mean / 100) * resolvedOutOf),
    outOf: resolvedOutOf,
    bands: available.map((c) => bandFor(c, Number(scores[c]))),
    unscored: criteria.filter((c) => !available.includes(c)),
  };
}

export function scorePaper({ boardId, tier = TIER.HIGHER, taskScores = [] }) {
  const scored = taskScores.filter((t) => t.marks !== null);
  const marks = scored.reduce((a, t) => a + t.marks, 0);
  const outOf = scored.reduce((a, t) => a + t.outOf, 0);
  const percent = outOf ? Math.round((marks / outOf) * 100) : null;
  return {
    boardId,
    tier,
    marks,
    outOf,
    percent,
    tasks: taskScores,
    // Grade is deliberately absent here — see gradeEstimate, which refuses to
    // guess without real boundaries.
  };
}

/**
 * Grade estimation.
 *
 * Grade boundaries are set per series by each board and are published *after*
 * the exam. We do not have them, and a made-up boundary table would hand a
 * student a "grade 7" that means nothing. So: this returns a band with an
 * explicit confidence of null and a message saying what it is, unless real
 * boundaries are supplied by the caller.
 */
export function gradeEstimate(percent, { boundaries = null, board = null, boundarySource = null } = {}) {
  if (percent === null || percent === undefined) {
    return { grade: null, confidence: null, note: 'Not enough scored tasks to estimate.' };
  }
  if (boundaries && typeof boundaries === 'object') {
    const sorted = Object.entries(boundaries)
      .filter(([, min]) => Number.isFinite(Number(min)))
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    if (sorted.length) {
      const hit = sorted.find(([, min]) => percent >= min);
      return {
        grade: hit ? hit[0] : 'U',
        confidence: 0.7,
        note: `Estimated against the grade boundaries you supplied${boundarySource ? ` (${boundarySource})` : ''}.`,
      };
    }
  }
  return {
    grade: null,
    indicativeBand: indicativeBand(percent),
    confidence: null,
    note: `No official grade boundaries are built in — they are published per series${board ? ` by ${board}` : ''} and change every year. Enter last year's boundaries to convert this percentage into a grade.`,
  };
}

function indicativeBand(percent) {
  if (percent >= 85) return 'Top of the range';
  if (percent >= 70) return 'Strong';
  if (percent >= 55) return 'Secure middle';
  if (percent >= 40) return 'Developing';
  return 'Early';
}

/**
 * Exam technique is reported separately from language level. It measures
 * whether the candidate used the task and the clock well; it must never be
 * smuggled into a language mark or presented as an examiner prediction.
 */
export function scoreExamTechnique(run) {
  const sections = run?.paper?.sections || [];
  const transcripts = run?.transcripts || [];
  if (!sections.length || !transcripts.length) {
    return { score: null, status: 'not-started', languageLevel: null, components: {} };
  }

  const round = (n) => Math.round(Math.max(0, Math.min(100, n)));
  const values = sections.map((section, index) => {
    const t = transcripts[index] || {};
    const allowance = Number(section.seconds) || 0;
    const spent = Number.isFinite(Number(t.spentSeconds)) ? Number(t.spentSeconds) : Number(t.spokenSeconds) || 0;
    const ratio = allowance ? spent / allowance : 0;
    const timing = round((ratio / 0.85) * 100 - (ratio > 1 ? Math.min(25, (ratio - 1) * 100) : 0));
    const response = t.responseData || {};
    const textWords = String(t.transcript || '').trim().split(/\s+/).filter(Boolean).length;
    const answerCount = Number(response.answerCount) || 0;
    const expectedCount = Number(response.expectedCount) || 0;
    const completion = expectedCount
      ? round((answerCount / expectedCount) * 100)
      : (response.complete === false ? 40 : textWords >= 12 ? 100 : textWords ? 70 : 0);
    const isSpeaking = !run.paper.examMode || run.paper.examMode === EXAM_MODE.SPEAKING;
    const interaction = !isSpeaking
      ? 100
      : round((t.transcript ? 60 : 0) + (t.candidateAsked ? 20 : 0) + (t.unexpectedHandled ? 20 : 0));
    const conditions = t.usedNotes && section.taskId === 'conversation' ? 0 : 100;
    return { timing, completion, interaction, conditions, ratio, taskId: section.taskId };
  });

  const average = (key) => round(values.reduce((sum, value) => sum + value[key], 0) / values.length);
  const components = {
    timing: average('timing'),
    taskCompletion: average('completion'),
    interaction: average('interaction'),
    examConditions: average('conditions'),
  };
  const score = round(
    components.timing * 0.35
      + components.taskCompletion * 0.30
      + components.interaction * 0.20
      + components.examConditions * 0.15,
  );
  return {
    score,
    status: 'practice',
    languageLevel: null,
    components,
    sections: values,
    note: 'Technique is a separate practice signal for timing, completion and exam conditions; it is not a language-level mark.',
  };
}

/**
 * The feedback that actually changes a mark next time: shortfall against the
 * time allowance, which criteria dragged, and one concrete instruction each.
 */
export function examFeedback(run, paperScore) {
  const notes = [];

  for (const t of run.transcripts) {
    if (t.shortfall > 20) {
      const section = run.paper.sections.find((s) => s.taskId === t.taskId);
      notes.push({
        kind: 'timing',
        taskId: t.taskId,
        text: `You spoke for ${Math.round(t.spokenSeconds)}s of the ${t.allowance}s allowed on the ${section?.label || t.taskId}. Running short costs marks on every criterion at once — aim to fill the time by adding a reason and an example to each answer.`,
      });
    }
  }

  for (const task of paperScore.tasks || []) {
    const weakest = (task.bands || []).slice().sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < 60) {
      const criterion = Object.values(CRITERIA).find((c) => c.label === weakest.criterion);
      notes.push({
        kind: 'criterion',
        taskId: task.taskId,
        text: `${weakest.criterion} was your weakest on the ${task.taskId}: “${weakest.desc}” ${nextStepFor(criterion?.id)}`,
      });
    }
  }

  if (!notes.length) {
    notes.push({ kind: 'ok', text: 'Timing and criteria both held up. Repeat with a different theme to check it was not the topic carrying you.' });
  }
  return notes;
}

function nextStepFor(criterionId) {
  switch (criterionId) {
    case 'communication': return 'Answer the question asked, then add one sentence of detail before stopping.';
    case 'accuracy': return 'Pick two tenses and rehearse them until the endings are automatic — accuracy marks come from control, not variety.';
    case 'range': return 'Prepare three connectives and one opinion phrase you can drop into any answer.';
    case 'pronunciation': return 'Read your prepared answers aloud into the pronunciation drill and fix the two sounds it flags.';
    case 'spontaneity': return 'Practise the unpredictable prompt — the “!” — with a partner who changes the question every time.';
    default: return '';
  }
}

// ------------------------------------------------------- examiner benchmark -

/**
 * How well do this app's scores agree with a real examiner's?
 *
 * The previous version of this shipped three invented scripts and reported
 * "agreement 100%, κ 1" on the analytics screen — a validation claim made of
 * nothing. This one starts empty and says so. Cohen's kappa is computed
 * properly (agreement corrected for chance), because the uncorrected figure
 * flatters any scorer on a skewed grade distribution.
 *
 * To populate it: have a qualified teacher mark 30+ recorded attempts using
 * the board's own mark scheme, store { id, boardId, examinerMarks, outOf,
 * appPercent, examinerGrade? }, and pass them in.
 */
export const EXAMINER_SCRIPTS = [];

export function cohensKappa(pairs) {
  const n = pairs.length;
  if (n < 2) return null;
  const labels = [...new Set(pairs.flat())];
  let observed = 0;
  for (const [a, b] of pairs) if (a === b) observed += 1;
  const po = observed / n;

  let pe = 0;
  for (const label of labels) {
    const pa = pairs.filter(([a]) => a === label).length / n;
    const pb = pairs.filter(([, b]) => b === label).length / n;
    pe += pa * pb;
  }
  if (pe >= 1) return null;
  return Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
}

export function benchmarkExaminer(scripts = EXAMINER_SCRIPTS) {
  const usable = scripts.filter((s) => s && Number.isFinite(s.appPercent) && Number.isFinite(s.examinerPercent));
  if (!usable.length) {
    return {
      n: 0,
      status: 'no-data',
      agreement: null,
      kappa: null,
      meanAbsoluteError: null,
      label: 'Not benchmarked',
      message: 'No examiner-marked attempts recorded. Until a qualified marker has scored real attempts, treat these marks as practice feedback, not a predicted grade.',
    };
  }

  let absError = 0;
  const gradePairs = [];
  let within5 = 0;
  for (const s of usable) {
    absError += Math.abs(s.appPercent - s.examinerPercent);
    if (Math.abs(s.appPercent - s.examinerPercent) <= 5) within5 += 1;
    if (s.appGrade && s.examinerGrade) gradePairs.push([s.appGrade, s.examinerGrade]);
  }

  const kappa = gradePairs.length >= 2 ? cohensKappa(gradePairs) : null;
  const mae = Math.round((absError / usable.length) * 10) / 10;

  return {
    n: usable.length,
    status: usable.length < 30 ? 'provisional' : 'benchmarked',
    agreement: Math.round((within5 / usable.length) * 100) / 100,
    kappa,
    meanAbsoluteError: mae,
    label: usable.length < 30
      ? `Provisional (n=${usable.length})`
      : `Benchmarked (MAE ${mae}pp, n=${usable.length})`,
    message: usable.length < 30
      ? `Only ${usable.length} examiner-marked attempts — too few to claim agreement. Indicative only.`
      : `Mean absolute error ${mae} percentage points against examiner marks${kappa === null ? '' : `, grade κ = ${kappa}`}.`,
  };
}

/**
 * Real exam performance validation: did the predicted mark match the grade
 * that actually came back in August? Same discipline — empty until someone
 * reports a real result.
 */
export const REAL_RESULTS = [];

export function validateAgainstResults(results = REAL_RESULTS) {
  const usable = results.filter((r) => r && r.predictedGrade && r.actualGrade);
  if (!usable.length) {
    return { n: 0, exact: null, withinOne: null, status: 'no-data', message: 'No real results reported yet.' };
  }
  const orders = [
    ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'],
    ['A*', 'A', 'B', 'C', 'D', 'E', 'U'],
  ];
  const idx = (g) => {
    const value = String(g);
    const order = orders.find((candidate) => candidate.includes(value));
    return order ? order.indexOf(value) : -1;
  };
  let exact = 0;
  let withinOne = 0;
  const comparable = usable.filter((r) => idx(r.predictedGrade) >= 0 && idx(r.actualGrade) >= 0);
  for (const r of comparable) {
    const d = Math.abs(idx(r.predictedGrade) - idx(r.actualGrade));
    if (d === 0) exact += 1;
    if (d <= 1) withinOne += 1;
  }
  return {
    n: comparable.length,
    exact: comparable.length ? Math.round((exact / comparable.length) * 100) / 100 : null,
    withinOne: comparable.length ? Math.round((withinOne / comparable.length) * 100) / 100 : null,
    status: comparable.length < 20 ? 'provisional' : 'validated',
    message: comparable.length
      ? `${exact}/${comparable.length} exact, ${withinOne}/${comparable.length} within one grade.`
      : 'No comparable grade pairs recorded yet.',
  };
}
