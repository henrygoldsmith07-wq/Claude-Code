// Practice task bank for the exam simulators.
//
// All material here is ORIGINAL practice written against the published *theme*
// lists (which are factual) — not past papers, not official board questions.
// Every item carries `provenance: 'generated'` and `official: false`; the
// simulator surfaces `boardStyle` + `specVersion` + `verifyAt` so the UI must
// show "Generated practice — not an official exam paper. Verify timings at …"
// Photo cards describe a scene in words instead of shipping a licensed
// photograph.

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
  {
    id: 'rp-wjec-cinema',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'Free-time activities',
    tier: TIER.FOUNDATION,
    setting: 'You are buying tickets at a cinema in Cardiff. The examiner plays the ticket seller.',
    settingFr: "Vous achetez des billets dans un cinéma à Cardiff. L'examinateur joue le vendeur.",
    prompts: [
      { id: 1, en: 'Say which film you want to see.', expect: 'Je voudrais voir…' },
      { id: 2, en: 'Say how many tickets you need.', expect: 'Deux billets, s’il vous plaît.' },
      { id: 3, en: 'Ask what time the film starts.', ask: true, expect: 'À quelle heure commence le film ?' },
      { id: 4, en: 'Say who you usually go to the cinema with.', expect: 'Je vais au cinéma avec…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Quel genre de films détestez-vous ?' },
    ],
  },
  {
    id: 'rp-wjec-exchange',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'Education and work',
    tier: TIER.HIGHER,
    setting: 'You are planning a visit to a partner school in France. The examiner is the exchange organiser.',
    settingFr: "Vous préparez une visite dans un établissement partenaire en France. L'examinateur organise l'échange.",
    prompts: [
      { id: 1, en: 'Explain what you would like to do during the visit.', expect: 'J’aimerais…' },
      { id: 2, en: 'Give one reason for learning French.', expect: 'J’apprends le français parce que…' },
      { id: 3, en: 'Ask what you should bring.', ask: true, expect: 'Qu’est-ce que je dois apporter ?' },
      { id: 4, en: 'Say what you did on your last school trip.', expect: 'Lors de mon dernier voyage scolaire…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Préférez-vous voyager seul(e) ?' },
    ],
  },
  {
    id: 'rp-aqa-library',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'People and lifestyle: education and work',
    tier: TIER.FOUNDATION,
    setting: 'You are joining a library in Lyon. The examiner plays the librarian.',
    settingFr: "Vous vous inscrivez dans une bibliothèque à Lyon. L'examinateur joue le bibliothécaire.",
    prompts: [
      { id: 1, en: 'Say which type of book you like.', expect: 'J’aime les livres…' },
      { id: 2, en: 'Say how often you read.', expect: 'Je lis… fois par semaine.' },
      { id: 3, en: 'Ask where the young-adult section is.', ask: true, expect: 'Où est la section jeunesse ?' },
      { id: 4, en: 'Say what you read last weekend.', expect: 'Le week-end dernier, j’ai lu…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Est-ce que vous aimez les films ?' },
    ],
  },
  {
    id: 'rp-aqa-lunch',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'People and lifestyle: healthy living and lifestyle',
    tier: TIER.HIGHER,
    setting: 'You are choosing lunch at a school canteen in Montpellier.',
    settingFr: 'Vous choisissez le déjeuner dans une cantine scolaire à Montpellier.',
    prompts: [
      { id: 1, en: 'Say what you would like for lunch.', expect: 'Je voudrais…' },
      { id: 2, en: 'Explain one healthy choice.', expect: 'C’est sain parce que…' },
      { id: 3, en: 'Ask whether there is a vegetarian option.', ask: true, expect: 'Y a-t-il une option végétarienne ?' },
      { id: 4, en: 'Say what you ate yesterday.', expect: 'Hier, j’ai mangé…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Quel est votre plat préféré ?' },
    ],
  },
  {
    id: 'rp-edexcel-market',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'My neighbourhood',
    tier: TIER.FOUNDATION,
    setting: 'You are buying a gift at a market in Marseille. The examiner plays the stallholder.',
    settingFr: "Vous achetez un cadeau dans un marché à Marseille. L'examinateur joue le vendeur.",
    prompts: [
      { id: 1, en: 'Say what you are looking for.', expect: 'Je cherche…' },
      { id: 2, en: 'Say who the gift is for.', expect: 'C’est pour…' },
      { id: 3, en: 'Ask how much it costs.', ask: true, expect: 'Ça coûte combien ?' },
      { id: 4, en: 'Say what you bought last time you visited a market.', expect: 'La dernière fois, j’ai acheté…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Vous préférez les magasins ou les marchés ?' },
    ],
  },
  {
    id: 'rp-edexcel-weekend',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Travel and tourism',
    tier: TIER.HIGHER,
    setting: 'You are arranging a weekend in Nice with a travel adviser.',
    settingFr: 'Vous organisez un week-end à Nice avec un conseiller de voyage.',
    prompts: [
      { id: 1, en: 'Say when you want to travel.', expect: 'Je voudrais partir…' },
      { id: 2, en: 'Describe the kind of accommodation you prefer.', expect: 'Je préfère un hôtel qui…' },
      { id: 3, en: 'Ask what there is to do in the evening.', ask: true, expect: 'Que peut-on faire le soir ?' },
      { id: 4, en: 'Say what went wrong on a previous trip.', expect: 'La dernière fois…' },
      { id: 5, en: '!', unpredictable: true, examinerAsks: 'Quel est le meilleur moyen de voyager ?' },
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
  {
    id: 'pc-wjec-school-garden',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'The environment and where people live',
    tier: TIER.HIGHER,
    title: 'Le jardin scolaire',
    scene: 'A group of pupils work in a school garden behind a stone building. One pupil carries a watering can, two are planting young vegetables, and another writes dates on wooden labels. A teacher points towards a compost bin while dark clouds gather above the playground.',
    questions: [
      { fr: 'Décris ce que font les élèves.', en: 'Describe what the pupils are doing.', core: true },
      { fr: 'Que penses-tu de ce projet ?', en: 'What do you think of this project?' },
      { fr: 'Qu’as-tu fait récemment pour aider l’environnement ?', en: 'What have you done recently to help the environment?', tense: 'past' },
      { fr: 'Quels changements faudrait-il faire dans ton école ?', en: 'What changes should be made in your school?', tense: 'conditional' },
      { fr: 'Que feras-tu le week-end prochain ?', en: 'What will you do next weekend?', tense: 'future' },
    ],
  },
  {
    id: 'pc-aqa-bus',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'Communication and the world around us: travel and tourism',
    tier: TIER.FOUNDATION,
    title: 'À l’arrêt de bus',
    scene: 'Three young people wait at a bus stop outside a town centre. One checks a phone, one reads a paper timetable, and one carries a small suitcase. A digital sign says the next bus is late, while a cyclist passes on a marked cycle lane.',
    questions: [
      { fr: 'Qu’est-ce qu’il y a sur la photo ?', en: 'What is in the photo?', core: true },
      { fr: 'Comment voyagent les jeunes dans ta région ?', en: 'How do young people travel in your area?' },
      { fr: 'Quand as-tu pris les transports en commun ?', en: 'When did you take public transport?', tense: 'past' },
      { fr: 'Quels sont les avantages du vélo ?', en: 'What are the advantages of cycling?' },
      { fr: 'Comment voyageras-tu à l’avenir ?', en: 'How will you travel in future?', tense: 'future' },
    ],
  },
  {
    id: 'pc-edexcel-club',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Studying and my future',
    tier: TIER.HIGHER,
    title: 'Le club après les cours',
    scene: 'A bright classroom after lessons. Four students sit around a table with laptops, colourful posters and a small model bridge. One student presents an idea while another takes notes. A noticeboard lists a robotics club meeting and a fundraising deadline.',
    questions: [
      { fr: 'Décris la scène.', en: 'Describe the scene.', core: true },
      { fr: 'Pourquoi les activités après les cours sont-elles utiles ?', en: 'Why are after-school activities useful?' },
      { fr: 'À quel club as-tu participé ?', en: 'Which club have you taken part in?', tense: 'past' },
      { fr: 'Quel métier voudrais-tu faire ?', en: 'What job would you like to do?', tense: 'conditional' },
      { fr: 'Que devrait faire ton école pour préparer les élèves ?', en: 'What should your school do to prepare pupils?' },
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
  {
    id: 'cv-wjec-community',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'The environment and where people live',
    opening: { fr: 'Qu’est-ce que tu aimes dans ta communauté ?', en: 'What do you like about your community?' },
    followUps: [
      { fr: 'Quels problèmes y a-t-il dans ta ville ?', en: 'What problems are there in your town?' },
      { fr: 'As-tu participé à une activité locale ?', en: 'Have you taken part in a local activity?', tense: 'past' },
      { fr: 'Comment améliorerais-tu les transports ?', en: 'How would you improve transport?', tense: 'conditional' },
    ],
    stretch: { fr: 'Les jeunes ont-ils assez de possibilités près de chez eux ?', en: 'Do young people have enough opportunities near where they live?' },
    candidateAsks: 'Ask the examiner what makes their town special.',
  },
  {
    id: 'cv-aqa-celebrity',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'Popular culture: celebrity culture',
    opening: { fr: 'Que penses-tu des célébrités ?', en: 'What do you think of celebrities?' },
    followUps: [
      { fr: 'Quelle personne admires-tu et pourquoi ?', en: 'Which person do you admire and why?' },
      { fr: 'Quel événement as-tu regardé récemment ?', en: 'Which event did you watch recently?', tense: 'past' },
      { fr: 'Les célébrités ont-elles trop d’influence ?', en: 'Do celebrities have too much influence?' },
    ],
    stretch: { fr: 'Faudrait-il protéger davantage la vie privée des personnes connues ?', en: 'Should famous people’s privacy be protected more?' },
    candidateAsks: 'Ask the examiner which music or films they enjoy.',
  },
  {
    id: 'cv-edexcel-future',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Studying and my future',
    opening: { fr: 'Quels sont tes projets après les examens ?', en: 'What are your plans after exams?' },
    followUps: [
      { fr: 'Quelles qualités sont importantes au travail ?', en: 'Which qualities are important at work?' },
      { fr: 'Quel emploi as-tu fait ou voudrais-tu essayer ?', en: 'What job have you done or would you like to try?', tense: 'past' },
      { fr: 'Préférerais-tu travailler en équipe ou seul(e) ?', en: 'Would you prefer to work in a team or alone?' },
    ],
    stretch: { fr: 'Le travail devrait-il être plus flexible pour les jeunes ?', en: 'Should work be more flexible for young people?' },
    candidateAsks: 'Ask the examiner what they liked about their first job.',
  },
  {
    id: 'cv-wjec-identity',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'Identity and relationships with others',
    opening: { fr: 'Comment te décrirais-tu ?', en: 'How would you describe yourself?' },
    followUps: [
      { fr: 'Qu’est-ce qui est important pour tes amis ?', en: 'What is important to your friends?' },
      { fr: 'Raconte une journée spéciale avec ta famille.', en: 'Tell me about a special day with your family.', tense: 'past' },
      { fr: 'Comment changeras-tu dans cinq ans ?', en: 'How will you change in five years?', tense: 'future' },
    ],
    stretch: { fr: 'Les réseaux sociaux rendent-ils les relations plus faciles ?', en: 'Do social networks make relationships easier?' },
    candidateAsks: 'Ask the examiner what they value in a friendship.',
  },
  {
    id: 'cv-aqa-wellbeing',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'People and lifestyle: healthy living and lifestyle',
    opening: { fr: 'Comment restes-tu en bonne santé ?', en: 'How do you stay healthy?' },
    followUps: [
      { fr: 'Que manges-tu pendant une journée normale ?', en: 'What do you eat on a normal day?' },
      { fr: 'Qu’as-tu fait pour te détendre récemment ?', en: 'What did you do to relax recently?', tense: 'past' },
      { fr: 'Que devrait faire ton école pour aider les élèves ?', en: 'What should your school do to help pupils?' },
    ],
    stretch: { fr: 'La santé mentale est-elle aussi importante que la santé physique ?', en: 'Is mental health as important as physical health?' },
    candidateAsks: 'Ask the examiner how they relax after a busy day.',
  },
  {
    id: 'cv-edexcel-media',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Media and technology',
    opening: { fr: 'Comment les médias font-ils partie de ta vie ?', en: 'How are media part of your life?' },
    followUps: [
      { fr: 'Quel est ton moyen préféré pour obtenir les nouvelles ?', en: 'What is your favourite way to get the news?' },
      { fr: 'As-tu vu un programme intéressant récemment ?', en: 'Have you seen an interesting programme recently?', tense: 'past' },
      { fr: 'Comment utiliseras-tu la technologie dans ton futur métier ?', en: 'How will you use technology in your future job?', tense: 'future' },
    ],
    stretch: { fr: 'Les informations en ligne sont-elles toujours fiables ?', en: 'Is online information always reliable?' },
    candidateAsks: 'Ask the examiner which device they could not live without.',
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
  {
    id: 'ra-wjec-transport',
    boards: ['wjec-gcse'],
    boardStyle: 'WJEC-style original practice',
    theme: 'The environment and where people live',
    tier: TIER.HIGHER,
    text: "Dans ma ville, beaucoup de personnes prennent le bus pour aller au travail. Pourtant, les embouteillages sont fréquents et le service n'est pas toujours fiable. La mairie voudrait créer davantage de pistes cyclables l'année prochaine.",
    focus: ['u-ou', 'nasal-an', 'r', 'liaison'],
    notes: 'Keep the contrast between «bus» and «beaucoup», and link «les embouteillages».',
  },
  {
    id: 'ra-aqa-festival',
    boards: ['aqa-gcse'],
    boardStyle: 'AQA-style original practice',
    theme: 'Popular culture: customs, festivals and celebrations',
    tier: TIER.FOUNDATION,
    text: "Chaque été, ma ville organise une fête dans le parc. Les familles apportent un pique-nique, les musiciens jouent sur une petite scène et les enfants participent à des jeux. L'année prochaine, j'aimerais aider les organisateurs.",
    focus: ['j', 'gn', 'nasal-in', 'liaison'],
    notes: 'Make «chaque» clear, pronounce the ɲ in «organisateurs», and keep the final consonants quiet.',
  },
  {
    id: 'ra-edexcel-future',
    boards: ['edexcel-gcse'],
    boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Studying and my future',
    tier: TIER.HIGHER,
    text: "Après le collège, je voudrais continuer mes études dans une grande ville. Je sais que la vie y sera plus chère, mais il y aura davantage de possibilités. Pour réussir, je devrai travailler régulièrement et demander de l'aide quand ce sera nécessaire.",
    focus: ['r', 'eu', 'future endings', 'liaison'],
    notes: 'Keep the future endings audible in «je devrai» and «ce sera», without adding English vowel sounds.',
  },
];

/**
 * Original written, listening and reading papers. These are deliberately
 * tagged by board style so a learner can practise the shape of the task
 * without us pretending to reproduce a live paper or a copyrighted source.
 */
export const WRITING_TASKS = [
  {
    id: 'wr-wjec-community', boards: ['wjec-gcse'], boardStyle: 'WJEC-style original practice',
    theme: 'The environment and where people live', title: 'Un projet pour votre ville',
    prompt: 'Vous écrivez un article pour le site de votre ville jumelée.',
    instructions: ['Décrivez un problème dans votre région.', 'Expliquez ce que les jeunes font déjà.', 'Proposez une amélioration pour l’avenir.'],
    wordTarget: '90–110 words', minWords: 90, maxWords: 110, targetSeconds: 2700, prepSeconds: 300, marks: 40,
    criteria: ['content', 'accuracy', 'range', 'organisation'],
  },
  {
    id: 'wr-aqa-school-life', boards: ['aqa-gcse'], boardStyle: 'AQA-style original practice',
    theme: 'People and lifestyle: education and work', title: 'Un message à un correspondant',
    prompt: 'Répondez à votre correspondant français au sujet de votre établissement.',
    instructions: ['Décrivez votre journée scolaire.', 'Dites ce que vous avez fait récemment à l’école.', 'Expliquez ce que vous changerez l’année prochaine.'],
    wordTarget: '90–110 words', minWords: 90, maxWords: 110, targetSeconds: 2700, prepSeconds: 300, marks: 40,
    criteria: ['content', 'accuracy', 'range', 'organisation'],
  },
  {
    id: 'wr-edexcel-weekend', boards: ['edexcel-gcse'], boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Travel and tourism', title: 'Un week-end réussi',
    prompt: 'Écrivez un article pour le blog de votre école sur un week-end idéal.',
    instructions: ['Décrivez où vous êtes allé(e) ou où vous voudriez aller.', 'Racontez une expérience passée.', 'Donnez des projets pour votre prochain week-end.'],
    wordTarget: '90–110 words', minWords: 90, maxWords: 110, targetSeconds: 2700, prepSeconds: 300, marks: 40,
    criteria: ['content', 'accuracy', 'range', 'organisation'],
  },
  {
    id: 'wr-wjec-alevel-film', boards: ['wjec-alevel'], boardStyle: 'WJEC-style original practice',
    theme: 'Literary texts and films', title: 'Critique culturelle',
    prompt: 'Rédigez une critique d’un film ou d’un livre francophone étudié.',
    instructions: ['Présentez l’œuvre et son contexte.', 'Analysez un personnage ou une idée importante.', 'Expliquez pourquoi vous la recommanderiez ou non.'],
    wordTarget: '250–300 words', minWords: 250, maxWords: 300, targetSeconds: 3600, prepSeconds: 300, marks: 40,
    criteria: ['content', 'accuracy', 'range', 'organisation'],
  },
];

export const LISTENING_TASKS = [
  {
    id: 'li-wjec-volunteering', boards: ['wjec-gcse'], boardStyle: 'WJEC-style original practice',
    theme: 'Identity and relationships with others', title: 'Une interview sur le bénévolat',
    script: "Bonjour, je m'appelle Nadia. Samedi dernier, j'ai aidé dans une banque alimentaire avec mon frère. Nous avons trié des boîtes pendant trois heures. C'était fatigant, mais j'ai aimé rencontrer des personnes différentes. Nous y retournerons pendant les vacances, car le responsable a besoin de bénévoles.",
    questions: [
      { prompt: 'Pourquoi Nadia a-t-elle fait cette activité ?', options: ['Pour gagner de l’argent', 'Pour aider sa communauté', 'Pour préparer un voyage'], answer: 1 },
      { prompt: 'Avec qui a-t-elle participé ?', options: ['Avec son frère', 'Avec sa classe', 'Avec sa voisine'], answer: 0 },
      { prompt: 'Combien de temps a-t-elle travaillé ?', options: ['Une heure', 'Deux heures', 'Trois heures'], answer: 2 },
      { prompt: 'Quand y retournera-t-elle ?', options: ['Demain', 'Pendant les vacances', 'L’année prochaine'], answer: 1 },
    ],
    targetSeconds: 1500, prepSeconds: 180, marks: 40, criteria: ['comprehension'], playCount: 2,
  },
  {
    id: 'li-aqa-cinema', boards: ['aqa-gcse'], boardStyle: 'AQA-style original practice',
    theme: 'Popular culture: free time activities', title: 'Une sortie au cinéma',
    script: "Ce week-end, mes amis et moi allons au cinéma du centre-ville. Nous avons choisi une comédie parce que nous voulons nous détendre après les examens. La séance commence à huit heures, mais je vais arriver plus tôt pour acheter des boissons. Après le film, nous prendrons le bus chez moi.",
    questions: [
      { prompt: 'Quand vont-ils au cinéma ?', options: ['Ce week-end', 'Le mois prochain', 'Pendant les vacances'], answer: 0 },
      { prompt: 'Pourquoi ont-ils choisi une comédie ?', options: ['Pour apprendre quelque chose', 'Pour se détendre', 'Pour voir un acteur célèbre'], answer: 1 },
      { prompt: 'Que fera le candidat avant la séance ?', options: ['Manger au restaurant', 'Acheter des boissons', 'Prendre le train'], answer: 1 },
      { prompt: 'Comment rentreront-ils ?', options: ['En bus', 'À pied', 'En voiture'], answer: 0 },
    ],
    targetSeconds: 1500, prepSeconds: 180, marks: 40, criteria: ['comprehension'], playCount: 2,
  },
  {
    id: 'li-edexcel-job', boards: ['edexcel-gcse'], boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Studying and my future', title: 'Un petit emploi',
    script: "Pendant l'été, j'ai travaillé dans une librairie deux jours par semaine. Au début, je trouvais le travail difficile, car il fallait parler aux clients. Maintenant, je suis plus à l'aise et j'ai appris à organiser les rayons. Plus tard, je voudrais avoir un emploi où je peux utiliser les langues.",
    questions: [
      { prompt: 'Où la personne a-t-elle travaillé ?', options: ['Dans une librairie', 'Dans un café', 'Dans une école'], answer: 0 },
      { prompt: 'À quelle fréquence ?', options: ['Tous les jours', 'Deux jours par semaine', 'Une fois par mois'], answer: 1 },
      { prompt: 'Pourquoi le travail était-il difficile au début ?', options: ['Il fallait parler aux clients', 'Il fallait voyager', 'Il fallait travailler la nuit'], answer: 0 },
      { prompt: 'Que voudrait-elle faire plus tard ?', options: ['Utiliser les langues', 'Ouvrir un restaurant', 'Devenir professeur de sport'], answer: 0 },
    ],
    targetSeconds: 1500, prepSeconds: 180, marks: 40, criteria: ['comprehension'], playCount: 2,
  },
  {
    id: 'li-wjec-alevel-news', boards: ['wjec-alevel'], boardStyle: 'WJEC-style original practice',
    theme: 'Understanding the francophone world', title: 'Un reportage local',
    script: "Dans cette émission, nous parlons d'une nouvelle initiative à Dakar. Des lycéens ont créé un jardin partagé dans un quartier où les espaces verts sont rares. Le projet fournit des légumes à plusieurs familles et permet aux élèves d'apprendre à travailler ensemble. Les organisateurs espèrent l'étendre l'année prochaine.",
    questions: [
      { prompt: 'Où se trouve l’initiative ?', options: ['À Dakar', 'À Lyon', 'À Montréal'], answer: 0 },
      { prompt: 'Quel problème le projet cherche-t-il à résoudre ?', options: ['Le manque d’espaces verts', 'Le prix des transports', 'Le bruit des écoles'], answer: 0 },
      { prompt: 'Qui reçoit les légumes ?', options: ['Des touristes', 'Des familles', 'Des entreprises'], answer: 1 },
      { prompt: 'Quel est le projet pour l’avenir ?', options: ['L’arrêter', 'Le déplacer', 'L’étendre'], answer: 2 },
    ],
    targetSeconds: 2400, prepSeconds: 300, marks: 40, criteria: ['comprehension'], playCount: 2,
  },
];

export const READING_TASKS = [
  {
    id: 'rd-wjec-town', boards: ['wjec-gcse'], boardStyle: 'WJEC-style original practice',
    theme: 'The environment and where people live', title: 'Une ville plus verte',
    passage: "La ville de Saint-Brieuc veut réduire la circulation dans son centre. À partir du mois prochain, une rue sera réservée aux piétons le samedi. Les commerçants espèrent attirer davantage de familles, mais certains habitants craignent que le stationnement devienne plus difficile. La mairie va mesurer les effets du projet après trois mois.",
    questions: [
      { prompt: 'Quel changement aura lieu le samedi ?', options: ['Une rue sera piétonne', 'Les magasins fermeront', 'Les bus seront gratuits'], answer: 0 },
      { prompt: 'Que souhaitent les commerçants ?', options: ['Voir plus de familles', 'Réduire les horaires', 'Déplacer le marché'], answer: 0 },
      { prompt: 'De quoi certains habitants ont-ils peur ?', options: ['Du bruit', 'Du manque de stationnement', 'De la pluie'], answer: 1 },
      { prompt: 'Quand la mairie évaluera-t-elle le projet ?', options: ['Après trois mois', 'Après un an', 'Demain'], answer: 0 },
    ],
    targetSeconds: 2700, prepSeconds: 300, marks: 40, criteria: ['comprehension'],
  },
  {
    id: 'rd-aqa-exchange', boards: ['aqa-gcse'], boardStyle: 'AQA-style original practice',
    theme: 'People and lifestyle: education and work', title: 'Une semaine d’échange',
    passage: "L’année dernière, Inès a accueilli une élève galloise chez elle. Au début, elles étaient un peu timides, mais elles ont vite découvert qu’elles partageaient le même goût pour la musique. Inès a surtout aimé les activités organisées par le collège, notamment une visite d’un musée. Elle voudrait maintenant rendre visite à son amie au Pays de Galles.",
    questions: [
      { prompt: 'Qui Inès a-t-elle accueillie ?', options: ['Une élève galloise', 'Une professeure', 'Une cousine'], answer: 0 },
      { prompt: 'Pourquoi les deux élèves se sont-elles rapprochées ?', options: ['Elles aimaient la même musique', 'Elles faisaient du sport', 'Elles habitaient la même rue'], answer: 0 },
      { prompt: 'Quelle activité a particulièrement plu à Inès ?', options: ['Une visite de musée', 'Un concert', 'Un match'], answer: 0 },
      { prompt: 'Que veut-elle faire ensuite ?', options: ['Changer de collège', 'Voyager au Pays de Galles', 'Apprendre l’italien'], answer: 1 },
    ],
    targetSeconds: 2700, prepSeconds: 300, marks: 40, criteria: ['comprehension'],
  },
  {
    id: 'rd-edexcel-media', boards: ['edexcel-gcse'], boardStyle: 'Pearson Edexcel-style original practice',
    theme: 'Media and technology', title: 'Le téléphone au quotidien',
    passage: "Pour Hugo, le téléphone est surtout un outil pratique. Il l’utilise pour vérifier les horaires de train et pour envoyer des messages à sa famille. Pourtant, il a décidé de ne plus le regarder pendant les repas, car il trouvait que ses conversations devenaient moins intéressantes. Le dimanche, il essaie aussi de passer une heure dehors sans écran.",
    questions: [
      { prompt: 'Pourquoi Hugo utilise-t-il son téléphone ?', options: ['Pour vérifier les trains', 'Pour jouer au football', 'Pour cuisiner'], answer: 0 },
      { prompt: 'Quelle règle a-t-il adoptée ?', options: ['Pas de téléphone pendant les repas', 'Pas de messages le dimanche', 'Pas de téléphone à l’école'], answer: 0 },
      { prompt: 'Quel problème avait-il remarqué ?', options: ['Ses conversations étaient moins intéressantes', 'Il perdait son téléphone', 'La batterie était faible'], answer: 0 },
      { prompt: 'Que fait-il le dimanche ?', options: ['Il travaille', 'Il passe du temps dehors sans écran', 'Il prend le train'], answer: 1 },
    ],
    targetSeconds: 2700, prepSeconds: 300, marks: 40, criteria: ['comprehension'],
  },
  {
    id: 'rd-wjec-alevel-identity', boards: ['wjec-alevel'], boardStyle: 'WJEC-style original practice',
    theme: 'Diversity and difference', title: 'Des voix différentes',
    passage: "Dans plusieurs villes francophones, des associations organisent des ateliers où les jeunes peuvent raconter leur histoire familiale. Les participants utilisent la photographie, la musique ou le théâtre pour montrer comment plusieurs cultures peuvent coexister. Les responsables disent que le projet ne cherche pas à effacer les différences, mais à créer des occasions de dialogue.",
    questions: [
      { prompt: 'Que peuvent raconter les jeunes ?', options: ['Leur histoire familiale', 'Leurs résultats sportifs', 'Leurs vacances'], answer: 0 },
      { prompt: 'Quels moyens artistiques peuvent-ils utiliser ?', options: ['La photographie, la musique ou le théâtre', 'La cuisine uniquement', 'Les jeux vidéo uniquement'], answer: 0 },
      { prompt: 'Quel est le but du projet ?', options: ['Effacer les différences', 'Créer un dialogue', 'Choisir une seule culture'], answer: 1 },
      { prompt: 'Où les ateliers sont-ils organisés ?', options: ['Dans plusieurs villes francophones', 'Dans une seule école', 'À la télévision'], answer: 0 },
    ],
    targetSeconds: 3600, prepSeconds: 300, marks: 40, criteria: ['comprehension'],
  },
];

// ------------------------------------------------------------- selection ----

const tierMatch = (item, tier) => !tier || !item.tier || item.tier === tier;
const boardMatch = (item, boardId) => !boardId || !item.boards || item.boards.includes(boardId);

export function pickRoleplay({ theme = null, tier = null, boardId = null, exclude = [] } = {}) {
  return pick(ROLEPLAYS, { theme, tier, boardId, exclude });
}
export function pickPhotocard({ theme = null, tier = null, boardId = null, exclude = [] } = {}) {
  return pick(PHOTOCARDS, { theme, tier, boardId, exclude });
}
export function pickConversation({ theme = null, boardId = null, exclude = [] } = {}) {
  return pick(CONVERSATIONS, { theme, boardId, exclude });
}
export function pickReadingPassage({ tier = null, boardId = null, exclude = [] } = {}) {
  return pick(READING_PASSAGES, { tier, boardId, exclude });
}

export function pickExamTask(mode, { boardId = null, theme = null, exclude = [] } = {}) {
  const pools = { writing: WRITING_TASKS, listening: LISTENING_TASKS, reading: READING_TASKS };
  return pick(pools[mode] || [], { boardId, theme, exclude });
}

function pick(pool, { theme, tier = null, boardId = null, exclude = [] }) {
  const skip = new Set(exclude);
  let candidates = pool.filter((i) => !skip.has(i.id) && tierMatch(i, tier) && boardMatch(i, boardId));
  if (theme) {
    const themed = candidates.filter((i) => i.theme === theme);
    if (themed.length) candidates = themed;
  }
  if (!candidates.length) candidates = pool.filter((i) => tierMatch(i, tier) && boardMatch(i, boardId));
  if (!candidates.length) candidates = pool;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

/** Every theme that has at least one task, for the theme picker. */
export function availableThemes() {
  const set = new Set();
  for (const list of [ROLEPLAYS, PHOTOCARDS, CONVERSATIONS, READING_PASSAGES, WRITING_TASKS, LISTENING_TASKS, READING_TASKS]) {
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
    writingTasks: WRITING_TASKS.length,
    listeningTasks: LISTENING_TASKS.length,
    readingTasks: READING_TASKS.length,
    themes: availableThemes().length,
  };
}

// ---- provenance hardening: every task is generated practice, not official ----
for (const pool of [ROLEPLAYS, PHOTOCARDS, CONVERSATIONS, READING_PASSAGES, WRITING_TASKS, LISTENING_TASKS, READING_TASKS]) {
  for (const item of pool) {
    if (!('provenance' in item)) item.provenance = 'generated';
    if (!('official' in item)) item.official = false;
    if (!item.boardStyle) item.boardStyle = `${item.boards ? item.boards.join('/') : 'generic'}-style original practice (generated)`;
  }
}
