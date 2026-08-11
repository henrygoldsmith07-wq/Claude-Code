// Error taxonomy — 12 coarse categories for per-structure tracking.
// Each category maps to one or more grammar topic ids and a remediation cue.

export const ERROR_CATEGORIES = [
  { id: 'agreement', label: 'Agreement (gender/number/participle)', topics: ['articles','accord-participe','present'], cue: 'Check the ending — gender and number must match.' },
  { id: 'tense', label: 'Tense / aspect', topics: ['passe-compose','futur-conditionnel','present'], cue: 'Is the event finished or background? Pick composé vs imparfait.' },
  { id: 'mood', label: 'Mood (subjunctive)', topics: ['subjonctif'], cue: 'After «il faut que / vouloir que / bien que» → subjunctive.' },
  { id: 'pronouns', label: 'Pronouns (y/en, le/lui, double)', topics: ['pronoms','double-pronoms','y-en'], cue: 'Replace the phrase — y (= à …), en (= de …).' },
  { id: 'preposition', label: 'Prepositions', topics: ['prepositions-lieu','depuis-pendant'], cue: 'à vs de vs en — the verb decides the preposition.' },
  { id: 'negation', label: 'Negation', topics: ['negation'], cue: 'ne … pas wraps the conjugated verb.' },
  { id: 'word-order', label: 'Word order / interrogation', topics: ['interrogation','comparatif'], cue: 'Pronouns go before the verb; inversion in questions.' },
  { id: 'liaison', label: 'Liaison / elision', topics: ['liaison'], cue: 'Sound the liaison where required (les‿amis, c’est‿un).' },
  { id: 'register', label: 'Register / naturalness', topics: ['registres'], cue: 'Formal vs familiar — pick the right register.' },
  { id: 'articles', label: 'Articles / determiners', topics: ['articles'], cue: 'A noun rarely stands naked — add le/la/un/du.' },
  { id: 'vocab', label: 'Vocabulary choice', topics: [], cue: 'A more natural word exists — check the collocation.' },
  { id: 'spelling', label: 'Spelling / accents', topics: [], cue: 'é vs è vs ê — the accent changes the sound.' },
];

export function categoryForTopic(topicId){
  for(const c of ERROR_CATEGORIES) if(c.topics.includes(topicId)) return c.id;
  return 'vocab';
}

export function categoriesForErrors(errorCounts){
  // errorCounts: { [topicId]: n }
  const byCat = {};
  for(const [topic, n] of Object.entries(errorCounts||{})){
    const cat = categoryForTopic(topic);
    byCat[cat] = (byCat[cat]||0) + n;
  }
  return Object.entries(byCat).sort((a,b)=> b[1]-a[1]).map(([id,count])=> ({ id, count, ...ERROR_CATEGORIES.find(c=>c.id===id) }));
}
