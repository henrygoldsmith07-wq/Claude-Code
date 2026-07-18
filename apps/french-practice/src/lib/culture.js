// Cultural learning content: eight themed sections of French culture, each
// with short notes, a useful phrase or two (spoken via TTS in the UI) and a
// "did you know" hook. Content is authored, factual and self-contained —
// no external media, in keeping with the app's no-backend design.

export const CULTURE_SECTIONS = [
  { id: 'notes', title: 'Cultural notes', emoji: '💡', blurb: 'The unspoken rules that shape daily life' },
  { id: 'customs', title: 'Customs', emoji: '🤝', blurb: 'Rituals from the apéro to the galette' },
  { id: 'etiquette', title: 'Etiquette', emoji: '🎩', blurb: 'Politeness that opens (and closes) doors' },
  { id: 'festivals', title: 'Festivals', emoji: '🎉', blurb: 'The calendar of fêtes worth knowing' },
  { id: 'food', title: 'Food', emoji: '🍽️', blurb: 'How France eats, and in what order' },
  { id: 'history', title: 'History', emoji: '📜', blurb: 'From the Gauls to the Fifth Republic' },
  { id: 'geography', title: 'Geography', emoji: '🗺️', blurb: 'The Hexagone and beyond' },
  { id: 'regional', title: 'Regional differences', emoji: '🧭', blurb: 'One country, many Frances' },
];

// entry: { id, section, title, emoji, body, phrase?: {fr, en}, tip }
const e = (id, section, title, emoji, body, phrase, tip) =>
  ({ id, section, title, emoji, body, phrase, tip });

export const CULTURE_ENTRIES = [
  // ---- cultural notes ----
  e('notes-bise', 'notes', 'La bise', '😘',
    'Friends and family greet with a light cheek kiss — usually two, but the count varies by region (up to four in parts of the north). It is a social reflex, not romantic, and colleagues often shake hands instead.',
    { fr: 'On se fait la bise ?', en: 'Shall we kiss cheeks (as a greeting)?' },
    'When unsure, offer a hand and follow the other person’s lead.'),
  e('notes-tu-vous', 'notes', 'Tu or vous', '🫵',
    '«Vous» is the default with strangers, elders and in any professional setting; «tu» is for friends, family, children and peers once invited. Switching to «tu» is a small milestone — often proposed explicitly.',
    { fr: 'On peut se tutoyer ?', en: 'Can we use “tu” with each other?' },
    'Staying on «vous» a bit too long is far safer than «tu» too soon.'),
  e('notes-dimanche', 'notes', 'Le dimanche', '🛌',
    'Sunday is still a day of rest: most shops close, and many towns are quiet. A long Sunday lunch with family is a cherished institution rather than an afterthought.',
    { fr: 'Tout est fermé le dimanche.', en: 'Everything is closed on Sunday.' },
    'Do your shopping Saturday — Sunday mornings only the boulangerie is reliably open.'),
  e('notes-laicite', 'notes', 'La laïcité', '⚖️',
    'Secularism is a core republican value: the state stays strictly neutral on religion, which is treated as a private matter. It shapes debates on schools, symbols and public life.',
    null,
    'Religion and salary are both considered private — not first-date small talk.'),

  // ---- customs ----
  e('customs-apero', 'customs', "L'apéro", '🥂',
    'The apéritif — a drink and nibbles before dinner — is a social ritual in its own right. «Prendre l’apéro» can stretch for an hour and is often the real point of the evening.',
    { fr: 'Tu viens prendre l’apéro ?', en: 'Want to come for a pre-dinner drink?' },
    'Bringing something to share (olives, chips, a bottle) is always welcome.'),
  e('customs-pain', 'customs', 'Le pain à table', '🥖',
    'Bread accompanies the whole meal, resting directly on the tablecloth beside your plate, and is used to push food and mop up sauce (la saucer). It is rarely eaten with butter at dinner.',
    { fr: 'Tu peux me passer le pain ?', en: 'Can you pass me the bread?' },
    'Tear off bite-size pieces rather than biting into the whole chunk.'),
  e('customs-fleurs', 'customs', 'Offering flowers', '💐',
    'Flowers make a classic host gift, but give an odd number, and never chrysanthemums (for graves on Toussaint) or red roses (romantic). Bring wine only if you know the host’s taste.',
    { fr: 'C’est pour vous, merci de l’invitation.', en: 'These are for you, thanks for the invitation.' },
    'A boxed dessert from a good pâtisserie is a safe, appreciated alternative.'),
  e('customs-galette', 'customs', 'La galette des rois', '👑',
    'Each January, families share a galette hiding a small charm (la fève). Whoever finds it is crowned king or queen for the day. The youngest child traditionally calls out who gets each slice from under the table.',
    { fr: 'J’ai eu la fève !', en: 'I got the charm!' },
    'Sold all through January — you’ll eat several before Candlemas.'),

  // ---- etiquette ----
  e('etiquette-bonjour', 'etiquette', 'Always say bonjour', '🙋',
    'Entering a shop, waiting room or lift, greet with «Bonjour» before anything else. Skipping it and going straight to a request reads as rude. Say «Bonjour messieurs-dames» to a group.',
    { fr: 'Bonjour, je voudrais un renseignement.', en: 'Hello, I’d like some information.' },
    'After 6pm switch to «Bonsoir»; leave with «Bonne journée / soirée».'),
  e('etiquette-table', 'etiquette', 'Table manners', '🍴',
    'Keep both hands (not elbows) visible on the table, wait for «Bon appétit», and keep bread on the cloth. Finish what’s on your plate — leaving food can seem wasteful.',
    { fr: 'Bon appétit !', en: 'Enjoy your meal!' },
    'The host says «Bon appétit» first; you can reply «Merci, de même».'),
  e('etiquette-merci', 'etiquette', '«S’il vous plaît» & «merci»', '🙏',
    'Politeness formulas are non-negotiable, and «pardon» / «excusez-moi» smooth every small interruption. A warm «Merci beaucoup, au revoir, bonne journée !» closes shop visits.',
    { fr: 'Excusez-moi de vous déranger.', en: 'Sorry to bother you.' },
    'Over-thanking is normal — French service is a two-way courtesy.'),
  e('etiquette-quart', 'etiquette', 'Le quart d’heure', '⏱️',
    'For casual dinners, arriving 10–15 minutes late — «le quart d’heure de politesse» — is polite, giving the host time. For professional meetings and trains, be exactly on time.',
    { fr: 'Je serai là vers 20h.', en: 'I’ll be there around 8pm.' },
    'Never arrive early to a home dinner — the host may not be ready.'),

  // ---- festivals ----
  e('festivals-14juillet', 'festivals', 'Le 14 juillet', '🎆',
    'The Fête nationale marks the 1789 storming of the Bastille. Expect a military parade on the Champs-Élysées, town firemen’s balls (les bals des pompiers) the night before, and fireworks everywhere.',
    { fr: 'On va voir le feu d’artifice ?', en: 'Shall we go watch the fireworks?' },
    'The French say «le 14 juillet», not «Bastille Day» — that’s an English coinage.'),
  e('festivals-musique', 'festivals', 'La Fête de la Musique', '🎶',
    'Every 21 June, amateurs and pros play free in streets, cafés and squares across the country. Started in France in 1982, it now happens worldwide on the summer solstice.',
    { fr: 'Il y a de la musique partout ce soir.', en: 'There’s music everywhere tonight.' },
    'Anyone can perform — cities turn into one big open-air stage.'),
  e('festivals-noel', 'festivals', 'Noël & le réveillon', '🎄',
    'The main celebration is the long dinner on Christmas Eve (le réveillon), often with oysters, foie gras and a bûche de Noël. Children leave shoes by the tree for Père Noël.',
    { fr: 'Joyeux Noël et bonne année !', en: 'Merry Christmas and happy new year!' },
    'A second réveillon on 31 December sees in the new year with more feasting.'),
  e('festivals-chandeleur', 'festivals', 'La Chandeleur', '🥞',
    'On 2 February, everyone makes crêpes. Tradition says to flip one with a coin in your other hand for a year of prosperity. 1 April is «poisson d’avril», when children stick paper fish on backs.',
    { fr: 'On fait des crêpes pour la Chandeleur.', en: 'We make crêpes for Candlemas.' },
    'Round, golden crêpes are said to symbolise the returning sun.'),

  // ---- food ----
  e('food-repas', 'food', 'The shape of a meal', '🍽️',
    'A proper meal runs entrée (starter), plat (main), then cheese, then dessert — cheese comes before something sweet, not after. Lunch is often the substantial meal, especially outside cities.',
    { fr: 'Vous prenez une entrée et un plat ?', en: 'Will you have a starter and a main?' },
    'The «formule» (set menu) is the good-value way to eat this sequence at lunch.'),
  e('food-fromage', 'food', 'Le fromage', '🧀',
    'With hundreds of cheeses, France serves a cheese course on its own, eaten with bread and no crackers. Cut wedge cheeses toward the point so everyone shares the rind fairly.',
    { fr: 'Un peu de fromage avant le dessert ?', en: 'A little cheese before dessert?' },
    'De Gaulle joked you can’t govern a country with 246 cheeses.'),
  e('food-boulangerie', 'food', 'La boulangerie', '🥖',
    'The neighbourhood bakery is daily life. A «baguette tradition» is made to a legal recipe with no additives. Bakers take turns closing so a quartier is never without bread.',
    { fr: 'Une baguette tradition, s’il vous plaît.', en: 'One traditional baguette, please.' },
    'Buy bread last on your errands so it’s still warm at the table.'),
  e('food-cafe', 'food', 'Café culture', '☕',
    'Order «un café» and you get an espresso; «un crème» is with milk, mostly a morning drink. Prices rise from the counter (au comptoir) to the terrace. You can linger for ages over one cup.',
    { fr: 'Un café et l’addition, s’il vous plaît.', en: 'A coffee and the bill, please.' },
    'Table service means you pay as you leave — flag the waiter for «l’addition».'),

  // ---- history ----
  e('history-gaulois', 'history', 'Les Gaulois', '🗡️',
    'Before Rome, Gaul was home to Celtic tribes. Vercingétorix united them but fell to Julius Caesar at Alésia in 52 BC. The plucky Gaul is a national self-image — think Astérix.',
    null,
    '«Nos ancêtres les Gaulois» was long the opening line of history lessons.'),
  e('history-1789', 'history', 'La Révolution', '🎭',
    'The 1789 Revolution toppled the monarchy and proclaimed «Liberté, Égalité, Fraternité» and the Declaration of the Rights of Man. It remains the founding event of the modern Republic.',
    { fr: 'Liberté, Égalité, Fraternité', en: 'Liberty, Equality, Fraternity' },
    'You’ll see that motto on every town hall (mairie) and coin.'),
  e('history-napoleon', 'history', 'Napoléon', '🎖️',
    'Rising from the Revolution, Napoléon Bonaparte crowned himself Emperor in 1804, redrew Europe’s map, and left the Code civil that still underpins French law.',
    null,
    'The Arc de Triomphe was commissioned to honour his armies.'),
  e('history-resistance', 'history', 'La Résistance', '✊',
    'After the 1940 defeat, de Gaulle’s June 18 radio appeal from London rallied resistance to occupation. 1944’s Liberation and the post-war Fifth Republic (1958) shaped today’s France.',
    { fr: 'le 8 mai 1945', en: 'V-E Day (8 May 1945)' },
    '8 May and 11 November are public holidays commemorating the world wars.'),

  // ---- geography ----
  e('geo-hexagone', 'geography', "L'Hexagone", '⬡',
    'Mainland France is nicknamed «l’Hexagone» for its roughly six-sided shape, bounded by three seas and three mountain ranges. «Métropole» means the mainland as opposed to overseas territories.',
    { fr: 'Il habite en métropole.', en: 'He lives in mainland France.' },
    'You’ll hear «l’Hexagone» used to mean “France” in the news.'),
  e('geo-fleuves', 'geography', 'Rivers & regions', '🏞️',
    'Four great rivers organise the land: the Seine, Loire, Garonne and Rhône. Since 2016 the mainland has 13 large regions, each with a strong identity and cuisine.',
    null,
    'The Loire’s valley of châteaux is a UNESCO-listed stretch.'),
  e('geo-domtom', 'geography', 'Outre-mer', '🌴',
    'France extends far beyond Europe: Guadeloupe, Martinique, Guyane, Réunion, Mayotte and more are full parts of the Republic. Thanks to them, France borders Brazil and spans many time zones.',
    { fr: 'la France d’outre-mer', en: 'overseas France' },
    'It gives France the second-largest maritime territory in the world.'),
  e('geo-paris', 'geography', 'Paris & beyond', '🗼',
    'Paris spirals out in 20 arrondissements from the Louvre. But «la province» — everywhere that isn’t Paris — is where regional life and pride truly sit, a distinction Parisians and others both feel.',
    { fr: 'Tu montes à Paris ?', en: 'Are you heading up to Paris?' },
    'One always «monte à Paris» and «descend en province», whatever the map says.'),

  // ---- regional differences ----
  e('regional-langues', 'regional', 'Regional languages', '🗣️',
    'Beside French, historic tongues live on: Breton in Brittany, Alsatian near Germany, Occitan and Basque in the south, Corsican on the island. Many survive in place names and road signs.',
    { fr: 'Kenavo ! (au revoir en breton)', en: 'Goodbye! (in Breton)' },
    'Bilingual signage is common in Brittany and the Basque Country.'),
  e('regional-chocolatine', 'regional', 'Pain au chocolat?', '🥐',
    'The same pastry is «pain au chocolat» in most of France but «chocolatine» in the south-west — a rivalry locals defend fiercely and joke about endlessly.',
    { fr: 'C’est une chocolatine, pas un pain au chocolat !', en: 'It’s a “chocolatine”, not a “pain au chocolat”!' },
    'Ask which they say — it instantly places where someone grew up.'),
  e('regional-nombres', 'regional', 'Counting differently', '🔢',
    'France says «soixante-dix, quatre-vingts, quatre-vingt-dix» (70/80/90), but Belgium and Switzerland use the tidier «septante, huitante/octante, nonante».',
    { fr: 'septante-cinq (75 en Belgique)', en: 'seventy-five (75 in Belgium)' },
    'Swiss French also says «huitante» for 80 in several cantons.'),
  e('regional-nord-sud', 'regional', 'North & south', '☀️',
    'The sunny Midi brings a lilting accent, olive-oil cooking and pétanque; the north leans to butter, beer and the warm «ch’ti» dialect. Pace, food and even greetings shift as you travel.',
    { fr: 'Il a l’accent du Midi.', en: 'He has a southern accent.' },
    'The film «Bienvenue chez les Ch’tis» gently mines this north–south gap.'),
];

export const getSectionEntries = (sectionId) =>
  CULTURE_ENTRIES.filter((x) => x.section === sectionId);

// ---- culture quiz (drawn from the content above) ----

export const CULTURE_QUIZ = [
  { q: 'What should you always do when entering a French shop?', options: ['Say «Bonjour»', 'Wait to be greeted', 'Ask the price first'], answer: 0, why: 'Greeting first is essential politeness.' },
  { q: 'When is the Fête de la Musique?', options: ['14 July', '21 June', '2 February'], answer: 1, why: 'It falls on the summer solstice, 21 June.' },
  { q: 'In a French meal, cheese is served…', options: ['After dessert', 'Before dessert', 'Instead of a starter'], answer: 1, why: 'Cheese comes between the main and dessert.' },
  { q: 'What does «l’Hexagone» refer to?', options: ['A famous monument', 'Mainland France', 'A card game'], answer: 1, why: 'It nicknames mainland France for its six-sided shape.' },
  { q: 'In Belgium, «seventy» is usually…', options: ['soixante-dix', 'septante', 'huitante'], answer: 1, why: 'Belgium and Switzerland use «septante».' },
  { q: 'Which flowers should you NOT give a host?', options: ['Tulips', 'Chrysanthemums', 'Daisies'], answer: 1, why: 'Chrysanthemums are for graves on Toussaint.' },
  { q: 'Who united the Gauls against Caesar?', options: ['Napoléon', 'Vercingétorix', 'De Gaulle'], answer: 1, why: 'Vercingétorix led the Gauls, losing at Alésia in 52 BC.' },
  { q: 'In the south-west, a «pain au chocolat» is called…', options: ['une chocolatine', 'un croissant', 'une brioche'], answer: 0, why: 'The south-west says «chocolatine».' },
];
