// Listening library: TTS-narrated tracks — mini-podcasts (monologues),
// two-voice dialogues, news bulletins and movie-style scenes. Each track has
// a hidden transcript (listen first), translations, and a comprehension quiz.
// All audio is synthesized locally; no external media, no link rot.

export const LISTENING_KINDS = [
  { id: 'authentique', title: 'Authentic audio', description: 'Real recorded voices — public-domain readings' },
  { id: 'podcast', title: 'Mini-podcasts', description: 'Short monologues on everyday topics' },
  { id: 'dialogue', title: 'Dialogues', description: 'Two voices, real back-and-forth' },
  { id: 'news', title: 'News bulletins', description: 'Radio-style headlines, read at pace' },
  { id: 'scene', title: 'Scenes', description: 'Movie-style drama between two characters' },
];

export const LISTENING_TRACKS = [
  {
    id: 'pod-paris',
    kind: 'podcast',
    cefr: 'B1',
    title: 'Ma première année à Paris',
    description: 'A newcomer looks back on twelve months in the capital.',
    lines: [
      { fr: "Quand je suis arrivée à Paris, je ne connaissais personne.", en: 'When I arrived in Paris, I knew nobody.' },
      { fr: "Les premiers mois ont été difficiles, surtout à cause du logement.", en: 'The first months were hard, mostly because of housing.' },
      { fr: "J'ai vécu dans une chambre minuscule au sixième étage, sans ascenseur.", en: 'I lived in a tiny room on the sixth floor, no lift.' },
      { fr: "Mais petit à petit, la ville est devenue ma maison.", en: 'But little by little, the city became my home.' },
      { fr: "Maintenant, j'ai mes habitudes : ma boulangerie, mon marché, mon café.", en: 'Now I have my routines: my bakery, my market, my café.' },
      { fr: "Franchement, je ne me vois plus vivre ailleurs.", en: "Honestly, I can't see myself living anywhere else now." },
    ],
    questions: [
      { q: 'What was the hardest part of her first months?', options: ['Finding housing', 'Learning French', 'Making friends'], answer: 0 },
      { q: 'Where did she live at first?', options: ['A tiny sixth-floor room', 'A flat-share', 'A hotel'], answer: 0 },
    ],
  },
  {
    id: 'pod-teletravail',
    kind: 'podcast',
    cefr: 'B2',
    title: 'Le télétravail, pour ou contre ?',
    description: 'A columnist weighs up working from home.',
    lines: [
      { fr: "Le télétravail a complètement changé notre façon de travailler.", en: 'Remote work has completely changed how we work.' },
      { fr: "D'un côté, on gagne du temps : plus de transports, plus de réunions inutiles.", en: 'On one hand, we save time: no more commuting, no more pointless meetings.' },
      { fr: "De l'autre, beaucoup de gens se sentent isolés derrière leur écran.", en: 'On the other, many people feel isolated behind their screens.' },
      { fr: "Selon une étude récente, la solution idéale serait deux jours à la maison, trois au bureau.", en: 'According to a recent study, the ideal would be two days at home, three at the office.' },
      { fr: "Bref, comme souvent, la vérité se trouve quelque part au milieu.", en: 'In short, as so often, the truth lies somewhere in the middle.' },
    ],
    questions: [
      { q: 'What downside of remote work is mentioned?', options: ['Feeling isolated', 'Lower pay', 'Longer hours'], answer: 0 },
      { q: 'What mix does the study recommend?', options: ['2 days home, 3 office', '5 days home', '1 day home, 4 office'], answer: 0 },
    ],
  },
  {
    id: 'dia-resto',
    kind: 'dialogue',
    cefr: 'A2',
    title: 'Une table pour deux',
    description: 'Booking a table that doesn’t exist.',
    lines: [
      { speaker: 'A', fr: "Bonsoir, j'ai réservé une table pour deux au nom de Martin.", en: 'Good evening, I booked a table for two under Martin.' },
      { speaker: 'B', fr: "Martin… Martin… Je suis désolé, je ne trouve rien à ce nom.", en: "Martin… Martin… I'm sorry, I can't find anything under that name." },
      { speaker: 'A', fr: "C'est impossible, j'ai appelé hier soir !", en: "That's impossible, I called last night!" },
      { speaker: 'B', fr: "Attendez… vous avez peut-être réservé dans notre autre restaurant, rue de la Paix ?", en: 'Wait… perhaps you booked at our other restaurant, on rue de la Paix?' },
      { speaker: 'A', fr: "Ah… c'est possible, oui. C'est loin d'ici ?", en: "Ah… that's possible, yes. Is it far from here?" },
      { speaker: 'B', fr: "Dix minutes à pied. Ou alors, il me reste une petite table près de la fenêtre.", en: 'Ten minutes on foot. Or — I do have a small table left by the window.' },
      { speaker: 'A', fr: "On prend la table près de la fenêtre. Merci !", en: "We'll take the table by the window. Thank you!" },
    ],
    questions: [
      { q: 'Why can’t the waiter find the booking?', options: ['It was made at another branch', 'It was cancelled', 'It was for another day'], answer: 0 },
      { q: 'How does it end?', options: ['They take a window table here', 'They walk to rue de la Paix', 'They go home'], answer: 0 },
    ],
  },
  {
    id: 'dia-voisin',
    kind: 'dialogue',
    cefr: 'B1',
    title: 'Le voisin bruyant',
    description: 'A delicate conversation in the stairwell.',
    lines: [
      { speaker: 'A', fr: "Excusez-moi, vous êtes le voisin du dessus, non ?", en: "Excuse me, you're the upstairs neighbour, right?" },
      { speaker: 'B', fr: "Oui, c'est moi. Il y a un problème ?", en: 'Yes, that\'s me. Is there a problem?' },
      { speaker: 'A', fr: "Eh bien… la musique, hier soir. Il était deux heures du matin.", en: 'Well… the music, last night. It was two in the morning.' },
      { speaker: 'B', fr: "Ah, mince. C'était mon anniversaire, on a un peu exagéré.", en: 'Oh no. It was my birthday, we got a bit carried away.' },
      { speaker: 'A', fr: "Je comprends, mais je travaille tôt, moi.", en: 'I understand, but I start work early.' },
      { speaker: 'B', fr: "Vous avez raison. Promis, la prochaine fois, je vous invite au lieu de vous réveiller.", en: "You're right. I promise — next time I'll invite you instead of waking you." },
    ],
    questions: [
      { q: 'What is the complaint about?', options: ['Loud music at 2 a.m.', 'A blocked parking spot', 'A barking dog'], answer: 0 },
      { q: 'What does the neighbour promise?', options: ['To invite them next time', 'To move out', 'To call the police'], answer: 0 },
    ],
  },
  {
    id: 'news-matin',
    kind: 'news',
    cefr: 'B2',
    title: 'Le journal de 8 heures',
    description: 'Three quick headlines, radio pace.',
    lines: [
      { fr: "Il est huit heures, voici les titres.", en: "It's eight o'clock, here are the headlines." },
      { fr: "Transports : la grève des contrôleurs se poursuit, un train sur trois circule ce matin.", en: 'Transport: the inspectors\' strike continues; one train in three is running this morning.' },
      { fr: "Météo : de fortes pluies sont attendues dans le sud-ouest à partir de ce soir.", en: 'Weather: heavy rain is expected in the south-west from this evening.' },
      { fr: "Et enfin, culture : le musée d'Orsay annonce une grande exposition consacrée aux impressionnistes.", en: "And finally, culture: the Musée d'Orsay announces a major exhibition devoted to the Impressionists." },
      { fr: "Il fera dix-neuf degrés à Paris. Bonne journée à tous.", en: 'It will be nineteen degrees in Paris. Have a good day, everyone.' },
    ],
    questions: [
      { q: 'How many trains are running?', options: ['One in three', 'One in two', 'None'], answer: 0 },
      { q: 'Where is heavy rain expected?', options: ['The south-west', 'Paris', 'The north'], answer: 0 },
    ],
  },
  {
    id: 'scene-gare',
    kind: 'scene',
    cefr: 'B2',
    title: 'Le dernier train',
    description: 'Two old friends, one platform, unfinished business.',
    lines: [
      { speaker: 'A', fr: "Tu allais vraiment partir sans me dire au revoir ?", en: 'You were really going to leave without saying goodbye?' },
      { speaker: 'B', fr: "Je déteste les adieux. Tu le sais très bien.", en: 'I hate goodbyes. You know that perfectly well.' },
      { speaker: 'A', fr: "Dix ans d'amitié, et tu m'envoies même pas un message ?", en: "Ten years of friendship, and you don't even send me a message?" },
      { speaker: 'B', fr: "Si je t'avais prévenu, tu m'aurais convaincu de rester.", en: "If I'd told you, you would have convinced me to stay." },
      { speaker: 'A', fr: "Évidemment ! C'est à ça que servent les amis.", en: "Of course! That's what friends are for." },
      { speaker: 'B', fr: "Le train part dans deux minutes. Viens avec moi, alors.", en: 'The train leaves in two minutes. Come with me, then.' },
      { speaker: 'A', fr: "…Tu es sérieux ?", en: '…Are you serious?' },
    ],
    questions: [
      { q: 'Why didn’t B announce the departure?', options: ['A would have convinced them to stay', 'They lost their phone', 'It was a surprise trip'], answer: 0 },
      { q: 'How does the scene end?', options: ['B invites A to come along', 'A misses the train', 'They argue and part'], answer: 0 },
    ],
  },
  {
    id: 'pod-habitudes',
    kind: 'podcast',
    cefr: 'A2',
    title: 'Ma routine du matin',
    description: 'A slow, clear monologue about one person\'s morning — perfect for beginners.',
    lines: [
      { fr: "Bonjour ! Aujourd'hui, je vous parle de ma routine du matin.", en: 'Hello! Today I\'m telling you about my morning routine.' },
      { fr: "Je me réveille à sept heures. D'abord, je bois un grand verre d'eau.", en: 'I wake up at seven o\'clock. First, I drink a big glass of water.' },
      { fr: "Ensuite, je prends une douche et je m'habille.", en: 'Then I take a shower and get dressed.' },
      { fr: "Pour le petit-déjeuner, je mange du pain avec de la confiture et je bois un café.", en: 'For breakfast, I eat bread with jam and drink a coffee.' },
      { fr: "Après, je vérifie mon téléphone pendant cinq minutes, pas plus.", en: 'Afterwards, I check my phone for five minutes, no more.' },
      { fr: "Enfin, je pars au travail à huit heures et demie. Et vous, quelle est votre routine ?", en: 'Finally, I leave for work at half past eight. And you, what is your routine?' },
    ],
    questions: [
      { q: 'What does the speaker do first after waking up?', options: ['Drinks a glass of water', 'Checks their phone', 'Takes a shower'], answer: 0 },
      { q: 'What time do they leave for work?', options: ['8:30', '7:00', '9:00'], answer: 0 },
    ],
  },
  {
    id: 'dial-pharmacie',
    kind: 'dialogue',
    cefr: 'A2',
    title: 'À la pharmacie',
    description: 'A customer with a headache, a pharmacist with advice.',
    lines: [
      { speaker: 'A', fr: "Bonjour, j'ai mal à la tête depuis ce matin. Vous avez quelque chose ?", en: 'Hello, I\'ve had a headache since this morning. Do you have something?' },
      { speaker: 'B', fr: "Oui, bien sûr. Vous avez de la fièvre ?", en: 'Yes, of course. Do you have a fever?' },
      { speaker: 'A', fr: "Non, je ne crois pas. Juste mal à la tête.", en: 'No, I don\'t think so. Just a headache.' },
      { speaker: 'B', fr: "Alors, prenez ce paracétamol. Un comprimé, trois fois par jour.", en: 'Then take this paracetamol. One tablet, three times a day.' },
      { speaker: 'A', fr: "Je le prends avant ou après les repas ?", en: 'Do I take it before or after meals?' },
      { speaker: 'B', fr: "Après les repas, c'est mieux. Et buvez beaucoup d'eau.", en: 'After meals is better. And drink plenty of water.' },
      { speaker: 'A', fr: "D'accord, merci beaucoup. Je vous dois combien ?", en: 'All right, thank you very much. How much do I owe you?' },
    ],
    questions: [
      { q: 'What is wrong with the customer?', options: ['A headache', 'A fever', 'A stomach ache'], answer: 0 },
      { q: 'When should they take the tablet?', options: ['After meals', 'Before meals', 'Only at night'], answer: 0 },
    ],
  },
  // Authentic audio: tracks that play a real recorded MP3 from /audio/ when
  // present (see public/audio/README.md for the public-domain sources); if
  // the file is missing the player falls back to TTS so nothing breaks.
  {
    id: 'auth-corbeau',
    kind: 'authentique',
    cefr: 'B2',
    title: 'Le Corbeau et le Renard — lu à voix haute',
    description: 'La Fontaine (1668), read by a native speaker. Public domain.',
    audioSrc: '/audio/corbeau.mp3',
    lines: [
      { fr: "Maître Corbeau, sur un arbre perché, tenait en son bec un fromage.", en: 'Master Crow, perched on a tree, held a cheese in his beak.' },
      { fr: "Maître Renard, par l'odeur alléché, lui tint à peu près ce langage :", en: 'Master Fox, drawn by the smell, addressed him more or less like this:' },
      { fr: "« Hé ! bonjour, Monsieur du Corbeau. Que vous êtes joli ! que vous me semblez beau !", en: '"Hey! Good day, Sir Crow. How pretty you are! How handsome you seem!' },
      { fr: "Sans mentir, si votre ramage se rapporte à votre plumage, vous êtes le Phénix des hôtes de ces bois. »", en: 'Truly, if your song matches your plumage, you are the Phoenix of these woods."' },
      { fr: "À ces mots le Corbeau ne se sent pas de joie ; et pour montrer sa belle voix, il ouvre un large bec, laisse tomber sa proie.", en: 'At these words the Crow is beside himself with joy; and to show off his fine voice, he opens a wide beak and drops his prize.' },
      { fr: "Le Renard s'en saisit, et dit : « Mon bon Monsieur, apprenez que tout flatteur vit aux dépens de celui qui l'écoute. »", en: 'The Fox seizes it and says: "My good sir, learn that every flatterer lives at the expense of the one who listens."' },
    ],
    questions: [
      { q: 'What does the Fox want?', options: ['The cheese', 'The tree', 'A song lesson'], answer: 0 },
      { q: 'How does he get it?', options: ['By flattering the Crow into singing', 'By climbing up', 'By trading'], answer: 0 },
    ],
  },
  {
    id: 'auth-cigale',
    kind: 'authentique',
    cefr: 'B2',
    title: 'La Cigale et la Fourmi — lue à voix haute',
    description: 'La Fontaine (1668), read by a native speaker. Public domain.',
    audioSrc: '/audio/cigale.mp3',
    lines: [
      { fr: "La Cigale, ayant chanté tout l'été, se trouva fort dépourvue quand la bise fut venue :", en: 'The Cicada, having sung all summer, found herself most destitute when the north wind came:' },
      { fr: "pas un seul petit morceau de mouche ou de vermisseau.", en: 'not a single little morsel of fly or worm.' },
      { fr: "Elle alla crier famine chez la Fourmi sa voisine,", en: 'She went to cry famine at the home of her neighbour the Ant,' },
      { fr: "la priant de lui prêter quelque grain pour subsister jusqu'à la saison nouvelle.", en: 'begging her to lend some grain to survive until the new season.' },
      { fr: "« Que faisiez-vous au temps chaud ? dit-elle à cette emprunteuse. — Nuit et jour à tout venant, je chantais, ne vous déplaise. »", en: '"What were you doing in the warm weather?" she said to the borrower. "Night and day, for all comers, I sang, if you please."' },
      { fr: "« Vous chantiez ? j'en suis fort aise. Eh bien ! dansez maintenant. »", en: '"You sang? I am delighted. Well then — dance now."' },
    ],
    questions: [
      { q: 'Why is the Cicada hungry?', options: ['She sang all summer instead of storing food', 'The Ant stole her food', 'The winter was unusually long'], answer: 0 },
      { q: 'What is the Ant\'s answer?', options: ['"You sang? Then dance now."', 'She lends the grain', 'She invites her in'], answer: 0 },
    ],
  },
];

export const tracksByKind = (kind) => LISTENING_TRACKS.filter((t) => t.kind === kind);

export const getTrack = (id) => LISTENING_TRACKS.find((t) => t.id === id) || null;
