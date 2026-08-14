// Web Speech API helper — picks the best available voice for the active target
// language and speaks with a configurable rate. The active language is set
// once from settings (setSpeechLanguage) so call sites don't each pass it.

import { getLanguage, DEFAULT_LANG } from './languages.js';

let active = getLanguage(DEFAULT_LANG);
let cachedVoice = null;

export function setSpeechLanguage(id) {
  const next = getLanguage(id);
  if (next.id !== active.id) {
    active = next;
    cachedVoice = null;
  }
}

const langVoices = () => {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const base = active.speechLang.slice(0, 2).toLowerCase();
  return voices.filter((v) => v.lang?.toLowerCase().startsWith(base));
};

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const matches = langVoices();
  if (!matches.length) return null;
  cachedVoice =
    matches.find((v) => v.lang === active.speechLang && active.voiceHint.test(v.name)) ||
    matches.find((v) => v.lang === active.speechLang) ||
    matches[0];
  return cachedVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickVoice();
  };
}

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

// Native reference audio cache (pre-generated TTS blobs for offline/minimal-pair)
const REF_CACHE = new Map(); // text -> Blob URL
export function cacheReferenceAudio(text, blob){
  if(!text || !blob) return null;
  const url = URL.createObjectURL(blob);
  REF_CACHE.set(text, url);
  return url;
}
export function getReferenceAudio(text){ return REF_CACHE.get(text) || null; }
export function clearReferenceCache(){ for(const url of REF_CACHE.values()) URL.revokeObjectURL(url); REF_CACHE.clear(); }

export function speak(text, { rate = 1, onEnd } = {}) {
  if (!ttsSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = active.speechLang;
  utterance.rate = Math.min(1.5, Math.max(0.5, rate));
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function ttsFallback(text){ return text; }
export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function getVoices() {
  return langVoices();
}

export function adaptiveTtsRate(level){
  const map = { A1: 0.85, A2: 0.9, B1: 1.0, B2: 1.05, C1: 1.1, C2: 1.15 };
  return map[level] || 1.0;
}

export function speakLines(lines, { rate = 1, onLine, onEnd } = {}) {
  if (!ttsSupported() || !lines.length) return;
  window.speechSynthesis.cancel();
  const installed = langVoices();
  const voiceA = pickVoice() || installed[0] || null;
  const voiceB = installed.find((v) => v !== voiceA) || voiceA;
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.fr);
    u.lang = active.speechLang;
    u.rate = Math.min(1.5, Math.max(0.5, rate));
    const second = line.speaker === 'B';
    if (second ? voiceB : voiceA) u.voice = second ? voiceB : voiceA;
    if (second && voiceB === voiceA) u.pitch = 0.8;
    u.onstart = () => onLine?.(i);
    if (i === lines.length - 1 && onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  });
}
