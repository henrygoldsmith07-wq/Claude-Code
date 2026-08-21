// Provider status: degrades gracefully when AI is unavailable.
// Core learning (vocab, grammar SRS, saved progress, offline drills, reading,
// listening, culture, phrasebook, conjugation tables, analytics) never needs
// the provider. Only these paths need it: whisper transcription, chat
// evaluation, tutor, generation, translation, TTS is browser-native.
// This module centralises the offline vs AI-ready signals.

import { relayEnabled } from './relay.js';

const OFFLINE_CORE = [
  'vocabulary', 'grammar', 'srs', 'reading', 'listening', 'write-typing',
  'phrasebook', 'conjugation', 'reference', 'culture', 'analytics', 'history',
  'notebook', 'path', 'progress', 'habits', 'achievements',
];

const AI_DEPENDENT = [
  'arena-transcribe', 'arena-evaluate', 'ai-tutor', 'ai-characters',
  'ai-translate', 'ai-exercises', 'ai-story', 'ai-snap', 'writing-ai',
  'pronunciation-coach', 'hint', 'session-report',
];

export const isCoreAvailable = () => true; // always, includes localStorage progress

export function isAIReady({ apiKey, mockMode } = {}) {
  if (mockMode) return true; // mock data, no provider needed
  if (relayEnabled) return true; // relay holds the key server-side
  return Boolean(apiKey && String(apiKey).trim().length > 20);
}

export function aiStatus({ apiKey, mockMode } = {}) {
  const ready = isAIReady({ apiKey, mockMode });
  return {
    ready,
    mode: mockMode ? 'mock' : relayEnabled ? 'relay' : apiKey ? 'direct' : 'none',
    core: OFFLINE_CORE,
    aiDependent: AI_DEPENDENT,
    message: ready
      ? null
      : 'AI features are offline — your vocabulary, grammar, SRS and progress still work. Add an API key or enable Mock Mode in Settings.',
  };
}

export function shouldBlockAI({ apiKey, mockMode }, label) {
  if (isAIReady({ apiKey, mockMode })) return null;
  return `AI unavailable for ${label}. Core practice still works offline.`;
}
