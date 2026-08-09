// Web Speech API helper — picks the best available voice for the active target
// language and speaks with a configurable rate. The active language is set
// once from settings (setSpeechLanguage) so call sites don't each pass it.

import { getLanguage, DEFAULT_LANG } from './languages';

let active = getLanguage(DEFAULT_LANG);
let cachedVoice = null;

// Switch the whole studio's speech to another language (fr | de | es).
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
  // Prefer the exact locale + a natural-sounding voice, then the exact locale.
  cachedVoice =
    matches.find((v) => v.lang === active.speechLang && active.voiceHint.test(v.name)) ||
    matches.find((v) => v.lang === active.speechLang) ||
    matches[0];
  return cachedVoice;
}

// Chrome populates voices lazily — refresh the cache when they arrive.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickVoice();
  };
}

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

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

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// All installed voices for the active language (for two-voice dialogues). May
// be empty until the browser's async voice list loads.
export function getVoices() {
  return langVoices();
}

// Speak a sequence of lines, alternating voice/pitch per speaker so dialogue
// partners sound distinct even when only one voice is installed.
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
    if (second && voiceB === voiceA) u.pitch = 0.8; // same voice — differentiate by pitch
    u.onstart = () => onLine?.(i);
    if (i === lines.length - 1 && onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u); // queued, not cancelled — plays sequentially
  });
}
