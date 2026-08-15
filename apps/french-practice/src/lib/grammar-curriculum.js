// Grammar topics that fill real gaps in the CEFR inventory (A1–B2).
//
// The library already covered most of A1–B1 under slightly different names
// (see GRAMMAR_ALIASES in cefr.js). These nine are the points that were
// genuinely absent — including, embarrassingly, «être/avoir» and the
// imparfait, which every syllabus puts near the front.
//
// Shape matches grammar.js: explanation { rule, examples, watchOut },
// drills[], build[], quiz[].

export const CURRICULUM_GRAMMAR_TOPICS = [
  {
    id: 'etre-avoir',
    cefr: 'A1',
    title: 'Être & avoir',
    summary: 'The two verbs that hold up half the language — on their own and as auxiliaries.',
    explanation: {
      rule: '**Être**: je suis, tu es, il est, nous sommes, vous êtes, ils sont. **Avoir**: j\'ai, tu as, il a, nous avons, vous avez, ils ont. Beyond their own meaning they are the *auxiliaries* that build the passé composé, and French uses **avoir** where English uses "to be" for age, hunger, thirst, cold and fear.',
      examples: [
        { fr: "J'ai vingt ans.", en: 'I am twenty. (literally: I have twenty years)' },
        { fr: "Nous sommes en retard.", en: 'We are late.' },
        { fr: "Elle a froid, ferme la fenêtre.", en: 'She is cold, shut the window.' },
        { fr: "Vous êtes déjà arrivés ?", en: 'Have you already arrived?' },
      ],
      watchOut: 'Never «je suis vingt ans» or «je suis faim». Age, hunger, thirst, cold, heat, fear and luck all take **avoir**.',
    },
    drills: [
      { q: "J'___ trente ans.", options: ['ai', 'suis', 'est'], answer: 0, why: 'Age uses avoir: j\'ai trente ans.' },
      { q: 'Nous ___ prêts à partir.', options: ['sommes', 'avons', 'êtes'], answer: 0, why: 'être + adjective: nous sommes prêts.' },
      { q: 'Ils ___ soif après le match.', options: ['ont', 'sont', 'est'], answer: 0, why: 'avoir soif — never «être soif».' },
      { q: 'Vous ___ gallois ?', options: ['êtes', 'avez', 'sont'], answer: 0, why: 'Nationality is a state: vous êtes.' },
    ],
    build: [
      { fr: "Elle a peur des chiens", en: 'She is afraid of dogs' },
      { fr: 'Nous sommes fatigués ce soir', en: 'We are tired tonight' },
    ],
    quiz: [
      { q: 'Tu ___ raison, c’est plus simple.', options: ['as', 'es', 'a'], answer: 0, why: 'avoir raison = to be right.' },
      { q: 'Le train ___ en retard.', options: ['est', 'a', 'sont'], answer: 0, why: 'être en retard.' },
      { q: 'J’___ besoin d’aide.', options: ['ai', 'suis', 'as'], answer: 0, why: 'avoir besoin de.' },
      { q: 'Ils ___ contents du résultat.', options: ['sont', 'ont', 'est'], answer: 0, why: 'être + adjective: ils sont contents.' },
    ],
  },
  {
    id: 'imparfait',
    cefr: 'A2',
    title: "L'imparfait",
    summary: 'The background tense: what used to happen, what was going on, what things were like.',
    explanation: {
      rule: 'Take the **nous** form of the present, drop **-ons**, add **-ais, -ais, -ait, -ions, -iez, -aient**. So nous parl*ons* → je parlais. The one irregular stem is **être** → j\'étais. Use it for habits in the past ("I used to…"), descriptions and states, and actions interrupted by something else.',
      examples: [
        { fr: "Quand j'étais petit, on allait en Bretagne chaque été.", en: 'When I was little, we went to Brittany every summer.' },
        { fr: "Il pleuvait et la rue était vide.", en: 'It was raining and the street was empty.' },
        { fr: "Je lisais quand le téléphone a sonné.", en: 'I was reading when the phone rang.' },
        { fr: "Elle voulait partir plus tôt.", en: 'She wanted to leave earlier.' },
      ],
      watchOut: 'Imparfait = the setting; passé composé = the event that lands in it. «Je regardais un film quand il est arrivé» — the watching is background, the arriving is the news.',
    },
    drills: [
      { q: 'Quand j’___ (être) jeune, je jouais du piano.', options: ['étais', 'ai été', 'serais'], answer: 0, why: 'être is the only irregular imparfait stem: ét-.' },
      { q: 'Nous ___ (finir) toujours à midi.', options: ['finissions', 'finions', 'finissons'], answer: 0, why: 'nous finissons → stem finiss- → finissions.' },
      { q: 'Il ___ (faire) beau hier après-midi.', options: ['faisait', 'a fait', 'ferait'], answer: 0, why: 'A description of the weather: imparfait.' },
      { q: 'Je dormais quand tu ___ (téléphoner).', options: ['as téléphoné', 'téléphonais', 'téléphonerais'], answer: 0, why: 'The interrupting event goes in the passé composé.' },
    ],
    build: [
      { fr: 'Quand nous habitions à Lyon nous prenions le tram', en: 'When we lived in Lyon we took the tram' },
      { fr: 'Il faisait froid et personne ne parlait', en: 'It was cold and nobody was talking' },
    ],
    quiz: [
      { q: 'Tous les samedis, on ___ au marché.', options: ['allait', 'est allé', 'ira'], answer: 0, why: 'A repeated past habit: imparfait.' },
      { q: 'Soudain, la lumière ___.', options: ["s'est éteinte", "s'éteignait", "s'éteindra"], answer: 0, why: 'A single sudden event: passé composé.' },
      { q: 'Elle ___ (avoir) dix ans à l’époque.', options: ['avait', 'a eu', 'aura'], answer: 0, why: 'Age as a background state: imparfait.' },
      { q: 'Nous ___ (manger) quand ils sont entrés.', options: ['mangions', 'avons mangé', 'mangerons'], answer: 0, why: 'Ongoing action interrupted: imparfait.' },
    ],
  },
  {
    id: 'expressions-temps',
    cefr: 'B1',
    title: 'Expressions de temps',
    summary: 'depuis, il y a, pendant, dans, en — the five that English speakers mix up daily.',
    explanation: {
      rule: '**depuis** = since/for, still going, with the **present** («j\'habite ici depuis 2019»). **il y a** = ago, finished («je suis arrivé il y a deux ans»). **pendant** = for, a closed stretch («j\'ai vécu là pendant trois ans»). **dans** = in, pointing forward («je pars dans dix minutes»). **en** = how long something takes («je le fais en dix minutes»).',
      examples: [
        { fr: "J'apprends le français depuis six mois.", en: 'I have been learning French for six months.' },
        { fr: "Il est parti il y a une heure.", en: 'He left an hour ago.' },
        { fr: "On a marché pendant deux heures.", en: 'We walked for two hours.' },
        { fr: "Le train part dans cinq minutes.", en: 'The train leaves in five minutes.' },
      ],
      watchOut: 'With **depuis**, French keeps the present tense where English uses a perfect: «je travaille ici depuis un an», not «j\'ai travaillé».',
    },
    drills: [
      { q: 'Je connais Marie ___ dix ans.', options: ['depuis', 'il y a', 'pendant'], answer: 0, why: 'Still true now → depuis.' },
      { q: 'Elle a téléphoné ___ vingt minutes.', options: ['il y a', 'depuis', 'dans'], answer: 0, why: 'A finished point in the past → il y a.' },
      { q: 'On se voit ___ une heure.', options: ['dans', 'depuis', 'pendant'], answer: 0, why: 'Pointing forward → dans.' },
      { q: "J'ai fini l'exercice ___ cinq minutes.", options: ['en', 'dans', 'depuis'], answer: 0, why: 'Duration taken to complete → en.' },
    ],
    build: [
      { fr: 'Nous attendons le bus depuis vingt minutes', en: 'We have been waiting for the bus for twenty minutes' },
      { fr: 'Il a habité au Québec pendant cinq ans', en: 'He lived in Quebec for five years' },
    ],
    quiz: [
      { q: '___ combien de temps tu apprends le français ?', options: ['Depuis', 'Pendant', 'Dans'], answer: 0, why: 'Asking about a stretch still running.' },
      { q: 'Le film a duré ___ trois heures.', options: ['pendant', 'depuis', 'en'], answer: 0, why: 'A closed duration → pendant.' },
      { q: 'Je reviens ___ deux jours.', options: ['dans', 'il y a', 'depuis'], answer: 0, why: 'Future point → dans.' },
      { q: 'Elle a écrit ce rapport ___ une journée.', options: ['en', 'pendant', 'dans'], answer: 0, why: 'Time needed to complete the task → en.' },
    ],
  },
  {
    id: 'pronoms-relatifs-composes',
    cefr: 'B1',
    title: 'Pronoms relatifs composés',
    summary: 'lequel, auquel, duquel — relatives after a preposition.',
    explanation: {
      rule: 'After a preposition you cannot use **que**. Use **lequel / laquelle / lesquels / lesquelles**, contracting with **à** (auquel, à laquelle, auxquels) and **de** (duquel, de laquelle, desquels). For people, **qui** is the natural choice after a preposition: «l\'ami avec qui je travaille».',
      examples: [
        { fr: "Le projet auquel je pense est ambitieux.", en: 'The project I am thinking of is ambitious.' },
        { fr: "La raison pour laquelle il est parti reste floue.", en: 'The reason he left remains unclear.' },
        { fr: "Les collègues avec qui je travaille sont gallois.", en: 'The colleagues I work with are Welsh.' },
        { fr: "Le bâtiment en face duquel on s'est garés.", en: 'The building opposite which we parked.' },
      ],
      watchOut: '**dont** already contains «de» — «le livre dont je parle», never «le livre de dont». Use **duquel** only inside a longer prepositional phrase (près de, à côté de, en face de).',
    },
    drills: [
      { q: "L'entreprise pour ___ je travaille est petite.", options: ['laquelle', 'lequel', 'qui'], answer: 0, why: 'entreprise is feminine singular → laquelle.' },
      { q: 'Le sujet ___ il s’intéresse est complexe.', options: ['auquel', 'duquel', 'lequel'], answer: 0, why: "s'intéresser à + lequel → auquel." },
      { q: "L'homme avec ___ je parlais est parti.", options: ['qui', 'lequel', 'dont'], answer: 0, why: 'For people after a preposition, qui is natural.' },
      { q: 'Les problèmes ___ nous faisons face sont réels.', options: ['auxquels', 'desquels', 'lesquels'], answer: 0, why: 'faire face à + lesquels → auxquels.' },
    ],
    build: [
      { fr: 'La ville dans laquelle je suis né est petite', en: 'The town in which I was born is small' },
      { fr: 'Voici le dossier auquel je faisais allusion', en: 'Here is the file I was alluding to' },
    ],
    quiz: [
      { q: 'Le stylo avec ___ j’écris est cassé.', options: ['lequel', 'laquelle', 'qui'], answer: 0, why: 'stylo is masculine singular → lequel.' },
      { q: 'Les raisons pour ___ elle a démissionné sont privées.', options: ['lesquelles', 'lesquels', 'auxquelles'], answer: 0, why: 'raisons is feminine plural → lesquelles.' },
      { q: 'Le café à côté ___ on s’est retrouvés.', options: ['duquel', 'auquel', 'dont'], answer: 0, why: 'à côté de + lequel → duquel.' },
      { q: 'La personne à ___ j’ai écrit n’a pas répondu.', options: ['qui', 'laquelle', 'dont'], answer: 0, why: 'People after à: qui (à laquelle is possible but stiffer).' },
    ],
  },
  {
    id: 'subjonctif-passe',
    cefr: 'B2',
    title: 'Le subjonctif passé',
    summary: 'The subjunctive for something already done: que j\'aie fait, que je sois parti.',
    explanation: {
      rule: 'Formed with the **present subjunctive of avoir/être** plus the past participle: que j\'aie fini, que tu sois venu. Use it in every subjunctive trigger where the action is *anterior* to the main verb — the emotion or doubt is now, the event was earlier.',
      examples: [
        { fr: "Je suis content que tu sois venu.", en: 'I am glad you came.' },
        { fr: "Bien qu'elle ait travaillé dur, elle a échoué.", en: 'Although she worked hard, she failed.' },
        { fr: "Il faut que j'aie terminé avant midi.", en: 'I must have finished before noon.' },
        { fr: "C'est dommage qu'ils n'aient rien dit.", en: 'It is a shame they said nothing.' },
      ],
      watchOut: 'Same agreement rules as the passé composé: «qu\'elle soit partie», «que je les aie vus». The subjunctive changes the mood, not the agreement.',
    },
    drills: [
      { q: 'Je suis ravi que vous ___ (pouvoir) venir.', options: ['ayez pu', 'puissiez', 'avez pu'], answer: 0, why: 'The coming already happened → subjonctif passé.' },
      { q: 'Bien qu’il ___ (partir) tôt, il est arrivé en retard.', options: ['soit parti', 'est parti', 'parte'], answer: 0, why: 'partir takes être; bien que takes the subjunctive.' },
      { q: 'C’est dommage que tu ___ (ne pas venir).', options: ['ne sois pas venu', 'ne viennes pas', "n'es pas venu"], answer: 0, why: 'Regret about a past event.' },
      { q: 'Je doute qu’elle ___ (comprendre) la consigne.', options: ['ait compris', 'comprenne', 'a compris'], answer: 0, why: 'Doubt now about an earlier act.' },
    ],
    build: [
      { fr: 'Je suis surpris que vous ayez accepté si vite', en: 'I am surprised you accepted so quickly' },
      { fr: 'Il faut que tout soit fini avant leur arrivée', en: 'Everything must be finished before they arrive' },
    ],
    quiz: [
      { q: 'Elle regrette que nous ___ (ne rien dire).', options: ["n'ayons rien dit", 'ne disions rien', "n'avons rien dit"], answer: 0, why: 'Past subjunctive after a verb of emotion.' },
      { q: 'Quoiqu’ils ___ (faire) de leur mieux, le résultat déçoit.', options: ['aient fait', 'font', 'feraient'], answer: 0, why: 'quoique + subjonctif; the effort is past.' },
      { q: 'Je ne crois pas qu’il ___ (voir) le message.', options: ['ait vu', 'voit', 'a vu'], answer: 0, why: 'Negated croire triggers the subjunctive.' },
      { q: 'Il est possible qu’elle ___ (se tromper).', options: ["se soit trompée", 'se trompe', "s'est trompée"], answer: 0, why: 'Reflexive verbs take être — and agree.' },
    ],
  },
  {
    id: 'concordance-temps',
    cefr: 'B2',
    title: 'La concordance des temps',
    summary: 'Which tense follows which — reported speech and subordinate clauses that sit in the past.',
    explanation: {
      rule: 'When the main verb moves into the past, the subordinate clause shifts with it: présent → **imparfait**, passé composé → **plus-que-parfait**, futur → **conditionnel présent**, futur antérieur → **conditionnel passé**.',
      examples: [
        { fr: "Il dit qu'il vient. → Il a dit qu'il venait.", en: 'He says he is coming. → He said he was coming.' },
        { fr: "Elle pense qu'il a compris. → Elle pensait qu'il avait compris.", en: 'She thinks he understood. → She thought he had understood.' },
        { fr: "Je sais qu'ils viendront. → Je savais qu'ils viendraient.", en: 'I know they will come. → I knew they would come.' },
        { fr: "On annonce qu'il aura fini. → On annonçait qu'il aurait fini.", en: 'They announce he will have finished. → They announced he would have finished.' },
      ],
      watchOut: 'A general truth can stay in the present even after a past main verb: «il a dit que la Terre tourne autour du Soleil». The shift is about the speaker\'s viewpoint, not a mechanical rule.',
    },
    drills: [
      { q: 'Il a dit qu’il ___ (être) fatigué.', options: ['était', 'est', 'sera'], answer: 0, why: 'présent → imparfait after a past main verb.' },
      { q: 'Elle savait qu’ils ___ (partir) la veille.', options: ['étaient partis', 'sont partis', 'partaient'], answer: 0, why: 'Anterior to a past reference → plus-que-parfait.' },
      { q: 'Je pensais que tu ___ (venir) demain.', options: ['viendrais', 'viendras', 'venais'], answer: 0, why: 'futur → conditionnel présent.' },
      { q: 'On croyait qu’il ___ (finir) avant notre retour.', options: ['aurait fini', 'aura fini', 'finissait'], answer: 0, why: 'futur antérieur → conditionnel passé.' },
    ],
    build: [
      { fr: 'Il a expliqué qu’il ne pouvait pas rester', en: 'He explained that he could not stay' },
      { fr: 'Nous savions qu’elle avait déjà répondu', en: 'We knew she had already replied' },
    ],
    quiz: [
      { q: 'Elle a répondu qu’elle ___ (ne pas savoir).', options: ['ne savait pas', 'ne sait pas', "n'a pas su"], answer: 0, why: 'présent → imparfait.' },
      { q: 'Ils ont promis qu’ils ___ (écrire).', options: ['écriraient', 'écriront', 'écrivaient'], answer: 0, why: 'A promise about the future, seen from the past.' },
      { q: 'Je croyais que le magasin ___ (fermer) à sept heures.', options: ['fermait', 'ferme', 'fermera'], answer: 0, why: 'Habitual fact reported from the past.' },
      { q: 'Il a dit que l’eau ___ (bouillir) à cent degrés.', options: ['bout', 'bouillait', 'bouillirait'], answer: 0, why: 'A general truth may stay in the present.' },
    ],
  },
  {
    id: 'restriction-ne-que',
    cefr: 'B2',
    title: 'La restriction : ne… que',
    summary: '"Only" without the word "seulement" — and where the «que» actually goes.',
    explanation: {
      rule: '**ne… que** means "only". The **que** sits immediately before the element being restricted, which is why moving it changes the meaning entirely. It is a restriction, not a negation: the sentence stays positive, so partitives keep **du/de la/des** rather than collapsing to **de**.',
      examples: [
        { fr: "Je ne bois que du thé.", en: 'I drink only tea.' },
        { fr: "Je ne bois du thé que le matin.", en: 'I drink tea only in the morning.' },
        { fr: "Il n'y a que trois places.", en: 'There are only three seats.' },
        { fr: "Elle ne fait que se plaindre.", en: 'She does nothing but complain.' },
      ],
      watchOut: 'Compare «je ne mange pas de viande» (negation → de) with «je ne mange que de la viande» (restriction → de la). Getting this wrong is a classic B2 marker.',
    },
    drills: [
      { q: 'Je ___ mange ___ des légumes. (only vegetables)', options: ['ne / que', 'ne / pas', 'que / ne'], answer: 0, why: 'ne before the verb, que before the restricted element.' },
      { q: 'Il n’y a ___ une solution.', options: ['qu\'', 'pas', 'que de'], answer: 0, why: "que elides before a vowel: qu'une." },
      { q: 'Elle ne travaille que ___ mardi.', options: ['le', 'du', 'de'], answer: 0, why: 'Restriction keeps the normal article.' },
      { q: 'Traduisez « He only arrived yesterday ».', options: ["Il n'est arrivé qu'hier", "Il n'est pas arrivé hier", "Il est arrivé que hier"], answer: 0, why: 'que goes directly before «hier».' },
    ],
    build: [
      { fr: 'Nous n’avons que dix minutes', en: 'We only have ten minutes' },
      { fr: 'Il ne pense qu’à son travail', en: 'He only thinks about his work' },
    ],
    quiz: [
      { q: 'Choisissez la phrase qui signifie « I only drink coffee in the morning ».', options: ['Je ne bois du café que le matin', 'Je ne bois que du café', 'Je ne bois pas de café le matin'], answer: 0, why: 'que before «le matin» restricts the time, not the drink.' },
      { q: 'Restriction ou négation : « Je ne mange que de la viande ».', options: ['Restriction — I eat only meat', 'Negation — I eat no meat', 'Both are possible'], answer: 0, why: 'ne… que is restrictive; the partitive survives.' },
      { q: 'Complétez : « Il ___ reste ___ deux jours. »', options: ['ne / que', 'ne / pas', 'n\'y / que'], answer: 0, why: 'Il ne reste que deux jours.' },
      { q: 'Quel équivalent de « ne… que » ?', options: ['seulement', 'jamais', 'personne'], answer: 0, why: '«Je bois seulement du thé» = «je ne bois que du thé».' },
    ],
  },
  {
    id: 'cause-consequence',
    cefr: 'B2',
    title: 'Cause & conséquence',
    summary: 'parce que, puisque, car, comme — and si… que, tellement que, d\'où.',
    explanation: {
      rule: '**Cause**: *parce que* answers "why?"; *car* is written and links two clauses of equal weight; *puisque* presents a cause both speakers already accept; *comme* fronts the cause at the start of the sentence; *étant donné que / en raison de* are formal. **Consequence**: *donc*, *si bien que*, *tellement… que*, *d\'où*, *par conséquent*.',
      examples: [
        { fr: "Comme il pleuvait, on est restés à la maison.", en: 'Since it was raining, we stayed home.' },
        { fr: "Puisque tu le sais déjà, je n'insiste pas.", en: 'Since you already know, I won\'t labour it.' },
        { fr: "Il faisait tellement chaud qu'on a annulé la sortie.", en: 'It was so hot that we cancelled the outing.' },
        { fr: "Le train était supprimé, d'où notre retard.", en: 'The train was cancelled, hence our lateness.' },
      ],
      watchOut: '**Comme** must open the sentence — «On est restés comme il pleuvait» is wrong. And *car* never starts a sentence in careful writing.',
    },
    drills: [
      { q: '___ tu es là, on peut commencer.', options: ['Puisque', 'Parce que', 'Car'], answer: 0, why: 'A cause both speakers already accept → puisque.' },
      { q: '___ il n’y avait plus de place, nous sommes partis.', options: ['Comme', 'Car', 'Donc'], answer: 0, why: 'comme fronts the cause.' },
      { q: 'Il a plu ___ le match a été reporté.', options: ['si bien que', 'parce que', 'puisque'], answer: 0, why: 'Consequence linker: si bien que.' },
      { q: 'Elle parle ___ vite ___ je ne comprends rien.', options: ['tellement / que', 'très / que', 'si / de'], answer: 0, why: 'tellement… que (or si… que) for intensity + result.' },
    ],
    build: [
      { fr: 'Comme la route était fermée nous avons fait un détour', en: 'As the road was closed we made a detour' },
      { fr: 'Il y avait tellement de monde que nous sommes repartis', en: 'There were so many people that we left again' },
    ],
    quiz: [
      { q: 'Quelle phrase est incorrecte ?', options: ['On est rentrés comme il pleuvait', 'Comme il pleuvait, on est rentrés', 'On est rentrés parce qu’il pleuvait'], answer: 0, why: '«comme» has to open the sentence.' },
      { q: 'Registre le plus formel pour « because of the strike » :', options: ['en raison de la grève', 'à cause de la grève', 'vu la grève'], answer: 0, why: '«en raison de» is the administrative register.' },
      { q: 'Complétez : « Il y avait beaucoup de bruit, ___ notre déménagement. »', options: ["d'où", 'car', 'puisque'], answer: 0, why: "d'où introduces a consequence, noun-style." },
      { q: '« Car » se place :', options: ['entre deux propositions', 'en début de phrase', 'en fin de phrase'], answer: 0, why: 'car links two clauses; it does not open the sentence.' },
    ],
  },
  {
    id: 'concession',
    cefr: 'B2',
    title: 'La concession',
    summary: 'bien que, malgré, avoir beau, quand même — granting a point and pushing past it.',
    explanation: {
      rule: '**bien que / quoique** + subjunctive. **malgré / en dépit de** + noun. **même si** + indicative (it is a hypothesis, not a subjunctive trigger). **avoir beau** + infinitive means "however much one does". In speech, **quand même** and **pourtant** carry most of the load.',
      examples: [
        { fr: "Bien qu'il soit tard, je continue.", en: 'Although it is late, I am carrying on.' },
        { fr: "Malgré la pluie, le marché était plein.", en: 'Despite the rain, the market was full.' },
        { fr: "Même si tu insistes, je ne changerai pas d'avis.", en: 'Even if you insist, I will not change my mind.' },
        { fr: "J'ai beau relire, je ne comprends pas.", en: 'However much I reread it, I don\'t understand.' },
      ],
      watchOut: '**Malgré** takes a noun, never a clause: «malgré la pluie» ✓, «malgré qu\'il pleuve» ✗ (widely heard, still censured). Use «bien qu\'il pleuve».',
    },
    drills: [
      { q: 'Bien qu’il ___ (faire) froid, on sort.', options: ['fasse', 'fait', 'ferait'], answer: 0, why: 'bien que always takes the subjunctive.' },
      { q: '___ ses efforts, il a échoué.', options: ['Malgré', 'Bien que', 'Même si'], answer: 0, why: 'Followed by a noun → malgré.' },
      { q: '___ tu me le demandes, je refuse.', options: ['Même si', 'Bien que', 'Malgré'], answer: 0, why: 'même si + indicative.' },
      { q: 'Il ___ crier, personne ne l’écoute.', options: ['a beau', 'a bien', 'est beau'], answer: 0, why: 'avoir beau + infinitive.' },
    ],
    build: [
      { fr: 'Malgré le bruit nous avons bien dormi', en: 'Despite the noise we slept well' },
      { fr: 'Bien que ce soit cher je vais le prendre', en: 'Although it is expensive I am going to take it' },
    ],
    quiz: [
      { q: 'Corrigez : « Malgré qu’il pleuve, on sort. »', options: ['Bien qu’il pleuve, on sort', 'Malgré il pleut, on sort', 'La phrase est correcte'], answer: 0, why: 'malgré cannot govern a clause.' },
      { q: 'Quoique + ?', options: ['subjonctif', 'indicatif', 'infinitif'], answer: 0, why: 'quoique behaves like bien que.' },
      { q: '« J’ai beau essayer » signifie :', options: ['however much I try', 'I try beautifully', 'I have tried'], answer: 0, why: 'avoir beau = concessive, not aesthetic.' },
      { q: 'Registre soutenu pour « despite » :', options: ['en dépit de', 'malgré', 'quand même'], answer: 0, why: '«en dépit de» is the formal counterpart of «malgré».' },
    ],
  },
];
