// Compatibility shim — the real exam layer lives in ./exams/.
//
// The previous version invented three-word "rubrics" per board and summed raw
// criterion numbers into a band with no reference to marks available. Boards,
// criteria, timings and mark conversion now live in exams/boards.js and
// exams/simulator.js.

export {
  BOARDS, CRITERIA, EXAM_MODE, EXAM_MODES, TASK_CRITERIA, TIER, bandFor, boardList, getBoard, getTask,
  specCaveat, targetSeconds, taskMarks, timingQa,
} from './exams/boards.js';

export {
  PHASE, buildPaper, initRun, beginPrep, beginSpeaking, phaseAllowance, timeLeft,
  isExpired, notesAllowed, completeSection, scoreTask, scorePaper, scoreExamTechnique, gradeEstimate, examFeedback,
} from './exams/simulator.js';

import { getBoard, targetSeconds } from './exams/boards.js';

/**
 * @deprecated Timings are per board and per tier — read them from the board.
 * Kept so any old import resolves, now sourced from the real spec model.
 */
export const TIMINGS = {
  photocard: { prep: getBoard('wjec-gcse').prepTotal, answer: targetSeconds('wjec-gcse', 'photocard', 'higher') },
  roleplay: { prep: getBoard('wjec-gcse').prepTotal, answer: targetSeconds('wjec-gcse', 'roleplay', 'higher') },
  conversation: { prep: 0, answer: targetSeconds('wjec-gcse', 'conversation', 'higher') },
};
