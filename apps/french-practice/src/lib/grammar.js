// Grammar library: CEFR-tagged topics, each a small interactive lesson —
// explanation (reference), drills with instant feedback, sentence building,
// and a scored quiz. Pure local content; the Arena's LLM classifies mistakes
// against these topic ids to surface "grammar tip" deep links.

import { EXTRA_GRAMMAR_TOPICS } from './grammar-extra';

const BASE_TOPICS = [
  {
    id: 'present',
    cefr: 'A1',
    title: 'Le présent',
    summary: 'The workhorse tense: -er, -ir, -re verbs and the big irregulars.',
    explanation: {
      rule: 'Regular verbs follow three families: **-er** (je parle, tu parles, il parle), **-ir** (je finis, tu finis, il finit), **-re** (je vends, tu vends, il vend). The essential irregulars — **être, avoir, aller, faire** — must simply be memorised: they appear in half of all spoken sentences.',
      examples: [
        { fr: 'Je travaille à Lyon.', en: 'I work in Lyon.' },
        { fr: 'Nous finissons à midi.', en: 'We finish at noon.' },
        { fr: 'Ils vendent leur maison.', en: 'They are selling their house.' },
        { fr: "On va au marché le samedi.", en: 'We go to the market on Saturdays.' },
      ],
      watchOut: 'French has no continuous form: «je mange» covers both “I eat” and “I am eating”. Don\'t reach for a translation of “am …-ing”.',
    },
    drills: [
      { q: 'Nous ___ (finir) le projet demain.', options: ['finissons', 'finons', 'finissez'], answer: 0, why: '-ir verbs take -issons with nous: nous finissons.' },
      { q: 'Elles ___ (vendre) des fleurs au marché.', options: ['vendent', 'vendont', 'vendes'], answer: 0, why: '-re verbs: ils/elles vendent (silent -ent).' },
      { q: 'Tu ___ (aller) où ce soir ?', options: ['vas', 'va', 'ailles'], answer: 0, why: 'Aller is irregular: je vais, tu vas, il va.' },
      { q: "J'___ (avoir) deux frères.", options: ['ai', 'as', 'a'], answer: 0, why: "Avoir: j'ai, tu as, il a." },
    ],
    build: [
      { fr: 'Nous mangeons au restaurant ce soir', en: 'We are eating at the restaurant tonight' },
      { fr: 'Ils ne parlent pas anglais', en: 'They do not speak English' },
    ],
    quiz: [
      { q: 'Vous ___ (faire) quoi ce week-end ?', options: ['faites', 'faisez', 'font'], answer: 0, why: 'Faire is irregular: vous faites (not «faisez»).' },
      { q: 'Elle ___ (prendre) le bus tous les jours.', options: ['prend', 'prends', 'prende'], answer: 0, why: 'Il/elle prend — no final -s in the third person.' },
      { q: 'Je ___ (être) en retard, désolé !', options: ['suis', 'es', 'sois'], answer: 0, why: 'Être: je suis.' },
      { q: 'Les enfants ___ (choisir) un gâteau.', options: ['choisissent', 'choisent', 'choissent'], answer: 0, why: '-ir verbs double up: ils choisissent.' },
    ],
  },
  {
    id: 'articles',
    cefr: 'A2',
    title: 'Articles & partitifs',
    summary: 'le/la/les, un/une/des, and the tricky du/de la/des for “some”.',
    explanation: {
      rule: 'Use **le/la/les** for specific or general things, **un/une/des** for countable ones, and the partitive **du/de la/de l\'/des** for unspecified quantities (“some”). After a negation, everything collapses to **de**: «je n\'ai pas de pain».',
      examples: [
        { fr: 'Je voudrais du pain et de la confiture.', en: 'I would like some bread and some jam.' },
        { fr: "Il n'y a plus de lait.", en: 'There is no milk left.' },
        { fr: "J'adore le fromage.", en: 'I love cheese (in general).' },
        { fr: 'Elle achète des pommes.', en: 'She is buying (some) apples.' },
      ],
      watchOut: 'English drops the article («I love cheese»); French almost never does. Blanket rule: a French noun rarely stands naked.',
    },
    drills: [
      { q: 'Tu veux ___ eau ?', options: ["de l'", 'du', 'de la'], answer: 0, why: "Eau starts with a vowel: de l'eau." },
      { q: "Je ne mange pas ___ viande.", options: ['de', 'de la', 'des'], answer: 0, why: 'After a negation the partitive becomes plain «de».' },
      { q: "___ musique adoucit les mœurs.", options: ['La', 'De la', 'Une'], answer: 0, why: 'General statements take the definite article: la musique.' },
      { q: 'On prend ___ croissants pour demain ?', options: ['des', 'les', 'du'], answer: 0, why: 'Unspecified countable plural: des croissants.' },
    ],
    build: [
      { fr: 'Je voudrais du café et des croissants', en: 'I would like some coffee and some croissants' },
      { fr: "Il n'y a pas de sucre", en: 'There is no sugar' },
    ],
    quiz: [
      { q: 'Vous avez ___ enfants ?', options: ['des', 'les', 'de'], answer: 0, why: 'Countable, unspecified: des enfants.' },
      { q: "Je n'ai plus ___ argent.", options: ["d'", 'de l’', 'des'], answer: 0, why: "Negation → de, elided before a vowel: plus d'argent." },
      { q: 'Elle déteste ___ lundi.', options: ['le', 'un', 'du'], answer: 0, why: 'General/habitual: le lundi (Mondays in general).' },
      { q: 'Tu as acheté ___ fromage ?', options: ['du', 'le', 'des'], answer: 0, why: 'An unspecified amount of cheese: du fromage.' },
    ],
  },
  {
    id: 'negation',
    cefr: 'A2',
    title: 'La négation',
    summary: 'ne … pas, jamais, rien, plus, personne — the sandwich around the verb.',
    explanation: {
      rule: 'Negation wraps the conjugated verb: **ne + verb + pas**. Swap «pas» for **jamais** (never), **rien** (nothing), **plus** (no longer), **personne** (nobody). In casual speech the «ne» often disappears («je sais pas») — understand it, but keep «ne» when you write.',
      examples: [
        { fr: 'Je ne comprends pas.', en: "I don't understand." },
        { fr: "Elle ne fume plus.", en: 'She no longer smokes.' },
        { fr: "Il n'y a personne.", en: 'There is nobody.' },
        { fr: "Je n'ai rien dit !", en: "I didn't say anything!" },
      ],
      watchOut: 'In the passé composé, the sandwich closes around the auxiliary: «je n\'ai pas mangé», never «je n\'ai mangé pas».',
    },
    drills: [
      { q: "Je ___ travaille ___ le dimanche.", options: ['ne … pas', 'pas … ne', 'ne … personne'], answer: 0, why: 'Standard sandwich: ne + verb + pas.' },
      { q: "Il n'a ___ compris.", options: ['rien', 'personne', 'jamais rien'], answer: 0, why: "Rien follows the auxiliary: il n'a rien compris." },
      { q: 'Elle ne voyage ___ seule.', options: ['jamais', 'rien', 'personne'], answer: 0, why: 'Jamais = never: elle ne voyage jamais seule.' },
      { q: 'Nous ne vivons ___ à Paris.', options: ['plus', 'rien', 'pas de'], answer: 0, why: 'Plus = no longer: nous ne vivons plus à Paris.' },
    ],
    build: [
      { fr: "Je n'ai pas vu le film", en: 'I have not seen the film' },
      { fr: 'Elle ne boit jamais de café', en: 'She never drinks coffee' },
    ],
    quiz: [
      { q: '« Nobody called » :', options: ["Personne n'a appelé", "N'a personne appelé", 'Personne a appelé'], answer: 0, why: "Personne as subject keeps «ne»: personne n'a appelé." },
      { q: "Je ne connais ___ ici.", options: ['personne', 'rien', 'pas'], answer: 0, why: 'Personne = nobody: je ne connais personne ici.' },
      { q: '« I no longer eat meat » :', options: ['Je ne mange plus de viande', 'Je ne mange pas plus la viande', 'Je mange ne plus de viande'], answer: 0, why: 'Ne + verb + plus, and negation turns du/de la into de.' },
      { q: "Tu n'as ___ oublié ?", options: ['rien', 'personne', 'aucun'], answer: 0, why: "Rien after the auxiliary: tu n'as rien oublié ?" },
    ],
  },
  {
    id: 'passe-compose',
    cefr: 'B1',
    title: 'Passé composé vs imparfait',
    summary: 'Events vs background: the past-tense duo that shapes every story.',
    explanation: {
      rule: 'The **passé composé** (avoir/être + participle) reports completed events that move a story forward. The **imparfait** paints the background: descriptions, habits, ongoing states. A story interleaves them: «Il **pleuvait** (backdrop) quand je **suis sorti** (event)».',
      examples: [
        { fr: "Quand j'étais petit, on allait à la mer chaque été.", en: 'When I was little, we went to the sea every summer. (habit → imparfait)' },
        { fr: "Hier, je suis allé à la mer.", en: 'Yesterday I went to the sea. (one event → passé composé)' },
        { fr: 'Elle lisait quand le téléphone a sonné.', en: 'She was reading when the phone rang.' },
      ],
      watchOut: 'Verbs of motion and reflexives take **être** — and then the participle agrees: «elle est allée», «ils se sont levés».',
    },
    drills: [
      { q: 'Hier soir, nous ___ un excellent film.', options: ['avons vu', 'voyions', 'avons vus'], answer: 0, why: 'One completed event → passé composé: nous avons vu.' },
      { q: 'Quand il était étudiant, il ___ beaucoup.', options: ['sortait', 'est sorti', 'sortirait'], answer: 0, why: 'Habit in the past → imparfait: il sortait.' },
      { q: 'Elle ___ quand je suis arrivé.', options: ['dormait', 'a dormi', 'dort'], answer: 0, why: 'Ongoing backdrop → imparfait: elle dormait.' },
      { q: 'Elles ___ à huit heures.', options: ['sont parties', 'ont parti', 'sont partis'], answer: 0, why: 'Partir takes être, participle agrees: elles sont parties.' },
    ],
    build: [
      { fr: 'Il pleuvait quand je suis sorti', en: 'It was raining when I went out' },
      { fr: "Nous avons mangé puis nous sommes rentrés", en: 'We ate and then we went home' },
    ],
    quiz: [
      { q: '« She got up at 7 » :', options: ["Elle s'est levée à sept heures", "Elle s'a levé à sept heures", 'Elle se levait à sept heures (one event)'], answer: 0, why: "Reflexives take être with agreement: elle s'est levée." },
      { q: "Avant, je ___ du piano.", options: ['jouais', 'ai joué', 'jouerai'], answer: 0, why: '«Avant» signals a past habit → imparfait.' },
      { q: 'Tout à coup, le train ___ .', options: ["s'est arrêté", "s'arrêtait", "s'arrête"], answer: 0, why: '«Tout à coup» = sudden event → passé composé.' },
      { q: 'Nous ___ fatigués après le voyage.', options: ['étions', 'avons été', 'sommes'], answer: 0, why: 'A state/description in the past → imparfait: nous étions fatigués.' },
    ],
  },
  {
    id: 'futur-conditionnel',
    cefr: 'B1',
    title: 'Futur & conditionnel',
    summary: 'Will vs would — same stem, different endings, very different politeness.',
    explanation: {
      rule: 'Both build on the infinitive stem. **Futur**: -ai, -as, -a, -ons, -ez, -ont («je parlerai»). **Conditionnel**: imparfait endings on the same stem («je parlerais») — for politeness, hypotheticals, and «si» clauses: «Si j\'avais le temps, je **voyagerais**».',
      examples: [
        { fr: "Je t'appellerai demain.", en: 'I will call you tomorrow.' },
        { fr: 'Je voudrais un café, s\'il vous plaît.', en: 'I would like a coffee, please.' },
        { fr: "S'il faisait beau, on irait à la plage.", en: 'If the weather were nice, we would go to the beach.' },
      ],
      watchOut: 'After «si» meaning “if”, never use the future or conditional in the si-clause itself: «si j\'aurai» is the classic giveaway mistake — it\'s «si j\'ai» or «si j\'avais».',
    },
    drills: [
      { q: 'Demain, nous ___ (partir) tôt.', options: ['partirons', 'partirions', 'partons demain'], answer: 0, why: 'A plain future plan → futur simple: nous partirons.' },
      { q: '___ -vous m\'aider, s\'il vous plaît ?', options: ['Pourriez', 'Pourrez', 'Pouviez'], answer: 0, why: 'Polite request → conditionnel: pourriez-vous.' },
      { q: "Si j'étais toi, je ___ (accepter).", options: ["accepterais", 'accepterai', 'acceptais'], answer: 0, why: 'Hypothetical result → conditionnel: j\'accepterais.' },
      { q: "S'il ___ (avoir) le temps, il viendra.", options: ['a', 'aura', 'aurait'], answer: 0, why: 'Real condition: si + présent, result in the future.' },
    ],
    build: [
      { fr: 'Je voudrais réserver une table pour deux', en: 'I would like to book a table for two' },
      { fr: 'Si tu veux nous irons ensemble', en: 'If you want we will go together' },
    ],
    quiz: [
      { q: '« I would love to come » :', options: ["J'adorerais venir", "J'adorerai venir", "J'adorais venir"], answer: 0, why: 'Would → conditionnel: j\'adorerais.' },
      { q: 'Vous ___ (recevoir) une réponse lundi.', options: ['recevrez', 'recevriez', 'receviez'], answer: 0, why: 'A promise about Monday → futur: vous recevrez.' },
      { q: "Si elle ___ plus tôt, elle réussirait.", options: ['commençait', 'commencera', 'commencerait'], answer: 0, why: 'Hypothetical si-clause → imparfait: si elle commençait.' },
      { q: '« Could you repeat? » :', options: ['Pourriez-vous répéter ?', 'Pouvez-vous répéterez ?', 'Pourrez-vous répétiez ?'], answer: 0, why: 'Politeness → conditionnel of pouvoir + infinitive.' },
    ],
  },
  {
    id: 'subjonctif',
    cefr: 'B2',
    title: 'Le subjonctif',
    summary: 'After il faut que, vouloir que, bien que — the mood of the intermediate plateau.',
    explanation: {
      rule: 'The subjunctive follows expressions of necessity, desire, emotion and doubt + **que**: «il faut que», «je veux que», «bien que», «avant que». Stem = ils-form of the present («ils finissent» → «que je finisse») with endings -e, -es, -e, -ions, -iez, -ent. Key irregulars: **que je sois, que j\'aie, que j\'aille, que je fasse, que je puisse**.',
      examples: [
        { fr: 'Il faut que tu sois à l\'heure.', en: 'You have to be on time.' },
        { fr: "Je veux qu'il vienne avec nous.", en: 'I want him to come with us.' },
        { fr: "Bien que ce soit cher, on le prend.", en: 'Although it is expensive, we\'ll take it.' },
      ],
      watchOut: '«J\'espère que» takes the **indicative**, not the subjunctive — hope is considered confident in French: «j\'espère que tu viendras».',
    },
    drills: [
      { q: 'Il faut que vous ___ (finir) avant midi.', options: ['finissiez', 'finissez', 'finirez'], answer: 0, why: 'Il faut que + subjonctif: que vous finissiez.' },
      { q: "Je veux que tu ___ (être) honnête.", options: ['sois', 'es', 'seras'], answer: 0, why: 'Vouloir que + subjonctif: que tu sois.' },
      { q: "Bien qu'il ___ (faire) froid, on sort.", options: ['fasse', 'fait', 'fera'], answer: 0, why: 'Bien que + subjonctif: qu\'il fasse.' },
      { q: "J'espère que tu ___ (aller) mieux.", options: ['vas', 'ailles', 'irais'], answer: 0, why: 'Espérer que + indicatif — the classic exception.' },
    ],
    build: [
      { fr: 'Il faut que je parte avant six heures', en: 'I have to leave before six' },
      { fr: 'Je ne pense pas que ce soit vrai', en: 'I do not think that it is true' },
    ],
    quiz: [
      { q: 'Il est important que nous ___ (avoir) un plan.', options: ['ayons', 'avons', 'aurons'], answer: 0, why: 'Il est important que + subjonctif: que nous ayons.' },
      { q: "« I doubt he can come » :", options: ["Je doute qu'il puisse venir", "Je doute qu'il peut venir", "Je doute qu'il pourra venir"], answer: 0, why: 'Douter que + subjonctif: qu\'il puisse.' },
      { q: 'Avant que tu ___ (partir), signe ici.', options: ['partes', 'pars', 'partiras'], answer: 0, why: 'Avant que + subjonctif: que tu partes.' },
      { q: 'Je pense que c\'___ une bonne idée.', options: ['est', 'soit', 'sera forcément'], answer: 0, why: 'Penser que (affirmative) + indicatif: c\'est. Negated «je ne pense pas que» would flip to subjunctive.' },
    ],
  },
  {
    id: 'pronoms',
    cefr: 'B1',
    title: 'Les pronoms objets',
    summary: 'le/la/les, lui/leur, y and en — replacing whole phrases so you stop repeating them.',
    explanation: {
      rule: 'Object pronouns go **before the verb**. Direct (COD) **le / la / les** replace a thing/person already named («Tu vois le film ? — Oui, je le vois»). Indirect (COI) **lui / leur** replace «à + person» («Je téléphone à Marie → je lui téléphone»). **y** replaces «à + place/thing» («j\'y vais»); **en** replaces «de + …» or a quantity («j\'en veux deux»).',
      examples: [
        { fr: 'Tu connais Paul ? — Oui, je le connais.', en: 'Do you know Paul? — Yes, I know him.' },
        { fr: "J'écris à mes parents → je leur écris.", en: 'I write to my parents → I write to them.' },
        { fr: 'Tu vas à la gare ? — J\'y vais maintenant.', en: 'Are you going to the station? — I\'m going there now.' },
        { fr: 'Des pommes ? J\'en ai acheté trois.', en: 'Apples? I bought three (of them).' },
      ],
      watchOut: 'In the passé composé the past participle agrees with a **preceding direct object**: «les fleurs ? je les ai achetées» (extra -es).',
    },
    drills: [
      { q: 'Tu vois Marie ? — Oui, je ___ vois.', options: ['la', 'lui', 'y'], answer: 0, why: 'Direct object (voir quelqu\'un): je la vois.' },
      { q: 'Je parle à mon frère → je ___ parle.', options: ['lui', 'le', 'y'], answer: 0, why: 'Parler à quelqu\'un = indirect: je lui parle.' },
      { q: 'Tu penses à ton rendez-vous ? — J\'___ pense.', options: ['y', 'le', 'en'], answer: 0, why: 'Penser à quelque chose → y: j\'y pense.' },
      { q: 'Tu as du pain ? — Oui, j\'___ ai.', options: ['en', 'le', 'y'], answer: 0, why: 'Partitive «du pain» → en: j\'en ai.' },
    ],
    build: [
      { fr: 'Je lui ai donné mon numéro', en: 'I gave him my number' },
      { fr: 'On y va tout de suite', en: 'We are going there right away' },
    ],
    quiz: [
      { q: 'Tu invites les voisins ? — Oui, je ___ invite.', options: ['les', 'leur', 'y'], answer: 0, why: 'Inviter quelqu\'un = direct: je les invite.' },
      { q: 'Elle répond à ses clients → elle ___ répond.', options: ['leur', 'les', 'y'], answer: 0, why: 'Répondre à quelqu\'un = indirect: elle leur répond.' },
      { q: 'Combien de cafés ? — J\'___ prends deux.', options: ['en', 'les', 'y'], answer: 0, why: 'A quantity → en: j\'en prends deux.' },
      { q: '« I saw them (the films) yesterday »', options: ['Je les ai vus hier', 'Je leur ai vu hier', 'J\'y ai vu hier'], answer: 0, why: 'Direct object les + agreement: je les ai vus.' },
    ],
  },
  {
    id: 'comparatif',
    cefr: 'A2',
    title: 'Comparatif & superlatif',
    summary: 'plus/moins/aussi… que, and le plus/le moins — comparing anything.',
    explanation: {
      rule: 'Comparative: **plus / moins / aussi + adjective + que** («plus grand que», «moins cher que», «aussi rapide que»). Superlative: **le / la / les plus (or moins) + adjective** («le plus grand»). Irregulars: **bon → meilleur** (better) / **le meilleur** (best); the adverb **bien → mieux** (better) / **le mieux** (best).',
      examples: [
        { fr: 'Le train est plus rapide que le bus.', en: 'The train is faster than the bus.' },
        { fr: 'C\'est le restaurant le moins cher du quartier.', en: 'It\'s the cheapest restaurant in the area.' },
        { fr: 'Ce vin est meilleur que l\'autre.', en: 'This wine is better than the other.' },
        { fr: 'Elle chante mieux que moi.', en: 'She sings better than me.' },
      ],
      watchOut: 'Don\'t say «plus bon» — the comparative of «bon» is **meilleur**. And «mieux» (adverb) is not «meilleur» (adjective): «il joue mieux», but «c\'est le meilleur joueur».',
    },
    drills: [
      { q: 'Paris est ___ grand ___ Lyon.', options: ['plus / que', 'plus / de', 'le plus / que'], answer: 0, why: 'Comparative of superiority: plus … que.' },
      { q: 'Ce gâteau est ___ que l\'autre (bon).', options: ['meilleur', 'plus bon', 'mieux'], answer: 0, why: 'Bon → meilleur (never «plus bon»).' },
      { q: 'C\'est la montagne ___ haute d\'Europe.', options: ['la plus', 'plus', 'le plus'], answer: 0, why: 'Superlative agrees: la plus haute.' },
      { q: 'Aujourd\'hui je vais ___ qu\'hier (bien).', options: ['mieux', 'meilleur', 'plus bien'], answer: 0, why: 'Bien → mieux (adverb).' },
    ],
    build: [
      { fr: 'Il est moins timide que son frère', en: 'He is less shy than his brother' },
      { fr: 'C\'est le plus beau jour de ma vie', en: 'It is the most beautiful day of my life' },
    ],
    quiz: [
      { q: 'Elle est ___ intelligente ___ sa sœur (equal).', options: ['aussi / que', 'plus / que', 'autant / de'], answer: 0, why: 'Equality with an adjective: aussi … que.' },
      { q: '« the best bakery in town »', options: ['la meilleure boulangerie de la ville', 'la plus bonne boulangerie', 'la mieux boulangerie'], answer: 0, why: 'Superlative of bon: la meilleure.' },
      { q: 'Le métro va ___ vite que le tram.', options: ['plus', 'meilleur', 'le plus'], answer: 0, why: 'Comparative with an adverb: plus vite que.' },
      { q: 'De tous, c\'est lui qui travaille ___.', options: ['le mieux', 'le meilleur', 'plus bien'], answer: 0, why: 'Superlative of the adverb bien: le mieux.' },
    ],
  },
];

export const GRAMMAR_TOPICS = [...BASE_TOPICS, ...EXTRA_GRAMMAR_TOPICS];

export const getGrammarTopic = (id) => GRAMMAR_TOPICS.find((t) => t.id === id) || null;

export const GRAMMAR_TOPIC_IDS = GRAMMAR_TOPICS.map((t) => t.id);
