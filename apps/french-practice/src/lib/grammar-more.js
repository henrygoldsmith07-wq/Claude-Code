// Wave three of the grammar library: high-frequency gaps and advanced
// polish (A1–C1). Same shape as grammar.js / grammar-extra.js.

export const MORE_GRAMMAR_TOPICS = [
  {
    id: 'genre-nombre',
    cefr: 'A1',
    title: 'Genre & nombre',
    summary: 'Masculine, feminine, plural — and the endings that mark them.',
    explanation: {
      rule: 'Most nouns are **masculine** or **feminine** by convention (un livre / une table). Adjectives agree: **petit / petite / petits / petites**. Plurals usually add **-s** (silent). Watch: **beau → belle**, **vieux → vieille**, **nouveau → nouvelle**.',
      examples: [
        { fr: 'un petit chat / une petite chatte', en: 'a small tomcat / a small female cat' },
        { fr: 'des livres intéressants', en: 'interesting books' },
        { fr: 'une vieille maison blanche', en: 'an old white house' },
      ],
      watchOut: 'Final consonants often appear only in the feminine: grand → grande, français → française.',
    },
    drills: [
      { q: 'Une ___ (grand) maison.', options: ['grande', 'grand', 'grands'], answer: 0, why: 'Feminine singular: grande.' },
      { q: 'Des ___ (beau) enfants.', options: ['beaux', 'belle', 'beau'], answer: 0, why: 'Masculine plural of beau: beaux.' },
      { q: 'Ma ___ (vieux) voiture.', options: ['vieille', 'vieux', 'vieil'], answer: 0, why: 'Feminine of vieux: vieille.' },
      { q: 'Un ___ (nouveau) ami.', options: ['nouvel', 'nouvelle', 'nouveaux'], answer: 0, why: 'Before a vowel: nouvel ami.' },
      { q: 'Des roses ___ (blanc).', options: ['blanches', 'blancs', 'blanche'], answer: 0, why: 'Feminine plural: blanches.' },
    ],
    build: [
      { fr: 'Une petite table ronde', en: 'A small round table' },
      { fr: 'De beaux jours d\'été', en: 'Beautiful summer days' },
    ],
    quiz: [
      { q: 'Feminine of «actif»:', options: ['active', 'actifve', 'actife'], answer: 0, why: '-if → -ive.' },
      { q: '«the old man» before a vowel:', options: ['le vieil homme', 'le vieux homme', 'la vieille homme'], answer: 0, why: 'Vieux → vieil before a vowel sound.' },
      { q: 'Plural of «journal»:', options: ['journaux', 'journals', 'journales'], answer: 0, why: '-al → -aux for many nouns.' },
      { q: 'Agree: «Elle est ___ (fatigué).»', options: ['fatiguée', 'fatigué', 'fatigués'], answer: 0, why: 'être + adjective agrees with elle.' },
    ],
  },
  {
    id: 'adjectifs-place',
    cefr: 'A2',
    title: 'Place des adjectifs',
    summary: 'Before or after the noun — and how meaning shifts.',
    explanation: {
      rule: 'Most descriptive adjectives follow the noun: «une voiture **rouge**». A short set often comes **before**: beau, bon, grand, petit, jeune, vieux, nouveau, joli, mauvais, autre… Some change meaning: «un grand homme» (great) vs «un homme grand» (tall).',
      examples: [
        { fr: 'une petite maison bleue', en: 'a small blue house' },
        { fr: 'un bon restaurant italien', en: 'a good Italian restaurant' },
        { fr: 'ma propre chambre / une chambre propre', en: 'my own room / a clean room' },
      ],
      watchOut: 'Nationality and colour almost always follow: «un livre français», «une robe noire».',
    },
    drills: [
      { q: 'une ___ (rouge) robe → natural order:', options: ['robe rouge', 'rouge robe', 'robes rouge'], answer: 0, why: 'Colour follows the noun.' },
      { q: '___ (beau) jour:', options: ['un beau jour', 'un jour beau', 'une belle jour'], answer: 0, why: 'Beau is in the “before” set.' },
      { q: '«a great man» (famous):', options: ['un grand homme', 'un homme grand', 'un grand hommes'], answer: 0, why: 'Grand before = great (figurative).' },
      { q: '«my own idea»:', options: ['ma propre idée', 'mon idée propre', 'propre mon idée'], answer: 0, why: 'Propre before = own.' },
    ],
    build: [
      { fr: 'Un petit café sympa', en: 'A nice little café' },
      { fr: 'Une vieille chanson française', en: 'An old French song' },
    ],
    quiz: [
      { q: 'Where does «italien» usually go?', options: ['after the noun', 'before the noun', 'either freely'], answer: 0, why: 'Nationality adjectives follow.' },
      { q: '«un homme grand» means primarily:', options: ['a tall man', 'a great man', 'an old man'], answer: 0, why: 'Grand after = physical height.' },
      { q: 'Pick the natural phrase:', options: ['une jolie fleur blanche', 'une blanche jolie fleur', 'une fleur jolie blanche'], answer: 0, why: 'BAGS-ish adjective before, colour after.' },
      { q: '«another book»:', options: ['un autre livre', 'un livre autre', 'autre un livre'], answer: 0, why: 'Autre comes before.' },
    ],
  },
  {
    id: 'depuis-pendant',
    cefr: 'A2',
    title: 'Depuis, pendant, il y a',
    summary: 'How long, for how long, and how long ago — three different tools.',
    explanation: {
      rule: '**Depuis** = since / for (still true now): «j\'habite ici **depuis** 2020». **Pendant** = for a completed duration: «j\'ai vécu à Lyon **pendant** trois ans». **Il y a** = ago: «je l\'ai vu **il y a** deux jours».',
      examples: [
        { fr: 'Je travaille ici depuis six mois.', en: 'I have been working here for six months.' },
        { fr: 'Elle a dormi pendant dix heures.', en: 'She slept for ten hours.' },
        { fr: 'On s\'est rencontrés il y a un an.', en: 'We met a year ago.' },
      ],
      watchOut: 'English “for” maps to both depuis and pendant — choose by whether the action continues now.',
    },
    drills: [
      { q: 'J\'apprends le français ___ deux ans. (still learning)', options: ['depuis', 'pendant', 'il y a'], answer: 0, why: 'Ongoing → depuis.' },
      { q: 'Le film a duré ___ deux heures.', options: ['pendant', 'depuis', 'il y a'], answer: 0, why: 'Completed duration → pendant.' },
      { q: 'Je l\'ai appelée ___ une semaine.', options: ['il y a', 'depuis', 'pendant'], answer: 0, why: 'Ago → il y a.' },
      { q: 'Il pleut ___ ce matin. (still raining)', options: ['depuis', 'pendant', 'il y a'], answer: 0, why: 'Started earlier, still true → depuis.' },
    ],
    build: [
      { fr: 'J\'attends depuis une heure', en: 'I have been waiting for an hour' },
      { fr: 'Il est parti il y a dix minutes', en: 'He left ten minutes ago' },
    ],
    quiz: [
      { q: '«for three years» if you still live there:', options: ['depuis trois ans', 'pendant trois ans', 'il y a trois ans'], answer: 0, why: 'Ongoing state → depuis.' },
      { q: '«for three years» if you no longer live there:', options: ['pendant trois ans', 'depuis trois ans', 'il y a trois ans'], answer: 0, why: 'Finished period → pendant.' },
      { q: '«two days ago»:', options: ['il y a deux jours', 'depuis deux jours', 'pendant deux jours'], answer: 0, why: 'Ago = il y a.' },
      { q: 'Wrong: «J\'habite ici pendant 2020.» Fix idea:', options: ['Use depuis 2020', 'Use il y a 2020', 'Drop the year'], answer: 0, why: 'Still living there → depuis.' },
    ],
  },
  {
    id: 'y-en',
    cefr: 'B1',
    title: 'Les pronoms y et en',
    summary: 'Replace places (y) and quantities / de-phrases (en).',
    explanation: {
      rule: '**Y** replaces à + place or à + thing: «Tu vas à Paris ? — J\'**y** vais.» **En** replaces de + noun or a quantity: «Tu veux du pain ? — J\'**en** veux.» Order with other pronouns: me/te/se/nous/vous · **y** · **en**.',
      examples: [
        { fr: 'J\'y pense souvent.', en: 'I often think about it.' },
        { fr: 'Elle en a trois.', en: 'She has three (of them).' },
        { fr: 'On y va ?', en: 'Shall we go (there)?' },
      ],
      watchOut: 'Penser **à** something → y; parler **de** something → en. «Je pense à Marie» cannot become *j\'y pense* for a person — keep «à elle».',
    },
    drills: [
      { q: 'Tu vas au cinéma ? — Oui, j\'___ vais.', options: ['y', 'en', 'le'], answer: 0, why: 'Au cinéma = à + place → y.' },
      { q: 'Tu as des frères ? — J\'___ ai deux.', options: ['en', 'y', 'les'], answer: 0, why: 'Quantity of frères → en.' },
      { q: 'Tu parles de ton voyage ? — J\'___ parle.', options: ['en', 'y', 'le'], answer: 0, why: 'De + thing → en.' },
      { q: 'Tu penses à tes examens ? — Oui, j\'___ pense.', options: ['y', 'en', 'les'], answer: 0, why: 'Penser à + thing → y.' },
    ],
    build: [
      { fr: 'J\'y vais demain matin', en: 'I\'m going there tomorrow morning' },
      { fr: 'Il en veut encore', en: 'He wants some more' },
    ],
    quiz: [
      { q: 'Replace «à la plage»: On va ___.', options: ['y', 'en', 'la'], answer: 0, why: 'Place with à → y.' },
      { q: 'Replace «des pommes»: J\'___ achète.', options: ['en', 'y', 'les'], answer: 0, why: 'Des + noun quantity → en.' },
      { q: '«Think about it» (idea):', options: ['J\'y pense', 'J\'en pense', 'Je le pense à'], answer: 0, why: 'Penser à → y.' },
      { q: '«I need some» (du lait):', options: ['J\'en ai besoin', 'J\'y ai besoin', 'Je l\'ai besoin'], answer: 0, why: 'Avoir besoin de → en.' },
    ],
  },
  {
    id: 'double-pronoms',
    cefr: 'B1',
    title: 'Double object pronouns',
    summary: 'me le, te la, lui en — stacking objects without chaos.',
    explanation: {
      rule: 'Order before the verb: **me/te/se/nous/vous** · **le/la/les** · **lui/leur** · **y** · **en**. In the affirmative imperative, pronouns flip after the verb with hyphens: «Donne-**le-moi** !»',
      examples: [
        { fr: 'Je te le donne.', en: 'I give it to you.' },
        { fr: 'Elle me l\'a envoyé.', en: 'She sent it to me.' },
        { fr: 'Donne-le-lui !', en: 'Give it to him/her!' },
      ],
      watchOut: 'Never *donne-moi-le* in standard French — direct object comes first in the imperative: donne-le-moi.',
    },
    drills: [
      { q: 'Je ___ explique. (the problem to you)', options: ['te l\'', 'le te', 't\'en'], answer: 0, why: 'Indirect te + direct le → te l\'.' },
      { q: 'Tu ___ as dit ? (it to them)', options: ['le leur', 'leur le', 'les leur'], answer: 0, why: 'le before leur.' },
      { q: 'Affirmative command: ___ ! (give it to me)', options: ['Donne-le-moi', 'Donne-moi-le', 'Me le donne'], answer: 0, why: 'Imperative: le before moi.' },
      { q: 'Negative command: ___ pas !', options: ['Ne me le donne', 'Ne le me donne', 'Donne-ne-me-le'], answer: 0, why: 'Negative keeps pre-verbal order: ne me le donne pas.' },
    ],
    build: [
      { fr: 'Je vous les envoie demain', en: 'I\'ll send them to you tomorrow' },
      { fr: 'Montre-la-nous', en: 'Show it to us' },
    ],
    quiz: [
      { q: '«I give them to him»:', options: ['Je les lui donne', 'Je lui les donne', 'Je le leur donne'], answer: 0, why: 'les (DO) before lui (IO).' },
      { q: '«Send it to me!» (affirmative):', options: ['Envoie-le-moi !', 'Envoie-moi-le !', 'Me l\'envoie !'], answer: 0, why: 'Imperative hyphen chain: le-moi.' },
      { q: '«She told me about it»:', options: ['Elle m\'en a parlé', 'Elle me y a parlé', 'Elle m\'y en a parlé'], answer: 0, why: 'Parler de → en with m\'.' },
      { q: 'Order: me + le →', options: ['me le', 'le me', 'moi le'], answer: 0, why: 'Personal IO before direct le/la/les.' },
    ],
  },
  {
    id: 'si-clauses',
    cefr: 'B1',
    title: 'Les phrases avec si',
    summary: 'Real, hypothetical and past hypothetical — three classic patterns.',
    explanation: {
      rule: '**Si + présent → futur/présent**: real possibility. **Si + imparfait → conditionnel**: hypothetical now. **Si + plus-que-parfait → conditionnel passé**: regret about the past. Never put futur/conditionnel inside the si-clause itself.',
      examples: [
        { fr: 'S\'il pleut, on restera ici.', en: 'If it rains, we\'ll stay here.' },
        { fr: 'Si j\'étais riche, je voyagerais.', en: 'If I were rich, I would travel.' },
        { fr: 'Si j\'avais su, je serais venu.', en: 'If I had known, I would have come.' },
      ],
      watchOut: '«Si j\'aurais» is a classic error — use «si j\'avais».',
    },
    drills: [
      { q: 'Si tu ___ (vouloir), on y va.', options: ['veux', 'voudras', 'voudrais'], answer: 0, why: 'Real condition: si + présent.' },
      { q: 'Si j\'___ (avoir) le temps, je t\'aiderais.', options: ['avais', 'aurai', 'aurais'], answer: 0, why: 'Hypothetical: si + imparfait.' },
      { q: 'Si elle ___ (partir) plus tôt, elle aurait réussi.', options: ['était partie', 'partait', 'partira'], answer: 0, why: 'Past hypothetical: si + plus-que-parfait.' },
      { q: 'Wrong pattern:', options: ['Si j\'aurai le temps…', 'Si j\'ai le temps…', 'Si j\'avais le temps…'], answer: 0, why: 'No future after si.' },
    ],
    build: [
      { fr: 'Si tu es libre on déjeune ensemble', en: 'If you\'re free we\'ll have lunch together' },
      { fr: 'Si j\'étais toi je refuserais', en: 'If I were you I would refuse' },
    ],
    quiz: [
      { q: 'Match: si + imparfait →', options: ['conditionnel présent', 'futur simple', 'passé composé'], answer: 0, why: 'Classic hypothetical pair.' },
      { q: '«If I had known»:', options: ['Si j\'avais su', 'Si j\'aurais su', 'Si j\'ai su'], answer: 0, why: 'Plus-que-parfait after si.' },
      { q: 'Real future plan after si:', options: ['Si tu viens, on ira', 'Si tu viendras, on ira', 'Si tu venais, on ira'], answer: 0, why: 'Si + présent, result futur.' },
      { q: 'Regret pattern result tense:', options: ['conditionnel passé', 'imparfait', 'présent'], answer: 0, why: 'Si + PQP → conditionnel passé.' },
    ],
  },
  {
    id: 'inversion',
    cefr: 'B2',
    title: 'L\'inversion',
    summary: 'Formal questions and elegant emphasis: venez-vous ?',
    explanation: {
      rule: 'Subject pronoun flips after the verb with a hyphen: «**Parlez-vous** français ?» With a noun subject, keep the noun and add a pronoun: «**Pierre vient-il** ?» Complex tenses invert the auxiliary: «**Avez-vous** fini ?»',
      examples: [
        { fr: 'Où allez-vous ?', en: 'Where are you going?' },
        { fr: 'Marie a-t-elle téléphoné ?', en: 'Did Marie call?' },
        { fr: 'Est-ce que tu viens ?', en: 'Are you coming? (less formal alternative)' },
      ],
      watchOut: 'Add **-t-** between vowel sounds: «a-t-il», «parle-t-elle».',
    },
    drills: [
      { q: 'Formal: ___ français ? (you speak)', options: ['Parlez-vous', 'Vous parlez', 'Parlez vous'], answer: 0, why: 'Inversion + hyphen.' },
      { q: '«Has she left?»', options: ['Est-elle partie ?', 'Elle est-partie ?', 'Est partie-elle ?'], answer: 0, why: 'Invert auxiliary être.' },
      { q: 'With noun: Paul ___ ? (does he work)', options: ['travaille-t-il', 'travaille-il', 'il-travaille'], answer: 0, why: 'Noun + verb-t-pronoun.' },
      { q: '«Can one enter?»', options: ['Peut-on entrer ?', 'On peut-entrer ?', 'Peut on entrer ?'], answer: 0, why: 'On inverts: peut-on.' },
    ],
    build: [
      { fr: 'Avez-vous un moment ?', en: 'Do you have a moment?' },
      { fr: 'Que voulez-vous dire ?', en: 'What do you mean?' },
    ],
    quiz: [
      { q: 'Why «a-t-elle» needs t:', options: ['to separate two vowel sounds', 'because elle is feminine', 'for the passé composé'], answer: 0, why: 'Euphonic -t-.' },
      { q: 'Least formal of these:', options: ['Tu viens ?', 'Venez-vous ?', 'Venez-vous bien ?'], answer: 0, why: 'Rising intonation alone is casual.' },
      { q: 'Invert: «Vous avez compris.»', options: ['Avez-vous compris ?', 'Avez compris-vous ?', 'Vous-avez compris ?'], answer: 0, why: 'Auxiliary first.' },
      { q: '«Where does she live?» formal:', options: ['Où habite-t-elle ?', 'Où elle habite ?', 'Où habite elle ?'], answer: 0, why: 'Full inversion with -t-.' },
    ],
  },
  {
    id: 'faire-causatif',
    cefr: 'B2',
    title: 'Faire + infinitif (causatif)',
    summary: 'Have something done — faire réparer, se faire couper.',
    explanation: {
      rule: '**Faire + infinitive** means to have/make someone do something: «Je **fais réparer** ma voiture.» Reflexive **se faire** + infinitive: «Je **me fais couper** les cheveux.» The person who acts is often introduced by **par** or **à**.',
      examples: [
        { fr: 'On fait livrer les courses.', en: 'We have the shopping delivered.' },
        { fr: 'Elle s\'est fait voler mon vélo. (attention au sens)', en: 'She had her bike stolen / got her bike stolen.' },
        { fr: 'Fais-le entrer.', en: 'Have him come in / Show him in.' },
      ],
      watchOut: '«Se faire + infinitive» can mean a service you arranged or something that happened to you — context decides.',
    },
    drills: [
      { q: 'Je ___ nettoyer mon appart. (have cleaned)', options: ['fais', 'laisse', 'mets'], answer: 0, why: 'Causative faire.' },
      { q: 'Elle ___ couper les cheveux. (has her hair cut)', options: ['se fait', 'fait se', 'se laisse'], answer: 0, why: 'Se faire + infinitive.' },
      { q: 'On a ___ construire une maison.', options: ['fait', 'laissé', 'eu'], answer: 0, why: 'Faire construire = have built.' },
      { q: 'Fais-___ patienter. (them wait)', options: ['les', 'leur', 'eux'], answer: 0, why: 'Direct object of faire + infinitive: les.' },
    ],
    build: [
      { fr: 'Je fais réparer mon ordinateur', en: 'I\'m having my computer repaired' },
      { fr: 'Il s\'est fait opérer hier', en: 'He had an operation yesterday' },
    ],
    quiz: [
      { q: '«Have the letter sent»:', options: ['Faire envoyer la lettre', 'Envoyer faire la lettre', 'Laisser envoyer la lettre (same always)'], answer: 0, why: 'Faire + infinitive.' },
      { q: 'Pronoun: «I have it done»:', options: ['Je le fais faire', 'Je lui fais faire (always)', 'Je fais le faire'], answer: 0, why: 'le before faire.' },
      { q: '«She had a dress made»:', options: ['Elle s\'est fait faire une robe', 'Elle a fait se faire une robe', 'Elle s\'a fait une robe'], answer: 0, why: 'Se faire faire is common for clothes.' },
      { q: 'Agent: often after', options: ['par / à', 'de / en', 'avec / sans'], answer: 0, why: 'Faire faire X par/à quelqu\'un.' },
    ],
  },
  {
    id: 'mise-en-relief',
    cefr: 'B2',
    title: 'Mise en relief (c\'est… qui/que)',
    summary: 'Highlight a piece of the sentence for emphasis.',
    explanation: {
      rule: 'To stress a subject: **C\'est X qui** + verb. To stress an object or other element: **C\'est X que**… «**C\'est Marie qui** a appelé.» «**C\'est demain que** je pars.» Also: **ce qui / ce que** for free relative clauses.',
      examples: [
        { fr: 'C\'est toi qui as raison.', en: 'You\'re the one who is right.' },
        { fr: 'C\'est le train que j\'ai raté.', en: 'It\'s the train that I missed.' },
        { fr: 'Ce qui m\'étonne, c\'est son calme.', en: 'What surprises me is his calm.' },
      ],
      watchOut: 'Agreement: «C\'est moi qui **suis**» (verb agrees with the real subject after qui).',
    },
    drills: [
      { q: '___ Paul qui a payé.', options: ['C\'est', 'Il est', 'Ce sont'], answer: 0, why: 'C\'est + name + qui.' },
      { q: 'C\'est moi qui ___ (être) responsable.', options: ['suis', 'est', 'es'], answer: 0, why: 'Verb agrees with moi → suis.' },
      { q: '___ m\'intéresse, c\'est le projet.', options: ['Ce qui', 'Ce que', 'Qui'], answer: 0, why: 'Ce qui as free subject.' },
      { q: 'C\'est demain ___ on se voit.', options: ['que', 'qui', 'dont'], answer: 0, why: 'Emphasised adverbial → que.' },
    ],
    build: [
      { fr: 'C\'est elle qui a gagné', en: 'She\'s the one who won' },
      { fr: 'Ce que je veux c\'est du calme', en: 'What I want is peace and quiet' },
    ],
    quiz: [
      { q: 'Emphasise subject «les enfants»:', options: ['Ce sont les enfants qui…', 'C\'est les enfants que…', 'Il est les enfants qui…'], answer: 0, why: 'Plural people often ce sont… qui.' },
      { q: '«What I fear is…»:', options: ['Ce que je crains, c\'est…', 'Ce qui je crains, c\'est…', 'Que je crains, c\'est…'], answer: 0, why: 'Ce que as free object.' },
      { q: 'Agreement after «c\'est nous qui»:', options: ['sommes', 'est', 'êtes'], answer: 0, why: 'Verb matches nous.' },
      { q: 'Pick natural emphasis:', options: ['C\'est à Paris que j\'habite', 'C\'est j\'habite à Paris que', 'Qui c\'est à Paris j\'habite'], answer: 0, why: 'C\'est + place + que.' },
    ],
  },
  {
    id: 'participe-present',
    cefr: 'B2',
    title: 'Participe présent & adjectif verbal',
    summary: 'en parlant vs une histoire intéressante — form and function.',
    explanation: {
      rule: 'The **participe présent** (en **-ant**) is invariable as a verb form: «**en parlant**». The **adjectif verbal** looks similar but agrees: «des livres **intéressants**». Not every -ant word can do both jobs.',
      examples: [
        { fr: 'En ouvrant la porte, j\'ai vu le chat.', en: 'On opening the door, I saw the cat.' },
        { fr: 'Une solution convaincante', en: 'A convincing solution' },
        { fr: 'Des enfants fatiguants / des parents fatigués', en: 'Tiring children / tired parents' },
      ],
      watchOut: 'Spelling splits: fatiguant (adj.) vs fatiguant/fatigué senses; convaincant vs convainquant (rare as participle).',
    },
    drills: [
      { q: '___ (regarder) le ciel, elle a souri. (gérondif)', options: ['En regardant', 'Regardante', 'Regardé'], answer: 0, why: 'Gérondif: en + -ant.' },
      { q: 'Des arguments ___ (convaincre as adj.).', options: ['convaincants', 'convainquants', 'convaincus'], answer: 0, why: 'Adjectif verbal: convaincant.' },
      { q: 'Invariable form:', options: ['en courant', 'courante (always)', 'courants'], answer: 0, why: 'Participle/gerund doesn\'t agree.' },
      { q: '«a fascinating film»:', options: ['un film fascinant', 'un film fascinante', 'un film en fascinant'], answer: 0, why: 'Adjective after noun, agrees in gender/number with film (m).' },
    ],
    build: [
      { fr: 'En attendant le bus j\'ai lu', en: 'While waiting for the bus I read' },
      { fr: 'Une idée intéressante', en: 'An interesting idea' },
    ],
    quiz: [
      { q: 'Gérondif of faire:', options: ['en faisant', 'en faissant', 'en ferant'], answer: 0, why: 'Faisant.' },
      { q: 'Which agrees?', options: ['adjectif verbal', 'participe présent verbal', 'both always'], answer: 0, why: 'Only the adjectival use agrees.' },
      { q: '«Tired parents» (feeling tired):', options: ['des parents fatigués', 'des parents fatiguants', 'des parents en fatiguant'], answer: 0, why: 'Fatigué = feeling tired.' },
      { q: 'Simultaneous action marker:', options: ['en + -ant', 'après + -ant', 'pour + -ant only'], answer: 0, why: 'En + present participle.' },
    ],
  },
  {
    id: 'passe-simple',
    cefr: 'C1',
    title: 'Le passé simple (lecture)',
    summary: 'Literary past tense — recognise it when you read.',
    explanation: {
      rule: 'The **passé simple** is the written narrative past (novels, history, news features). Spoken French uses passé composé instead. Learn to **read** endings: il **parla**, ils **finirent**, il **fut**, il **eut**, il **fit**.',
      examples: [
        { fr: 'Il ouvrit la porte et entra.', en: 'He opened the door and went in.' },
        { fr: 'Elle fut surprise.', en: 'She was surprised.' },
        { fr: 'Ils firent un long voyage.', en: 'They made a long journey.' },
      ],
      watchOut: 'You rarely need to produce passé simple in speech — recognition unlocks literature.',
    },
    drills: [
      { q: 'Passé simple of «il a parlé» in literary style:', options: ['il parla', 'il parlait', 'il parlera'], answer: 0, why: 'Simple past narrative: parla.' },
      { q: '«elle fut» corresponds to:', options: ['elle a été', 'elle était (same always)', 'elle sera'], answer: 0, why: 'Fut = passé simple of être ≈ a été in speech.' },
      { q: '«ils firent» is from:', options: ['faire', 'finir', 'falloir'], answer: 0, why: 'Faire → ils firent.' },
      { q: 'Spoken equivalent of «il partit»:', options: ['il est parti', 'il partait', 'il partira'], answer: 0, why: 'Narrated event → passé composé in speech.' },
    ],
    build: [
      { fr: 'Il regarda puis sourit', en: 'He looked then smiled (literary)' },
      { fr: 'Nous fûmes étonnés', en: 'We were astonished (literary)' },
    ],
    quiz: [
      { q: 'Main use of passé simple today:', options: ['written narrative', 'café chat', 'texting friends'], answer: 0, why: 'Literary/journalistic writing.' },
      { q: '«il eut» is passé simple of:', options: ['avoir', 'être', 'aller'], answer: 0, why: 'Avoir → il eut.' },
      { q: '«elles vinrent» comes from:', options: ['venir', 'vivre', 'voir'], answer: 0, why: 'Venir → vinrent.' },
      { q: 'Replace in speech: «Il prit le train.»', options: ['Il a pris le train.', 'Il prenait le train (always)', 'Il prendra le train.'], answer: 0, why: 'Passé composé for spoken completed event.' },
    ],
  },
  {
    id: 'nominalisation',
    cefr: 'C1',
    title: 'La nominalisation',
    summary: 'Turn verbs and adjectives into abstract nouns for formal style.',
    explanation: {
      rule: 'Formal French packs meaning into nouns: **décider → la décision**, **améliorer → l\'amélioration**, **libre → la liberté**. Prepositions shift: «améliorer le système» → «**l\'amélioration du** système».',
      examples: [
        { fr: 'La création d\'emplois', en: 'Job creation' },
        { fr: 'Le refus de commenter', en: 'The refusal to comment' },
        { fr: 'Suite à votre demande…', en: 'Further to your request…' },
      ],
      watchOut: 'Don\'t nominalise everything in speech — it sounds bureaucratic. Save it for essays, reports and news.',
    },
    drills: [
      { q: 'Nominalise «détruire»:', options: ['la destruction', 'le détruire', 'destructif'], answer: 0, why: '-tion noun.' },
      { q: '«améliorer la qualité» →', options: ['l\'amélioration de la qualité', 'l\'améliorer de qualité', 'la qualité améliorante'], answer: 0, why: 'de-phrase after noun.' },
      { q: 'Adjective «possible» → noun:', options: ['la possibilité', 'le possiblement', 'possibiler'], answer: 0, why: '-ité abstract noun.' },
      { q: 'Formal rewrite vibe:', options: ['La mise en place du dispositif', 'On a mis le truc', 'On a fait'], answer: 0, why: 'Nominal style of admin French.' },
    ],
    build: [
      { fr: 'La réussite du projet dépend de vous', en: 'The project\'s success depends on you' },
      { fr: 'Le développement durable', en: 'Sustainable development' },
    ],
    quiz: [
      { q: 'Nominalise «choisir»:', options: ['le choix', 'la choisement', 'choisirade'], answer: 0, why: 'Choix is the noun.' },
      { q: '«because they refused» more formal:', options: ['en raison de leur refus', 'parce qu\'ils ont dit non (only)', 'à cause ils refusent'], answer: 0, why: 'Nominalisation + en raison de.' },
      { q: 'Verb → -tion often marks:', options: ['abstract process', 'always a person', 'imperative'], answer: 0, why: 'Process/result nouns.' },
      { q: 'Risk of overuse:', options: ['heavy bureaucratic tone', 'too slangy', 'wrong tense'], answer: 0, why: 'Nominal style can feel stiff.' },
    ],
  },
  {
    id: 'registres',
    cefr: 'C1',
    title: 'Registres de langue',
    summary: 'Soutenu, courant, familier — choose the right gear.',
    explanation: {
      rule: '**Soutenu**: written, formal («je souhaite que vous veniez»). **Courant**: neutral speech. **Familier**: friends («je m\'en fous» — strong). Same idea, different clothing: «Comment allez-vous ? / Ça va ? / Ça roule ?»',
      examples: [
        { fr: 'Je vous serais reconnaissant de…', en: 'I would be grateful if you would… (formal)' },
        { fr: 'Tu peux m\'appeler ce soir ?', en: 'Can you call me tonight? (neutral/informal)' },
        { fr: 'Ça te dit d\'un café ?', en: 'Fancy a coffee? (casual)' },
      ],
      watchOut: 'Mixing registers (slang in a cover letter, courtroom French with mates) undermines credibility.',
    },
    drills: [
      { q: 'Most formal greeting:', options: ['Bonjour Madame', 'Salut !', 'Coucou'], answer: 0, why: 'Title + bonjour is formal-safe.' },
      { q: 'Casual «I\'m tired»:', options: ['Je suis crevé', 'Je suis fatigué (neutral)', 'both exist — pick crevé as more familiar'], answer: 0, why: 'Crevé is familier.' },
      { q: 'Cover letter closing style:', options: ['soutenu', 'argot', 'verlan-heavy'], answer: 0, why: 'Formal writing stays soutenu.' },
      { q: '«Je m\'en fous» is:', options: ['very familiar / rude if misused', 'perfect for job interviews', 'literary only'], answer: 0, why: 'Strong casual register.' },
    ],
    build: [
      { fr: 'Pourriez-vous me renseigner', en: 'Could you give me some information (formal)' },
      { fr: 'Tu peux m\'aider', en: 'Can you help me (informal)' },
    ],
    quiz: [
      { q: 'Best for a bank email:', options: ['Je me permets de vous contacter…', 'Yo, besoin d\'un truc', 'Wesh la banque'], answer: 0, why: 'Soutenu/courant polished.' },
      { q: '«Bouquin» is:', options: ['familier for livre', 'more formal than livre', 'not French'], answer: 0, why: 'Casual synonym.' },
      { q: 'Switching to tu too early risks:', options: ['sounding rude', 'sounding too formal', 'wrong tense'], answer: 0, why: 'Register / politeness.' },
      { q: 'News headline style tends toward:', options: ['nominal + compact', 'heavy slang', 'only questions'], answer: 0, why: 'Press French is noun-heavy and tight.' },
    ],
  },
  {
    id: 'ne-explétif',
    cefr: 'C1',
    title: 'Le «ne» explétif',
    summary: 'A ne that doesn\'t negate — after craindre, avant que, plus… que.',
    explanation: {
      rule: 'In formal style, **ne** can appear without **pas** after verbs of fear, prevention, or after comparatives: «Je crains qu\'il **ne** vienne», «avant qu\'il **ne** parte», «plus grand qu\'on **ne** le croit». It does **not** make the sentence negative.',
      examples: [
        { fr: 'Je crains qu\'il ne soit trop tard.', en: 'I fear it may be too late.' },
        { fr: 'Pars avant qu\'il ne pleuve.', en: 'Leave before it rains.' },
        { fr: 'Il est plus malin qu\'on ne le croit.', en: 'He is cleverer than people think.' },
      ],
      watchOut: 'In speech the explétif ne often drops. Keep it for writing and exams.',
    },
    drills: [
      { q: 'Formal: Je crains qu\'elle ___ (être) absente.', options: ['ne soit', 'n\'est pas', 'soit pas'], answer: 0, why: 'Fear + subjunctive + explétif ne.' },
      { q: 'Avant qu\'il ___ (arriver), range.', options: ['n\'arrive', 'n\'arrive pas', 'arrivera'], answer: 0, why: 'Avant que + subjunctive + optional explétif ne.' },
      { q: 'Does explétif ne negate?', options: ['No', 'Yes always', 'Only with pas'], answer: 0, why: 'It is not a true negation.' },
      { q: 'Comparative: plus… que l\'on ___ croit.', options: ['ne le', 'ne pas le', 'ne jamais le'], answer: 0, why: 'Explétif ne + le.' },
    ],
    build: [
      { fr: 'Je redoute qu\'il ne refuse', en: 'I dread that he might refuse' },
      { fr: 'Pars avant qu\'il ne soit trop tard', en: 'Leave before it\'s too late' },
    ],
    quiz: [
      { q: 'After «de peur que» you often find:', options: ['ne + subjunctive', 'pas only', 'future'], answer: 0, why: 'Fear constructions favour explétif ne + subj.' },
      { q: 'Spoken French often:', options: ['drops the explétif ne', 'requires double pas', 'forbids subjunctive'], answer: 0, why: 'Optional in speech.' },
      { q: '«plus… que» formal:', options: ['qu\'on ne le pense', 'qu\'on ne le pense pas (same)', 'que on ne pense'], answer: 0, why: 'Comparative + explétif ne.' },
      { q: 'Meaning of «Je crains qu\'il ne vienne»:', options: ['I fear he may come', 'I fear he is not coming (always)', 'I hope he comes'], answer: 0, why: 'Fear that he comes — ne is not pas.' },
    ],
  },
  {
    id: 'hypothese-avancee',
    cefr: 'C1',
    title: 'Hypothèse & concession avancées',
    summary: 'Quand bien même, fût-il, quoi que — polished what-ifs.',
    explanation: {
      rule: 'Higher registers pack hypothesis into **quand bien même**, **fût-ce**, **quoi que** + subjunctive, **où que**, **qui que**. Concession: **bien que**, **même si**, **encore que** (formal).',
      examples: [
        { fr: 'Quoi qu\'il arrive, j\'irai.', en: 'Whatever happens, I\'ll go.' },
        { fr: 'Où que tu ailles, appelle-moi.', en: 'Wherever you go, call me.' },
        { fr: 'Quand bien même il refuserait, on continue.', en: 'Even if he refused, we carry on.' },
      ],
      watchOut: '«Même si» takes indicative; «bien que» takes subjunctive.',
    },
    drills: [
      { q: 'Quoi qu\'il ___ (dire), écoute.', options: ['dise', 'dit', 'dira'], answer: 0, why: 'Quoi que + subjunctive.' },
      { q: 'Bien qu\'elle ___ (être) fatiguée, elle sort.', options: ['soit', 'est', 'sera'], answer: 0, why: 'Bien que + subjunctive.' },
      { q: 'Même s\'il ___ (pleuvoir), on marche.', options: ['pleut', 'pleuve', 'plût'], answer: 0, why: 'Même si + indicative.' },
      { q: 'Où que vous ___ (être)…', options: ['soyez', 'êtes', 'serez'], answer: 0, why: 'Où que + subjunctive.' },
    ],
    build: [
      { fr: 'Quoi qu\'il en soit je reste', en: 'Be that as it may I\'m staying' },
      { fr: 'Bien que ce soit difficile on essaie', en: 'Although it\'s hard we try' },
    ],
    quiz: [
      { q: '«Whoever you are» formal:', options: ['Qui que vous soyez', 'Qui que vous êtes', 'Qui vous soyez que'], answer: 0, why: 'Qui que + subjunctive.' },
      { q: 'Which takes indicative?', options: ['même si', 'bien que', 'avant que'], answer: 0, why: 'Même si + indicative.' },
      { q: '«Wherever he goes»:', options: ['Où qu\'il aille', 'Où qu\'il va', 'Où il aille que'], answer: 0, why: 'Où que + subj.' },
      { q: 'Tone of «quand bien même»:', options: ['formal / literary', 'street slang', 'only spoken to kids'], answer: 0, why: 'Elevated concession/hypothesis.' },
    ],
  },
  {
    id: 'articles-contractes',
    cefr: 'A1',
    title: 'Articles contractés',
    summary: 'au, aux, du, des — à/de + le/les fused.',
    explanation: {
      rule: '**à + le → au**, **à + les → aux**, **de + le → du**, **de + les → des**. No contraction with **la** or **l\'**: à la, à l\', de la, de l\'.',
      examples: [
        { fr: 'Je vais au marché.', en: 'I\'m going to the market.' },
        { fr: 'Le livre du professeur', en: 'The teacher\'s book' },
        { fr: 'Je parle aux enfants.', en: 'I\'m speaking to the children.' },
      ],
      watchOut: '«des» can mean de + les OR the indefinite plural — context decides.',
    },
    drills: [
      { q: 'à + le cinéma →', options: ['au cinéma', 'à le cinéma', 'aux cinéma'], answer: 0, why: 'à + le = au.' },
      { q: 'de + les amis →', options: ['des amis', 'de les amis', 'du amis'], answer: 0, why: 'de + les = des.' },
      { q: 'à + la plage →', options: ['à la plage', 'au plage', 'à le plage'], answer: 0, why: 'No contraction with la.' },
      { q: 'de + l\'eau →', options: ['de l\'eau', 'du eau', 'des eau'], answer: 0, why: 'No contraction with l\'.' },
    ],
    build: [
      { fr: 'On va au restaurant', en: 'We\'re going to the restaurant' },
      { fr: 'La voiture des voisins', en: 'The neighbours\' car' },
    ],
    quiz: [
      { q: 'à + les →', options: ['aux', 'aus', 'à les'], answer: 0, why: 'à + les = aux.' },
      { q: 'de + le →', options: ['du', 'de le', 'des'], answer: 0, why: 'de + le = du.' },
      { q: '«to the school» (la école elided):', options: ['à l\'école', 'au école', 'à le école'], answer: 0, why: 'à + l\'.' },
      { q: '«from the friends» (specific les amis):', options: ['des amis', 'de les amis', 'du amis'], answer: 0, why: 'de + les = des.' },
    ],
  },
  {
    id: 'nombres-dates',
    cefr: 'A1',
    title: 'Nombres & dates',
    summary: 'Telling the day, the year, and surviving 70–99.',
    explanation: {
      rule: 'Days: **lundi, mardi…** Months: **janvier… décembre** (no capital needed in French). Dates: **le 3 mars 2026**. 70–99: **soixante-dix, quatre-vingts, quatre-vingt-dix** (Belgium/Switzerland: septante, etc.).',
      examples: [
        { fr: 'On est le mardi 30 juillet.', en: 'It\'s Tuesday 30 July.' },
        { fr: 'Je suis né en 1999.', en: 'I was born in 1999.' },
        { fr: 'Il est quatre-vingt-dix heures… non, 90 !', en: 'Ninety (the number).' },
      ],
      watchOut: 'Quatre-vingt**s** only when nothing follows (80); quatre-vingt-un has no -s.',
    },
    drills: [
      { q: '80 =', options: ['quatre-vingts', 'quatre-vingt', 'huitante (France standard)'], answer: 0, why: 'Quatre-vingts with -s when alone.' },
      { q: '81 =', options: ['quatre-vingt-un', 'quatre-vingts-un', 'quatre vingt un'], answer: 0, why: 'No -s when a number follows.' },
      { q: '«on Monday» as a habit:', options: ['le lundi', 'lundi le', 'au lundi'], answer: 0, why: 'Le + day = habit/general.' },
      { q: 'Date format:', options: ['le 14 juillet', 'juillet 14 le', '14th juillet'], answer: 0, why: 'le + number + month.' },
    ],
    build: [
      { fr: 'Rendez-vous le 3 mai à 15 heures', en: 'Appointment on 3 May at 3pm' },
      { fr: 'J\'ai vingt-deux ans', en: 'I am twenty-two' },
    ],
    quiz: [
      { q: '70 in France:', options: ['soixante-dix', 'septante', 'soixante et dix'], answer: 0, why: 'Standard French 70.' },
      { q: 'Year 2000 often said:', options: ['deux mille', 'vingt cent', 'two thousand only'], answer: 0, why: 'Deux mille…' },
      { q: '«in August»:', options: ['en août', 'au août', 'dans août'], answer: 0, why: 'en + month.' },
      { q: '91:', options: ['quatre-vingt-onze', 'quatre-vingts-onze', 'nonante et un (France)'], answer: 0, why: 'Quatre-vingt-onze.' },
    ],
  },
];
