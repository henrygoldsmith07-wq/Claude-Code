// Phoneme confusion profile — per phoneme weakness, confidence, and minimal-pair queue.
// French phonemes that trip English speakers: r/ʁ, y/u, nasal ɛ̃/ɔ̃/ɑ̃, liaison, gn/ɲ.

import { recordPronunciationGap } from './storage.js';

export const PHONEMES = [
  { id: 'r', label: 'r (uvular ʁ)', tip: 'Gargle lightly — back of the throat, not the English r.' },
  { id: 'u-ou', label: 'u / ou (y vs u)', tip: 'u = lips tight like whistling; ou = relaxed like “oo”.' },
  { id: 'nasal-an', label: 'nasal an/en (ɑ̃)', tip: 'Air through nose + mouth — “vent” without closing the n.' },
  { id: 'nasal-on', label: 'nasal on (ɔ̃)', tip: 'Round lips — “bon” with nose.' },
  { id: 'nasal-in', label: 'nasal in/un (ɛ̃/œ̃)', tip: 'Smile slightly — “vin” is one vowel, not “van”.' },
  { id: 'liaison', label: 'liaison', tip: 'Link the consonant: les‿amis [lez‿ami].' },
  { id: 'gn', label: 'gn (ɲ)', tip: 'Like “ny” in canyon — “agneau”.' },
  { id: 'j', label: 'j (ʒ)', tip: 'Soft, like “measure” — jamais.' },
];

const KEY = 'fp.phonemeProfile';

function readRaw(){
  try{ const v = localStorage.getItem(KEY); return v? JSON.parse(v): {}; }catch{ return {}; }
}
function writeRaw(v){ try{ localStorage.setItem(KEY, JSON.stringify(v)); }catch{} }

export function getPhonemeProfile(){ return readRaw(); }

export function recordPhonemeAttempt(phonemeId, { correct, confidence=0.7, label=phonemeId, trackGap=true }={}){
  if(!phonemeId) return null;
  const p = readRaw();
  const cur = p[phonemeId] || { attempts: 0, correct: 0, misses: 0, avgConf: 0.5, lastAt: null };
  cur.attempts += 1;
  if(correct) cur.correct += 1; else cur.misses += 1;
  cur.avgConf = Math.round((cur.avgConf*0.7 + confidence*0.3)*100)/100;
  cur.lastAt = new Date().toISOString();
  cur.weak = (cur.misses / Math.max(1, cur.attempts)) >= 0.33 || (cur.attempts>=3 && cur.avgConf < 0.6);
  p[phonemeId] = cur;
  writeRaw(p);
  if (trackGap) {
    recordPronunciationGap(phonemeId, {
      label,
      score: correct ? Math.round(Math.max(0, Math.min(1, confidence)) * 100) : 0,
      source: 'phoneme-profile',
      context: { confidence, attempts: cur.attempts, misses: cur.misses },
    });
  }
  return cur;
}

export function weakestPhonemes(limit=3){
  const p = readRaw();
  return PHONEMES.map(ph=> ({ ...ph, stats: p[ph.id] || { attempts:0, weak: false } }))
    .filter(x=> x.stats.attempts>0)
    .sort((a,b)=> (b.stats.misses/(b.stats.attempts||1)) - (a.stats.misses/(a.stats.attempts||1)))
    .slice(0, limit);
}

export function nextMinimalPair(weakId){
  const PAIRS = {
    'u-ou': [['tu','tout'], ['rue','roue'], ['dessus','dessous']],
    'nasal-an': [['vent','vin'], ['temps','teint'], ['lent','lin']],
    'r': [['roux','loo'], ['rue','loup']],
    'nasal-on': [['bon','beau'], ['pont','peau']],
  };
  const pool = PAIRS[weakId] || [['pain','pin'], ['beau','bon']];
  return pool[Math.floor(Math.random()*pool.length)];
}

// Calibrated confidence for speech scoring (simple isotonic-ish)
export function calibratedConfidence(raw){
  // raw 0..1 → calibrated (slightly conservative in mid range)
  if(raw < 0.4) return raw * 0.85;
  if(raw < 0.7) return 0.34 + (raw-0.4)*0.85;
  return Math.min(0.97, raw*0.98);
}

export function accentToleranceScore(expected, heard){
  // Allow common accent-tolerant equivalences before penalising (very light)
  const norm = s=> s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
  if(norm(expected)===norm(heard)) return 0.92; // accent-only diff
  return null; // fall through to strict scorer
}
