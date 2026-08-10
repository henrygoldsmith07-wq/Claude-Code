// Explicit learner model — pure helpers over storage snapshots.
// CEFR mapping, weakness → practice generation, gradual vocab introduction.

export const CEFR_ORDER = ["A1","A2","B1","B2","C1","C2"];

export function cefrIndex(level){ return Math.max(0, CEFR_ORDER.indexOf(level)); }
export function nextCefr(level, delta){
  const i = cefrIndex(level) + delta;
  return CEFR_ORDER[Math.max(0, Math.min(CEFR_ORDER.length-1, i))];
}

// Map CEFR to a short descriptor and exam-board hint
export function cefrDescriptor(level){
  const m = { A1:"Beginner", A2:"Elementary", B1:"Intermediate", B2:"Upper-intermediate", C1:"Advanced", C2:"Mastery" };
  return m[level] || level;
}

export const EXAM_BOARDS = [
  { id: null, label: "No exam focus" },
  { id: "gcse-aqa", label: "GCSE AQA" },
  { id: "gcse-edexcel", label: "GCSE Edexcel" },
  { id: "a-level-aqa", label: "A-Level AQA" },
  { id: "delf-b1", label: "DELF B1" },
  { id: "delf-b2", label: "DELF B2" },
];

// Difficulty adaptation: nudge level by session scores + XP pace
export function adaptedLevel(base, sessions, xpLog){
  const recent = sessions.slice(-6).map(s=> s.report?.average_scores?.overall).filter(n=> typeof n==="number");
  if(recent.length<3) return { level: base, reason: "not enough sessions" };
  const avg = recent.reduce((a,b)=>a+b,0)/recent.length;
  let delta = 0;
  if(avg>=86) delta = 1;
  else if(avg<58) delta = -1;
  const level = nextCefr(base, delta);
  return { level, avg: Math.round(avg), delta, reason: delta? (delta>0?"strong recent scores":"struggling — easing") : "steady" };
}

// Gradual vocab introduction: only surface N new words per day beyond known frontier
export function newWordsForToday(allEntries, srs, perDay=5){
  const known = new Set(Object.keys(srs));
  const unseen = allEntries.filter(e=> !known.has(e.id));
  // sort by frequency (lower freq number = more common → earlier)
  unseen.sort((a,b)=> (a.freq||9)-(b.freq||9));
  return unseen.slice(0, perDay);
}

// Conversation control: pick known + 1-2 new words to seed generated dialogue
export function conversationVocab(knownWords, newWords){
  const pool = [...(knownWords||[]).slice(-18), ...(newWords||[]).slice(0,2).map(w=> w.fr || w)];
  return pool.slice(0, 20);
}

// Build practice queue from weaknesses: SM-2 due + weak grammar + notebook
// Returns ordered item ids with reason
// weakness: { type: "grammar"|"vocab"|"pronunciation", id, severity }
export function practiceQueue({ srs, weakGrammar, weakWords, notebook }){
  const q = [];
  (weakWords||[]).slice(0,6).forEach(w=> q.push({ id: w.id || w, type:"vocab", reason:"weak word" }));
  (weakGrammar||[]).slice(0,3).forEach(g=> q.push({ id: g, type:"grammar", reason:"weak grammar" }));
  // due cards: most forgotten first approximated by lowest interval
  Object.entries(srs||{}).filter(([_,s])=> !s.due || new Date(s.due)<=new Date()).slice(0,8).forEach(([id])=> q.push({ id, type:"vocab", reason:"due" }));
  return q;
}
