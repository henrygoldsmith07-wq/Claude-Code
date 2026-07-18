// Real-world practice: a survival phrasebook grouped by situation, plus a
// timed mock exam. Situations that map to an Arena roleplay expose a
// `scenarioId` so the learner can jump from reading phrases to using them
// live. All content is authored and self-contained (no backend).

// situation: { id, title, emoji, blurb, scenarioId?, phrases: [{fr, en}] }
export const SITUATIONS = [
  {
    id: 'travel',
    title: 'Travel phrases',
    emoji: '🧳',
    blurb: 'Directions, tickets and getting unstuck',
    phrases: [
      { fr: "Excusez-moi, où se trouve la gare ?", en: 'Excuse me, where is the station?' },
      { fr: "Un aller-retour pour Lyon, s'il vous plaît.", en: 'A return ticket to Lyon, please.' },
      { fr: "À quelle heure part le prochain train ?", en: 'What time does the next train leave?' },
      { fr: "Je crois que je me suis perdu(e).", en: 'I think I’m lost.' },
      { fr: "Pouvez-vous me montrer sur la carte ?", en: 'Can you show me on the map?' },
      { fr: "C'est loin d'ici à pied ?", en: 'Is it far from here on foot?' },
    ],
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    emoji: '🍽️',
    blurb: 'Ordering, dietary needs, the bill',
    scenarioId: 'bistro',
    phrases: [
      { fr: "Une table pour deux, s'il vous plaît.", en: 'A table for two, please.' },
      { fr: "Qu'est-ce que vous me conseillez ?", en: 'What do you recommend?' },
      { fr: "Je suis végétarien(ne).", en: 'I’m vegetarian.' },
      { fr: "Je suis allergique aux fruits de mer.", en: 'I’m allergic to seafood.' },
      { fr: "L'addition, s'il vous plaît.", en: 'The bill, please.' },
      { fr: "C'était délicieux, merci !", en: 'That was delicious, thank you!' },
    ],
  },
  {
    id: 'airport',
    title: 'Airport',
    emoji: '✈️',
    blurb: 'Check-in, security, delays',
    scenarioId: 'vol',
    phrases: [
      { fr: "Où est l'enregistrement pour ce vol ?", en: 'Where is check-in for this flight?' },
      { fr: "Je n'ai qu'un bagage à main.", en: 'I only have hand luggage.' },
      { fr: "Mon vol est en retard.", en: 'My flight is delayed.' },
      { fr: "J'ai raté ma correspondance.", en: 'I missed my connection.' },
      { fr: "Où puis-je récupérer mes bagages ?", en: 'Where can I collect my luggage?' },
      { fr: "Ma valise n'est pas arrivée.", en: 'My suitcase hasn’t arrived.' },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    emoji: '🛍️',
    blurb: 'Sizes, prices, paying',
    scenarioId: 'marche',
    phrases: [
      { fr: "Est-ce que vous avez ça dans une autre taille ?", en: 'Do you have this in another size?' },
      { fr: "Je peux l'essayer ?", en: 'Can I try it on?' },
      { fr: "Ça coûte combien ?", en: 'How much does it cost?' },
      { fr: "C'est un peu trop cher pour moi.", en: 'It’s a bit too expensive for me.' },
      { fr: "Je vais juste regarder, merci.", en: 'I’m just looking, thanks.' },
      { fr: "Est-ce que je peux payer par carte ?", en: 'Can I pay by card?' },
    ],
  },
  {
    id: 'medical',
    title: 'Medical emergencies',
    emoji: '🚑',
    blurb: 'Symptoms, the pharmacy, urgent help',
    scenarioId: 'pharmacie',
    phrases: [
      { fr: "J'ai besoin d'un médecin.", en: 'I need a doctor.' },
      { fr: "Appelez une ambulance, s'il vous plaît !", en: 'Call an ambulance, please!' },
      { fr: "J'ai mal ici.", en: 'It hurts here.' },
      { fr: "Je suis diabétique.", en: 'I’m diabetic.' },
      { fr: "Avez-vous quelque chose contre le mal de tête ?", en: 'Do you have something for a headache?' },
      { fr: "Où est la pharmacie la plus proche ?", en: 'Where is the nearest pharmacy?' },
    ],
  },
  {
    id: 'business',
    title: 'Business communication',
    emoji: '💼',
    blurb: 'Meetings, email, introductions',
    scenarioId: 'reunion',
    phrases: [
      { fr: "Enchanté(e), je travaille dans le marketing.", en: 'Pleased to meet you, I work in marketing.' },
      { fr: "Je vous envoie un mail pour confirmer.", en: 'I’ll send you an email to confirm.' },
      { fr: "On peut fixer une réunion la semaine prochaine ?", en: 'Can we set up a meeting next week?' },
      { fr: "Je reviens vers vous dès que possible.", en: 'I’ll get back to you as soon as possible.' },
      { fr: "Pouvez-vous préciser votre demande ?", en: 'Could you clarify your request?' },
      { fr: "Merci pour votre temps.", en: 'Thank you for your time.' },
    ],
  },
  {
    id: 'interview',
    title: 'Interviews',
    emoji: '🎯',
    blurb: 'Strengths, experience, questions',
    scenarioId: 'entretien',
    phrases: [
      { fr: "J'ai cinq ans d'expérience dans ce domaine.", en: 'I have five years’ experience in this field.' },
      { fr: "Je suis quelqu'un de rigoureux et curieux.", en: 'I’m a rigorous and curious person.' },
      { fr: "Je cherche un nouveau défi.", en: 'I’m looking for a new challenge.' },
      { fr: "Mon plus grand point fort, c'est l'organisation.", en: 'My greatest strength is organisation.' },
      { fr: "Est-ce que le poste est en télétravail ?", en: 'Is the position remote?' },
      { fr: "Quand puis-je espérer une réponse ?", en: 'When can I expect an answer?' },
    ],
  },
];

export const getSituation = (id) => SITUATIONS.find((s) => s.id === id);

// ---- mock exam (DELF-style: comprehension, grammar & usage) ----

export const EXAM = {
  title: 'Mock placement exam',
  blurb: 'A short exam across grammar, vocabulary and real-world usage.',
  questions: [
    { skill: 'Grammar', q: 'Complétez : « Hier, je ___ au marché. »', options: ['vais', 'suis allé', 'irai'], answer: 1, why: 'Passé composé for a completed past action.' },
    { skill: 'Usage', q: 'At a shop, you enter and first say…', options: ['«Bonjour»', '«C’est combien ?»', '«Au revoir»'], answer: 0, why: 'Always greet before anything else.' },
    { skill: 'Vocabulary', q: '« L’addition » means…', options: ['the menu', 'the bill', 'the tip'], answer: 1, why: '«L’addition» is the restaurant bill.' },
    { skill: 'Grammar', q: 'Complétez : « Il faut que tu ___ prudent. »', options: ['es', 'sois', 'seras'], answer: 1, why: '«Il faut que» triggers the subjonctif.' },
    { skill: 'Usage', q: 'At the airport, « un vol en retard » is…', options: ['a cancelled flight', 'a delayed flight', 'a full flight'], answer: 1, why: '«En retard» = late/delayed.' },
    { skill: 'Vocabulary', q: 'At the pharmacy, « une ordonnance » is…', options: ['a prescription', 'an order of food', 'an appointment'], answer: 0, why: '«Une ordonnance» is a medical prescription.' },
    { skill: 'Grammar', q: 'Complétez : « Si j’avais le temps, je ___ plus. »', options: ['voyage', 'voyagerais', 'voyagerai'], answer: 1, why: 'Conditionnel after «si + imparfait».' },
    { skill: 'Usage', q: 'In a job interview, « un point fort » is…', options: ['a strength', 'a weakness', 'a salary'], answer: 0, why: '«Un point fort» = a strong point / strength.' },
    { skill: 'Vocabulary', q: '« Un aller-retour » is a…', options: ['one-way ticket', 'return ticket', 'season pass'], answer: 1, why: '«Aller-retour» = round trip / return.' },
    { skill: 'Grammar', q: 'Choisissez : « Je cherche la femme ___ j’ai rencontrée. »', options: ['qui', 'que', 'dont'], answer: 1, why: '«Que» is the direct object of «rencontrer».' },
  ],
};

// CEFR-ish band from a percentage score.
export function examBand(pct) {
  if (pct >= 90) return { band: 'C1', note: 'Confident and precise — exam-ready.' };
  if (pct >= 70) return { band: 'B2', note: 'Strong. Polish the trickier grammar.' };
  if (pct >= 50) return { band: 'B1', note: 'Solid footing — keep drilling usage.' };
  if (pct >= 30) return { band: 'A2', note: 'Getting there. Review the phrasebook.' };
  return { band: 'A1', note: 'Early days — the situations above will help.' };
}
