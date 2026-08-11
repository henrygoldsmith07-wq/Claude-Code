// Mark-scheme-aligned exam scoring for GCSE/A-Level (WJEC/AQA/Edexcel).
// Photocard, role-play, conversation — each with rubric bands.

export const EXAM_RUBRICS = {
  'gcse-wjec': { photocard: [ 'Content 0-6','Comprehension 0-6','Pronunciation 0-4'], roleplay: [ 'Task completion','Accuracy','Interaction'], conversation: [ 'Fluency','Accuracy','Range'] },
  'gcse-aqa': { photocard: [ 'Communication','Knowledge of language','Pronunciation'], roleplay: [ 'Communication','Accuracy'], conversation: [ 'Communication','Range','Accuracy'] },
  aqa: { photocard: [ 'Communication','Accuracy'], roleplay: [ 'Communication','Accuracy'], conversation: [ 'Fluency','Accuracy','Range'] },
};

export const TIMINGS = {
  photocard: { prep: 120, answer: 180 },
  roleplay: { prep: 120, answer: 240 },
  conversation: { prep: 0, answer: 420 },
};

export function scoreExam({ mode, board='gcse-wjec', criteria }){
  // criteria: { content:0..6, comprehension:0..6, pronunciation:0..4, ... } → band
  const total = Object.values(criteria||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const max = mode==='photocard' ? 16 : mode==='roleplay' ? 15 : 18;
  const pct = max ? Math.round(total/max*100) : 0;
  const grade = pct>=80? 'A*' : pct>=70? 'A' : pct>=60? 'B' : pct>=50? 'C' : pct>=40? 'D' : 'U';
  const band = grade;
  return { total, max, pct, grade, band, board, mode };
}

export function examinerFeedback({ mode, score }){
  const tips = {
    photocard: score.pct>=70? 'Strong description — keep tenses varied.' : 'Describe the photo with present tense and ask a follow-up.',
    roleplay: score.pct>=70? 'Task completed naturally.' : 'Initiate your questions clearly; check the tense.',
    conversation: score.pct>=70? 'Good range — add a complex sentence.' : 'Extend answers with «parce que / bien que» and give an example.',
  };
  return tips[mode] || 'Keep going — vary vocabulary and tenses.';
}

export function cefrCalibration(level, examPct){
  // CEFR estimate from exam performance (coarse)
  if(examPct>=80) return level;
  if(examPct>=60) return level;
  if(examPct<40) return 'A2';
  return level;
}
