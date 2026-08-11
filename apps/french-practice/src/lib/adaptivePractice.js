// Adaptive practice — listening/speech/dictation/conversation difficulty,
// weak recycling, active vocabulary targets, controlled new-vocab introduction.

import { levelForSrs, dictationSpeed } from './dictationProgression';
import { fsrsRetention } from './fsrs';

export function listeningDifficulty(srs, entries){
  const lvl = levelForSrs(srs, entries);
  const cefr = lvl<=2?'A2': lvl===3?'B1': lvl===4?'B2':'C1';
  const speed = lvl<=2?0.85: lvl===3?1.0:1.1;
  return { cefr, speed, level: lvl };
}

export function speechSpeedAdaptation(level){
  const map = { A1:0.85, A2:0.9, B1:1.0, B2:1.05, C1:1.1, C2:1.15 };
  return map[level] || 1.0;
}

export function weakRecycleQueue(weakWords, dueIds, limit=6){
  const pool = [...(weakWords||[]).slice(0,4).map(w=>w.id||w), ...(dueIds||[]).slice(0,4)];
  return [...new Set(pool)].slice(0, limit);
}

export function controlledNewVocab(allEntries, srs, perDay=5, activeTarget= null){
  const limit = activeTarget ?? perDay;
  const unseen = allEntries.filter(e=> !srs[e.id] && !srs[`${e.id}::receptive`]);
  unseen.sort((a,b)=> (a.freq||9)-(b.freq||9));
  return unseen.slice(0, limit);
}

export function activeVocabTarget(srs, entries){
  const known = Object.values(srs).filter(s=> (s.reps||0)>=2).length;
  const total = entries.length;
  return { known, total, pct: total? Math.round(known/total*100):0, nextMilestone: Math.ceil((known+1)/50)*50 };
}

export function conversationConstraint(knownWords, weakQueue, level){
  const levelCap = { A1: 200, A2: 500, B1: 1200, B2: 2500, C1: 4000, C2: 8000 }[level] || 1200;
  return { knownWords: (knownWords||[]).slice(0, Math.min(knownWords.length, 20)), weakQueue: (weakQueue||[]).slice(0,3), maxNewWords: 2, levelCap };
}

export function noiseGate(peakDb){
  if(peakDb < -45) return { ok: false, reason: 'Too quiet — move closer or check mic.' };
  if(peakDb > -6) return { ok: false, reason: 'Clipping — speak a little softer.' };
  return { ok: true };
}
