// Compatibility shim.
//
// This module used to export SAMPLE_SCRIPTS — three invented exam scripts —
// and Analytics rendered "Agreement 100% · κ 1" from them. That is a
// validation claim built from nothing, so the fixtures are gone and the real
// harness lives in exams/simulator.js, which starts empty and says it is
// unvalidated until someone marks real attempts.

export {
  EXAMINER_SCRIPTS,
  benchmarkExaminer,
  cohensKappa,
  REAL_RESULTS,
  validateAgainstResults,
} from './exams/simulator.js';

import { benchmarkExaminer } from './exams/simulator.js';

/** @deprecated Use benchmarkExaminer — kept so old call sites keep compiling. */
export const benchmarkExam = (scripts) => benchmarkExaminer(scripts);
