// Grammar library, wave two: seventeen more CEFR-tagged topics (A1–B2),
// same interactive-lesson shape as grammar.js. Split into its own module
// to keep both files under the size limit.

export const EXTRA_GRAMMAR_TOPICS = [
  {
    id: 'futur-proche',
    cefr: 'A1',
    title: 'Le futur proche',
    summary: 'aller + infinitive — the everyday future',
    explanation: {
      rule: "To say what's about to happen, conjugate «aller» in the present and add an infinitive: je vais manger, tu vas partir, on va voir. Spoken French uses it far more than the futur simple.",
      examples: [
        { fr: 'Je vais appeler ma mère ce soir.', en: "I'm going to call my mother tonight." },
        { fr: 'On va prendre le train de neuf heures.', en: "We're going to take the nine o'clock train." },
        { fr: 'Ils vont déménager le mois prochain.', en: "They're going to move next month." },
      ],
      watchOut: "Negation wraps «aller», not the infinitive: «Je ne vais pas venir» — never «Je vais ne pas venir».",
    },
    drills: [
      { q: 'Nous ___ visiter le musée demain.', options: ['allons', 'vont', 'va'], answer: 0, why: 'Nous → allons + infinitive.' },
      { q: 'Elle ___ être en retard.', options: ['va', 'vas', 'aller'], answer: 0, why: 'Elle → va; the second verb stays infinitive.' },
      { q: 'Je ne ___ pas sortir ce soir.', options: ['vais', 'va', 'suis'], answer: 0, why: 'Je → vais, with ne…pas around it.' },
    ],
    build: [
      { fr: 'On va manger dans dix minutes', en: "We're going to eat in ten minutes" },
      { fr: 'Tu vas adorer ce film', en: "You're going to love this film" },
    ],
    quiz: [
      { q: 'Ils ___ acheter une maison.', options: ['vont', 'allez', 'va'], answer: 0, why: 'Ils → vont.' },
      { q: 'Vous ___ comprendre très vite.', options: ['allez', 'allons', 'vont'], answer: 0, why: 'Vous → allez.' },
      { q: 'Which is correct?', options: ['Je ne vais pas rester.', 'Je vais ne pas rester.', 'Je ne pas vais rester.'], answer: 0, why: 'Negation wraps the conjugated «vais».' },
      { q: '«Nous allons voir» means:', options: ["We're going to see", 'We just saw', 'We would see'], answer: 0, why: 'aller + infinitive = near future.' },
    ],
  },
  {
    id: 'imperatif',
    cefr: 'A2',
    title: "L'impératif",
    summary: 'Commands and suggestions — Écoute ! Allons-y !',
    explanation: {
      rule: "Use the tu/nous/vous present forms without the subject: Parle ! Parlons ! Parlez ! For -er verbs the tu form drops its -s (Parle !, Va !). Pronouns follow with a hyphen in the affirmative: «Donne-le-moi», but come first in the negative: «Ne me le donne pas».",
      examples: [
        { fr: 'Écoute bien la question.', en: 'Listen carefully to the question.' },
        { fr: 'Allons-y, on est en retard !', en: "Let's go, we're late!" },
        { fr: 'Ne touchez pas, c\'est fragile.', en: "Don't touch, it's fragile." },
      ],
      watchOut: "The -s comes back before y/en for sound: «Vas-y !», «Manges-en !».",
    },
    drills: [
      { q: 'Tell a friend to wait: «___ une minute !»', options: ['Attends', 'Attend', 'Attendez'], answer: 0, why: 'Informal tu → attends (non -er verbs keep the s).' },
      { q: '«___ tranquilles !» (vous)', options: ['Restez', 'Restes', 'Rester'], answer: 0, why: 'Vous → restez.' },
      { q: 'Go ahead! → «___ !»', options: ['Vas-y', 'Va-y', 'Vas y'], answer: 0, why: 'The s returns before y, joined by a hyphen.' },
    ],
    build: [
      { fr: 'Prends ton temps', en: 'Take your time' },
      { fr: 'Ne parle pas si vite', en: "Don't speak so fast" },
    ],
    quiz: [
      { q: 'Tu form of «manger» in the imperative:', options: ['Mange', 'Manges', 'Mangez'], answer: 0, why: '-er verbs drop the tu -s.' },
      { q: '«Give it to me» =', options: ['Donne-le-moi', 'Me le donne', 'Donne-moi-le'], answer: 0, why: 'Affirmative order: verb-DO-IO with hyphens.' },
      { q: "«Don't be afraid» (tu) =", options: ["N'aie pas peur", "N'as pas peur", 'Ne pas avoir peur'], answer: 0, why: 'Avoir has irregular imperative: aie, ayons, ayez.' },
      { q: '«Let\'s leave» =', options: ['Partons', 'Partez', 'Pars'], answer: 0, why: 'Nous form without subject = let\'s….' },
    ],
  },
  {
    id: 'questions',
    cefr: 'A1',
    title: 'Poser des questions',
    summary: 'Intonation, est-ce que, and inversion',
    explanation: {
      rule: "Three registers: rising intonation («Tu viens ?» — casual), «est-ce que» («Est-ce que tu viens ?» — neutral), and inversion («Viens-tu ?» — formal/written). Question words (où, quand, pourquoi, comment, combien) sit in front: «Où est-ce que tu habites ?»",
      examples: [
        { fr: 'Tu as quel âge ?', en: 'How old are you? (casual)' },
        { fr: "Est-ce que vous avez une table pour deux ?", en: 'Do you have a table for two?' },
        { fr: 'Pourquoi apprends-tu le français ?', en: 'Why are you learning French? (formal)' },
      ],
      watchOut: "In inversion, a -t- is inserted between two vowels: «A-t-il fini ?», «Parle-t-elle anglais ?».",
    },
    drills: [
      { q: 'Neutral register: «___ tu aimes le café ?»', options: ['Est-ce que', 'Que', 'Qu\'est-ce'], answer: 0, why: 'Est-ce que + normal word order.' },
      { q: 'Formal: «___ -vous déjà venu ici ?»', options: ['Êtes', 'Avez', 'Sont'], answer: 0, why: 'Venir takes être: êtes-vous venu.' },
      { q: '«Where do you work?» (casual):', options: ['Tu travailles où ?', 'Où travailles ?', 'Travailles-tu où ?'], answer: 0, why: 'Casual French leaves the question word at the end.' },
    ],
    build: [
      { fr: 'Est-ce que tu peux répéter', en: 'Can you repeat' },
      { fr: 'Comment ça se passe au travail', en: 'How is it going at work' },
    ],
    quiz: [
      { q: 'Insert the liaison letter: «Aime-___-elle le thé ?»', options: ['t', 's', 'z'], answer: 0, why: 'A -t- separates the two vowels.' },
      { q: '«How much does it cost?» =', options: ['Ça coûte combien ?', 'Combien ça coûtez ?', 'Coûte combien ça ?'], answer: 0, why: 'Casual: statement + combien.' },
      { q: 'Most formal version:', options: ['Avez-vous réservé ?', 'Est-ce que vous avez réservé ?', 'Vous avez réservé ?'], answer: 0, why: 'Inversion is the formal register.' },
      { q: '«Qu\'est-ce que tu fais ?» asks about:', options: ['what you are doing', 'where you are', 'who you are'], answer: 0, why: 'Que/qu\'est-ce que = what.' },
    ],
  },
  {
    id: 'possessifs',
    cefr: 'A1',
    title: 'Les possessifs',
    summary: 'mon/ma/mes, notre/nos — agreement with the THING',
    explanation: {
      rule: "Possessives agree with the noun owned, not the owner: mon frère, ma sœur, mes parents. Son/sa/ses can mean his OR her — «sa voiture» is his car or her car. Before a vowel, feminine ma/ta/sa become mon/ton/son: «mon amie».",
      examples: [
        { fr: 'Elle adore son chien.', en: 'She loves her dog.' },
        { fr: 'Il a perdu sa clé.', en: 'He lost his key.' },
        { fr: 'Mon amie habite à Lille.', en: 'My (female) friend lives in Lille.' },
      ],
      watchOut: '«sa voiture» tells you the CAR is feminine — not the owner. English speakers flip this constantly.',
    },
    drills: [
      { q: '___ école est loin. (my)', options: ['Mon', 'Ma', 'Mes'], answer: 0, why: 'École is feminine but starts with a vowel → mon.' },
      { q: 'Il cherche ___ lunettes. (his)', options: ['ses', 'sa', 'son'], answer: 0, why: 'Lunettes is plural → ses.' },
      { q: 'C\'est ___ tour ! (your, informal)', options: ['ton', 'ta', 'tes'], answer: 0, why: 'Tour (turn) is masculine → ton.' },
    ],
    build: [
      { fr: 'Sa mère travaille avec mon père', en: 'His mother works with my father' },
      { fr: 'Nos voisins ont vendu leur maison', en: 'Our neighbours sold their house' },
    ],
    quiz: [
      { q: '«Her brother» =', options: ['son frère', 'sa frère', 'ses frère'], answer: 0, why: 'Frère is masculine → son, whoever owns him.' },
      { q: '«Their ideas» =', options: ['leurs idées', 'leur idées', 'ses idées'], answer: 0, why: 'Plural noun → leurs.' },
      { q: 'Why «mon histoire» although histoire is feminine?', options: ['It starts with a vowel', 'Histoire is masculine', 'It\'s an exception with no rule'], answer: 0, why: 'Ma → mon before a vowel sound.' },
      { q: '«sa maison» means:', options: ['his or her house', 'only her house', 'only his house'], answer: 0, why: 'Agreement is with maison, not the owner.' },
    ],
  },
  {
    id: 'demonstratifs',
    cefr: 'A2',
    title: 'Les démonstratifs',
    summary: 'ce, cette, ces — and celui/celle for "the one"',
    explanation: {
      rule: "This/that: ce livre (m), cette table (f), ces gens (pl). Before a vowel, ce becomes cet: «cet homme». To say 'the one(s)': celui/celle/ceux/celles — «Celle de gauche» (the one on the left). Add -ci/-là to contrast: «ce pull-ci ou ce pull-là ?»",
      examples: [
        { fr: 'Cette couleur te va très bien.', en: 'That colour really suits you.' },
        { fr: 'Cet appartement est trop cher.', en: 'This flat is too expensive.' },
        { fr: 'Je préfère celui en laine.', en: 'I prefer the wool one.' },
      ],
      watchOut: '«cet» exists only in the masculine singular before a vowel — «cette» already ends in a vowel sound.',
    },
    drills: [
      { q: '___ hôtel est complet.', options: ['Cet', 'Ce', 'Cette'], answer: 0, why: 'Masculine + vowel sound → cet.' },
      { q: 'Je prends ___ chaussures.', options: ['ces', 'ce', 'cette'], answer: 0, why: 'Plural → ces.' },
      { q: '«The one (f) I saw yesterday»: ___ que j\'ai vue hier.', options: ['celle', 'celui', 'ceux'], answer: 0, why: 'Feminine singular → celle.' },
    ],
    build: [
      { fr: 'Ce fromage vient de cette région', en: 'This cheese comes from this region' },
      { fr: 'Je préfère celui de droite', en: 'I prefer the one on the right' },
    ],
    quiz: [
      { q: '___ après-midi, je suis libre.', options: ['Cet', 'Ce', 'Cette'], answer: 0, why: 'Après-midi: masculine + vowel → cet.' },
      { q: '«these ones (m pl)» =', options: ['ceux-ci', 'celles-ci', 'celui-ci'], answer: 0, why: 'Masculine plural → ceux(-ci).' },
      { q: '«Which dress? That one!» =', options: ['Celle-là !', 'Celui-là !', 'Cette-là !'], answer: 0, why: 'Robe is feminine → celle-là; «cette-là» doesn\'t exist.' },
      { q: 'Pick the correct pair:', options: ['ce garçon / cette fille', 'cet garçon / ce fille', 'cette garçon / cet fille'], answer: 0, why: 'Garçon m → ce; fille f → cette.' },
    ],
  },
  {
    id: 'pronominaux',
    cefr: 'A2',
    title: 'Les verbes pronominaux',
    summary: 'se lever, se souvenir — verbs that carry a mirror',
    explanation: {
      rule: "Reflexive verbs add me/te/se/nous/vous/se before the verb: je me lève, tu te souviens, ils se parlent. In the passé composé they ALL take être: «Elle s'est levée». The negative wraps both: «Je ne me souviens pas».",
      examples: [
        { fr: 'Je me réveille à sept heures.', en: 'I wake up at seven.' },
        { fr: 'On se retrouve devant le cinéma ?', en: 'Shall we meet in front of the cinema?' },
        { fr: "Elle s'est trompée de bus.", en: 'She took the wrong bus.' },
      ],
      watchOut: "Some verbs change meaning with se: «trouver» = to find, «se trouver» = to be located; «demander» = to ask, «se demander» = to wonder.",
    },
    drills: [
      { q: 'Nous ___ levons tôt le dimanche.', options: ['nous', 'se', 'vous'], answer: 0, why: 'Nous nous levons — the pronoun matches the subject.' },
      { q: 'Passé composé: «Ils ___ rencontrés à Lyon.»', options: ['se sont', 'se ont', 'sont se'], answer: 0, why: 'Pronominal verbs take être: se sont rencontrés.' },
      { q: '«Je ___ demande pourquoi.» (I wonder why)', options: ['me', 'se', 'te'], answer: 0, why: 'Se demander = to wonder; je → me.' },
    ],
    build: [
      { fr: 'Tu te souviens de cette soirée', en: 'You remember that evening' },
      { fr: 'On ne se voit pas assez souvent', en: "We don't see each other often enough" },
    ],
    quiz: [
      { q: '«She got dressed» =', options: ["Elle s'est habillée", 'Elle a habillé', "Elle s'a habillée"], answer: 0, why: 'Pronominal → être + agreement: s\'est habillée.' },
      { q: '«to wonder» =', options: ['se demander', 'demander', 'se trouver'], answer: 0, why: 'Se demander = ask oneself = wonder.' },
      { q: 'Negative: «Je ___ lève ___ tôt.»', options: ['ne me / pas', 'me ne / pas', 'ne / me pas'], answer: 0, why: 'Ne + pronoun + verb + pas.' },
      { q: '«On se tutoie ?» proposes:', options: ['switching to informal "tu"', 'meeting later', 'a toast'], answer: 0, why: 'Se tutoyer = to use tu with each other.' },
    ],
  },
  {
    id: 'prepositions-lieu',
    cefr: 'A2',
    title: 'Prépositions de lieu',
    summary: 'à, en, au, chez — going to places without a map',
    explanation: {
      rule: "Cities take à («à Paris»); feminine countries take en («en France»); masculine countries take au («au Japon»), plural aux («aux États-Unis»). People's homes/shops take chez: «chez Marie», «chez le médecin».",
      examples: [
        { fr: 'Je vais chez le coiffeur.', en: "I'm going to the hairdresser's." },
        { fr: 'Elle habite aux Pays-Bas.', en: 'She lives in the Netherlands.' },
        { fr: 'On se retrouve au café ?', en: 'Shall we meet at the café?' },
      ],
      watchOut: 'Countries ending in -e are usually feminine (en Italie) — big exception: le Mexique (au Mexique).',
    },
    drills: [
      { q: 'Il travaille ___ Canada.', options: ['au', 'en', 'à'], answer: 0, why: 'Canada is masculine → au.' },
      { q: 'Je dîne ___ mes parents.', options: ['chez', 'à', 'dans'], answer: 0, why: "People's homes → chez." },
      { q: 'Nous allons ___ Espagne.', options: ['en', 'au', 'à'], answer: 0, why: 'Espagne is feminine → en.' },
    ],
    build: [
      { fr: 'Je rentre chez moi vers midi', en: 'I go home around noon' },
      { fr: 'Elle étudie en Allemagne cette année', en: 'She is studying in Germany this year' },
    ],
    quiz: [
      { q: '«in the United States» =', options: ['aux États-Unis', 'en États-Unis', 'à États-Unis'], answer: 0, why: 'Plural country → aux.' },
      { q: '«at the doctor\'s» =', options: ['chez le médecin', 'au médecin', 'dans le médecin'], answer: 0, why: 'A professional\'s place → chez.' },
      { q: '«to Lisbon» =', options: ['à Lisbonne', 'en Lisbonne', 'au Lisbonne'], answer: 0, why: 'Cities → à.' },
      { q: '«au Mexique» although Mexique ends in -e because:', options: ['Mexique is masculine', 'Mexique is plural', 'it\'s a city'], answer: 0, why: 'Le Mexique — a famous exception.' },
    ],
  },
  {
    id: 'quantites',
    cefr: 'A2',
    title: 'Les quantités',
    summary: 'beaucoup de, trop de, un peu de — quantity + de',
    explanation: {
      rule: "After quantity words, the article disappears — just «de» (or d'): beaucoup de temps, trop de bruit, un kilo de pommes, pas de problème. Compare: «Je bois du café» but «Je bois trop de café».",
      examples: [
        { fr: "Il y a trop de monde ici.", en: 'There are too many people here.' },
        { fr: 'Je voudrais un peu de lait.', en: "I'd like a little milk." },
        { fr: "Elle n'a pas d'argent sur elle.", en: "She has no money on her." },
      ],
      watchOut: '«La plupart» is the exception: «la plupart des gens» keeps des.',
    },
    drills: [
      { q: "J'ai beaucoup ___ travail.", options: ['de', 'du', 'des'], answer: 0, why: 'Quantity word → bare de.' },
      { q: 'Un kilo ___ tomates, s\'il vous plaît.', options: ['de', 'des', 'les'], answer: 0, why: 'Measure + de.' },
      { q: 'Il ne reste plus ___ pain.', options: ['de', 'du', 'le'], answer: 0, why: 'Negative quantity → de.' },
    ],
    build: [
      { fr: 'Tu mets trop de sel dans la soupe', en: 'You put too much salt in the soup' },
      { fr: 'Il y a assez de place pour tous', en: 'There is enough room for everyone' },
    ],
    quiz: [
      { q: '«a lot of friends» =', options: ["beaucoup d'amis", 'beaucoup des amis', 'beaucoup les amis'], answer: 0, why: 'Beaucoup + de (d\' before vowel).' },
      { q: '«I don\'t have a car» =', options: ["Je n'ai pas de voiture", "Je n'ai pas une voiture", "Je n'ai pas la voiture"], answer: 0, why: 'Pas + de replaces the article.' },
      { q: 'Exception that keeps des:', options: ['la plupart', 'trop', 'assez'], answer: 0, why: 'La plupart des… keeps the article.' },
      { q: '«a bit of patience» =', options: ['un peu de patience', 'un peu du patience', 'peu la patience'], answer: 0, why: 'Un peu + de.' },
    ],
  },
  {
    id: 'relatifs',
    cefr: 'B1',
    title: 'Les pronoms relatifs',
    summary: 'qui, que, dont, où — glue for grown-up sentences',
    explanation: {
      rule: "«qui» replaces the subject («l'ami qui habite ici»), «que» the object («le film que j'ai vu»), «où» a place or time («l'année où je suis né»), and «dont» anything built with de («le livre dont je parle»).",
      examples: [
        { fr: "C'est le café qui fait les meilleurs croissants.", en: "It's the café that makes the best croissants." },
        { fr: "Voilà la femme dont je t'ai parlé.", en: "There's the woman I told you about." },
        { fr: "Le jour où on s'est rencontrés, il pleuvait.", en: 'The day we met, it was raining.' },
      ],
      watchOut: "If the verb uses «de» (parler de, avoir besoin de, se souvenir de), the relative MUST be dont — «que je parle» is wrong.",
    },
    drills: [
      { q: "La ville ___ je préfère, c'est Lyon.", options: ['que', 'qui', 'dont'], answer: 0, why: 'Je préfère la ville → object → que.' },
      { q: "L'outil ___ j'ai besoin coûte cher.", options: ['dont', 'que', 'qui'], answer: 0, why: 'Avoir besoin DE → dont.' },
      { q: "Le quartier ___ j'habite est calme.", options: ['où', 'que', 'dont'], answer: 0, why: 'Place → où.' },
    ],
    build: [
      { fr: "C'est un plat que ma mère adore", en: "It's a dish my mother loves" },
      { fr: 'Le sujet dont on parle est délicat', en: 'The subject we are talking about is delicate' },
    ],
    quiz: [
      { q: "L'homme ___ conduit le bus est sympa.", options: ['qui', 'que', 'dont'], answer: 0, why: 'Subject of conduire → qui.' },
      { q: "Le résultat ___ je suis fier :", options: ['dont', 'que', 'qui'], answer: 0, why: 'Fier DE → dont.' },
      { q: "«The year I moved» =", options: ["l'année où j'ai déménagé", "l'année que j'ai déménagé", "l'année dont j'ai déménagé"], answer: 0, why: 'A moment in time → où.' },
      { q: 'Pick the correct sentence:', options: ["Le film que j'ai vu était long.", "Le film qui j'ai vu était long.", "Le film dont j'ai vu était long."], answer: 0, why: 'Voir takes a direct object → que.' },
    ],
  },
  {
    id: 'plus-que-parfait',
    cefr: 'B1',
    title: 'Le plus-que-parfait',
    summary: 'avait fait — the past before the past',
    explanation: {
      rule: "For an action completed BEFORE another past action: imparfait of avoir/être + past participle. «Quand je suis arrivé, le train était déjà parti» — the leaving happened first.",
      examples: [
        { fr: "Elle avait déjà mangé quand je l'ai appelée.", en: 'She had already eaten when I called her.' },
        { fr: "Nous étions partis avant l'orage.", en: 'We had left before the storm.' },
        { fr: "Il m'a rendu le livre que je lui avais prêté.", en: 'He gave me back the book I had lent him.' },
      ],
      watchOut: 'Same être/avoir split and agreement rules as the passé composé — just with imparfait auxiliaries.',
    },
    drills: [
      { q: "Quand tu es arrivé, on ___ déjà commencé.", options: ['avait', 'a', 'est'], answer: 0, why: 'Earlier past → plus-que-parfait: avait commencé.' },
      { q: "Elle ___ partie avant midi.", options: ['était', 'avait', 'est'], answer: 0, why: 'Partir takes être → était partie.' },
      { q: "Je ne savais pas que vous ___ vécu à Rome.", options: ['aviez', 'avez', 'êtes'], answer: 0, why: 'Vous + avoir imparfait → aviez vécu.' },
    ],
    build: [
      { fr: "Il avait oublié ses clés au bureau", en: 'He had left his keys at the office' },
      { fr: "On était déjà partis quand il a appelé", en: 'We had already left when he called' },
    ],
    quiz: [
      { q: "«I had never seen that» =", options: ["Je n'avais jamais vu ça", "Je n'ai jamais vu ça", "Je ne voyais jamais ça"], answer: 0, why: 'Had seen = plus-que-parfait.' },
      { q: 'Auxiliary tense in the plus-que-parfait:', options: ['imparfait', 'présent', 'futur'], answer: 0, why: 'Imparfait of avoir/être + participle.' },
      { q: "«Elles ___ arrivées en avance.»", options: ['étaient', 'avaient', 'sont'], answer: 0, why: 'Arriver → être; feminine plural agreement: arrivées.' },
      { q: 'Which happened first? «Le film avait commencé quand on est entrés.»', options: ['the film starting', 'us entering', 'they were simultaneous'], answer: 0, why: 'Plus-que-parfait marks the earlier event.' },
    ],
  },
  {
    id: 'gerondif',
    cefr: 'B1',
    title: 'Le gérondif',
    summary: 'en + -ant — doing two things at once',
    explanation: {
      rule: "«en» + present participle (nous stem + -ant) expresses simultaneity or means: «Je révise en écoutant de la musique» (while listening), «Il a appris en pratiquant» (by practising). Irregular participles: étant, ayant, sachant.",
      examples: [
        { fr: 'Elle est partie en claquant la porte.', en: 'She left, slamming the door.' },
        { fr: 'On apprend en faisant des erreurs.', en: 'You learn by making mistakes.' },
        { fr: 'Ne mange pas en parlant !', en: "Don't eat while talking!" },
      ],
      watchOut: 'The subject of both actions must be the same person — «En arrivant, le téléphone a sonné» is a classic dangling error.',
    },
    drills: [
      { q: 'Il chante ___ (prendre) sa douche.', options: ['en prenant', 'en prend', 'en pris'], answer: 0, why: 'Stem pren- + -ant.' },
      { q: "J'ai trouvé la réponse ___ (chercher) en ligne.", options: ['en cherchant', 'en cherche', 'à chercher'], answer: 0, why: 'Means → en + -ant.' },
      { q: 'Gérondif of «savoir»:', options: ['en sachant', 'en savant', 'en sait'], answer: 0, why: 'Irregular participle: sachant.' },
    ],
    build: [
      { fr: 'Je me détends en lisant le soir', en: 'I relax by reading in the evening' },
      { fr: 'Il est tombé en descendant du bus', en: 'He fell while getting off the bus' },
    ],
    quiz: [
      { q: '«while working» =', options: ['en travaillant', 'en travailler', 'à travaillant'], answer: 0, why: 'En + participle in -ant.' },
      { q: 'Gérondif of «être»:', options: ['en étant', 'en êtant', 'en soyant'], answer: 0, why: 'Irregular: étant.' },
      { q: 'Which sentence is correct?', options: ['Elle téléphone en conduisant.', 'Elle téléphone en conduire.', 'En conduisant, le feu est passé au rouge.'], answer: 0, why: 'Same subject does both actions.' },
      { q: '«He got rich by investing» =', options: ['Il est devenu riche en investissant.', 'Il est devenu riche à investir.', 'Il est devenu riche pour investir.'], answer: 0, why: 'Means → gérondif.' },
    ],
  },
  {
    id: 'passif',
    cefr: 'B1',
    title: 'La voix passive',
    summary: 'être + participle — when the action matters more than the actor',
    explanation: {
      rule: "être (in any tense) + past participle, agreeing with the subject: «La tour a été construite en 1889.» The doer, if mentioned, follows «par». Spoken French often prefers «on»: «On a volé mon vélo» rather than «Mon vélo a été volé».",
      examples: [
        { fr: 'Le musée est fermé le mardi.', en: 'The museum is closed on Tuesdays.' },
        { fr: 'Cette chanson a été écrite par Brel.', en: 'This song was written by Brel.' },
        { fr: 'Les résultats seront annoncés demain.', en: 'The results will be announced tomorrow.' },
      ],
      watchOut: 'Only verbs with a direct object can go passive — «téléphoner à» cannot: no «Je suis téléphoné».',
    },
    drills: [
      { q: 'La lettre ___ envoyée hier.', options: ['a été', 'a', 'est était'], answer: 0, why: 'Passé composé passive: a été + participle.' },
      { q: 'Ces gâteaux sont ___ par ma grand-mère.', options: ['faits', 'fait', 'faites'], answer: 0, why: 'Masculine plural agreement: faits.' },
      { q: 'Everyday alternative to «Mon sac a été volé»:', options: ['On a volé mon sac.', 'Mon sac a volé.', 'Quelqu\'un est volé mon sac.'], answer: 0, why: 'Spoken French prefers on + active.' },
    ],
    build: [
      { fr: 'Le dîner est préparé par le chef', en: 'Dinner is prepared by the chef' },
      { fr: 'La réunion a été annulée ce matin', en: 'The meeting was cancelled this morning' },
    ],
    quiz: [
      { q: '«The house will be sold» =', options: ['La maison sera vendue', 'La maison sera vendre', 'La maison a vendu'], answer: 0, why: 'Futur of être + participle with agreement.' },
      { q: 'Which verb cannot be made passive?', options: ['téléphoner à', 'construire', 'inviter'], answer: 0, why: 'No direct object → no passive.' },
      { q: 'The agent is introduced by:', options: ['par', 'de', 'avec'], answer: 0, why: '«…écrit par Hugo».' },
      { q: '«Elle a été invitée» — the participle ends in -ée because:', options: ['the subject is feminine', 'invitation is feminine', 'être always adds -e'], answer: 0, why: 'Passive participles agree with the subject.' },
    ],
  },
  {
    id: 'discours-indirect',
    cefr: 'B2',
    title: 'Le discours indirect',
    summary: 'Il a dit que… — reporting speech, shifting tenses',
    explanation: {
      rule: "After a past reporting verb, tenses slide back: présent → imparfait («Il a dit qu'il était fatigué»), passé composé → plus-que-parfait, futur → conditionnel. Questions use «si» (yes/no) or the question word; «est-ce que» disappears.",
      examples: [
        { fr: "Elle a dit qu'elle viendrait demain.", en: 'She said she would come tomorrow.' },
        { fr: "Il m'a demandé si j'avais faim.", en: 'He asked me if I was hungry.' },
        { fr: "Je lui ai demandé où il habitait.", en: 'I asked him where he lived.' },
      ],
      watchOut: "«Qu'est-ce que» becomes «ce que»: «Il demande ce que tu fais» — never «Il demande qu'est-ce que tu fais».",
    },
    drills: [
      { q: '«Je suis prêt» → Il a dit qu\'il ___ prêt.', options: ['était', 'est', 'serait'], answer: 0, why: 'Présent → imparfait after a past reporting verb.' },
      { q: '«Viendras-tu ?» → Elle a demandé si je ___.', options: ['viendrais', 'viendrai', 'venais'], answer: 0, why: 'Futur → conditionnel.' },
      { q: '«Qu\'est-ce que tu veux ?» → Il demande ___ tu veux.', options: ['ce que', 'qu\'est-ce que', 'que'], answer: 0, why: 'Qu\'est-ce que → ce que in reported speech.' },
    ],
    build: [
      { fr: "Elle a dit qu'elle avait tout compris", en: 'She said she had understood everything' },
      { fr: "Il m'a demandé si j'étais libre", en: 'He asked me if I was free' },
    ],
    quiz: [
      { q: '«J\'ai fini» reported:', options: ["Il a dit qu'il avait fini", "Il a dit qu'il a fini", "Il a dit qu'il finissait"], answer: 0, why: 'Passé composé → plus-que-parfait.' },
      { q: 'Yes/no questions are reported with:', options: ['si', 'que', 'quoi'], answer: 0, why: '«…demandé si…».' },
      { q: '«Où habites-tu ?» reported:', options: ['Il a demandé où j\'habitais', 'Il a demandé où est-ce que j\'habite', 'Il a demandé que j\'habitais où'], answer: 0, why: 'Question word stays, tense slides back.' },
      { q: '«demain» in reported past speech usually becomes:', options: ['le lendemain', 'hier', 'aujourd\'hui'], answer: 0, why: 'Time markers shift: demain → le lendemain.' },
    ],
  },
  {
    id: 'conditionnel-passe',
    cefr: 'B2',
    title: 'Le conditionnel passé',
    summary: "j'aurais dû — regrets, reproaches and what-ifs",
    explanation: {
      rule: "Conditionnel of avoir/être + past participle: «j'aurais aimé» (I would have liked), «tu aurais dû» (you should have), «il serait venu» (he would have come). Pairs with «si + plus-que-parfait»: «Si j'avais su, je serais resté.»",
      examples: [
        { fr: "J'aurais dû t'écouter.", en: 'I should have listened to you.' },
        { fr: "Sans toi, on n'aurait jamais réussi.", en: 'Without you, we would never have succeeded.' },
        { fr: "Elle serait venue si tu l'avais invitée.", en: 'She would have come if you had invited her.' },
      ],
      watchOut: "Never conditionnel after «si» — the si-clause takes plus-que-parfait: «Si j'aurais su» is the classic native-child error.",
    },
    drills: [
      { q: "Tu ___ me le dire ! (should have)", options: ['aurais dû', 'devais', 'as dû'], answer: 0, why: 'Reproach → conditionnel passé of devoir.' },
      { q: "Si j'avais su, je ne ___ pas venu.", options: ['serais', 'suis', 'étais'], answer: 0, why: 'Result clause → conditionnel passé; venir takes être.' },
      { q: "On ___ aimé rester plus longtemps.", options: ['aurait', 'aura', 'avait'], answer: 0, why: 'Would have liked → aurait aimé.' },
    ],
    build: [
      { fr: "J'aurais voulu être artiste", en: 'I would have liked to be an artist' },
      { fr: 'Sans la pluie on serait sortis', en: 'Without the rain we would have gone out' },
    ],
    quiz: [
      { q: '«She would have said yes» =', options: ['Elle aurait dit oui', 'Elle aura dit oui', 'Elle avait dit oui'], answer: 0, why: 'Conditionnel passé: aurait + participle.' },
      { q: 'Correct si-clause:', options: ["Si tu étais venu, on aurait gagné.", "Si tu serais venu, on aurait gagné.", "Si tu venais, on aurait gagné."], answer: 0, why: 'Si + plus-que-parfait → conditionnel passé.' },
      { q: '«you shouldn\'t have» =', options: ["tu n'aurais pas dû", 'tu ne devais pas', "tu n'as pas dû"], answer: 0, why: 'Reproach about the past → conditionnel passé of devoir.' },
      { q: '«Ils seraient partis» — être because:', options: ['partir is an être verb', 'ils is plural', 'the sentence is negative'], answer: 0, why: 'Same auxiliary rules as the passé composé.' },
    ],
  },
  {
    id: 'connecteurs',
    cefr: 'B2',
    title: 'Les connecteurs logiques',
    summary: 'pourtant, donc, ainsi, en revanche — the argument builders',
    explanation: {
      rule: "Cause: car, puisque, comme. Consequence: donc, du coup (spoken), c'est pourquoi. Opposition: mais, pourtant, en revanche, alors que. Concession: bien que (+subjonctif), malgré (+noun), quand même.",
      examples: [
        { fr: "Il pleuvait, pourtant on est sortis.", en: 'It was raining, yet we went out.' },
        { fr: "Comme tu n'étais pas là, j'ai commencé sans toi.", en: "Since you weren't there, I started without you." },
        { fr: "Le projet est risqué ; en revanche, il peut tout changer.", en: 'The project is risky; on the other hand, it could change everything.' },
      ],
      watchOut: "«malgré» takes a noun, never a clause: «malgré la pluie» ✓, «malgré qu'il pleut» is widely heard but still considered incorrect.",
    },
    drills: [
      { q: "Il est malade, ___ il est venu travailler.", options: ['pourtant', 'donc', 'car'], answer: 0, why: 'Opposition between illness and coming in → pourtant.' },
      { q: "___ il était tard, on a pris un taxi.", options: ['Comme', 'Pourtant', 'Donc'], answer: 0, why: 'Cause in first position → comme.' },
      { q: "J'ai raté le bus, ___ je suis arrivé en retard.", options: ['du coup', 'malgré', 'bien que'], answer: 0, why: 'Spoken consequence → du coup.' },
    ],
    build: [
      { fr: 'Il fait froid donc je reste chez moi', en: 'It is cold so I am staying home' },
      { fr: 'Malgré la grève le train est parti', en: 'Despite the strike the train left' },
    ],
    quiz: [
      { q: '«bien que» is followed by:', options: ['the subjunctive', 'the infinitive', 'the future'], answer: 0, why: 'Bien que + subjonctif: «bien qu\'il soit tard».' },
      { q: 'Formal «on the other hand»:', options: ['en revanche', 'du coup', 'car'], answer: 0, why: 'En revanche is the polished opposition marker.' },
      { q: 'Correct use of malgré:', options: ['malgré le bruit', "malgré qu'il y a du bruit", 'malgré il y a du bruit'], answer: 0, why: 'Malgré + noun only.' },
      { q: '«puisque» introduces:', options: ['a cause both speakers know', 'a surprise', 'a consequence'], answer: 0, why: 'Puisque = since (shared knowledge).' },
    ],
  },
  {
    id: 'adverbes',
    cefr: 'A2',
    title: 'Les adverbes en -ment',
    summary: 'lentement, vraiment — building and placing adverbs',
    explanation: {
      rule: "Most adverbs: feminine adjective + -ment (lente → lentement, heureuse → heureusement). Adjectives ending in a vowel use the masculine (vrai → vraiment). -ant/-ent become -amment/-emment (courant → couramment, évident → évidemment). Short adverbs follow the verb: «Je parle bien français».",
      examples: [
        { fr: 'Elle parle couramment trois langues.', en: 'She speaks three languages fluently.' },
        { fr: 'Franchement, je ne sais pas.', en: "Frankly, I don't know." },
        { fr: 'Il conduit prudemment.', en: 'He drives carefully.' },
      ],
      watchOut: 'In compound tenses, common short adverbs sit between auxiliary and participle: «J\'ai bien dormi», not «J\'ai dormi bien».',
    },
    drills: [
      { q: 'Adverb of «facile»:', options: ['facilement', 'facilment', 'facileament'], answer: 0, why: 'Ends in vowel → facile + ment.' },
      { q: 'Adverb of «évident»:', options: ['évidemment', 'évidentment', 'évidament'], answer: 0, why: '-ent → -emment (pronounced -amment).' },
      { q: '«I slept well» =', options: ["J'ai bien dormi", "J'ai dormi bien", 'Je bien ai dormi'], answer: 0, why: 'Short adverb between avoir and participle.' },
    ],
    build: [
      { fr: 'Il répond toujours très poliment', en: 'He always answers very politely' },
      { fr: 'Elle a vraiment aimé le concert', en: 'She really liked the concert' },
    ],
    quiz: [
      { q: 'Adverb of «courant»:', options: ['couramment', 'courantment', 'couremment'], answer: 0, why: '-ant → -amment.' },
      { q: 'Adverb of «heureux»:', options: ['heureusement', 'heureuxment', 'heurement'], answer: 0, why: 'Feminine heureuse + -ment.' },
      { q: 'Pick the natural word order:', options: ['On a déjà mangé.', 'On a mangé déjà.', 'Déjà on a mangé.'], answer: 0, why: 'Déjà slots inside the compound verb.' },
      { q: '«gentiment» comes from:', options: ['gentil', 'gentiment', 'gens'], answer: 0, why: 'Gentil → gentiment (slightly irregular).' },
    ],
  },
  {
    id: 'accord-participe',
    cefr: 'B2',
    title: 'L\'accord du participe passé',
    summary: 'the agreement rules everyone fears — tamed',
    explanation: {
      rule: "With être, the participle agrees with the subject: «Elle est partie». With avoir, it agrees ONLY with a direct object placed BEFORE the verb: «Les fleurs que j'ai achetées» (que = les fleurs, before → -es), but «J'ai acheté des fleurs» (object after → no agreement).",
      examples: [
        { fr: 'Elles sont arrivées hier soir.', en: 'They (f) arrived last night.' },
        { fr: "Voici les photos que j'ai prises.", en: 'Here are the photos I took.' },
        { fr: "Cette lettre, je l'ai écrite ce matin.", en: 'This letter — I wrote it this morning.' },
      ],
      watchOut: "With pronominal verbs, no agreement when the reflexive pronoun is an INDIRECT object: «Elles se sont lavé les mains» (lavé quoi ? les mains, after → invariable).",
    },
    drills: [
      { q: 'La tarte que tu as ___ était délicieuse.', options: ['faite', 'fait', 'faits'], answer: 0, why: 'Que = la tarte, before the verb → feminine agreement.' },
      { q: "Elles sont ___ à midi.", options: ['venues', 'venu', 'venus'], answer: 0, why: 'Être → agreement with elles.' },
      { q: "J'ai ___ des erreurs.", options: ['fait', 'faites', 'faite'], answer: 0, why: 'Direct object after the verb → no agreement.' },
    ],
    build: [
      { fr: 'Les clés que j\'ai perdues étaient neuves', en: 'The keys I lost were new' },
      { fr: 'Elle s\'est coupé le doigt', en: 'She cut her finger' },
    ],
    quiz: [
      { q: '«Les chansons qu\'il a ___»', options: ['écrites', 'écrit', 'écrite'], answer: 0, why: 'Qu\' = les chansons (f pl), before → écrites.' },
      { q: '«Elle s\'est lavée» vs «Elle s\'est lavé les mains» — the second has no agreement because:', options: ['the direct object (les mains) follows the verb', 'mains is masculine', 'laver is irregular'], answer: 0, why: 'Se is indirect there; the real object comes after.' },
      { q: '«Nous avons ___ nos places.» =', options: ['réservé', 'réservés', 'réservées'], answer: 0, why: 'Object after avoir → invariable.' },
      { q: '«Ils se sont téléphoné» takes no -s because:', options: ['téléphoner à = indirect object', 'ils is masculine', 'the verb is irregular'], answer: 0, why: 'Se = à qui → indirect → no agreement.' },
    ],
  },
];
