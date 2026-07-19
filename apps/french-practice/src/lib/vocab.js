// Vocabulary library: themed packs with rich entries — picture (emoji-as-
// image content), frequency rank, example sentences, synonyms/antonyms,
// collocations, register/region notes. The filler-word deck folds in as a
// pack (same ids, so existing SRS history carries over).

import { FLASHCARDS } from './data';

// freq: 1 = top 100 words, 2 = top 500, 3 = top 1000, 4 = top 5000, 5 = rare/niche
export const FREQ_LABELS = { 1: 'Top 100', 2: 'Top 500', 3: 'Top 1000', 4: 'Top 5000', 5: 'Niche' };

const w = (id, fr, en, emoji, freq, example, exampleEn, extra = {}) =>
  ({ id, fr, en, emoji, freq, example, exampleEn, syn: [], ant: [], coll: [], note: '', ...extra });

export const VOCAB_PACKS = [
  {
    id: 'food',
    title: 'Food & Café',
    description: 'Eat, drink and order with confidence.',
    entries: [
      w('food-pain', 'le pain', 'bread', '🥖', 2, "Tu peux acheter du pain en rentrant ?", 'Can you buy some bread on your way home?', { coll: ['du pain frais', 'un morceau de pain'], syn: ['la baguette'] }),
      w('food-fromage', 'le fromage', 'cheese', '🧀', 2, "On prend un plateau de fromages ?", 'Shall we get a cheese board?', { coll: ['un plateau de fromages', 'du fromage de chèvre'] }),
      w('food-plat', 'le plat', 'dish / main course', '🍽️', 2, "Le plat du jour est un poulet rôti.", "Today's special is roast chicken.", { coll: ['le plat du jour', 'un plat chaud'], syn: ['le mets'] }),
      w('food-legumes', 'les légumes', 'vegetables', '🥦', 2, "Mange tes légumes !", 'Eat your vegetables!', { ant: ['la viande'], coll: ['des légumes de saison'] }),
      w('food-vin', 'le vin', 'wine', '🍷', 2, "Un verre de vin rouge, s'il vous plaît.", 'A glass of red wine, please.', { coll: ['un verre de vin', 'du vin rouge/blanc'] }),
      w('food-addition', "l'addition", 'the bill', '🧾', 3, "L'addition, s'il vous plaît !", 'The bill, please!', { syn: ['la note'], coll: ["demander l'addition", "régler l'addition"] }),
      w('food-petit-dej', 'le petit-déjeuner', 'breakfast', '🥐', 3, "Je prends le petit-déjeuner à sept heures.", 'I have breakfast at seven.', { coll: ['prendre le petit-déjeuner'] }),
      w('food-gouter', 'goûter', 'to taste / afternoon snack', '😋', 3, "Goûte cette tarte, elle est incroyable.", 'Taste this tart, it is incredible.', { syn: ['déguster'], coll: ['goûter un plat'] }),
    ],
  },
  {
    id: 'travel',
    title: 'Travel & Transport',
    description: 'Stations, airports and getting unstuck.',
    entries: [
      w('trav-gare', 'la gare', 'train station', '🚉', 2, "On se retrouve devant la gare à midi.", "Let's meet in front of the station at noon.", { coll: ['la gare routière', 'en gare'] }),
      w('trav-billet', 'le billet', 'ticket', '🎫', 2, "J'ai acheté un billet aller-retour.", 'I bought a return ticket.', { syn: ['le ticket'], coll: ['un billet aller-retour', 'composter son billet'] }),
      w('trav-valise', 'la valise', 'suitcase', '🧳', 3, "Ma valise est trop lourde.", 'My suitcase is too heavy.', { coll: ['faire sa valise', 'boucler sa valise'] }),
      w('trav-vol', 'le vol', 'flight', '✈️', 2, "Le vol pour Lyon est annulé.", 'The flight to Lyon is cancelled.', { coll: ['un vol direct', 'un vol annulé'], note: 'Also means "theft" — context decides.' }),
      w('trav-correspondance', 'la correspondance', 'connection (transfer)', '🔀', 4, "J'ai raté ma correspondance à Paris.", 'I missed my connection in Paris.', { coll: ['rater sa correspondance'] }),
      w('trav-retard', 'en retard', 'late', '⏰', 1, "Désolé, je suis en retard !", 'Sorry, I am late!', { ant: ['en avance', "à l'heure"], coll: ['avoir du retard'] }),
      w('trav-douane', 'la douane', 'customs', '🛂', 4, "On a passé une heure à la douane.", 'We spent an hour at customs.', { coll: ['passer la douane'] }),
      w('trav-louer', 'louer', 'to rent', '🔑', 2, "On va louer une voiture pour le week-end.", "We're renting a car for the weekend.", { coll: ['louer une voiture', 'un appartement à louer'] }),
    ],
  },
  {
    id: 'work',
    title: 'Work & Office',
    description: 'Meetings, deadlines and office life.',
    entries: [
      w('work-reunion', 'la réunion', 'meeting', '📅', 2, "La réunion commence dans dix minutes.", 'The meeting starts in ten minutes.', { coll: ['une réunion d’équipe', 'animer une réunion'] }),
      w('work-dossier', 'le dossier', 'file / case', '📁', 2, "Je t'envoie le dossier ce soir.", "I'll send you the file tonight.", { coll: ['monter un dossier', 'un dossier urgent'] }),
      w('work-delai', 'le délai', 'deadline / time limit', '⏳', 3, "Le délai est trop court.", 'The deadline is too tight.', { syn: ["l'échéance"], coll: ['respecter les délais', 'dans les délais'] }),
      w('work-embaucher', 'embaucher', 'to hire', '🤝', 3, "L'entreprise embauche trois développeurs.", 'The company is hiring three developers.', { ant: ['licencier'], syn: ['recruter'] }),
      w('work-salaire', 'le salaire', 'salary', '💶', 2, "Elle a négocié son salaire.", 'She negotiated her salary.', { syn: ['la paie', 'la rémunération'], coll: ['une augmentation de salaire'] }),
      w('work-conge', 'le congé', 'leave / day off', '🏖️', 3, "Je prends une semaine de congé en août.", "I'm taking a week off in August.", { coll: ['les congés payés', 'un congé maladie'] }),
      w('work-equipe', "l'équipe", 'team', '👥', 2, "Bienvenue dans l'équipe !", 'Welcome to the team!', { coll: ["un travail d'équipe", "l'esprit d'équipe"] }),
      w('work-demissionner', 'démissionner', 'to resign', '🚪', 4, "Il a démissionné hier, tout le monde est choqué.", 'He resigned yesterday, everyone is shocked.', { ant: ['embaucher'], coll: ['poser sa démission'] }),
    ],
  },
  {
    id: 'feelings',
    title: 'Feelings & Moods',
    description: 'Say how you actually feel.',
    entries: [
      w('feel-heureux', 'heureux / heureuse', 'happy', '😊', 1, "Je suis tellement heureuse pour toi !", 'I am so happy for you!', { syn: ['content(e)', 'ravi(e)'], ant: ['triste', 'malheureux'] }),
      w('feel-inquiet', 'inquiet / inquiète', 'worried', '😟', 3, "Ne sois pas inquiet, tout va bien se passer.", "Don't be worried, everything will be fine.", { syn: ['anxieux', 'soucieux'], ant: ['serein', 'rassuré'] }),
      w('feel-fier', 'fier / fière', 'proud', '🦁', 3, "Je suis fier de toi.", 'I am proud of you.', { coll: ['fier de soi'], ant: ['honteux'] }),
      w('feel-colere', 'en colère', 'angry', '😠', 2, "Elle est en colère contre moi.", 'She is angry with me.', { syn: ['furieux', 'énervé'], ant: ['calme'], coll: ['se mettre en colère'] }),
      w('feel-surpris', 'surpris(e)', 'surprised', '😲', 3, "J'étais surpris de le voir là.", 'I was surprised to see him there.', { syn: ['étonné(e)'] }),
      w('feel-decu', 'déçu(e)', 'disappointed', '😞', 3, "Franchement, je suis un peu déçu du film.", 'Honestly, I am a bit disappointed by the film.', { coll: ['déçu par quelqu’un'] }),
      w('feel-epuise', 'épuisé(e)', 'exhausted', '😫', 3, "Après le déménagement, on était épuisés.", 'After the move, we were exhausted.', { syn: ['crevé (fam.)', 'vidé'], ant: ['reposé', 'en forme'] }),
      w('feel-manquer', 'manquer à', 'to be missed by', '💭', 2, "Tu me manques.", 'I miss you.', { note: 'Reversed structure: «tu me manques» = you are missing to me.', coll: ['ça me manque'] }),
    ],
  },
  {
    id: 'objects',
    title: 'Everyday Objects',
    description: 'Picture deck — name what you see.',
    entries: [
      w('obj-cle', 'la clé', 'key', '🔑', 2, "J'ai encore perdu mes clés !", 'I lost my keys again!', { coll: ['un trousseau de clés', 'fermer à clé'] }),
      w('obj-parapluie', 'le parapluie', 'umbrella', '☂️', 4, "Prends ton parapluie, il va pleuvoir.", 'Take your umbrella, it is going to rain.', {}),
      w('obj-montre', 'la montre', 'watch', '⌚', 3, "Ta montre avance de cinq minutes.", 'Your watch is five minutes fast.', { coll: ['regarder sa montre'] }),
      w('obj-lunettes', 'les lunettes', 'glasses', '👓', 3, "Je ne trouve plus mes lunettes.", "I can't find my glasses.", { coll: ['des lunettes de soleil', 'porter des lunettes'] }),
      w('obj-portefeuille', 'le portefeuille', 'wallet', '👛', 4, "On m'a volé mon portefeuille dans le métro.", 'My wallet was stolen in the metro.', {}),
      w('obj-bouilloire', 'la bouilloire', 'kettle', '🫖', 5, "Mets la bouilloire, on se fait un thé.", "Put the kettle on, let's make tea.", {}),
      w('obj-sac', 'le sac à dos', 'backpack', '🎒', 3, "Tout tient dans mon sac à dos.", 'Everything fits in my backpack.', { coll: ['un sac à main'] }),
      w('obj-ordinateur', "l'ordinateur", 'computer', '💻', 2, "Mon ordinateur portable est en panne.", 'My laptop is broken.', { coll: ['un ordinateur portable', 'en panne'] }),
    ],
  },
  {
    id: 'idioms',
    title: 'Idioms',
    description: 'Expressions that make no literal sense — and every conversational one.',
    entries: [
      w('idio-lapin', 'poser un lapin à quelqu’un', 'to stand someone up', '🐇', 4, "Il m'a posé un lapin, j'ai attendu une heure !", 'He stood me up, I waited an hour!', { kind: 'idiom', note: 'Literally: to put down a rabbit for someone.' }),
      w('idio-yeux', 'coûter les yeux de la tête', 'to cost a fortune', '💸', 4, "Ce sac coûte les yeux de la tête.", 'That bag costs a fortune.', { kind: 'idiom', syn: ['coûter un bras'] }),
      w('idio-cafard', 'avoir le cafard', 'to feel down / blue', '🪳', 4, "Depuis lundi, j'ai un peu le cafard.", "I've been feeling a bit down since Monday.", { kind: 'idiom', note: 'Literally: to have the cockroach.' }),
      w('idio-grain', 'mettre son grain de sel', 'to butt in with an opinion', '🧂', 4, "Il faut toujours qu'elle mette son grain de sel !", 'She always has to put in her two cents!', { kind: 'idiom' }),
      w('idio-pommes', 'tomber dans les pommes', 'to faint', '🍎', 4, "Il faisait si chaud qu'elle est tombée dans les pommes.", 'It was so hot she fainted.', { kind: 'idiom', syn: ["s'évanouir"] }),
      w('idio-midi', 'chercher midi à quatorze heures', 'to overcomplicate things', '🕑', 5, "Arrête de chercher midi à quatorze heures, c'est simple !", 'Stop overcomplicating it, it is simple!', { kind: 'idiom' }),
      w('idio-langue', 'donner sa langue au chat', 'to give up (guessing)', '🐈', 4, "Je ne sais pas… je donne ma langue au chat !", "I don't know… I give up!", { kind: 'idiom' }),
      w('idio-poil', 'avoir un poil dans la main', 'to be bone idle', '🖐️', 5, "Lui, travailler ? Il a un poil dans la main !", 'Him, work? He is bone idle!', { kind: 'idiom', ant: ['bosseur'] }),
    ],
  },
  {
    id: 'slang',
    title: 'Slang & Argot',
    description: 'How French actually sounds between friends.',
    entries: [
      w('slang-bosser', 'bosser', 'to work (informal)', '🛠️', 3, "Je bosse tard ce soir, commencez sans moi.", "I'm working late tonight, start without me.", { kind: 'slang', syn: ['travailler', 'taffer'], note: 'Neutral-informal; fine with colleagues, not in a cover letter.' }),
      w('slang-truc', 'un truc', 'a thing / thingy', '❓', 1, "C'est quoi ce truc ?", 'What is that thing?', { kind: 'slang', syn: ['un machin', 'une chose'] }),
      w('slang-kiffer', 'kiffer', 'to really like / love', '🤩', 4, "Je kiffe ce resto.", 'I love this restaurant.', { kind: 'slang', syn: ['adorer'], note: 'From Arabic «kif»; very common under 40.' }),
      w('slang-relou', 'relou', 'annoying (verlan)', '🙄', 4, "Il est relou avec ses questions.", 'He is annoying with his questions.', { kind: 'slang', note: 'Verlan of «lourd». Verlan flips syllables.', syn: ['pénible'] }),
      w('slang-fric', 'le fric', 'money / cash', '💰', 3, "Je n'ai plus de fric avant vendredi.", "I'm out of cash until Friday.", { kind: 'slang', syn: ['la thune', 'le pognon', "l'argent"] }),
      w('slang-creve', 'crevé(e)', 'knackered / dead tired', '🥱', 3, "Je suis crevé, je rentre.", "I'm knackered, I'm heading home.", { kind: 'slang', syn: ['épuisé', 'mort'], ant: ['en forme'] }),
      w('slang-mec', 'un mec / une meuf', 'a guy / a girl', '🧑', 2, "C'est le mec dont je t'ai parlé.", "That's the guy I told you about.", { kind: 'slang', note: '«Meuf» is verlan of «femme».' }),
      w('slang-ouf', 'ouf', 'crazy / amazing (verlan)', '🤯', 4, "Ce concert était un truc de ouf !", 'That concert was insane!', { kind: 'slang', note: 'Verlan of «fou». «Un truc de ouf» = a crazy thing.' }),
    ],
  },
  {
    id: 'regional',
    title: 'Regional French',
    description: 'Québec, Belgium, Switzerland and the South.',
    entries: [
      w('reg-magasiner', 'magasiner', 'to go shopping (Québec)', '🛍️', 5, "On va magasiner au centre-ville samedi.", "We're going shopping downtown on Saturday.", { kind: 'regional', note: 'Québec. France uses «faire du shopping / les magasins».', syn: ['faire les magasins'] }),
      w('reg-char', 'un char', 'a car (Québec)', '🚗', 5, "Mon char est au garage.", 'My car is at the garage.', { kind: 'regional', note: 'Québec. In France «char» means a tank or parade float.', syn: ['une voiture', 'une bagnole (fam.)'] }),
      w('reg-blonde', 'ma blonde / mon chum', 'my girlfriend / boyfriend (Québec)', '💑', 5, "Je te présente ma blonde.", 'Meet my girlfriend.', { kind: 'regional', note: 'Québec. France: «ma copine / mon copain».' }),
      w('reg-septante', 'septante', 'seventy (Belgium/Switzerland)', '7️⃣', 5, "Ça fait septante euros.", 'That will be seventy euros.', { kind: 'regional', note: 'Belgium & Switzerland. France says «soixante-dix».' }),
      w('reg-nonante', 'nonante', 'ninety (Belgium/Switzerland)', '9️⃣', 5, "Il a nonante ans et toute sa tête.", 'He is ninety and sharp as ever.', { kind: 'regional', note: 'Belgium & Switzerland. France says «quatre-vingt-dix».' }),
      w('reg-chocolatine', 'la chocolatine', 'chocolate croissant (South-West)', '🍫', 5, "Une chocolatine et un café, s'il vous plaît.", 'A chocolate croissant and a coffee, please.', { kind: 'regional', note: 'South-West France. Paris says «pain au chocolat» — a national debate.' }),
      w('reg-peguer', 'péguer', 'to be sticky (South)', '🍯', 5, "La table pègue, passe un coup d'éponge.", 'The table is sticky, give it a wipe.', { kind: 'regional', note: 'Southern France, from Occitan.' }),
      w('reg-minot', 'un minot', 'a kid (Marseille)', '🧒', 5, "Les minots jouent au foot sur la place.", 'The kids are playing football on the square.', { kind: 'regional', note: 'Marseille & Provence. France-wide: «un gamin, un gosse».', syn: ['un gamin', 'un gosse'] }),
    ],
  },
  {
    id: 'health',
    title: 'Health & Body',
    description: 'Symptoms, the body and the doctor.',
    entries: [
      w('health-tete', 'la tête', 'head', '🤕', 2, "J'ai mal à la tête depuis ce matin.", 'I have had a headache since this morning.', { coll: ['avoir mal à la tête'] }),
      w('health-ventre', 'le ventre', 'stomach / belly', '🤢', 2, "Il a mal au ventre après le repas.", 'He has a stomachache after the meal.', { coll: ['avoir mal au ventre'] }),
      w('health-dos', 'le dos', 'back', '🦴', 2, "Mon dos me fait souffrir.", 'My back is hurting me.', { coll: ['un mal de dos'] }),
      w('health-fievre', 'la fièvre', 'fever', '🌡️', 3, "L'enfant a de la fièvre.", 'The child has a fever.', { coll: ['avoir de la fièvre'] }),
      w('health-rhume', 'le rhume', 'cold', '🤧', 3, "J'ai attrapé un rhume.", 'I caught a cold.', { coll: ['attraper un rhume'] }),
      w('health-medecin', 'le médecin', 'doctor', '🩺', 2, "Je dois voir un médecin.", 'I need to see a doctor.', { syn: ['le docteur'], coll: ['prendre rendez-vous'] }),
      w('health-ordonnance', "l'ordonnance", 'prescription', '📝', 4, "Le médecin m'a fait une ordonnance.", 'The doctor wrote me a prescription.'),
      w('health-sante', 'la santé', 'health', '💪', 2, "La santé, c'est le plus important.", 'Health is the most important thing.', { coll: ['être en bonne santé'] }),
    ],
  },
  {
    id: 'home',
    title: 'House & Home',
    description: 'Rooms, furniture and daily life at home.',
    entries: [
      w('home-maison', 'la maison', 'house', '🏠', 1, "Ils ont acheté une maison à la campagne.", 'They bought a house in the countryside.', { ant: ["l'appartement"] }),
      w('home-appartement', "l'appartement", 'flat / apartment', '🏢', 2, "Mon appartement est au troisième étage.", 'My flat is on the third floor.', { coll: ['louer un appartement'] }),
      w('home-cuisine', 'la cuisine', 'kitchen / cooking', '🍳', 2, "On mange dans la cuisine.", 'We eat in the kitchen.', { note: 'Also means "cooking / cuisine".' }),
      w('home-chambre', 'la chambre', 'bedroom', '🛏️', 2, "Ma chambre donne sur le jardin.", 'My bedroom looks out onto the garden.', { coll: ['une chambre double'] }),
      w('home-salle-de-bain', 'la salle de bain', 'bathroom', '🛁', 3, "La salle de bain est au fond du couloir.", 'The bathroom is at the end of the hall.'),
      w('home-meuble', 'le meuble', 'piece of furniture', '🪑', 3, "On cherche des meubles pour le salon.", 'We are looking for furniture for the living room.', { coll: ['un meuble ancien'] }),
      w('home-loyer', 'le loyer', 'rent', '💶', 3, "Le loyer augmente chaque année.", 'The rent goes up every year.', { coll: ['payer le loyer'] }),
      w('home-cle', 'la clé', 'key', '🔑', 2, "J'ai perdu mes clés.", 'I lost my keys.', { coll: ['un trousseau de clés'] }),
    ],
  },
  {
    id: 'nature',
    title: 'Nature & Weather',
    description: 'The outdoors, seasons and the forecast.',
    entries: [
      w('nature-temps', 'le temps', 'weather / time', '🌤️', 1, "Quel temps fait-il aujourd'hui ?", 'What is the weather like today?', { note: 'Also means "time".', coll: ['il fait beau', 'il fait mauvais'] }),
      w('nature-pluie', 'la pluie', 'rain', '🌧️', 3, "La pluie n'arrête pas depuis hier.", "The rain hasn't stopped since yesterday.", { coll: ['sous la pluie'] }),
      w('nature-soleil', 'le soleil', 'sun', '☀️', 2, "Il y a du soleil ce matin.", 'It is sunny this morning.', { coll: ['un coup de soleil'] }),
      w('nature-neige', 'la neige', 'snow', '❄️', 3, "La neige recouvre les montagnes.", 'Snow covers the mountains.', { coll: ['un bonhomme de neige'] }),
      w('nature-arbre', "l'arbre", 'tree', '🌳', 2, "Cet arbre a plus de cent ans.", 'This tree is over a hundred years old.'),
      w('nature-mer', 'la mer', 'sea', '🌊', 2, "On part à la mer cet été.", 'We are going to the seaside this summer.', { ant: ['la montagne'] }),
      w('nature-montagne', 'la montagne', 'mountain', '⛰️', 2, "J'adore marcher en montagne.", 'I love hiking in the mountains.'),
      w('nature-saison', 'la saison', 'season', '🍂', 3, "L'automne est ma saison préférée.", 'Autumn is my favourite season.', { coll: ['les quatre saisons'] }),
    ],
  },
  {
    id: 'time',
    title: 'Time, Numbers & Money',
    description: 'Telling the time, counting and paying.',
    entries: [
      w('time-heure', "l'heure", 'hour / time', '🕐', 1, "Il est quelle heure ?", 'What time is it?', { coll: ["à l'heure", 'de bonne heure'] }),
      w('time-jour', 'le jour', 'day', '📅', 1, "Quel jour on est ?", 'What day is it?', { ant: ['la nuit'], coll: ['tous les jours'] }),
      w('time-semaine', 'la semaine', 'week', '🗓️', 2, "On se voit la semaine prochaine.", 'We will see each other next week.', { coll: ['en semaine'] }),
      w('time-mois', 'le mois', 'month', '📆', 2, "Le loyer est dû en début de mois.", 'The rent is due at the start of the month.'),
      w('time-argent', "l'argent", 'money', '💰', 1, "Je n'ai pas assez d'argent sur moi.", "I don't have enough money on me.", { note: 'Also means "silver".', coll: ['gagner de l\'argent'] }),
      w('time-prix', 'le prix', 'price', '🏷️', 2, "Le prix a beaucoup augmenté.", 'The price has gone up a lot.', { coll: ['à moitié prix'] }),
      w('time-monnaie', 'la monnaie', 'change / currency', '🪙', 3, "Vous avez la monnaie de vingt euros ?", 'Do you have change for twenty euros?', { note: 'Also means "currency".' }),
      w('time-gratuit', 'gratuit', 'free (of charge)', '🆓', 3, "L'entrée est gratuite le dimanche.", 'Entry is free on Sundays.', { ant: ['payant'] }),
    ],
  },
  {
    id: 'filler',
    title: 'Filler Words',
    description: 'The connective tissue of spoken French.',
    entries: FLASHCARDS.map((c) => ({
      id: c.id, // same ids as the old deck — SRS history carries over
      fr: c.front,
      en: c.meaning,
      emoji: '💬',
      freq: 2,
      example: c.example,
      exampleEn: c.exampleTranslation,
      syn: [],
      ant: [],
      coll: [],
      note: c.register,
    })),
  },
];

export const getPack = (id) => VOCAB_PACKS.find((p) => p.id === id);

export const allEntries = () => VOCAB_PACKS.flatMap((p) => p.entries);

export const allEntryIds = () => allEntries().map((e) => e.id);

export function findEntry(id) {
  return allEntries().find((e) => e.id === id) || null;
}
