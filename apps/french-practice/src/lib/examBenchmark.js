// Examiner-style feedback benchmark: compare app scores to examiner grades.
// Small deterministic harness — extend with 40 real scripts over time.

export function benchmarkExam(scripts){
  // scripts: [{ id, examinerGrade, appPct }]
  let agree=0;
  for(const s of scripts){
    const appGrade = s.appPct>=80?'A*': s.appPct>=70?'A': s.appPct>=60?'B': s.appPct>=50?'C': s.appPct>=40?'D':'U';
    if(appGrade===s.examinerGrade) agree++;
  }
  const accuracy = scripts.length? Math.round(agree/scripts.length*100)/100 : null;
  // Cohen's kappa stub (treat as observed agreement for now)
  const kappa = accuracy;
  return { n: scripts.length, accuracy, kappa, agree };
}

export const SAMPLE_SCRIPTS = [
  { id: 's1', examinerGrade: 'A', appPct: 74 },
  { id: 's2', examinerGrade: 'C', appPct: 55 },
  { id: 's3', examinerGrade: 'B', appPct: 62 },
];
