// The exam simulator: timing engine, mark-scheme scoring, and the examiner
// benchmark.
//
// The timing engine is the part that matters pedagogically. Candidates lose
// marks for running short far more often than for being wrong, and the only
// way to learn the length of two minutes of continuous French is to be held
// to it. So the simulator runs real clocks — supervised preparation, then a
// per-task allowance that does not pause when you panic.

import {
  CRITERIA, TASK_CRITERIA, bandFor, getBoard, getTask, specCaveat, targetSeconds, taskMarks, TIER,
} from './boards.js';
import { pickConversation, pickPhotocard, pickReadingPassage, pickRoleplay } from './tasks.js';

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
export function buildPaper({ boardId = 'wjec-gcse', tier = TIER.HIGHER, mode = 'full', taskId = null, theme = null } = {}) {
  const board = getBoard(boardId);
  if (!board) throw new Error(`Unknown exam board: ${boardId}`);

  const wanted = mode === 'single' && taskId
    ? board.tasks.filter((t) => t.id === taskId)
    : board.tasks;

  const sections = wanted.map((task) => ({
    taskId: task.id,
    label: task.label,
    blurb: task.blurb,
    seconds: targetSeconds(boardId, task.id, tier),
    marks: taskMarks(boardId, task.id, tier),
    criteria: TASK_CRITERIA[task.id] || ['communication'],
    material: materialFor(task.id, { theme, tier }),
  }));

  const prepSeconds = mode === 'single'
    ? Math.round((board.prepTotal || 600) / Math.max(1, board.tasks.length))
    : board.prepTotal || 600;

  return {
    boardId,
    boardName: board.name,
    tier: board.tiers.length ? tier : null,
    mode,
    prepSeconds,
    sections,
    totalMarks: sections.reduce((a, s) => a + (s.marks || 0), 0),
    totalSpeakingSeconds: sections.reduce((a, s) => a + (s.seconds || 0), 0),
    caveat: specCaveat(boardId),
    createdAt: new Date().toISOString(),
  };
}

function materialFor(taskId, { theme, tier }) {
  switch (taskId) {
    case 'roleplay': return pickRoleplay({ theme, tier });
    case 'photocard': return pickPhotocard({ theme, tier });
    case 'reading-aloud': return pickReadingPassage({ tier });
    case 'conversation':
    case 'stimulus':
    case 'research':
      return pickConversation({ theme });
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
  return run.phase === PHASE.SPEAKING && section && section.taskId !== 'conversation';
}

/** Finish the current section and move on (or to review). */
export function completeSection(run, { transcript = '', spokenSeconds = 0, now = Date.now() } = {}) {
  const section = run.paper.sections[run.sectionIndex];
  const allowance = section?.seconds ?? 0;
  const transcripts = [...run.transcripts, {
    taskId: section?.taskId,
    transcript,
    spokenSeconds,
    allowance,
    // Under-running is the commonest lost mark, so it is recorded explicitly.
    shortfall: Math.max(0, allowance - spokenSeconds),
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
export function scoreTask({ boardId, taskId, tier = TIER.HIGHER, scores = {} }) {
  const criteria = TASK_CRITERIA[taskId] || ['communication'];
  const available = criteria.filter((c) => Number.isFinite(Number(scores[c])));
  if (!available.length) {
    return { taskId, marks: null, outOf: taskMarks(boardId, taskId, tier), bands: [], note: 'Not scored.' };
  }
  const mean = available.reduce((a, c) => a + Number(scores[c]), 0) / available.length;
  const outOf = taskMarks(boardId, taskId, tier) || 0;
  return {
    taskId,
    percent: Math.round(mean),
    marks: Math.round((mean / 100) * outOf),
    outOf,
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
export function gradeEstimate(percent, { boundaries = null, board = null } = {}) {
  if (percent === null || percent === undefined) {
    return { grade: null, confidence: null, note: 'Not enough scored tasks to estimate.' };
  }
  if (boundaries) {
    const sorted = Object.entries(boundaries).sort((a, b) => b[1] - a[1]);
    const hit = sorted.find(([, min]) => percent >= min);
    return {
      grade: hit ? hit[0] : 'U',
      confidence: 0.7,
      note: 'Estimated against the grade boundaries you supplied.',
    };
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
  const order = ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'];
  const idx = (g) => order.indexOf(String(g));
  let exact = 0;
  let withinOne = 0;
  for (const r of usable) {
    const d = Math.abs(idx(r.predictedGrade) - idx(r.actualGrade));
    if (d === 0) exact += 1;
    if (d <= 1) withinOne += 1;
  }
  return {
    n: usable.length,
    exact: Math.round((exact / usable.length) * 100) / 100,
    withinOne: Math.round((withinOne / usable.length) * 100) / 100,
    status: usable.length < 20 ? 'provisional' : 'validated',
    message: `${exact}/${usable.length} exact, ${withinOne}/${usable.length} within one grade.`,
  };
}
