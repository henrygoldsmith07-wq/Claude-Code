// Listening library: TTS-narrated tracks — mini-podcasts (monologues),
// two-voice dialogues, news bulletins and movie-style scenes. Each track has
// a hidden transcript (listen first), translations, and a comprehension quiz.
// All audio is synthesized locally; no external media, no link rot.

export const LISTENING_KINDS = [
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
];

export const tracksByKind = (kind) => LISTENING_TRACKS.filter((t) => t.kind === kind);

export const getTrack = (id) => LISTENING_TRACKS.find((t) => t.id === id) || null;
