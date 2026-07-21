// One switch for the whole app's language. Points the content layer, the
// speech engine and the AI prompt layer at the chosen target language so a
// single call flips French → German → Spanish everywhere.

import { setContentLanguage, contentLang } from './content/active';
import { setSpeechLanguage } from './tts';
import { setLanguage as setAiLanguage } from './groq';
import { getLanguage } from './languages';

// The active target-language config, for UI copy ("Speak German out loud…").
export const activeLanguage = () => getLanguage(contentLang());
// Convenience for the very common "…French…" → "…German…" swaps in copy.
export const langName = () => activeLanguage().name;

export function syncLanguage(id) {
  const lang = getLanguage(id);
  setContentLanguage(lang.id);
  setSpeechLanguage(lang.id);
  setAiLanguage(lang.id);
  return lang;
}
