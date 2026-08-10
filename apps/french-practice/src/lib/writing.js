// Writing content: sentence-completion starters and free-writing / essay
// prompts. Starters target specific structures; prompts scale by length.

// Personal error notebook: auto-log corrections with explanation rather than bare replacement
// Each idea: every correction is stored as { id, original, corrected, why, at } and surfaced as drills.
export function explainCorrection(original, corrected){
  if(!original || !corrected || original===corrected) return "No change needed.";
  return `“${original}” → “${corrected}” — corrected form is more natural/grammatical here. Try reusing “${corrected}” in your next turn.`;
}

export const COMPLETION_STARTERS = [
  { fr: "Si j'avais le temps,", en: 'If I had the time,', hint: 'conditionnel expected' },
  { fr: 'Quand je suis arrivé(e),', en: 'When I arrived,', hint: 'past narration' },
  { fr: 'Il faut que tu', en: 'You have to', hint: 'subjonctif expected' },
  { fr: 'Ce que je préfère, c’est', en: 'What I prefer is', hint: 'noun or infinitive' },
  { fr: "Avant d'aller au travail, je", en: 'Before going to work, I', hint: 'daily routine' },
  { fr: 'Je ne pense pas que ce', en: "I don't think that this", hint: 'subjonctif expected' },
  { fr: "L'année prochaine, nous", en: 'Next year, we', hint: 'futur expected' },
  { fr: 'Bien que ce soit difficile,', en: 'Although it is difficult,', hint: 'contrast' },
  { fr: "Ce week-end, j'ai envie de", en: 'This weekend, I feel like', hint: 'infinitive' },
  { fr: 'Quand j’étais petit(e),', en: 'When I was little,', hint: 'imparfait expected' },
];

// Personal error notebook: auto-log corrections with explanation rather than bare replacement
// Each idea: every correction is stored as { id, original, corrected, why, at } and surfaced as drills.

export const WRITING_PROMPTS = [
  { fr: 'Décrivez votre journée idéale, du matin au soir.', en: 'Describe your ideal day, morning to night.' },
  { fr: 'Écrivez un court message pour annuler un dîner poliment.', en: 'Write a short message politely cancelling a dinner.' },
  { fr: "Racontez un voyage qui ne s'est pas passé comme prévu.", en: "Tell of a trip that didn't go as planned." },
  { fr: 'Décrivez votre plat préféré à quelqu’un qui ne le connaît pas.', en: "Describe your favourite dish to someone who doesn't know it." },
  { fr: 'Écrivez une critique (positive ou négative) du dernier film que vous avez vu.', en: 'Write a review of the last film you watched.' },
  { fr: 'Convainquez un ami de visiter votre ville.', en: 'Convince a friend to visit your town.' },
];

// Personal error notebook: auto-log corrections with explanation rather than bare replacement
// Each idea: every correction is stored as { id, original, corrected, why, at } and surfaced as drills.

export const ESSAY_PROMPTS = [
  { fr: 'Les réseaux sociaux rapprochent-ils les gens ou les isolent-ils ?', en: 'Do social networks bring people together or isolate them?' },
  { fr: 'Faut-il apprendre une langue étrangère dès l’école primaire ?', en: 'Should a foreign language be learned from primary school?' },
  { fr: 'Le télétravail est-il un progrès pour tout le monde ?', en: 'Is remote work progress for everyone?' },
  { fr: 'La cuisine d’un pays raconte-t-elle son histoire ?', en: "Does a country's cuisine tell its history?" },
];

// Personal error notebook: auto-log corrections with explanation rather than bare replacement
// Each idea: every correction is stored as { id, original, corrected, why, at } and surfaced as drills.

export const randomFrom = (arr, exclude) => {
  const pool = arr.filter((x) => x !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
};