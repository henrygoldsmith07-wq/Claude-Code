// Practice task bank for the exam simulators.
//
// All material here is original, written against the published *theme* lists
// (which are factual) rather than copied from any board's papers. Photo cards
// describe a scene in words instead of shipping a licensed photograph — the
// task a candidate performs is the same, and the description is what the
// simulator reads to the AI examiner.
//
// Each task carries the theme it sits under and a tier, so the simulator can
// draw a paper that looks like the real thing rather than a random pile.

import { TIER } from './boards.js';

/**
 * Role-plays. Five prompts, one of which is a question the candidate must ASK
 * (marked `ask: true`) and one unpredictable follow-up (`unpredictable: true`)
 * — the two things candidates most often lose marks on.
 */
export const ROLEPLAYS = [
  {
    id: 'rp-office-tourisme',
    theme: 'Travel and tourism',
    tier: TIER.FOUNDATION,
    setting: "You are at the tourist office in Nantes. The examiner plays the assistant.",
    settingFr: "Vous êtes à l'office de tourisme à Nantes. L'examinateur joue l'employé(e).",
    prompts: [
      { id: 1, en: 'Say why you are visiting the town.', expect: 'Je visite la ville pour…' },
      { id: 2, en: 'Say how long you are staying.', expect: 'Je reste… jours' },
      { id: 3, en: 'Ask where the castle is.', ask: true, expect: 'Où est le château ?' },
      { id: 4, en: 'Say what you like doing on holiday.', expect: "J'aime… en vacances" },
      { id: 5, en: '! (respond to the unexpected question)', unpredictable: true, examinerAsks: "Et vous êtes venu(e) comment ?" },
    ],
  },
  {
    id: 'rp-boulangerie',
    theme: 'My personal world',
    tier: TIER.FOUNDATION,
    setting: 'You are in a bakery in Lille. The examiner plays the baker.',
    settingFr: 'Vous êtes dans une boulangerie à Lille. L\'examinateur joue le boulanger.',
    prompts: [
      { id: 1, en: 'Say what you would like to buy.', expect: 'Je voudrais…' },
      { id: 2, en: 'Say how many you want.', expect: 'Deux, s\'il vous plaît' },
      { id: 3, en: 'Ask the price.', ask: true, expect: 'Ça fait combien ?' },
      { id: 4, en: 'Say when you usually eat breakfast.', expect: 'Je prends le petit déjeuner à…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: "Vous préférez le pain ou les viennoiseries ?" },
    ],
  },
  {
    id: 'rp-medecin',
    theme: 'Healthy living and lifestyle',
    tier: TIER.HIGHER,
    setting: "You are at a doctor's surgery in Toulouse. The examiner plays the doctor.",
    settingFr: "Vous êtes chez le médecin à Toulouse. L'examinateur joue le médecin.",
    prompts: [
      { id: 1, en: 'Explain what is wrong and since when.', expect: "J'ai mal à… depuis…" },
      { id: 2, en: 'Say what you have already tried.', expect: "J'ai déjà pris…" },
      { id: 3, en: 'Ask whether you need a prescription.', ask: true, expect: "Est-ce qu'il me faut une ordonnance ?" },
      { id: 4, en: 'Describe your usual diet and exercise.', expect: "D'habitude je mange… et je fais…" },
      { id: 5, en: '!', unpredictable: true, examinerAsks: "Et vous dormez combien d'heures par nuit ?" },
    ],
  },
  {
    id: 'rp-college',
    theme: 'Education and work',
    tier: TIER.HIGHER,
    setting: 'You are speaking to a French exchange coordinator about your school.',
    settingFr: 'Vous parlez au responsable des échanges à propos de votre collège.',
    prompts: [
      { id: 1, en: 'Describe your school day.', expect: 'Les cours commencent à…' },
      { id: 2, en: 'Say which subject you prefer and why.', expect: 'Ma matière préférée est… parce que…' },
      { id: 3, en: 'Ask what French schools do on Wednesdays.', ask: true, expect: 'Que font les élèves français le mercredi ?' },
      { id: 4, en: 'Say what you want to do after your exams.', expect: 'Après mes examens, je voudrais…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: "Quel aspect du système français vous surprend le plus ?" },
    ],
  },
  {
    id: 'rp-environnement',
    theme: 'The environment and where people live',
    tier: TIER.HIGHER,
    setting: 'You are joining an environmental group in your French twin town.',
    settingFr: "Vous rejoignez une association écologique dans votre ville jumelée.",
    prompts: [
      { id: 1, en: 'Say what you already do for the environment.', expect: 'Je trie les déchets et…' },
      { id: 2, en: 'Say what the biggest problem is in your area.', expect: "Le plus gros problème, c'est…" },
      { id: 3, en: 'Ask what the group does each month.', ask: true, expect: "Qu'est-ce que vous faites chaque mois ?" },
      { id: 4, en: 'Suggest an improvement for your town.', expect: 'On devrait…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: "Pensez-vous que les jeunes en font assez ?" },
    ],
  },
];

/**
 * Photo cards. `scene` is the written description the simulator gives to the
 * AI examiner in place of an image, so the questions it asks are grounded in
 * something specific rather than generic.
 */
export const PHOTOCARDS = [
  {
    id: 'pc-marche',
    theme: 'Customs, festivals and celebrations',
    tier: TIER.FOUNDATION,
    title: 'Le marché du samedi',
    scene: 'A busy outdoor market on a sunny Saturday morning. A stallholder in an apron hands a paper bag of tomatoes to an older woman with a wicker basket. Behind them, crates of fruit, a cheese stall, and a queue of about six people. Two children eat crêpes at a small table.',
    questions: [
      { fr: "Qu'est-ce qu'il y a sur la photo ?", en: 'What is in the photo?', core: true },
      { fr: "Qu'est-ce que tu penses des marchés ?", en: 'What do you think of markets?' },
      { fr: 'Es-tu allé(e) au marché récemment ? Raconte.', en: 'Have you been to a market recently? Tell me about it.', tense: 'past' },
      { fr: 'Préfères-tu le marché ou le supermarché ? Pourquoi ?', en: 'Do you prefer the market or the supermarket? Why?' },
      { fr: 'Que feras-tu ce week-end ?', en: 'What will you do this weekend?', tense: 'future' },
    ],
  },
  {
    id: 'pc-gare',
    theme: 'Travel and tourism',
    tier: TIER.HIGHER,
    title: 'Départ en vacances',
    scene: 'A crowded station concourse. A family of four stands beside four suitcases, the father checking a departures board that shows several delayed trains. A teenager sits on a case wearing headphones, looking bored. Rain is visible through the glass roof.',
    questions: [
      { fr: 'Décris cette photo.', en: 'Describe this photo.', core: true },
      { fr: 'À ton avis, comment se sentent ces personnes ?', en: 'How do you think these people feel?' },
      { fr: 'Parle de tes dernières vacances.', en: 'Talk about your last holiday.', tense: 'past' },
      { fr: 'Quels sont les avantages du train par rapport à l’avion ?', en: 'What are the advantages of the train over the plane?' },
      { fr: 'Où aimerais-tu voyager plus tard ? Pourquoi ?', en: 'Where would you like to travel later? Why?', tense: 'conditional' },
    ],
  },
  {
    id: 'pc-portable',
    theme: 'Media and technology',
    tier: TIER.HIGHER,
    title: 'Écrans à table',
    scene: 'Four teenagers around a café table. Three are looking at their phones; the fourth, arms folded, is looking at the others with an irritated expression. Three untouched drinks sit on the table.',
    questions: [
      { fr: 'Que vois-tu sur cette photo ?', en: 'What do you see in this photo?', core: true },
      { fr: 'Les portables nuisent-ils à l’amitié ?', en: 'Do phones harm friendship?' },
      { fr: 'Combien de temps passes-tu devant un écran ?', en: 'How much time do you spend on a screen?' },
      { fr: 'Raconte une fois où la technologie t’a aidé(e).', en: 'Tell me about a time technology helped you.', tense: 'past' },
      { fr: 'Faudrait-il interdire les portables au collège ?', en: 'Should phones be banned at school?', tense: 'conditional' },
    ],
  },
  {
    id: 'pc-sport',
    theme: 'Free-time activities',
    tier: TIER.FOUNDATION,
    title: 'Le match du dimanche',
    scene: 'A muddy football pitch on a grey afternoon. A player in a red shirt is about to take a corner; five spectators stand behind a low fence, one holding an umbrella and a thermos. A dog on a lead watches the ball.',
    questions: [
      { fr: "Qu'est-ce qui se passe sur la photo ?", en: 'What is happening in the photo?', core: true },
      { fr: 'Fais-tu du sport ? Lequel ?', en: 'Do you do sport? Which?' },
      { fr: 'Quel sport as-tu essayé récemment ?', en: 'What sport have you tried recently?', tense: 'past' },
      { fr: 'Pourquoi le sport est-il important pour les jeunes ?', en: 'Why is sport important for young people?' },
      { fr: 'Vas-tu continuer ce sport à l’avenir ?', en: 'Will you carry on with this sport in future?', tense: 'future' },
    ],
  },
  {
    id: 'pc-benevolat',
    theme: 'Identity and relationships with others',
    tier: TIER.HIGHER,
    title: 'Coup de main',
    scene: 'A community hall. Six volunteers in matching yellow t-shirts sort tins of food into cardboard boxes. An older man reads a clipboard list aloud while a young woman writes on a whiteboard headed "Collecte — samedi".',
    questions: [
      { fr: 'Décris ce que font ces personnes.', en: 'Describe what these people are doing.', core: true },
      { fr: 'As-tu déjà fait du bénévolat ?', en: 'Have you ever volunteered?', tense: 'past' },
      { fr: 'Pourquoi certains jeunes ne s’engagent-ils pas ?', en: 'Why do some young people not get involved?' },
      { fr: 'Quel rôle joue la famille dans ce genre d’action ?', en: 'What role does family play in this kind of action?' },
      { fr: 'Que ferais-tu pour aider ta communauté ?', en: 'What would you do to help your community?', tense: 'conditional' },
    ],
  },
];

/**
 * Conversation themes with a question ladder — the opening question, the
 * follow-ups an examiner reaches for, and the "stretch" question that
 * separates a grade 7 from a grade 9. The candidate is also expected to ask
 * one question of their own, which `candidateAsks` prompts.
 */
export const CONVERSATIONS = [
  {
    id: 'cv-famille',
    theme: 'Identity and relationships with others',
    opening: { fr: 'Parle-moi de ta famille.', en: 'Tell me about your family.' },
    followUps: [
      { fr: "Comment t'entends-tu avec tes parents ?", en: 'How do you get on with your parents?' },
      { fr: 'Qu’est-ce qui fait un bon ami, selon toi ?', en: 'What makes a good friend, in your view?' },
      { fr: 'Décris une occasion où ta famille s’est réunie.', en: 'Describe a time your family got together.', tense: 'past' },
    ],
    stretch: { fr: 'Penses-tu que les liens familiaux changent avec les réseaux sociaux ?', en: 'Do you think family ties are changing because of social media?' },
    candidateAsks: 'Ask the examiner about their own family or friendships.',
  },
  {
    id: 'cv-ecole',
    theme: 'Education and work',
    opening: { fr: 'Décris une journée typique au collège.', en: 'Describe a typical school day.' },
    followUps: [
      { fr: 'Quelle matière préfères-tu et pourquoi ?', en: 'Which subject do you prefer and why?' },
      { fr: 'Qu’est-ce que tu changerais dans ton école ?', en: 'What would you change about your school?', tense: 'conditional' },
      { fr: 'Qu’as-tu fait pendant tes dernières vacances scolaires ?', en: 'What did you do in the last school holidays?', tense: 'past' },
    ],
    stretch: { fr: 'Les examens sont-ils une bonne mesure de l’intelligence ?', en: 'Are exams a good measure of intelligence?' },
    candidateAsks: 'Ask the examiner about schools in France or Wales.',
  },
  {
    id: 'cv-temps-libre',
    theme: 'Free-time activities',
    opening: { fr: 'Que fais-tu pendant ton temps libre ?', en: 'What do you do in your free time?' },
    followUps: [
      { fr: 'Combien de temps y consacres-tu par semaine ?', en: 'How much time do you spend on it each week?' },
      { fr: 'Comment as-tu commencé ?', en: 'How did you start?', tense: 'past' },
      { fr: 'Préfères-tu sortir ou rester à la maison ?', en: 'Do you prefer going out or staying in?' },
    ],
    stretch: { fr: 'Le temps libre est-il un luxe pour les jeunes d’aujourd’hui ?', en: 'Is free time a luxury for young people today?' },
    candidateAsks: 'Ask the examiner what they do at the weekend.',
  },
  {
    id: 'cv-environnement',
    theme: 'The environment and where people live',
    opening: { fr: 'Décris l’endroit où tu habites.', en: 'Describe where you live.' },
    followUps: [
      { fr: 'Quels sont les avantages et les inconvénients de ta région ?', en: 'What are the advantages and drawbacks of your area?' },
      { fr: 'Que fais-tu pour protéger l’environnement ?', en: 'What do you do to protect the environment?' },
      { fr: 'Où habitais-tu quand tu étais petit(e) ?', en: 'Where did you live when you were little?', tense: 'past' },
    ],
    stretch: { fr: 'Faut-il rendre les centres-villes interdits aux voitures ?', en: 'Should city centres be closed to cars?' },
    candidateAsks: 'Ask the examiner about their town.',
  },
  {
    id: 'cv-technologie',
    theme: 'Media and technology',
    opening: { fr: 'Comment utilises-tu la technologie tous les jours ?', en: 'How do you use technology every day?' },
    followUps: [
      { fr: 'Quelle application utilises-tu le plus ?', en: 'Which app do you use most?' },
      { fr: 'Y a-t-il des dangers en ligne pour les jeunes ?', en: 'Are there dangers online for young people?' },
      { fr: 'Comment la technologie a-t-elle changé depuis ton enfance ?', en: 'How has technology changed since your childhood?', tense: 'past' },
    ],
    stretch: { fr: 'L’intelligence artificielle va-t-elle remplacer certains métiers ?', en: 'Will AI replace certain jobs?', tense: 'future' },
    candidateAsks: 'Ask the examiner about their own screen habits.',
  },
];

/** Short passages for the AQA reading-aloud task. Pronunciation-loaded. */
export const READING_PASSAGES = [
  {
    id: 'ra-quartier',
    theme: 'My neighbourhood',
    tier: TIER.FOUNDATION,
    text: "J'habite dans un petit village près de la mer. Le samedi, je vais au marché avec ma mère. Nous achetons des légumes, du pain et parfois du fromage. L'après-midi, je retrouve mes amis au parc.",
    focus: ['liaison', 'u-ou', 'nasal-an'],
    notes: 'Watch the liaison in «mes amis» and the u in «légumes».',
  },
  {
    id: 'ra-vacances',
    theme: 'Travel and tourism',
    tier: TIER.HIGHER,
    text: "L'été dernier, nous sommes partis en Bretagne pendant quinze jours. Il pleuvait souvent, mais nous avons quand même visité plusieurs villages. Ce que j'ai préféré, c'était les crêpes au caramel au beurre salé.",
    focus: ['nasal-in', 'r', 'liaison'],
    notes: '«quinze» and «pendant» carry two different nasals; do not merge them.',
  },
  {
    id: 'ra-environnement',
    theme: 'The environment',
    tier: TIER.HIGHER,
    text: "Beaucoup de jeunes s'inquiètent pour l'environnement. Dans mon collège, nous trions les déchets et nous éteignons les lumières. Ce n'est pas grand-chose, mais je crois que chaque geste compte.",
    focus: ['j', 'gn', 'nasal-on'],
    notes: '«jeunes» and «je» need the soft ʒ; «éteignons» has the ɲ.',
  },
];

// ------------------------------------------------------------- selection ----

const tierMatch = (item, tier) => !tier || !item.tier || item.tier === tier;

export function pickRoleplay({ theme = null, tier = null, exclude = [] } = {}) {
  return pick(ROLEPLAYS, { theme, tier, exclude });
}
export function pickPhotocard({ theme = null, tier = null, exclude = [] } = {}) {
  return pick(PHOTOCARDS, { theme, tier, exclude });
}
export function pickConversation({ theme = null, exclude = [] } = {}) {
  return pick(CONVERSATIONS, { theme, exclude });
}
export function pickReadingPassage({ tier = null, exclude = [] } = {}) {
  return pick(READING_PASSAGES, { tier, exclude });
}

function pick(pool, { theme, tier, exclude = [] }) {
  const skip = new Set(exclude);
  let candidates = pool.filter((i) => !skip.has(i.id) && tierMatch(i, tier));
  if (theme) {
    const themed = candidates.filter((i) => i.theme === theme);
    if (themed.length) candidates = themed;
  }
  if (!candidates.length) candidates = pool.filter((i) => tierMatch(i, tier));
  if (!candidates.length) candidates = pool;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

/** Every theme that has at least one task, for the theme picker. */
export function availableThemes() {
  const set = new Set();
  for (const list of [ROLEPLAYS, PHOTOCARDS, CONVERSATIONS, READING_PASSAGES]) {
    for (const item of list) if (item.theme) set.add(item.theme);
  }
  return [...set].sort();
}

export function taskBankStats() {
  return {
    roleplays: ROLEPLAYS.length,
    photocards: PHOTOCARDS.length,
    conversations: CONVERSATIONS.length,
    readingPassages: READING_PASSAGES.length,
    themes: availableThemes().length,
  };
}
