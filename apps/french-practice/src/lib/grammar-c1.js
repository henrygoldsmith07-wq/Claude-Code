// The C1 grammar band — the level the library had almost nothing for.
//
// C1 is less about new conjugations than about *control*: hedging a claim,
// holding a paragraph together, hearing irony, and recognising the literary
// tenses you will read but never say. Two of these (subjonctif imparfait,
// périphrases verbales) are explicitly receptive: the drills ask you to
// recognise and translate, not to produce.

export const C1_GRAMMAR_TOPICS = [
  {
    id: 'subjonctif-imparfait',
    cefr: 'C1',
    title: "Le subjonctif imparfait (reconnaissance)",
    summary: 'The literary subjunctive: qu\'il fût, qu\'elle eût. Read it, do not speak it.',
    explanation: {
      rule: 'Built from the **passé simple** stem: qu\'il fût, qu\'elle eût, qu\'ils vinssent. In modern French it survives only in literature, formal writing and a handful of fixed phrases; spoken French replaces it with the **présent du subjonctif**. Your target is recognition — knowing that «qu\'il fût» is a subjunctive, not a typo.',
      examples: [
        { fr: "Il fallait qu'il partît avant l'aube.", en: 'He had to leave before dawn. (modern: qu\'il parte)' },
        { fr: "Elle craignait qu'il ne vînt trop tard.", en: 'She feared he would come too late. (modern: qu\'il vienne)' },
        { fr: "Dût-il y passer la nuit, il finirait.", en: 'Even if it took him all night, he would finish.' },
        { fr: "Encore eût-il fallu que je le susse.", en: 'I would still have had to know it. (a famous joke line)' },
      ],
      watchOut: 'Never produce it in conversation or in an exam speaking test — it reads as parody. In writing, only if the register is deliberately literary.',
    },
    drills: [
      { q: '« Il fallait qu\'il vînt » — quel mode et temps ?', options: ['subjonctif imparfait', 'passé simple', 'conditionnel passé'], answer: 0, why: 'vînt = 3rd person subjonctif imparfait of venir.' },
      { q: 'Équivalent moderne de « qu\'elle eût fini » :', options: ["qu'elle ait fini", "qu'elle avait fini", "qu'elle aurait fini"], answer: 0, why: 'Subjonctif plus-que-parfait → subjonctif passé today.' },
      { q: 'Dans quel contexte l\'emploierait-on ?', options: ['un roman du XIXe siècle', 'un message vocal', 'un oral d’examen'], answer: 0, why: 'Purely literary register.' },
      { q: '« Dût-il pleuvoir » signifie :', options: ['even if it should rain', 'it had to rain', 'it would have rained'], answer: 0, why: 'Inverted subjunctive with concessive force.' },
    ],
    build: [
      { fr: 'Il aurait fallu qu’elle vienne plus tôt', en: 'She should have come earlier (modern phrasing)' },
      { fr: 'Je craignais qu’il ne soit déjà parti', en: 'I feared he had already left' },
    ],
    quiz: [
      { q: 'Le subjonctif imparfait se forme sur :', options: ['le passé simple', 'le présent', "l'imparfait de l'indicatif"], answer: 0, why: 'Stem taken from the passé simple.' },
      { q: '« qu’il fût » vient de :', options: ['être', 'faire', 'falloir'], answer: 0, why: 'être → que je fusse, qu’il fût.' },
      { q: 'À l’oral, on le remplace par :', options: ['le subjonctif présent', "l'indicatif imparfait", 'le conditionnel'], answer: 0, why: 'Modern spoken French collapses both onto the present subjunctive.' },
      { q: '« Ne » dans « qu’il ne vînt » est :', options: ['un ne explétif', 'une négation', 'une faute'], answer: 0, why: 'Expletive ne after craindre — carries no negative meaning.' },
    ],
  },
  {
    id: 'anaphore-cohesion',
    cefr: 'C1',
    title: 'Anaphore & cohésion',
    summary: 'Not repeating yourself: ce dernier, celui-ci, y, en, and nominal recall.',
    explanation: {
      rule: 'French written style punishes repetition harder than English does. Refer back with **ce dernier / cette dernière** (the latter), **celui-ci / celui-là**, the pronouns **y** and **en**, and above all with a **nominal recall** — a noun phrase that re-labels what you just said: «Le gouvernement a annoncé une réforme. **Cette mesure** divise.»',
      examples: [
        { fr: "Marc a vu Paul ; ce dernier n'a rien dit.", en: 'Marc saw Paul; the latter said nothing.' },
        { fr: "Il propose une hausse des taxes. Une telle décision inquiète.", en: 'He proposes a tax rise. Such a decision is worrying.' },
        { fr: "On parle beaucoup de la réforme. J'y reviendrai.", en: 'The reform is much discussed. I will come back to it.' },
        { fr: "Des critiques ont été formulées ; il en a tenu compte.", en: 'Criticisms were made; he took them into account.' },
      ],
      watchOut: '**Ce dernier** always refers to the *last-mentioned* item — not the most important one. Getting the order wrong reverses your meaning.',
    },
    drills: [
      { q: '« Julie a rencontré Anne ; ___ était en retard. » (Anne)', options: ['cette dernière', 'celle-là', 'elle-même'], answer: 0, why: 'Anne is the last named → cette dernière.' },
      { q: 'Reprise nominale de « le gouvernement a interdit la circulation » :', options: ['Cette interdiction…', 'Ce gouvernement…', 'Cela…'], answer: 0, why: 'A noun phrase that re-labels the event.' },
      { q: '« Il pense à son avenir. » → « Il ___ pense souvent. »', options: ['y', 'en', 'le'], answer: 0, why: 'penser à + thing → y.' },
      { q: '« Elle parle de ses projets. » → « Elle ___ parle sans cesse. »', options: ['en', 'y', 'les'], answer: 0, why: 'parler de → en.' },
    ],
    build: [
      { fr: 'Le rapport signale un risque ; ce constat inquiète les élus', en: 'The report flags a risk; this finding worries councillors' },
      { fr: 'Il a proposé deux solutions mais aucune ne convainc', en: 'He proposed two solutions but neither convinces' },
    ],
    quiz: [
      { q: '« Ce dernier » désigne :', options: ['le dernier élément cité', 'le plus important', 'le sujet de la phrase'], answer: 0, why: 'Strictly positional.' },
      { q: 'Quel procédé évite le mieux la répétition dans un essai ?', options: ['la reprise nominale', "l'ellipse", 'le pronom «ça»'], answer: 0, why: 'A re-labelling noun phrase also advances the argument.' },
      { q: '« Il tient à ce projet. » → « Il ___ tient. »', options: ['y', 'en', 'lui'], answer: 0, why: 'tenir à + thing → y.' },
      { q: 'Registre de « celui-ci » à l’écrit :', options: ['neutre à soutenu', 'familier', 'argotique'], answer: 0, why: 'Standard written anaphora.' },
    ],
  },
  {
    id: 'modalisation',
    cefr: 'C1',
    title: 'La modalisation',
    summary: 'Committing more or less: semble-t-il, sans doute, il se peut que, conditionnel journalistique.',
    explanation: {
      rule: 'Modalisation is how you say a thing *without fully vouching for it*. Tools: adverbs (**sans doute**, **apparemment**, **vraisemblablement**), impersonal frames (**il semble que** + subjunctive, **il paraît que** + indicative), and the **conditional of report** used by journalists: «le suspect aurait pris la fuite» = allegedly fled.',
      examples: [
        { fr: "Le bilan s'élèverait à trois blessés.", en: 'The toll is reportedly three injured.' },
        { fr: "Il semble que la situation se soit améliorée.", en: 'It appears the situation has improved.' },
        { fr: "Sans doute a-t-il raison.", en: 'He is probably right.' },
        { fr: "Il se peut que je sois en retard.", en: 'I may be late.' },
      ],
      watchOut: '**Sans doute** means "probably", not "without doubt" — for genuine certainty use **sans aucun doute**. And **il paraît que** takes the indicative while **il semble que** takes the subjunctive.',
    },
    drills: [
      { q: 'Il semble qu’il ___ (être) parti.', options: ['soit', 'est', 'serait'], answer: 0, why: 'il semble que + subjonctif.' },
      { q: 'Il paraît qu’elle ___ (déménager) l’an dernier.', options: ['a déménagé', 'ait déménagé', 'déménageât'], answer: 0, why: 'il paraît que + indicatif.' },
      { q: '« Le voleur aurait été arrêté » exprime :', options: ['une information non confirmée', 'un regret', 'une condition'], answer: 0, why: 'Conditionnel journalistique.' },
      { q: '« Sans doute » signifie le plus souvent :', options: ['probablement', 'certainement', 'jamais'], answer: 0, why: 'A hedge, not a guarantee.' },
    ],
    build: [
      { fr: 'Il se pourrait que la réunion soit reportée', en: 'The meeting might be postponed' },
      { fr: 'Selon la presse le projet serait abandonné', en: 'According to the press the project has reportedly been dropped' },
    ],
    quiz: [
      { q: 'Certitude totale :', options: ['sans aucun doute', 'sans doute', 'apparemment'], answer: 0, why: 'The «aucun» is what makes it categorical.' },
      { q: '« Il se peut que » est suivi :', options: ['du subjonctif', "de l'indicatif", "de l'infinitif"], answer: 0, why: 'Possibility → subjunctive.' },
      { q: 'Quel outil un journaliste utilise-t-il pour une info non vérifiée ?', options: ['le conditionnel', "l'imparfait", 'le passé simple'], answer: 0, why: 'The conditional of report.' },
      { q: '« Vraisemblablement » se situe :', options: ['entre le possible et le certain', 'au-delà du certain', 'dans le faux'], answer: 0, why: 'A high-probability hedge.' },
    ],
  },
  {
    id: 'ellipse-oral',
    cefr: 'C1',
    title: "L'ellipse et le français parlé",
    summary: 'What natives actually drop: ne, il, tu es, and whole subjects.',
    explanation: {
      rule: 'Spoken French systematically deletes material that writing keeps. The **ne** of negation disappears («j\'sais pas»); **il** reduces to /i/ («i\' vient»); **tu es** → «t\'es»; **il y a** → «y a»; **je suis** → «chuis». Understanding this is a listening skill: the words are not missing from the sentence, they are missing from the *signal*.',
      examples: [
        { fr: "J'sais pas, faut voir.", en: "I don't know, we'll see. (je ne sais pas, il faut voir)" },
        { fr: "Y a personne.", en: 'There is nobody. (il n\'y a personne)' },
        { fr: "T'as vu ça ?", en: 'Did you see that? (tu as vu cela)' },
        { fr: "Chais pas c'qu'i' veut.", en: "I don't know what he wants." },
      ],
      watchOut: 'Reproduce this in casual speech and you sound native; reproduce it in a written exam and you lose marks. Two registers, two rule sets.',
    },
    drills: [
      { q: '« Y a rien à faire » — forme écrite ?', options: ["Il n'y a rien à faire", 'Y a rien à faire', 'Il y a rien à faire'], answer: 0, why: 'Restore both «il» and «ne».' },
      { q: '« Chuis crevé » =', options: ['Je suis fatigué', 'Je sais', "J'ai chaud"], answer: 0, why: 'chuis = je suis; crevé = exhausted (familier).' },
      { q: 'Que perd-on presque toujours à l’oral ?', options: ['le «ne»', 'le «pas»', 'le verbe'], answer: 0, why: 'Only the second element of the negation survives.' },
      { q: '« I’ m’a dit » — qui parle de qui ?', options: ['il m’a dit', 'je lui ai dit', 'ils m’ont dit'], answer: 0, why: '«il» reduces to /i/ before a consonant.' },
    ],
    build: [
      { fr: 'Il n’y a pas de problème', en: 'There is no problem (written form of «y a pas d’problème»)' },
      { fr: 'Tu as compris ce qu’il a dit', en: 'You understood what he said (written form of «t’as compris c’qu’i’ a dit»)' },
    ],
    quiz: [
      { q: 'Dans un e-mail professionnel, on écrit :', options: ["Il n'y a pas de créneau", "Y a pas de créneau", "Y'a pas d'créneau"], answer: 0, why: 'Full form in professional writing.' },
      { q: '« T’es sûr ? » correspond à :', options: ['Tu es sûr ?', 'Tes sûrs ?', 'Tu as sûr ?'], answer: 0, why: "t' = tu, elided before a vowel." },
      { q: 'La chute du « ne » est :', options: ['normale à l’oral', 'une faute grave', 'régionale'], answer: 0, why: 'It is the spoken standard across the francophone world.' },
      { q: 'Pourquoi les débutants trouvent l’oral dur ?', options: ['le signal perd des syllabes attendues', 'le vocabulaire est différent', 'la grammaire change'], answer: 0, why: 'Same grammar, compressed signal.' },
    ],
  },
  {
    id: 'figement-idiomatique',
    cefr: 'C1',
    title: 'Expressions figées',
    summary: 'Fixed phrases where you cannot change a single word.',
    explanation: {
      rule: 'A **locution figée** is frozen: the article, the number and the preposition are all fixed, and the meaning is not the sum of the parts. «Prendre son courage à deux mains» cannot become «à une main». Learn them whole, and note which take **avoir**, which take **faire**, and which fix a bare noun with no article at all («avoir faim», «faire attention»).',
      examples: [
        { fr: "Il a pris son courage à deux mains.", en: 'He plucked up his courage.' },
        { fr: "Ça ne casse pas trois pattes à un canard.", en: 'It is nothing to write home about.' },
        { fr: "Elle a le bras long.", en: 'She has influence / connections.' },
        { fr: "On a mis les pieds dans le plat.", en: 'We put our foot in it.' },
      ],
      watchOut: 'Do not translate the image. «Il pleut des cordes» is "it is pouring", not "it rains ropes" — and English "it rains cats and dogs" has no French equivalent worth attempting.',
    },
    drills: [
      { q: 'Compléter : « prendre son courage à ___ mains ».', options: ['deux', 'une', 'pleines'], answer: 0, why: 'Frozen — always «deux».' },
      { q: '« Avoir le bras long » signifie :', options: ['avoir de l’influence', 'être grand', 'être paresseux'], answer: 0, why: 'Idiomatic, not literal.' },
      { q: '« Il pleut des ___ ».', options: ['cordes', 'chats', 'seaux'], answer: 0, why: '«des cordes» — «à seaux» exists but is rarer.' },
      { q: '« Mettre les pieds dans le plat » =', options: ['dire une maladresse', 'cuisiner', 'partir vite'], answer: 0, why: 'To blunder into a delicate subject.' },
    ],
    build: [
      { fr: 'Il a mis les pieds dans le plat pendant la réunion', en: 'He put his foot in it during the meeting' },
      { fr: 'Ce film ne casse pas trois pattes à un canard', en: 'That film is nothing special' },
    ],
    quiz: [
      { q: 'Pourquoi dit-on « expression figée » ?', options: ['on ne peut pas en changer les éléments', 'elle est ancienne', 'elle est régionale'], answer: 0, why: 'Frozen form is the defining property.' },
      { q: '« Tomber dans les pommes » =', options: ["s'évanouir", 'échouer', 'se tromper'], answer: 0, why: 'To faint.' },
      { q: '« Poser un lapin à quelqu’un » =', options: ['ne pas venir au rendez-vous', 'offrir un cadeau', 'mentir'], answer: 0, why: 'To stand someone up.' },
      { q: 'Quelle stratégie d’apprentissage convient ?', options: ['mémoriser le bloc entier', 'traduire mot à mot', 'deviner le sens'], answer: 0, why: 'Chunk learning — the parts do not carry the meaning.' },
    ],
  },
  {
    id: 'argumentation-academique',
    cefr: 'C1',
    title: 'Argumentation académique',
    summary: 'Thèse, antithèse, synthèse — the shape a French essay is expected to have.',
    explanation: {
      rule: 'A French **dissertation** is not a five-paragraph essay. The standard plan is **thèse → antithèse → synthèse** (or *plan analytique*: cause → conséquence → solution), opened by an **accroche**, a restatement of the subject, a **problématique** posed as a question, and an announced plan. Each part opens with an announcement and closes with a **transition**.',
      examples: [
        { fr: "Nous verrons dans un premier temps…, avant d'examiner…", en: 'We shall first consider…, before examining…' },
        { fr: "Il convient dès lors de se demander si…", en: 'It is therefore worth asking whether…' },
        { fr: "Après avoir montré…, nous nuancerons ce constat.", en: 'Having shown…, we shall qualify this finding.' },
        { fr: "En définitive, la question n'est pas tant… que…", en: 'Ultimately, the question is less… than…' },
      ],
      watchOut: 'The **problématique** is a genuine question, not a summary. «Nous allons parler du numérique» is not a problématique; «Le numérique élargit-il vraiment l\'accès au savoir ?» is.',
    },
    drills: [
      { q: 'La problématique se formule :', options: ['sous forme de question', 'sous forme de liste', 'sous forme de citation'], answer: 0, why: 'It sets the tension the essay resolves.' },
      { q: 'Le plan « thèse / antithèse / synthèse » sert surtout à :', options: ['discuter une opinion', 'raconter des faits', 'décrire un lieu'], answer: 0, why: 'It is the dialectical plan.' },
      { q: '« Dans un second temps » sert à :', options: ['annoncer une partie', 'conclure', 'citer'], answer: 0, why: 'A plan-announcing connector.' },
      { q: 'Que place-t-on en tout début de dissertation ?', options: ['une accroche', 'la conclusion', 'la bibliographie'], answer: 0, why: 'The hook that motivates the subject.' },
    ],
    build: [
      { fr: 'Nous examinerons d’abord les causes puis les conséquences', en: 'We shall first examine the causes then the consequences' },
      { fr: 'Il convient de nuancer cette affirmation', en: 'This claim needs qualifying' },
    ],
    quiz: [
      { q: 'La synthèse doit :', options: ['dépasser l’opposition', 'répéter la thèse', 'lister les sources'], answer: 0, why: 'It resolves rather than repeats.' },
      { q: 'Quel connecteur ouvre une concession ?', options: ['certes', 'donc', 'ainsi'], answer: 0, why: '«Certes… mais…» is the concession pair.' },
      { q: 'La transition se place :', options: ['entre deux parties', 'dans l’introduction', 'en note de bas de page'], answer: 0, why: 'It carries the reader across the joint.' },
      { q: 'Registre attendu :', options: ['soutenu, sans «je» familier', 'familier', 'oral'], answer: 0, why: 'Formal register; «on» and «nous» dominate.' },
    ],
  },
  {
    id: 'litote-ironie',
    cefr: 'C1',
    title: 'Litote, euphémisme & ironie',
    summary: 'Saying less to mean more — and hearing when a compliment is not one.',
    explanation: {
      rule: '**Litote** asserts by denying the opposite: «ce n\'est pas mauvais» = it is very good. **Euphémisme** softens: «il nous a quittés» = he died. **Ironie** says the opposite of what is meant, marked by intonation in speech and by exaggeration in writing. French uses litote far more than English, and beginners routinely read it as lukewarm praise.',
      examples: [
        { fr: "Ce n'est pas bête, ton idée.", en: 'That is actually a very good idea.' },
        { fr: "Je ne dirais pas non.", en: 'I would love to.' },
        { fr: "Il n'est pas très en forme.", en: 'He is in a bad way.' },
        { fr: "Bravo, tu as encore oublié les clés.", en: 'Well done, you forgot the keys again. (ironic)' },
      ],
      watchOut: '«Pas mal» is genuine praise, not a shrug. «Ce n\'est pas faux» means "you have a point". Reading these literally will make every French compliment sound cold.',
    },
    drills: [
      { q: '« Ce n’est pas mauvais » signifie :', options: ["c'est très bon", "c'est moyen", "c'est mauvais"], answer: 0, why: 'Classic litote.' },
      { q: '« Il nous a quittés » est :', options: ['un euphémisme', 'une litote', 'une ironie'], answer: 0, why: 'Softening a hard fact.' },
      { q: '« Je ne dirais pas non » =', options: ['oui, volontiers', 'non merci', 'peut-être'], answer: 0, why: 'Enthusiastic acceptance.' },
      { q: 'La litote consiste à :', options: ['nier le contraire', 'exagérer', 'répéter'], answer: 0, why: 'Assertion by negated opposite.' },
    ],
    build: [
      { fr: 'Ce n’est pas rien ce que tu as fait', en: 'What you did is quite something' },
      { fr: 'Elle n’est pas la moins douée du groupe', en: 'She is far from the least talented in the group' },
    ],
    quiz: [
      { q: '« Pas mal ! » comme réaction à un plat :', options: ['un vrai compliment', 'une critique polie', 'de l’indifférence'], answer: 0, why: 'In French this is warm praise.' },
      { q: '« Ce n’est pas faux » =', options: ['tu as raison', 'tu as tort', 'je ne sais pas'], answer: 0, why: 'Concessive agreement.' },
      { q: 'L’ironie à l’oral se signale surtout par :', options: ['l’intonation', 'le vocabulaire', 'le temps verbal'], answer: 0, why: 'Prosody carries it.' },
      { q: '« Il n’est pas très bavard » décrit quelqu’un de :', options: ['très silencieux', 'assez causant', 'agressif'], answer: 0, why: 'Litote again — strongly understated.' },
    ],
  },
  {
    id: 'peripheries-verbales',
    cefr: 'C1',
    title: 'Périphrases verbales',
    summary: 'aller / venir de / être en train de / se mettre à — aspect without new tenses.',
    explanation: {
      rule: 'French marks **aspect** with light verbs rather than tenses. **venir de** + infinitive = just did. **être en train de** = right now. **aller** + infinitive = about to. **se mettre à** = start suddenly. **finir par** = end up doing. **ne pas arrêter de** = keep doing. Stacking them onto an imparfait gives the past equivalents: «il venait de partir» = he had just left.',
      examples: [
        { fr: "Je viens de raccrocher.", en: 'I have just hung up.' },
        { fr: "Elle était en train de préparer le dîner.", en: 'She was in the middle of making dinner.' },
        { fr: "Il s'est mis à pleuvoir.", en: 'It started to rain.' },
        { fr: "On a fini par accepter.", en: 'We ended up accepting.' },
      ],
      watchOut: '**Venir de** in the imparfait, not the passé composé, gives "had just": «je venais d\'arriver» ✓, «je suis venu d\'arriver» ✗.',
    },
    drills: [
      { q: '« I had just finished » =', options: ['je venais de finir', "j'ai venu de finir", 'je viens de finir'], answer: 0, why: 'Imparfait of venir de → past-in-past.' },
      { q: '« Elle ___ de partir. » (a minute ago)', options: ['vient', 'va', 'est'], answer: 0, why: 'venir de = immediate past.' },
      { q: '« Il ___ à crier. » (suddenly started)', options: ["s'est mis", 'a fini', 'est allé'], answer: 0, why: 'se mettre à = inceptive.' },
      { q: '« They kept complaining » =', options: ["ils n'arrêtaient pas de se plaindre", 'ils ont fini de se plaindre', 'ils venaient de se plaindre'], answer: 0, why: 'ne pas arrêter de = continuous repetition.' },
    ],
    build: [
      { fr: 'Nous étions en train de dîner quand il a appelé', en: 'We were in the middle of dinner when he called' },
      { fr: 'Il a fini par comprendre son erreur', en: 'He eventually understood his mistake' },
    ],
    quiz: [
      { q: '« Être en train de » exprime :', options: ["l'action en cours", 'le futur', "l'habitude"], answer: 0, why: 'Progressive aspect.' },
      { q: '« Finir par » exprime :', options: ['le résultat après un délai', 'le début', "l'interruption"], answer: 0, why: 'Eventual outcome.' },
      { q: 'Le futur proche se forme avec :', options: ['aller + infinitif', 'venir + infinitif', 'être + participe'], answer: 0, why: 'aller = near future.' },
      { q: '« Je venais de sortir » se traduit :', options: ['I had just gone out', 'I was going out', 'I have just gone out'], answer: 0, why: 'Past-in-past.' },
    ],
  },
  {
    id: 'accord-cas-difficiles',
    cefr: 'C1',
    title: 'Accords : les cas difficiles',
    summary: 'The agreements that trip up native speakers too.',
    explanation: {
      rule: 'Past participle with **avoir** agrees with a preceding direct object («les lettres que j\'ai écrites») but never with the subject. With **pronominal verbs**, agreement follows the same logic: «elle s\'est lavée» (direct) but «elle s\'est lavé les mains» (the hands are the object). **Faire** + infinitive never agrees: «elle s\'est fait mal». And **ci-joint / ci-inclus** stay invariable before the noun.',
      examples: [
        { fr: "Les photos que j'ai prises sont floues.", en: 'The photos I took are blurred.' },
        { fr: "Elle s'est cassé la jambe.", en: 'She broke her leg. (no agreement — «la jambe» is the object)' },
        { fr: "Ils se sont parlé longtemps.", en: 'They talked for a long time. (parler à → indirect, no agreement)' },
        { fr: "Ci-joint les documents demandés.", en: 'Please find attached the requested documents.' },
      ],
      watchOut: 'The test is always: **is there a direct object, and does it come before the participle?** «Elle s\'est rendu compte» never agrees, because «compte» is the object.',
    },
    drills: [
      { q: 'Les fleurs qu’il a ___ (offrir) sont fanées.', options: ['offertes', 'offert', 'offerts'], answer: 0, why: 'Preceding direct object «que» = les fleurs (f. pl.).' },
      { q: 'Elle s’est ___ (laver) les mains.', options: ['lavé', 'lavée', 'lavés'], answer: 0, why: '«les mains» follows, so no agreement.' },
      { q: 'Ils se sont ___ (téléphoner) hier.', options: ['téléphoné', 'téléphonés', 'téléphonées'], answer: 0, why: 'téléphoner à → indirect object, invariable.' },
      { q: 'Elle s’est ___ (faire) mal au genou.', options: ['fait', 'faite', 'faits'], answer: 0, why: 'faire + infinitive is always invariable.' },
    ],
    build: [
      { fr: 'La lettre que nous avons reçue est arrivée hier', en: 'The letter we received arrived yesterday' },
      { fr: 'Elles se sont rendu compte de leur erreur', en: 'They realised their mistake' },
    ],
    quiz: [
      { q: 'Avec « avoir », le participe s’accorde :', options: ['avec le COD placé avant', 'avec le sujet', 'jamais'], answer: 0, why: 'Only with a preceding direct object.' },
      { q: '« Elle s’est rendu compte » — pourquoi pas «rendue» ?', options: ['«compte» est le COD', 'le verbe est intransitif', 'c’est une exception arbitraire'], answer: 0, why: 'The object follows the participle.' },
      { q: '« Ci-joint » avant le nom :', options: ['reste invariable', 's’accorde', 'prend un s'], answer: 0, why: 'Invariable in pre-nominal position.' },
      { q: '« Les gâteaux qu’elle a ___ » (faire) :', options: ['faits', 'fait', 'faites'], answer: 0, why: 'Preceding COD, masculine plural.' },
    ],
  },
];
