// FSRS 4.5 (evidence-based) scheduler — stability/difficulty/retrievability.
// Keeps separate histories for receptive (fr→en) vs productive (en→fr).
// Pure, deterministic, offline. Migrates SM-2 cards (ease/interval/reps).

const DAY = 86400000;
const FSRS_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
const DEFAULT_D = 5; // 1..10
const DEFAULT_S = 1; // days

export function retrievability(stability, days){
  if(!stability) return 0;
  return Math.exp(Math.log(0.9) * days / stability);
}

function nextDifficulty(d, rating){
  // rating 1..4 (again/hard/good/easy)
  const delta = FSRS_W[5] * (rating - 3);
  let nd = d + delta;
  if(rating===1) nd += FSRS_W[6];
  else if(rating===4) nd -= FSRS_W[7];
  return Math.max(1, Math.min(10, nd));
}

function nextStability(s, d, r, rating){
  const w = FSRS_W;
  if(rating===1){
    return Math.max(0.1, w[11] * Math.pow(d, -w[12]) * (Math.pow(s+1, w[13]) -1) * Math.exp((1-r)*w[14]));
  }
  const hard = rating===2 ? w[15] : 1;
  const easy = rating===4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11-d) * Math.pow(s, -w[9]) * (Math.exp((1-r)*w[10]) -1) * hard * easy);
}

export function initFsrs(){
  return { S: DEFAULT_S, D: DEFAULT_D, due: null, lastReviewed: null, reps: 0, lapses: 0, history: [] };
}

export function migrateFromSm2(sm2){
  if(!sm2) return initFsrs();
  if(sm2.S != null && sm2.D != null) return sm2; // already FSRS
  const interval = sm2.interval || 0;
  const S = Math.max(0.5, interval || DEFAULT_S);
  const ease = sm2.ease || 2.5;
  const D = Math.max(1, Math.min(10, Math.round(11 - ease*2)));
  return {
    S, D,
    due: sm2.due || null,
    lastReviewed: sm2.lastReviewed || null,
    reps: sm2.reps || 0,
    lapses: sm2.lapses || 0,
    history: [],
    sm2ease: ease,
  };
}

export function rateFsrs(entry, rating, now = Date.now()){
  // rating: 'again'|'hard'|'good'|'easy' → 1..4
  const map = { again: 1, hard: 2, good: 3, easy: 4 };
  const r = map[rating] || 3;
  const prev = { S: DEFAULT_S, D: DEFAULT_D, reps: 0, lapses: 0, ...entry };
  const S = prev.S || DEFAULT_S;
  const D = prev.D || DEFAULT_D;
  const days = prev.lastReviewed ? Math.max(0, (now - new Date(prev.lastReviewed).getTime())/DAY) : 0;
  const retr = retrievability(S, days);
  let nS, nD, intervalDays;
  if(r===1){
    nD = nextDifficulty(D, 1);
    nS = Math.max(0.1, nextStability(S, D, retr, 1));
    intervalDays = 0;
  } else {
    nD = nextDifficulty(D, r);
    nS = nextStability(S, D, retr, r);
    if((prev.reps||0)===0) intervalDays = r===2 ? 1 : r===3 ? 3 : 4;
    else if((prev.reps||0)===1) intervalDays = r===2 ? 2 : r===3 ? 6 : 8;
    else intervalDays = Math.max(1, Math.round(nS));
    if(r===2) intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
  }
  const next = {
    S: Math.round(nS*100)/100,
    D: Math.round(nD*100)/100,
    reps: r===1 ? 0 : (prev.reps||0)+1,
    lapses: (prev.lapses||0) + (r===1?1:0),
    due: new Date(now + intervalDays*DAY).toISOString(),
    lastReviewed: new Date(now).toISOString(),
    lastRating: rating,
    interval: intervalDays,
    history: [...(prev.history||[]), { at: new Date(now).toISOString(), rating, S, D, retr: Math.round(retr*100)/100 }].slice(-40),
  };
  return next;
}

export function fsrsRetention(entry, now = Date.now()){
  if(!entry || !entry.S || !entry.lastReviewed) return null;
  const days = Math.max(0, (now - new Date(entry.lastReviewed).getTime())/DAY);
  return retrievability(entry.S, days);
}

// Receptive vs productive: two slots per card id
export function fsrsKey(id, mode){ // mode: 'receptive'|'productive'
  return `${id}::${mode}`;
}
export function isProductiveUnlocked(srs, id){
  const rec = srs[fsrsKey(id, 'receptive')] || srs[id];
  return (rec?.reps||0) >= 2;
}
