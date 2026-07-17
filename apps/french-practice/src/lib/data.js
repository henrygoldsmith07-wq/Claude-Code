// Static content: roleplay scenarios (with 3rd-turn curveballs), daily
// challenge topics, and the filler-word flashcard deck.
// UI-facing fields (title, setup, hint scaffolding) are in English; the
// practice material itself (openers, hints' French phrases, topics,
// examples) stays in French. aiRole/curveball are model-facing prompts.

export const SCENARIOS = [
  {
    id: 'bistro',
    emoji: '🥐',
    title: 'Ordering at the Bistro',
    setup: 'You walk into a busy Parisian bistro at lunchtime and want to order.',
    aiRole: "Serveur/serveuse parisien(ne) sympathique mais pressé(e).",
    opener: "Bonjour ! Bienvenue au Petit Zinc. Vous avez choisi, ou vous avez besoin d'une minute ?",
    openerTranslation: "Hello! Welcome to Le Petit Zinc. Have you decided, or do you need a minute?",
    curveball: "Le plat que le client vient de commander (ou son choix le plus probable) n'est plus disponible — propose une alternative du jour.",
    staticHints: [
      "Vocabulary: «la carte» (the menu), «le plat du jour» (today's special), «saignant / à point» (rare / medium).",
      "Start with: «Je vais prendre…» or «Qu'est-ce que vous me conseillez…»",
      "«Je vais prendre le plat du jour, et une carafe d'eau, s'il vous plaît.» — I'll have today's special and a carafe of water, please.",
    ],
  },
  {
    id: 'poste',
    emoji: '📦',
    title: 'At the Post Office',
    setup: 'You need to send an important package abroad and ask about delivery times.',
    aiRole: "Agent(e) de la Poste efficace qui pose beaucoup de questions de procédure.",
    opener: "Bonjour, c'est à vous ! Qu'est-ce que je peux faire pour vous aujourd'hui ?",
    openerTranslation: "Hello, you're next! What can I do for you today?",
    curveball: "Le colis dépasse la limite de poids pour le tarif standard — annonce un supplément et demande au client de choisir.",
    staticHints: [
      "Vocabulary: «un colis» (a package), «les délais» (delivery times), «en recommandé» (registered mail).",
      "Start with: «Je voudrais envoyer…»",
      "«Je voudrais envoyer ce colis au Royaume-Uni, c'est possible en recommandé ?» — I'd like to send this package to the UK, can I do it registered?",
    ],
  },
  {
    id: 'vol',
    emoji: '✈️',
    title: 'Rebooking a Flight',
    setup: "Tomorrow's flight is cancelled and you're calling the airline to rebook it.",
    aiRole: "Agent(e) du service client d'une compagnie aérienne, poli(e) mais qui suit un script strict.",
    opener: "Air Hexagone, bonjour ! Je suis Camille, comment puis-je vous aider ?",
    openerTranslation: "Air Hexagone, hello! I'm Camille, how can I help you?",
    curveball: "Le seul vol de remplacement disponible part à 6h du matin avec une escale — demande au client s'il accepte.",
    staticHints: [
      "Vocabulary: «annulé» (cancelled), «reporter» (to postpone), «un remboursement» (a refund).",
      "Start with: «Bonjour, je vous appelle parce que…»",
      "«Bonjour, je vous appelle parce que mon vol a été annulé et je voudrais le reporter.» — Hello, I'm calling because my flight was cancelled and I'd like to rebook it.",
    ],
  },
  {
    id: 'marche',
    emoji: '🍅',
    title: 'At the Market',
    setup: 'You are shopping at the open-air market, chatting with a fruit-and-veg seller.',
    aiRole: "Marchand(e) bavard(e) qui adore donner des conseils de cuisine.",
    opener: "Allez-y, goûtez-moi ces fraises ! Elles sont arrivées ce matin. Qu'est-ce qu'il vous faut ?",
    openerTranslation: "Go on, taste these strawberries! They arrived this morning. What do you need?",
    curveball: "Le marchand n'a plus de monnaie — demande au client s'il peut payer par carte ou en appoint.",
    staticHints: [
      "Vocabulary: «une barquette» (a punnet), «mûr» (ripe), «c'est combien ?» (how much is it?).",
      "Start with: «Je vais vous prendre…»",
      "«Elles ont l'air délicieuses ! Je vais vous prendre deux barquettes, s'il vous plaît.» — They look delicious! I'll take two punnets, please.",
    ],
  },
  {
    id: 'colloc',
    emoji: '🏠',
    title: 'Flat-share Viewing',
    setup: 'You are viewing a flat-share in Lyon and chatting with one of the current flatmates.',
    aiRole: "Colocataire décontracté(e) qui veut savoir si vous êtes compatible avec l'ambiance de l'appart.",
    opener: "Salut, entre ! Alors, c'est toi qui cherches une chambre ? Tu viens d'où ?",
    openerTranslation: "Hi, come in! So you're the one looking for a room? Where are you from?",
    curveball: "Le colocataire mentionne que le loyer vient d'augmenter de 50 € — observe la réaction du candidat.",
    staticHints: [
      "Vocabulary: «le loyer» (the rent), «les charges» (utilities), «au calme» (quiet).",
      "Start with: «Oui, c'est moi ! Je viens de…»",
      "«Oui c'est moi ! Je viens d'Angleterre et je cherche une chambre pour six mois.» — Yes, that's me! I'm from England and I'm looking for a room for six months.",
    ],
  },
];

export const DAILY_TOPICS = [
  { fr: "Décrivez votre petit-déjeuner idéal.", en: 'Describe your ideal breakfast.' },
  { fr: "Racontez la dernière fois que vous avez été en retard.", en: 'Tell the story of the last time you were late.' },
  { fr: "Quel est le meilleur conseil qu'on vous ait donné ?", en: "What's the best advice you've ever been given?" },
  { fr: "Décrivez votre ville à quelqu'un qui ne la connaît pas.", en: "Describe your town to someone who doesn't know it." },
  { fr: "Qu'est-ce que vous feriez avec un million d'euros ?", en: 'What would you do with a million euros?' },
  { fr: "Racontez un souvenir d'enfance.", en: 'Tell a childhood memory.' },
  { fr: "Pour ou contre les réseaux sociaux ?", en: 'For or against social media?' },
  { fr: "Décrivez votre film ou série préféré(e) sans dire le titre.", en: 'Describe your favourite film or series without saying the title.' },
  { fr: "Qu'est-ce qui vous rend heureux/heureuse un dimanche ?", en: 'What makes you happy on a Sunday?' },
  { fr: "Si vous pouviez dîner avec une personne célèbre, qui et pourquoi ?", en: 'If you could have dinner with someone famous, who and why?' },
  { fr: "Décrivez le pire repas de votre vie.", en: 'Describe the worst meal of your life.' },
  { fr: "Quelle habitude aimeriez-vous changer ?", en: 'Which habit would you like to change?' },
];

export const FLASHCARDS = [
  { id: 'du-coup', front: 'du coup', meaning: 'so / as a result', example: "Il pleuvait, du coup on est restés à la maison.", exampleTranslation: 'It was raining, so we stayed home.', register: 'Very common, informal' },
  { id: 'en-fait', front: 'en fait', meaning: 'actually / in fact', example: "En fait, je ne suis jamais allé à Paris.", exampleTranslation: "Actually, I've never been to Paris.", register: 'Universal, all registers' },
  { id: 'bref', front: 'bref', meaning: 'anyway / long story short', example: "Bref, on a raté le train.", exampleTranslation: 'Long story short, we missed the train.', register: 'Informal, wraps up a story' },
  { id: 'quand-meme', front: 'quand même', meaning: 'still / all the same', example: "C'est cher, mais c'est quand même très bon.", exampleTranslation: "It's expensive, but it's still really good.", register: 'Universal' },
  { id: 'genre', front: 'genre', meaning: 'like / kind of', example: "Il est arrivé genre deux heures en retard.", exampleTranslation: 'He arrived like two hours late.', register: 'Very informal, younger speakers' },
  { id: 'enfin', front: 'enfin', meaning: 'well / I mean', example: "Enfin, tu vois ce que je veux dire.", exampleTranslation: 'Well, you see what I mean.', register: 'Universal filler' },
  { id: 'franchement', front: 'franchement', meaning: 'honestly / frankly', example: "Franchement, c'était le meilleur concert de ma vie.", exampleTranslation: 'Honestly, it was the best concert of my life.', register: 'Informal emphasis' },
  { id: 'bah', front: 'bah', meaning: 'well / duh', example: "Bah oui, évidemment !", exampleTranslation: 'Well yes, obviously!', register: 'Very informal, spoken only' },
  { id: 'tu-vois', front: 'tu vois', meaning: 'you know / you see', example: "C'est compliqué, tu vois, il y a beaucoup d'étapes.", exampleTranslation: "It's complicated, you know, there are lots of steps.", register: 'Informal, conversational glue' },
  { id: 'carrement', front: 'carrément', meaning: 'totally / absolutely', example: "Ce resto est carrément incroyable.", exampleTranslation: 'This restaurant is totally amazing.', register: 'Informal, enthusiastic' },
];

export const randomTopic = () =>
  DAILY_TOPICS[Math.floor(Math.random() * DAILY_TOPICS.length)];
