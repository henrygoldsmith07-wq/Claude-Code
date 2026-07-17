// Reading library: CEFR-graded texts across five kinds — graded readers,
// a branching interactive story, magazine articles, news, and a public-
// domain classic. Every text supports dual-language display, per-word
// tap-to-translate (via its gloss + the shared dictionary), and most carry
// a comprehension quiz.

export const READING_KINDS = [
  { id: 'reader', title: 'Graded readers', description: 'Simple stories written for your level' },
  { id: 'story', title: 'Interactive stories', description: 'You choose what happens next' },
  { id: 'article', title: 'Articles', description: 'Magazine-style features' },
  { id: 'news', title: 'News', description: 'Short items, journalistic register' },
  { id: 'book', title: 'Books', description: 'Classics from the public domain' },
];

export const READING_TEXTS = [
  {
    id: 'read-lyon',
    kind: 'reader',
    cefr: 'A2',
    title: 'Un week-end à Lyon',
    description: 'Two friends, one city, too much food.',
    paragraphs: [
      {
        fr: "Samedi matin, Léa et Thomas arrivent à Lyon en train. Il fait beau. Ils laissent leurs sacs à l'hôtel et partent visiter la vieille ville.",
        en: 'Saturday morning, Léa and Thomas arrive in Lyon by train. The weather is nice. They leave their bags at the hotel and set off to visit the old town.',
      },
      {
        fr: "À midi, ils ont faim. Thomas veut manger dans un bouchon, un petit restaurant typique de Lyon. Léa commande une salade, mais Thomas choisit un plat très copieux. « Tu vas voir, dit-il, la cuisine lyonnaise, c'est sérieux ! »",
        en: 'At noon, they are hungry. Thomas wants to eat in a "bouchon", a small restaurant typical of Lyon. Léa orders a salad, but Thomas chooses a very hearty dish. "You\'ll see," he says, "Lyonnais cooking is serious business!"',
      },
      {
        fr: "Le soir, ils montent à Fourvière pour voir la ville d'en haut. Les lumières s'allument doucement. « Alors, tu es content de ton week-end ? » demande Léa. Thomas sourit : « Oui, mais j'ai encore faim. »",
        en: 'In the evening, they go up to Fourvière to see the city from above. The lights come on slowly. "So, happy with your weekend?" asks Léa. Thomas smiles: "Yes, but I\'m hungry again."',
      },
    ],
    gloss: {
      bouchon: 'traditional Lyonnais restaurant',
      copieux: 'hearty, generous (of a meal)',
      "s'allument": 'light up',
      doucement: 'slowly, gently',
      sourit: 'smiles',
    },
    questions: [
      { q: 'What is a "bouchon"?', options: ['A typical Lyon restaurant', 'A famous bridge', 'A kind of wine'], answer: 0 },
      { q: 'Why do they go up to Fourvière?', options: ['To see the city from above', 'To catch a train', 'To eat dinner'], answer: 0 },
    ],
  },
  {
    id: 'story-porte',
    kind: 'story',
    cefr: 'B1',
    title: 'La porte bleue',
    description: 'A mysterious door appears in your building. You decide what happens.',
    start: 'n1',
    nodes: {
      n1: {
        paragraphs: [
          {
            fr: "Un mardi soir, en rentrant chez vous, vous remarquez une porte bleue au fond du couloir. Elle n'était pas là hier. Une petite carte est collée dessus : « Entrez sans frapper. »",
            en: "One Tuesday evening, coming home, you notice a blue door at the end of the corridor. It wasn't there yesterday. A small card is stuck to it: \"Come in without knocking.\"",
          },
        ],
        choices: [
          { label: "Vous ouvrez la porte. — You open the door.", next: 'n2' },
          { label: "Vous frappez d'abord, par politesse. — You knock first, to be polite.", next: 'n3' },
        ],
      },
      n2: {
        paragraphs: [
          {
            fr: "Derrière la porte, un escalier descend vers une lumière chaude. Une odeur de café et de vieux livres monte vers vous. En bas, une librairie immense s'étend à perte de vue — impossible, vu la taille de l'immeuble.",
            en: 'Behind the door, a staircase leads down toward a warm light. A smell of coffee and old books drifts up. Below, an immense bookshop stretches as far as the eye can see — impossible, given the size of the building.',
          },
        ],
        choices: [
          { label: "Vous descendez l'escalier. — You go down the stairs.", next: 'n4' },
          { label: "Vous refermez la porte, troublé(e). — You close the door, shaken.", next: 'n5' },
        ],
      },
      n3: {
        paragraphs: [
          {
            fr: "Vous frappez trois coups. La carte se décolle et tombe. Au dos, quelqu'un a écrit à la main : « On avait dit SANS frapper. Tant pis. Revenez mardi prochain. » Quand vous relevez la tête, la porte a disparu.",
            en: 'You knock three times. The card peels off and falls. On the back, someone has handwritten: "We said WITHOUT knocking. Too bad. Come back next Tuesday." When you look up, the door has vanished.',
          },
        ],
        choices: [{ label: "Attendre mardi prochain… — Wait for next Tuesday…", next: 'n1' }],
        ending: 'Fin (pour l’instant) — an ending, for now.',
      },
      n4: {
        paragraphs: [
          {
            fr: "En bas, une vieille dame vous attend derrière un comptoir. « Enfin ! dit-elle. Chaque livre ici raconte la vie que vous n'avez pas vécue. Vous pouvez en lire un seul. Choisissez bien. »",
            en: '"At last!" says an old woman behind a counter. "Every book here tells the life you didn\'t live. You may read only one. Choose well."',
          },
        ],
        ending: "Fin — vous choisissez un livre. Lequel ? À vous d'écrire la suite.",
      },
      n5: {
        paragraphs: [
          {
            fr: "Vous refermez la porte et rentrez chez vous. Toute la nuit, l'odeur du café et des vieux livres flotte dans l'appartement. Au matin, sous votre porte, quelqu'un a glissé une carte : « Elle sera là mardi prochain. »",
            en: 'You close the door and go home. All night, the smell of coffee and old books lingers in the flat. In the morning, someone has slipped a card under your door: "It will be there next Tuesday."',
          },
        ],
        ending: 'Fin — mais les mardis, maintenant, vous rentrez tôt.',
      },
    },
    gloss: {
      couloir: 'corridor, hallway',
      collée: 'stuck, glued',
      frapper: 'to knock',
      escalier: 'staircase',
      'à perte de vue': 'as far as the eye can see',
      troublé: 'shaken, unsettled',
      comptoir: 'counter',
    },
  },
  {
    id: 'art-boulangerie',
    kind: 'article',
    cefr: 'B2',
    title: 'La boulangerie, une passion française',
    description: 'Why the bakery remains the heart of every French street.',
    paragraphs: [
      {
        fr: "Chaque matin, six millions de Français poussent la porte d'une boulangerie. Ce geste quotidien, presque machinal, en dit long sur le rapport du pays à son pain. La baguette n'est pas un simple aliment : c'est un rituel, un repère, parfois même un sujet de dispute nationale.",
        en: "Every morning, six million French people push open a bakery door. This daily, almost automatic gesture says a lot about the country's relationship with its bread. The baguette is not just food: it is a ritual, a landmark, sometimes even a subject of national dispute.",
      },
      {
        fr: "Car tout le monde a son avis : bien cuite ou pas trop, tradition ou classique, croûte craquante ou mie moelleuse. Les boulangers, eux, se lèvent à quatre heures du matin pour défendre un savoir-faire inscrit, depuis 2022, au patrimoine immatériel de l'UNESCO.",
        en: 'Because everyone has an opinion: well-baked or not too much, "tradition" or classic, crackly crust or soft crumb. The bakers, for their part, get up at four in the morning to defend a craft inscribed, since 2022, on UNESCO\'s intangible heritage list.',
      },
      {
        fr: "Pourtant, le métier attire de moins en moins de jeunes, et des milliers de villages n'ont plus de boulangerie du tout. Alors, la prochaine fois que vous achetez une baguette, regardez-la autrement : vous tenez un morceau de culture entre les mains.",
        en: 'Yet the trade attracts fewer and fewer young people, and thousands of villages no longer have a bakery at all. So next time you buy a baguette, look at it differently: you are holding a piece of culture in your hands.',
      },
    ],
    gloss: {
      machinal: 'automatic, mechanical',
      repère: 'landmark, reference point',
      croûte: 'crust',
      mie: 'the soft inside of bread',
      moelleuse: 'soft, fluffy',
      'savoir-faire': 'craft, expertise',
      patrimoine: 'heritage',
      métier: 'trade, profession',
    },
    questions: [
      { q: 'What happened in 2022?', options: ['The baguette joined UNESCO heritage', 'Bakeries went on strike', 'Bread prices doubled'], answer: 0 },
      { q: 'What problem does the article mention?', options: ['Fewer young people join the trade', 'Flour shortages', 'Too many bakeries'], answer: 0 },
    ],
  },
  {
    id: 'news-greve',
    kind: 'news',
    cefr: 'B1',
    title: 'Transports : la grève reconduite',
    description: 'A short wire piece, journalistic register.',
    paragraphs: [
      {
        fr: "Les syndicats de contrôleurs ont annoncé lundi la reconduction de la grève pour une durée de quarante-huit heures. Sur les grandes lignes, un train sur trois circulera en moyenne, selon la direction.",
        en: 'The inspectors\' unions announced on Monday that the strike would be extended for forty-eight hours. On main lines, one train in three will run on average, according to management.',
      },
      {
        fr: "Les négociations, suspendues vendredi, doivent reprendre mercredi matin. En attendant, les voyageurs sont invités à reporter leurs déplacements ou à privilégier le covoiturage. Les billets des trains annulés seront intégralement remboursés.",
        en: 'Negotiations, suspended on Friday, are due to resume Wednesday morning. In the meantime, travellers are advised to postpone their journeys or opt for carpooling. Tickets for cancelled trains will be fully refunded.',
      },
    ],
    gloss: {
      syndicats: 'trade unions',
      reconduction: 'extension, renewal',
      circulera: 'will run',
      reporter: 'to postpone',
      covoiturage: 'carpooling',
      remboursés: 'refunded',
    },
    questions: [
      { q: 'How long is the strike extended for?', options: ['48 hours', '24 hours', 'One week'], answer: 0 },
      { q: 'What happens to cancelled-train tickets?', options: ['Fully refunded', 'Exchanged only', 'Lost'], answer: 0 },
    ],
  },
  {
    id: 'book-corbeau',
    kind: 'book',
    cefr: 'B2',
    title: 'Le Corbeau et le Renard — Jean de La Fontaine (1668)',
    description: 'The classic fable every French child knows by heart. Public domain.',
    paragraphs: [
      {
        fr: "Maître Corbeau, sur un arbre perché,\nTenait en son bec un fromage.\nMaître Renard, par l'odeur alléché,\nLui tint à peu près ce langage :\n« Hé ! bonjour, Monsieur du Corbeau.\nQue vous êtes joli ! que vous me semblez beau !",
        en: 'Master Crow, perched on a tree,\nHeld a cheese in his beak.\nMaster Fox, drawn by the smell,\nAddressed him more or less like this:\n"Hey! Good day, Sir Crow.\nHow pretty you are! How handsome you seem!',
      },
      {
        fr: "Sans mentir, si votre ramage\nSe rapporte à votre plumage,\nVous êtes le Phénix des hôtes de ces bois. »\nÀ ces mots le Corbeau ne se sent pas de joie ;\nEt pour montrer sa belle voix,\nIl ouvre un large bec, laisse tomber sa proie.",
        en: 'Truly, if your song\nMatches your plumage,\nYou are the Phoenix of these woods."\nAt these words the Crow is beside himself with joy;\nAnd to show off his fine voice,\nHe opens a wide beak, and drops his prize.',
      },
      {
        fr: "Le Renard s'en saisit, et dit : « Mon bon Monsieur,\nApprenez que tout flatteur\nVit aux dépens de celui qui l'écoute :\nCette leçon vaut bien un fromage, sans doute. »\nLe Corbeau, honteux et confus,\nJura, mais un peu tard, qu'on ne l'y prendrait plus.",
        en: 'The Fox seizes it and says: "My good sir,\nLearn that every flatterer\nLives at the expense of the one who listens to him:\nThis lesson is surely worth a cheese."\nThe Crow, ashamed and embarrassed,\nSwore — though a little late — that he would not be caught again.',
      },
    ],
    gloss: {
      perché: 'perched',
      bec: 'beak',
      alléché: 'enticed, tempted (by a smell)',
      ramage: 'birdsong (literary)',
      plumage: 'plumage, feathers',
      proie: 'prey, prize',
      flatteur: 'flatterer',
      'aux dépens de': 'at the expense of',
      honteux: 'ashamed',
    },
    questions: [
      { q: 'How does the Fox get the cheese?', options: ['By flattering the Crow into singing', 'By climbing the tree', 'By trading for it'], answer: 0 },
      { q: 'What is the moral?', options: ['Flatterers live at their listener\'s expense', 'Never share food', 'Crows sing beautifully'], answer: 0 },
    ],
  },
];

export const getText = (id) => READING_TEXTS.find((t) => t.id === id) || null;
