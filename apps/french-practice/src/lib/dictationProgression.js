// Dictation progression: 5 levels — word → chunk → sentence → paragraph → authentic.
// Speed and diacritic strictness ramp with level.

export const DICTATION_LEVELS = [
  { id: 1, label: 'Word', hint: 'Single words, slow' },
  { id: 2, label: 'Chunk', hint: '2–3 word chunks' },
  { id: 3, label: 'Sentence', hint: 'Full sentence, natural speed' },
  { id: 4, label: 'Paragraph', hint: 'Two sentences, faster' },
  { id: 5, label: 'Authentic', hint: 'Natural speech, all accents strict' },
];

export function levelForSrs(srs, entries){
  const learned = Object.values(srs).filter(s=> (s.reps||0)>=2).length;
  if(learned < 8) return 1;
  if(learned < 20) return 2;
  if(learned < 40) return 3;
  if(learned < 80) return 4;
  return 5;
}

export function dictationSpeed(level){
  return level <=2 ? 0.75 : level===3 ? 0.9 : level===4 ? 1.0 : 1.05;
}

export function diacriticStrict(level){
  return level >= 4;
}
