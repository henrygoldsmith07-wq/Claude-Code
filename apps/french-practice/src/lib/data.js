// Static content: roleplay scenarios (with 3rd-turn curveballs), daily
// challenge topics, and the filler-word flashcard deck.
// UI-facing fields (title, setup, hint scaffolding) are in English; the
// practice material itself (openers, hints' French phrases, topics,
// examples) stays in French. aiRole/curveball are model-facing prompts.

export const SCENARIOS = [
  {
    id: 'bistro',
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

// Goal-specific scenarios (business & school learning paths) + free talk.
SCENARIOS.push(
  {
    id: 'libre',
    title: 'Free Talk',
    setup: 'Open-ended conversation — no script, no scenario. Talk about whatever you like; your partner follows your lead.',
    aiRole: "Ami(e) français(e) curieux/curieuse qui suit la conversation où l'apprenant veut l'emmener, pose des questions ouvertes et partage ses propres opinions.",
    opener: "Salut ! Ça me fait plaisir de te voir. Alors, qu'est-ce que tu as envie de raconter aujourd'hui ?",
    openerTranslation: "Hi! Great to see you. So, what do you feel like talking about today?",
    curveball: "Change complètement de sujet avec une question personnelle inattendue mais amicale (par exemple : ton plus grand rêve, un souvenir marquant).",
    staticHints: [
      "Vocabulary: «en ce moment» (at the moment), «d'ailleurs» (by the way), «ça dépend» (it depends).",
      "Start with: «En ce moment, je… » or «J'ai envie de parler de…»",
      "«En ce moment, je pense beaucoup à mes prochaines vacances.» — At the moment I'm thinking a lot about my next holidays.",
    ],
  },
  {
    id: 'entretien',
    title: 'Job Interview',
    setup: 'You are interviewing for a position at a French company. The hiring manager wants to know about you.',
    aiRole: "Responsable RH professionnel(le) mais bienveillant(e) qui mène un entretien d'embauche.",
    opener: "Bonjour, asseyez-vous ! Merci d'être venu(e). Alors, parlez-moi un peu de vous et de votre parcours.",
    openerTranslation: "Hello, have a seat! Thanks for coming. So, tell me a little about yourself and your background.",
    curveball: "Demande au candidat de décrire un échec professionnel et ce qu'il en a appris.",
    staticHints: [
      "Vocabulary: «un poste» (a position), «une expérience» (experience), «un point fort» (a strength).",
      "Start with: «Alors, j'ai travaillé pendant… » or «Je suis quelqu'un de…»",
      "«J'ai trois ans d'expérience dans ce domaine et je cherche un nouveau défi.» — I have three years' experience in this field and I'm looking for a new challenge.",
    ],
  },
  {
    id: 'reunion',
    title: 'Team Meeting',
    setup: 'You are giving a project update in a weekly team meeting at your French office.',
    aiRole: "Chef(fe) de projet qui anime la réunion et pose des questions précises sur l'avancement.",
    opener: "Bon, on va commencer. Où est-ce qu'on en est sur le projet ? Vous pouvez nous faire un point rapide ?",
    openerTranslation: "Right, let's get started. Where are we on the project? Can you give us a quick update?",
    curveball: "Annonce que le client vient d'avancer la date de livraison d'une semaine — demande comment on s'adapte.",
    staticHints: [
      "Vocabulary: «l'avancement» (progress), «un délai» (a deadline), «en retard / dans les temps» (behind / on schedule).",
      "Start with: «Alors, pour le moment, on a terminé…»",
      "«On est dans les temps : la première phase est terminée et on commence les tests cette semaine.» — We're on schedule: phase one is done and we start testing this week.",
    ],
  },
  {
    id: 'cours',
    title: 'Office Hours',
    setup: "You are meeting your French professor during office hours to discuss an assignment you're struggling with.",
    aiRole: "Professeur(e) d'université exigeant(e) mais qui aime aider les étudiants motivés.",
    opener: "Entrez ! Vous vouliez me voir à propos du devoir, c'est ça ? Qu'est-ce qui vous pose problème ?",
    openerTranslation: "Come in! You wanted to see me about the assignment, right? What's giving you trouble?",
    curveball: "Propose à l'étudiant(e) de présenter son travail devant la classe la semaine prochaine — observe sa réaction.",
    staticHints: [
      "Vocabulary: «un devoir» (an assignment), «une consigne» (an instruction), «un délai supplémentaire» (an extension).",
      "Start with: «En fait, je n'ai pas bien compris…»",
      "«En fait, je n'ai pas bien compris la deuxième question — est-ce que vous pourriez me l'expliquer ?» — Actually, I didn't quite understand the second question — could you explain it to me?",
    ],
  },
  {
    id: 'pharmacie',
    title: 'At the Pharmacy',
    setup: "You feel unwell while travelling and go to a pharmacy to describe your symptoms and get advice.",
    aiRole: "Pharmacien(ne) attentif(ve) qui pose des questions sur les symptômes avant de conseiller.",
    opener: "Bonjour, qu'est-ce qui vous amène ? Vous n'avez pas l'air en forme.",
    openerTranslation: "Hello, what brings you in? You don't look well.",
    curveball: "Demande si le client prend déjà d'autres médicaments ou a des allergies avant de recommander quoi que ce soit.",
    staticHints: [
      "Vocabulary: «j'ai mal à la tête / au ventre» (I have a headache / stomachache), «de la fièvre» (a fever), «une ordonnance» (a prescription).",
      "Start with: «Je ne me sens pas très bien, j'ai…»",
      "«Depuis hier, j'ai mal à la gorge et un peu de fièvre. Qu'est-ce que vous me conseillez ?» — Since yesterday I've had a sore throat and a slight fever. What do you recommend?",
    ],
  },
  {
    id: 'banque',
    title: 'At the Bank',
    setup: 'You are opening a bank account as a newcomer in France and have questions about the paperwork.',
    aiRole: "Conseiller(ère) bancaire poli(e) et méthodique qui demande des justificatifs.",
    opener: "Bonjour, bienvenue. Vous souhaitez ouvrir un compte, c'est bien ça ? Vous avez un justificatif de domicile ?",
    openerTranslation: "Hello, welcome. You'd like to open an account, is that right? Do you have proof of address?",
    curveball: "Explique qu'il manque un document (justificatif de domicile récent) et propose une solution.",
    staticHints: [
      "Vocabulary: «un compte» (an account), «une carte bancaire» (a debit card), «un justificatif de domicile» (proof of address), «un RIB» (bank details).",
      "Start with: «Bonjour, je voudrais ouvrir un compte…»",
      "«Je viens d'arriver en France et je voudrais ouvrir un compte courant. Qu'est-ce qu'il vous faut ?» — I've just arrived in France and I'd like to open a current account. What do you need?",
    ],
  },
  {
    id: 'medecin',
    title: "At the Doctor's",
    setup: "You have a persistent symptom and are describing it to a GP during an appointment.",
    aiRole: "Médecin généraliste calme qui pose des questions précises et rassure.",
    opener: "Bonjour, installez-vous. Alors, qu'est-ce qui ne va pas aujourd'hui ?",
    openerTranslation: "Hello, have a seat. So, what's wrong today?",
    curveball: "Demande depuis combien de temps ça dure et si le symptôme empêche de dormir ou de travailler.",
    staticHints: [
      "Vocabulary: «depuis trois jours» (for three days), «ça me lance» (it throbs), «une analyse de sang» (a blood test), «se reposer» (to rest).",
      "Start with: «Docteur, j'ai un problème depuis…»",
      "«Depuis une semaine, j'ai très mal au dos et je dors mal.» — For a week I've had bad back pain and I'm sleeping badly.",
    ],
  },
  {
    id: 'coiffeur',
    title: 'At the Hairdresser',
    setup: 'You want a haircut and need to explain exactly what you would (and would not) like.',
    aiRole: "Coiffeur/coiffeuse bavard(e) et enthousiaste qui propose toujours un peu plus.",
    opener: "Bonjour ! Installez-vous. Alors, on fait quoi de beau aujourd'hui ?",
    openerTranslation: "Hello! Have a seat. So, what are we doing today?",
    curveball: "Propose une coupe plus courte ou une couleur que le client n'a pas demandée — vois comment il réagit.",
    staticHints: [
      "Vocabulary: «une coupe» (a cut), «les pointes» (the ends), «dégradé» (layered/faded), «pas trop court» (not too short).",
      "Start with: «Je voudrais juste rafraîchir la coupe…»",
      "«Juste les pointes, s'il vous plaît, mais gardez la longueur.» — Just the ends, please, but keep the length.",
    ],
  },
  {
    id: 'logement',
    title: 'Renting a Flat',
    setup: "You are viewing a flat to rent and asking the letting agent the questions that matter.",
    aiRole: "Agent(e) immobilier(ère) enthousiaste qui vante le bien mais élude les défauts.",
    opener: "Bonjour ! Alors voilà le salon — lumineux, n'est-ce pas ? Vous cherchez pour quand ?",
    openerTranslation: "Hello! So here's the living room — bright, isn't it? When are you looking to move in?",
    curveball: "Admet à contrecœur un défaut (voisins bruyants, ou charges élevées) quand le client insiste.",
    staticHints: [
      "Vocabulary: «le loyer» (rent), «les charges» (utilities/fees), «meublé» (furnished), «la caution» (deposit), «lumineux» (bright).",
      "Start with: «C'est à combien le loyer, charges comprises ?»",
      "«Le loyer, c'est combien charges comprises, et il y a un dépôt de garantie ?» — How much is the rent including fees, and is there a deposit?",
    ],
  }
);

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
