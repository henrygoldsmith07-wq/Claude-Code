// Web Speech API helper — picks the best available fr-FR voice and speaks
// with a configurable rate. Voice list loads asynchronously in some browsers.

let cachedVoice = null;

function pickFrenchVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith('fr'));
  if (!fr.length) return null;
  // Prefer fr-FR, then "premium"/natural-sounding names, then anything French.
  cachedVoice =
    fr.find((v) => v.lang === 'fr-FR' && /natural|premium|enhanced|amélior/i.test(v.name)) ||
    fr.find((v) => v.lang === 'fr-FR') ||
    fr[0];
  return cachedVoice;
}

// Chrome populates voices lazily — refresh the cache when they arrive.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickFrenchVoice();
  };
}

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text, { rate = 1, onEnd } = {}) {
  if (!ttsSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = Math.min(1.5, Math.max(0.5, rate));
  const voice = pickFrenchVoice();
  if (voice) utterance.voice = voice;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// All installed French voices (for two-voice dialogues). May be empty until
// the browser's async voice list loads.
export function getFrenchVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.filter((v) => v.lang?.toLowerCase().startsWith('fr'));
}

// Speak a sequence of lines, alternating voice/pitch per speaker so dialogue
// partners sound distinct even when only one French voice is installed.
export function speakLines(lines, { rate = 1, onLine, onEnd } = {}) {
  if (!ttsSupported() || !lines.length) return;
  window.speechSynthesis.cancel();
  const french = getFrenchVoices();
  const voiceA = pickFrenchVoice() || french[0] || null;
  const voiceB = french.find((v) => v !== voiceA) || voiceA;
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.fr);
    u.lang = 'fr-FR';
    u.rate = Math.min(1.5, Math.max(0.5, rate));
    const second = line.speaker === 'B';
    if (second ? voiceB : voiceA) u.voice = second ? voiceB : voiceA;
    if (second && voiceB === voiceA) u.pitch = 0.8; // same voice — differentiate by pitch
    u.onstart = () => onLine?.(i);
    if (i === lines.length - 1 && onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u); // queued, not cancelled — plays sequentially
  });
}
