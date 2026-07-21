// Target-language registry. The app teaches one of these to an English
// speaker; everything language-specific (TTS voice, speech-recognition code,
// AI prompt language, branding, CEFR level titles) is looked up from here so
// the whole studio can switch between French, German and Spanish.

export const LANGUAGES = {
  fr: {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
    adjective: 'French',
    speechLang: 'fr-FR',
    whisper: 'fr',
    flag: '🇫🇷',
    studio: 'Le Studio',
    hello: 'Bonjour',
    voiceHint: /natural|premium|enhanced|amélior/i,
    // CEFR title ladder (levels 1-3 share the first, 4-6 the second, …).
    levelTitles: ['Débutant', 'Apprenti', 'Étudiant', 'Causeur', 'Bavard', 'Orateur', 'Éloquent', 'Francophone', 'Maître', 'Légende'],
  },
  de: {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    adjective: 'German',
    speechLang: 'de-DE',
    whisper: 'de',
    flag: '🇩🇪',
    studio: 'Das Studio',
    hello: 'Hallo',
    voiceHint: /natural|premium|enhanced/i,
    levelTitles: ['Anfänger', 'Lehrling', 'Schüler', 'Sprecher', 'Redner', 'Rhetoriker', 'Gewandt', 'Kenner', 'Meister', 'Legende'],
  },
  es: {
    id: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    adjective: 'Spanish',
    speechLang: 'es-ES',
    whisper: 'es',
    flag: '🇪🇸',
    studio: 'El Estudio',
    hello: 'Hola',
    voiceHint: /natural|premium|enhanced/i,
    levelTitles: ['Principiante', 'Aprendiz', 'Estudiante', 'Hablante', 'Conversador', 'Orador', 'Elocuente', 'Hispanohablante', 'Maestro', 'Leyenda'],
  },
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);
export const DEFAULT_LANG = 'fr';
export const getLanguage = (id) => LANGUAGES[id] || LANGUAGES[DEFAULT_LANG];
