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
