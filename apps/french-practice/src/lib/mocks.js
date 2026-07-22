// Canned responses for Mock Mode — lets the whole app be exercised offline
// (no API key, no network) from the Dev Panel.

const MOCK_TRANSCRIPTS = [
  "Bonjour, je voudrais un café au lait et un croissant s'il vous plaît.",
  "Je pense que le train est en retard, du coup je vais attendre ici.",
  "Est-ce que vous pouvez m'aider ? J'ai perdu mon colis la semaine dernière.",
];

const MOCK_REPLIES = [
  {
    reply: "Très bon choix ! Un café au lait et un croissant, ça marche. Vous voulez autre chose avec ça ?",
    translation: "Great choice! A café au lait and a croissant, coming up. Would you like anything else with that?",
    corrections: "Almost perfect! One nuance: in a Parisian bistro you'd say <s>je voudrais un café au lait</s> <mark>je vais prendre un café crème</mark> — *café au lait* is mostly said at home.",
    native_alternative: "« Bonjour, je vous prends un petit crème et un croissant, s'il vous plaît ! »",
    grammar_topic: 'articles',
    scores: { grammar: 92, naturalness: 78, relevance: 95, fluency: 84, overall: 87 },
  },
  {
    reply: "Ah non, pas de chance ! Il y a souvent des retards sur cette ligne. Vous allez où, exactement ?",
    translation: "Oh no, bad luck! There are often delays on this line. Where exactly are you headed?",
    corrections: "Very good! Your use of <mark>du coup</mark> is perfectly natural here. Just watch the rhythm: take a small pause after «retard».",
    native_alternative: "« Le train a du retard, du coup je poireaute ici en attendant. »",
    grammar_topic: null,
    scores: { grammar: 88, naturalness: 85, relevance: 90, fluency: 76, overall: 85 },
  },
];

let mockIdx = 0;

export function mockTurn() {
  const transcript = MOCK_TRANSCRIPTS[mockIdx % MOCK_TRANSCRIPTS.length];
  const evaluation = MOCK_REPLIES[mockIdx % MOCK_REPLIES.length];
  mockIdx += 1;
  return { transcript, evaluation };
}

export function mockHint(level) {
  return [
    "Useful vocabulary: «l'addition» (the bill), «régler» (to pay), «une terrasse» (outdoor seating).",
    "Start with: «Excusez-moi, est-ce que je pourrais…»",
    "«Excusez-moi, est-ce que je pourrais avoir l'addition, s'il vous plaît ?» — Excuse me, could I have the bill, please?",
  ][level - 1] || 'Try answering simply, one idea at a time.';
}

export function mockSentenceCheck() {
  return {
    correct: true,
    feedback: "Nice! That's a natural use of the expression. (Mock mode — enable a real API key for genuine feedback.)",
  };
}

export function mockAccentFeedback() {
  return "Good rhythm overall. The recognizer stumbled on «voudrais» — make sure the French r comes from the back of the throat, and round your lips tightly for the u in «du». (Mock mode — add a real API key for genuine accent analysis.)";
}

export function mockWritingFeedback(depth) {
  const essay = depth === 'essay';
  return {
    corrections: "Nice work overall. One slip: <s>je suis allé au la plage</s> <mark>je suis allé à la plage</mark> — «à + la» never contracts. (Mock mode.)",
    strengths: ['Good use of the passé composé («je suis allé»).', 'Clear, simple sentence rhythm.'],
    suggestions: essay
      ? ['Add connectors between paragraphs («d\'abord», «ensuite», «enfin»).', 'Vary sentence openings — three sentences start with «je».']
      : ['Try one sentence with «qui» or «que» next time.'],
    scores: essay
      ? { grammar: 82, vocabulary: 76, structure: 70, overall: 76 }
      : { grammar: 84, vocabulary: 78, overall: 81 },
  };
}

export function mockCompletion() {
  return {
    natural: true,
    feedback: 'Natural and correct — «Si j\'avais le temps, je voyagerais plus» is exactly right. (Mock mode.)',
  };
}

export function mockTutorReply(question) {
  return `Great question! Here's the short version.\n\nIn French, **le passé composé** is used for completed actions: «J'ai mangé une pomme.» (I ate an apple.) The **imparfait** paints the background: «Il pleuvait quand je suis sorti.» (It was raining when I went out.)\n\nA good rule of thumb: if you could answer "what happened?", use passé composé; if you're answering "what was it like?", use imparfait.\n\n*(Mock mode — add a real API key for a genuine tutor. You asked: «${question.slice(0, 60)}»)*`;
}

export function mockTranslation(direction) {
  return direction === 'fr-en'
    ? 'I would like to book a table for two people, please. (Mock mode.)'
    : 'Je voudrais réserver une table pour deux personnes, s\'il vous plaît. (Mode démo.)';
}

export function mockExercises() {
  return [
    { q: 'Je ___ au cinéma hier soir.', options: ['suis allé', 'ai allé', 'vais'], answer: 0, why: '«Aller» takes être in the passé composé.' },
    { q: 'Il faut que tu ___ tes devoirs.', options: ['fais', 'fasses', 'feras'], answer: 1, why: '«Il faut que» triggers the subjonctif.' },
    { q: 'C\'est la femme ___ j\'ai rencontrée.', options: ['qui', 'que', 'dont'], answer: 1, why: '«Que» stands for the direct object of «rencontrer».' },
  ];
}

export function mockLesson() {
  return {
    title: 'Taming the subjonctif after «il faut que»',
    explanation: 'Your recent sessions show hesitation after «il faut que». The rule: expressions of necessity, doubt and emotion push the next verb into the subjonctif. For regular verbs, take the ils-form stem and add -e, -es, -e, -ions, -iez, -ent: «il faut que tu parles», «il faut que nous finissions». (Mock mode.)',
    exercises: mockExercises(),
  };
}

export function mockStory() {
  return {
    title: 'Le café du matin',
    paragraphs: [
      { fr: 'Ce matin, Léa se lève tôt. Il fait beau et le soleil entre par la fenêtre.', en: 'This morning, Léa gets up early. The weather is nice and the sun comes through the window.' },
      { fr: 'Elle prend son petit-déjeuner : du pain, du fromage et un grand café.', en: 'She has her breakfast: some bread, some cheese and a big coffee.' },
      { fr: '« Aujourd’hui, je vais au marché », dit-elle. Elle a besoin de légumes et de fruits.', en: '“Today, I’m going to the market,” she says. She needs vegetables and fruit.' },
      { fr: 'Dans la rue, elle rencontre un ami. Ils parlent un peu, puis ils continuent leur chemin. (Mock mode.)', en: 'In the street, she meets a friend. They talk a little, then they carry on their way. (Mock mode.)' },
    ],
  };
}

export function mockCharacterReply() {
  return 'Ah, mon petit ! Quand j\'avais ton âge, on faisait le pain nous-mêmes tous les dimanches. Et toi, tu sais cuisiner ?\n*Ah, my dear! When I was your age, we made bread ourselves every Sunday. And you, can you cook? (Mock mode.)*';
}

export function mockExplanation() {
  return 'The core rule here is agreement: in the passé composé with «être», the past participle agrees with the subject — «elle est allée», «ils sont partis». French keeps this marker because the participle behaves like an adjective after «être». Pattern to remember: DR & MRS VANDERTRAMP verbs take «être» and agree. Extra example: «Elles sont arrivées en retard.» — They (f.) arrived late. (Mock mode.)';
}

export function mockReport() {
  return {
    session_grade: 'B+',
    average_scores: { grammar: 87, naturalness: 79, relevance: 91, fluency: 78, overall: 84 },
    strengths: [
      'Confident use of polite request forms («je voudrais», «est-ce que je pourrais»).',
      'Good situational vocabulary — «colis», «en retard» used correctly.',
    ],
    stubborn_habits: [
      'Literal translations of English idioms («je suis excité» patterns).',
      'Hesitation before numbers and times — practise saying prices aloud.',
    ],
    tomorrow_focus: "Practise the subjonctif after «il faut que» and drop three conversational fillers (du coup, en fait, bref) into your replies.",
  };
}
