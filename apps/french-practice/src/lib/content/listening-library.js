// Listening library, second wave: serialised stories, longer podcasts,
// multi-voice dialogues and adapted news.
//
// Everything is narrated by the device's speech engine, as elsewhere in the
// app — that is what keeps it working offline and free of link rot. The gain
// here is *length and shape*: a three-part story that carries a plot across
// sessions asks something different of a listener than a six-line monologue,
// and adapted news teaches the register learners actually meet.

const q = (question, options, answer) => ({ q: question, options, answer });

export const STORY_TRACKS = [
  {
    id: 'st-valise-1',
    kind: 'story',
    serial: 'la-valise',
    part: 1,
    of: 3,
    cefr: 'A2',
    title: 'La valise — 1. Le quai',
    description: 'Part one of three. A suitcase is left on a platform in Nantes.',
    lines: [
      { fr: "Il est sept heures du matin. Sur le quai numéro trois, il n'y a presque personne.", en: 'It is seven in the morning. On platform three there is almost nobody.' },
      { fr: "Léa attend son train pour Rennes. Elle a un café dans une main et son billet dans l'autre.", en: 'Léa is waiting for her train to Rennes. She has a coffee in one hand and her ticket in the other.' },
      { fr: "À côté du banc, il y a une vieille valise marron. Personne ne la regarde.", en: 'Next to the bench there is an old brown suitcase. Nobody is looking at it.' },
      { fr: "Léa attend cinq minutes. Puis dix. La valise ne bouge pas.", en: 'Léa waits five minutes. Then ten. The suitcase does not move.' },
      { fr: "« Excusez-moi, c'est à vous ? » demande-t-elle à un homme en manteau gris.", en: '"Excuse me, is this yours?" she asks a man in a grey coat.' },
      { fr: "L'homme ne répond pas. Il regarde sa montre et il part vite vers la sortie.", en: 'The man does not answer. He looks at his watch and leaves quickly towards the exit.' },
      { fr: "Le train entre en gare. Léa hésite. Puis elle prend la valise avec elle.", en: 'The train pulls in. Léa hesitates. Then she takes the suitcase with her.' },
    ],
    questions: [
      q('Where is Léa going?', ['Rennes', 'Nantes', 'Paris'], 0),
      q('What does the man in the grey coat do?', ['He leaves without answering', 'He takes the suitcase', 'He calls the police'], 0),
      q('What does Léa do at the end?', ['She takes the suitcase onto the train', 'She leaves it on the platform', 'She opens it'], 0),
    ],
  },
  {
    id: 'st-valise-2',
    kind: 'story',
    serial: 'la-valise',
    part: 2,
    of: 3,
    cefr: 'B1',
    title: 'La valise — 2. Le carnet',
    description: 'Part two. What was inside, and why it was left.',
    lines: [
      { fr: "Dans le train, Léa a posé la valise entre ses pieds. Elle n'osait pas l'ouvrir.", en: 'On the train, Léa put the suitcase between her feet. She did not dare open it.' },
      { fr: "Au bout d'une demi-heure, la curiosité a gagné.", en: 'After half an hour, curiosity won.' },
      { fr: "À l'intérieur, il n'y avait ni vêtements ni argent : seulement un carnet noir et une photo.", en: 'Inside there were neither clothes nor money: only a black notebook and a photograph.' },
      { fr: "La photo montrait deux enfants devant une maison bleue, quelque part au bord de la mer.", en: 'The photo showed two children in front of a blue house, somewhere by the sea.' },
      { fr: "Le carnet était rempli d'adresses, toutes barrées sauf une.", en: 'The notebook was full of addresses, all crossed out except one.' },
      { fr: "« 14, rue des Lilas, Saint-Malo. » Léa a relu l'adresse trois fois.", en: '"14, rue des Lilas, Saint-Malo." Léa read the address three times.' },
      { fr: "Son train s'arrêtait à Rennes. De Rennes, il y avait un car pour Saint-Malo toutes les heures.", en: 'Her train stopped at Rennes. From Rennes there was a coach to Saint-Malo every hour.' },
      { fr: "Elle savait déjà qu'elle n'irait pas au travail le lendemain.", en: 'She already knew she would not be going to work the next day.' },
    ],
    questions: [
      q('What was in the suitcase?', ['A notebook and a photo', 'Clothes and money', 'Nothing'], 0),
      q('What was unusual about the notebook?', ['Every address but one was crossed out', 'It was empty', 'It was written in English'], 0),
      q('What does Léa decide?', ['To go to Saint-Malo instead of work', 'To hand it to the police', 'To go home'], 0),
    ],
  },
  {
    id: 'st-valise-3',
    kind: 'story',
    serial: 'la-valise',
    part: 3,
    of: 3,
    cefr: 'B1',
    title: 'La valise — 3. La maison bleue',
    description: 'Part three. The blue house, and the answer.',
    lines: [
      { fr: "La rue des Lilas montait vers la mer. Au numéro 14, la maison était bien bleue, mais délavée.", en: 'Rue des Lilas climbed towards the sea. At number 14 the house was indeed blue, but faded.' },
      { fr: "Une femme d'environ soixante-dix ans a ouvert avant même que Léa ait frappé.", en: 'A woman of about seventy opened before Léa had even knocked.' },
      { fr: "« Vous l'avez trouvée », a-t-elle dit. Ce n'était pas une question.", en: '"You found it," she said. It was not a question.' },
      { fr: "Elle a expliqué que son frère laissait la valise dans une gare différente chaque année.", en: 'She explained that her brother left the suitcase in a different station every year.' },
      { fr: "« Il dit que quelqu'un finit toujours par la rapporter. Il dit que ça prouve quelque chose. »", en: '"He says somebody always ends up bringing it back. He says it proves something."' },
      { fr: "Léa a demandé ce que ça prouvait, exactement.", en: 'Léa asked what exactly it proved.' },
      { fr: "La femme a souri et a mis la bouilloire en route. « Vous êtes venue de Nantes, non ? Voilà. »", en: 'The woman smiled and put the kettle on. "You came from Nantes, didn\'t you? There you are."' },
    ],
    questions: [
      q('Who opens the door?', ['A woman of about seventy', 'A young man', 'Nobody'], 0),
      q('Why does the brother leave the suitcase?', ['To prove someone will always return it', 'To hide money', 'By accident'], 0),
      q('What is the woman’s answer to Léa’s question?', ['Léa’s journey is itself the proof', 'She refuses to say', 'She gives her the notebook'], 0),
    ],
  },
];

export const PODCAST_TRACKS = [
  {
    id: 'pod-apprendre',
    kind: 'podcast',
    cefr: 'B1',
    title: 'Pourquoi on oublie ce qu’on apprend',
    description: 'A study-skills monologue — and a rare chance to hear the vocabulary of learning in French.',
    lines: [
      { fr: "On a tous vécu ça : on révise une liste de mots le soir, et le lendemain, il n'en reste presque rien.", en: 'We have all been through it: you revise a word list in the evening and by the next day almost nothing is left.' },
      { fr: "Ce n'est pas un problème de mémoire. C'est un problème de calendrier.", en: 'It is not a memory problem. It is a scheduling problem.' },
      { fr: "Notre cerveau efface ce qu'il juge inutile, et « inutile » veut dire : jamais redemandé.", en: 'Our brain deletes what it judges useless, and "useless" means: never asked for again.' },
      { fr: "D'où l'idée de la répétition espacée : revoir un mot juste avant de l'oublier.", en: 'Hence the idea of spaced repetition: reviewing a word just before you forget it.' },
      { fr: "Le moment idéal n'est pas quand c'est facile. C'est quand ça résiste un peu.", en: 'The ideal moment is not when it is easy. It is when it puts up a bit of resistance.' },
      { fr: "Autrement dit, si la révision est confortable, elle est probablement inutile.", en: 'In other words, if revision is comfortable, it is probably useless.' },
      { fr: "Alors la prochaine fois que vous hésitez sur un mot, réjouissez-vous : c'est là que ça compte.", en: 'So next time you hesitate over a word, be glad: that is where it counts.' },
    ],
    questions: [
      q('What does the speaker say forgetting is really about?', ['Scheduling, not memory', 'Intelligence', 'Age'], 0),
      q('When is the ideal review moment?', ['Just before you forget', 'Immediately after learning', 'A year later'], 0),
      q('What does the speaker say about comfortable revision?', ['It is probably useless', 'It is the most effective', 'It suits beginners'], 0),
    ],
  },
  {
    id: 'pod-boulot',
    kind: 'podcast',
    cefr: 'B2',
    title: 'La semaine de quatre jours, vraiment ?',
    description: 'A columnist weighs the four-day week — argument vocabulary at natural pace.',
    lines: [
      { fr: "L'idée revient chaque année, et chaque année on nous promet le même miracle.", en: 'The idea comes back every year, and every year we are promised the same miracle.' },
      { fr: "Certes, les expériences menées à l'étranger montrent des résultats encourageants.", en: 'Admittedly, trials run abroad show encouraging results.' },
      { fr: "Force est de constater, toutefois, que la plupart concernent des bureaux, rarement des hôpitaux.", en: 'It has to be said, however, that most concern offices, rarely hospitals.' },
      { fr: "Dans la mesure où le travail se mesure en heures, réduire la semaine revient à réduire la production.", en: 'Insofar as work is measured in hours, cutting the week amounts to cutting output.' },
      { fr: "Sauf, précisément, si l'on cesse de mesurer le travail en heures.", en: 'Except, precisely, if we stop measuring work in hours.' },
      { fr: "C'est là que le débat devient intéressant, et c'est là qu'il s'arrête généralement.", en: 'That is where the debate becomes interesting, and that is where it generally stops.' },
      { fr: "En somme, la question n'est pas tant le nombre de jours que ce qu'on attend d'une journée.", en: 'In short, the question is less the number of days than what we expect from a day.' },
    ],
    questions: [
      q('What limitation does the speaker raise about the trials?', ['They mostly cover offices, not hospitals', 'They were too short', 'They were not published'], 0),
      q('What does the speaker say the real question is?', ['What we expect from a day, not the number of days', 'How much people are paid', 'Which country tried it first'], 0),
      q('What is the speaker’s tone?', ['Sceptical but open', 'Enthusiastic', 'Hostile'], 0),
    ],
  },
];

export const DIALOGUE_TRACKS = [
  {
    id: 'dl-colocation',
    kind: 'dialogue',
    cefr: 'B1',
    title: 'Visite d’une colocation',
    description: 'Three speakers, overlapping questions — the messy shape of real conversation.',
    lines: [
      { speaker: 'A', fr: "Alors, voilà le salon. C'est un peu en désordre, désolé, on a fait une soirée hier.", en: 'So, this is the living room. It is a bit messy, sorry, we had people over last night.' },
      { speaker: 'B', fr: "Pas de souci. Et la chambre qui se libère, c'est laquelle ?", en: 'No worries. And which room is coming free?' },
      { speaker: 'A', fr: "Celle du fond, à droite. Elle est petite mais elle donne sur la cour, donc c'est calme.", en: 'The one at the end, on the right. It is small but it looks onto the courtyard, so it is quiet.' },
      { speaker: 'B', fr: "Le loyer, c'est bien 420 charges comprises ?", en: 'The rent is 420 including bills, is that right?' },
      { speaker: 'A', fr: "420 hors charges, en fait. Comptez une trentaine d'euros de plus.", en: 'It is 420 excluding bills, in fact. Reckon on about thirty euros more.' },
      { speaker: 'B', fr: "D'accord. Et vous êtes combien en tout ?", en: 'Right. And how many of you are there in total?' },
      { speaker: 'A', fr: "Quatre. Enfin, trois et demi — Marius est presque toujours chez sa copine.", en: 'Four. Well, three and a half — Marius is nearly always at his girlfriend\'s.' },
      { speaker: 'B', fr: "Ça marche. Je peux revoir la chambre cinq minutes ?", en: 'That works. Can I see the room again for five minutes?' },
    ],
    questions: [
      q('Is the rent inclusive of bills?', ['No, add about €30', 'Yes, fully inclusive', 'Bills are free'], 0),
      q('Why does the flatmate say "three and a half"?', ['One is rarely there', 'One is a child', 'One is moving out'], 0),
      q('What does the visitor ask at the end?', ['To see the room again', 'To sign the contract', 'To meet the landlord'], 0),
    ],
  },
  {
    id: 'dl-reclamation',
    kind: 'dialogue',
    cefr: 'B2',
    title: 'Une réclamation qui tourne mal',
    description: 'A complaint escalating politely — register control under pressure.',
    lines: [
      { speaker: 'A', fr: "Bonjour, j'ai commandé ce meuble il y a six semaines et il est arrivé abîmé.", en: 'Hello, I ordered this piece of furniture six weeks ago and it arrived damaged.' },
      { speaker: 'B', fr: "Je comprends. Vous avez le bon de livraison ?", en: 'I understand. Do you have the delivery note?' },
      { speaker: 'A', fr: "Bien sûr, le voici. J'ai signalé le problème le jour même, par mail.", en: 'Of course, here it is. I reported the problem the same day, by email.' },
      { speaker: 'B', fr: "Le souci, c'est que le délai de réclamation est de quarante-huit heures.", en: 'The trouble is the claim window is forty-eight hours.' },
      { speaker: 'A', fr: "Justement, j'ai écrit dans les vingt-quatre heures. J'ai l'accusé de réception.", en: 'Precisely — I wrote within twenty-four hours. I have the delivery receipt.' },
      { speaker: 'B', fr: "Ah, dans ce cas, ça change tout. Je vais voir ce que je peux faire.", en: 'Ah, in that case, that changes everything. Let me see what I can do.' },
      { speaker: 'A', fr: "Je vous en serais reconnaissant. J'aimerais éviter d'écrire au service consommateurs.", en: 'I would be grateful. I would rather not have to write to consumer services.' },
      { speaker: 'B', fr: "Ce ne sera pas nécessaire. On vous renvoie une pièce neuve sous huit jours.", en: 'That will not be necessary. We will send you a new part within a week.' },
    ],
    questions: [
      q('What resolves the dispute?', ['Proof the complaint was in time', 'A refund request', 'A manager'], 0),
      q('What does the customer imply by mentioning consumer services?', ['A polite threat to escalate', 'That they work there', 'That they are lost'], 0),
      q('What is the outcome?', ['A replacement part within a week', 'A full refund', 'Nothing'], 0),
    ],
  },
];

export const NEWS_TRACKS = [
  {
    id: 'nw-transports',
    kind: 'news',
    cefr: 'B1',
    title: 'Journal — transports et météo',
    description: 'Adapted bulletin: slower, but with the real syntax of broadcast news.',
    lines: [
      { fr: "Il est huit heures, voici les titres.", en: 'It is eight o\'clock, here are the headlines.' },
      { fr: "La circulation des trains reste perturbée dans l'ouest du pays après l'orage d'hier soir.", en: 'Train services remain disrupted in the west of the country after last night\'s storm.' },
      { fr: "Selon la compagnie, le trafic reprendra progressivement en début d'après-midi.", en: 'According to the operator, services will gradually resume in the early afternoon.' },
      { fr: "Les voyageurs sont invités à reporter leur déplacement si cela leur est possible.", en: 'Travellers are advised to postpone their journey where possible.' },
      { fr: "Côté météo, une amélioration est attendue à partir de jeudi.", en: 'On the weather, an improvement is expected from Thursday.' },
      { fr: "Enfin, en économie, le chômage aurait légèrement reculé au dernier trimestre.", en: 'Finally, in economics, unemployment has reportedly fallen slightly in the last quarter.' },
    ],
    questions: [
      q('Why are trains disrupted?', ['A storm', 'A strike', 'Engineering work'], 0),
      q('When will services resume?', ['Early afternoon', 'Immediately', 'Thursday'], 0),
      q('Why does the newsreader say "aurait reculé"?', ['The figure is not yet confirmed', 'It is a conditional wish', 'It happened long ago'], 0),
    ],
  },
  {
    id: 'nw-education',
    kind: 'news',
    cefr: 'B2',
    title: 'Journal — réforme et réactions',
    description: 'A fuller bulletin with reported speech and hedged attribution.',
    lines: [
      { fr: "Le ministère a présenté ce matin les grandes lignes de sa réforme des programmes.", en: 'The ministry this morning set out the main lines of its curriculum reform.' },
      { fr: "Le texte prévoit une augmentation du nombre d'heures consacrées aux langues vivantes.", en: 'The text provides for an increase in the hours devoted to modern languages.' },
      { fr: "Les syndicats, eux, dénoncent une mesure annoncée sans moyens supplémentaires.", en: 'The unions, for their part, denounce a measure announced with no extra resources.' },
      { fr: "« On nous demande davantage à effectifs constants », a déclaré une représentante.", en: '"We are being asked to do more with the same staffing," a representative said.' },
      { fr: "Le ministère assure de son côté qu'un plan de recrutement suivra à la rentrée.", en: 'The ministry, for its part, insists a recruitment plan will follow in September.' },
      { fr: "Selon plusieurs sources, les discussions se poursuivraient jusqu'à la fin du mois.", en: 'According to several sources, talks are said to be continuing until the end of the month.' },
    ],
    questions: [
      q('What does the reform propose?', ['More hours for modern languages', 'Fewer exams', 'Longer holidays'], 0),
      q('What is the unions’ objection?', ['No extra resources', 'The subject choice', 'The timing'], 0),
      q('What does "se poursuivraient" signal?', ['Unconfirmed report', 'A completed action', 'A command'], 0),
    ],
  },
];

export const NEW_LISTENING_TRACKS = [
  ...STORY_TRACKS,
  ...PODCAST_TRACKS,
  ...DIALOGUE_TRACKS,
  ...NEWS_TRACKS,
];

/**
 * Video.
 *
 * The app ships no video: it is a no-backend PWA and bundling or hot-linking
 * media would break offline use and rot within a year. What it can honestly
 * do is point at the sources worth watching at each level, with what makes
 * each one suitable — which is the part a learner cannot work out alone.
 *
 * No URLs are embedded; the names are stable and searchable, and a dead link
 * in an offline app is worse than none.
 */
export const VIDEO_GUIDE = [
  { cefr: 'A1', name: 'Extra French', kind: 'Sitcom for learners', why: 'Scripted at beginner pace with visual context carrying the meaning.' },
  { cefr: 'A2', name: 'Peppa Pig en français', kind: "Children's animation", why: 'Short episodes, present tense, huge repetition — unglamorous and effective.' },
  { cefr: 'A2', name: 'Français Authentique', kind: 'Slow explainer videos', why: 'Deliberately clear delivery with no English.' },
  { cefr: 'B1', name: 'InnerFrench', kind: 'Long-form explainer', why: 'B1-pitched monologue on real subjects; the bridge most learners are missing.' },
  { cefr: 'B1', name: 'Arte — Le Dessous des Cartes', kind: 'Documentary shorts', why: 'Maps and graphics carry the argument while you catch the French.' },
  { cefr: 'B2', name: 'France 24 / TV5Monde journals', kind: 'News', why: 'Standard broadcast register; subtitles available on TV5Monde\'s learning site.' },
  { cefr: 'B2', name: 'Les Bonobos / Karambolage (Arte)', kind: 'Culture shorts', why: 'Idiomatic speech at natural pace, short enough to rewatch.' },
  { cefr: 'C1', name: 'French cinema without subtitles', kind: 'Feature film', why: 'Overlapping speech, regional accents and slang — the real ceiling test.' },
  { cefr: 'C1', name: 'France Culture debates', kind: 'Panel discussion', why: 'Fast interruption-driven argument; the hardest listening there is.' },
];

export const videoGuideFor = (cefr) => VIDEO_GUIDE.filter((v) => v.cefr === cefr);
