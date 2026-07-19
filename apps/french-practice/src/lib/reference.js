// Reference tools: verb conjugation tables, minimal pairs, cloze tests and a
// frequency word list / offline dictionary. All authored and self-contained —
// conjugations are hand-verified (irregulars can't be generated reliably),
// and everything works offline with on-device TTS.

export const PERSONS = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];

export const TENSES = [
  { id: 'present', label: 'Présent' },
  { id: 'passe', label: 'Passé composé' },
  { id: 'imparfait', label: 'Imparfait' },
  { id: 'futur', label: 'Futur simple' },
  { id: 'cond', label: 'Conditionnel' },
  { id: 'subj', label: 'Subjonctif' },
];

// Each verb: infinitive, IPA, English, and six forms per tense (order = PERSONS).
export const CONJUGATIONS = [
  {
    inf: 'être', ipa: '/ɛtʁ/', en: 'to be',
    tenses: {
      present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
      passe: ['ai été', 'as été', 'a été', 'avons été', 'avez été', 'ont été'],
      imparfait: ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient'],
      futur: ['serai', 'seras', 'sera', 'serons', 'serez', 'seront'],
      cond: ['serais', 'serais', 'serait', 'serions', 'seriez', 'seraient'],
      subj: ['sois', 'sois', 'soit', 'soyons', 'soyez', 'soient'],
    },
  },
  {
    inf: 'avoir', ipa: '/avwaʁ/', en: 'to have',
    tenses: {
      present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
      passe: ['ai eu', 'as eu', 'a eu', 'avons eu', 'avez eu', 'ont eu'],
      imparfait: ['avais', 'avais', 'avait', 'avions', 'aviez', 'avaient'],
      futur: ['aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront'],
      cond: ['aurais', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient'],
      subj: ['aie', 'aies', 'ait', 'ayons', 'ayez', 'aient'],
    },
  },
  {
    inf: 'aller', ipa: '/ale/', en: 'to go',
    tenses: {
      present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'],
      passe: ['suis allé(e)', 'es allé(e)', 'est allé(e)', 'sommes allé(e)s', 'êtes allé(e)(s)', 'sont allé(e)s'],
      imparfait: ['allais', 'allais', 'allait', 'allions', 'alliez', 'allaient'],
      futur: ['irai', 'iras', 'ira', 'irons', 'irez', 'iront'],
      cond: ['irais', 'irais', 'irait', 'irions', 'iriez', 'iraient'],
      subj: ['aille', 'ailles', 'aille', 'allions', 'alliez', 'aillent'],
    },
  },
  {
    inf: 'faire', ipa: '/fɛʁ/', en: 'to do / make',
    tenses: {
      present: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'],
      passe: ['ai fait', 'as fait', 'a fait', 'avons fait', 'avez fait', 'ont fait'],
      imparfait: ['faisais', 'faisais', 'faisait', 'faisions', 'faisiez', 'faisaient'],
      futur: ['ferai', 'feras', 'fera', 'ferons', 'ferez', 'feront'],
      cond: ['ferais', 'ferais', 'ferait', 'ferions', 'feriez', 'feraient'],
      subj: ['fasse', 'fasses', 'fasse', 'fassions', 'fassiez', 'fassent'],
    },
  },
  {
    inf: 'parler', ipa: '/paʁle/', en: 'to speak (regular -er)',
    tenses: {
      present: ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent'],
      passe: ['ai parlé', 'as parlé', 'a parlé', 'avons parlé', 'avez parlé', 'ont parlé'],
      imparfait: ['parlais', 'parlais', 'parlait', 'parlions', 'parliez', 'parlaient'],
      futur: ['parlerai', 'parleras', 'parlera', 'parlerons', 'parlerez', 'parleront'],
      cond: ['parlerais', 'parlerais', 'parlerait', 'parlerions', 'parleriez', 'parleraient'],
      subj: ['parle', 'parles', 'parle', 'parlions', 'parliez', 'parlent'],
    },
  },
  {
    inf: 'finir', ipa: '/finiʁ/', en: 'to finish (regular -ir)',
    tenses: {
      present: ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent'],
      passe: ['ai fini', 'as fini', 'a fini', 'avons fini', 'avez fini', 'ont fini'],
      imparfait: ['finissais', 'finissais', 'finissait', 'finissions', 'finissiez', 'finissaient'],
      futur: ['finirai', 'finiras', 'finira', 'finirons', 'finirez', 'finiront'],
      cond: ['finirais', 'finirais', 'finirait', 'finirions', 'finiriez', 'finiraient'],
      subj: ['finisse', 'finisses', 'finisse', 'finissions', 'finissiez', 'finissent'],
    },
  },
  {
    inf: 'prendre', ipa: '/pʁɑ̃dʁ/', en: 'to take',
    tenses: {
      present: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'],
      passe: ['ai pris', 'as pris', 'a pris', 'avons pris', 'avez pris', 'ont pris'],
      imparfait: ['prenais', 'prenais', 'prenait', 'prenions', 'preniez', 'prenaient'],
      futur: ['prendrai', 'prendras', 'prendra', 'prendrons', 'prendrez', 'prendront'],
      cond: ['prendrais', 'prendrais', 'prendrait', 'prendrions', 'prendriez', 'prendraient'],
      subj: ['prenne', 'prennes', 'prenne', 'prenions', 'preniez', 'prennent'],
    },
  },
  {
    inf: 'pouvoir', ipa: '/puvwaʁ/', en: 'can / to be able',
    tenses: {
      present: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'],
      passe: ['ai pu', 'as pu', 'a pu', 'avons pu', 'avez pu', 'ont pu'],
      imparfait: ['pouvais', 'pouvais', 'pouvait', 'pouvions', 'pouviez', 'pouvaient'],
      futur: ['pourrai', 'pourras', 'pourra', 'pourrons', 'pourrez', 'pourront'],
      cond: ['pourrais', 'pourrais', 'pourrait', 'pourrions', 'pourriez', 'pourraient'],
      subj: ['puisse', 'puisses', 'puisse', 'puissions', 'puissiez', 'puissent'],
    },
  },
  {
    inf: 'vouloir', ipa: '/vulwaʁ/', en: 'to want',
    tenses: {
      present: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'],
      passe: ['ai voulu', 'as voulu', 'a voulu', 'avons voulu', 'avez voulu', 'ont voulu'],
      imparfait: ['voulais', 'voulais', 'voulait', 'voulions', 'vouliez', 'voulaient'],
      futur: ['voudrai', 'voudras', 'voudra', 'voudrons', 'voudrez', 'voudront'],
      cond: ['voudrais', 'voudrais', 'voudrait', 'voudrions', 'voudriez', 'voudraient'],
      subj: ['veuille', 'veuilles', 'veuille', 'voulions', 'vouliez', 'veuillent'],
    },
  },
  {
    inf: 'venir', ipa: '/vəniʁ/', en: 'to come',
    tenses: {
      present: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'],
      passe: ['suis venu(e)', 'es venu(e)', 'est venu(e)', 'sommes venu(e)s', 'êtes venu(e)(s)', 'sont venu(e)s'],
      imparfait: ['venais', 'venais', 'venait', 'venions', 'veniez', 'venaient'],
      futur: ['viendrai', 'viendras', 'viendra', 'viendrons', 'viendrez', 'viendront'],
      cond: ['viendrais', 'viendrais', 'viendrait', 'viendrions', 'viendriez', 'viendraient'],
      subj: ['vienne', 'viennes', 'vienne', 'venions', 'veniez', 'viennent'],
    },
  },
];

// Minimal pairs: two words differing by a single sound. The drill plays one
// and asks which was heard — training the ear for the tricky contrasts.
export const MINIMAL_PAIRS = [
  { a: { fr: 'rue', en: 'street', ipa: '/ʁy/' }, b: { fr: 'roue', en: 'wheel', ipa: '/ʁu/' }, contrast: '/y/ vs /u/' },
  { a: { fr: 'dessus', en: 'above', ipa: '/dəsy/' }, b: { fr: 'dessous', en: 'below', ipa: '/dəsu/' }, contrast: '/y/ vs /u/' },
  { a: { fr: 'poisson', en: 'fish', ipa: '/pwasɔ̃/' }, b: { fr: 'poison', en: 'poison', ipa: '/pwazɔ̃/' }, contrast: '/s/ vs /z/' },
  { a: { fr: 'dessert', en: 'dessert', ipa: '/desɛʁ/' }, b: { fr: 'désert', en: 'desert', ipa: '/dezɛʁ/' }, contrast: '/s/ vs /z/' },
  { a: { fr: 'vin', en: 'wine', ipa: '/vɛ̃/' }, b: { fr: 'vent', en: 'wind', ipa: '/vɑ̃/' }, contrast: '/ɛ̃/ vs /ɑ̃/' },
  { a: { fr: 'pain', en: 'bread', ipa: '/pɛ̃/' }, b: { fr: 'paon', en: 'peacock', ipa: '/pɑ̃/' }, contrast: '/ɛ̃/ vs /ɑ̃/' },
  { a: { fr: 'beau', en: 'beautiful', ipa: '/bo/' }, b: { fr: 'bout', en: 'end / tip', ipa: '/bu/' }, contrast: '/o/ vs /u/' },
  { a: { fr: 'blanc', en: 'white', ipa: '/blɑ̃/' }, b: { fr: 'blond', en: 'blond', ipa: '/blɔ̃/' }, contrast: '/ɑ̃/ vs /ɔ̃/' },
  { a: { fr: 'cou', en: 'neck', ipa: '/ku/' }, b: { fr: 'queue', en: 'tail / queue', ipa: '/kø/' }, contrast: '/u/ vs /ø/' },
];

// Cloze (gap-fill) tests: a sentence with a blank and three options.
export const CLOZE_TESTS = [
  { text: 'Hier soir, je ___ au cinéma.', options: ['suis allé', 'ai allé', 'vais'], answer: 0, why: '«Aller» takes «être» in the passé composé.' },
  { text: 'Il faut que tu ___ tes devoirs.', options: ['fais', 'fasses', 'feras'], answer: 1, why: '«Il faut que» triggers the subjonctif.' },
  { text: 'Nous ___ à Paris depuis deux ans.', options: ['habitons', 'habitent', 'habite'], answer: 0, why: '«Nous» → -ons ending.' },
  { text: 'Si j’avais le temps, je ___ plus.', options: ['voyage', 'voyagerais', 'voyagerai'], answer: 1, why: 'Conditionnel after «si + imparfait».' },
  { text: 'Elle ___ déjà partie quand je suis arrivé.', options: ['était', 'est', 'a'], answer: 0, why: 'Plus-que-parfait: imparfait of «être» + participle.' },
  { text: 'C’est la femme ___ j’ai rencontrée.', options: ['qui', 'que', 'dont'], answer: 1, why: '«Que» is the direct object of «rencontrer».' },
  { text: 'Je n’ai ___ compris.', options: ['rien', 'personne', 'aucun'], answer: 0, why: '«Ne… rien» = nothing.' },
  { text: 'Quand j’étais petit, je ___ au foot.', options: ['joue', 'jouais', 'jouerai'], answer: 1, why: 'Imparfait for a past habit.' },
  { text: '___-vous parler plus lentement ?', options: ['Pouvez', 'Pouvoir', 'Pouvons'], answer: 0, why: '«Vous» form of pouvoir in a question.' },
  { text: 'Nous ___ mangé au restaurant.', options: ['avons', 'sommes', 'ont'], answer: 0, why: '«Manger» takes «avoir»; «nous» → avons.' },
];

// The high-frequency word list — the app's core searchable lexicon — lives in
// its own data module so it can grow to real dictionary scale. Re-exported
// here so the Reference hub (offline dictionary) keeps a single import.
export { FREQUENCY_WORDS } from './frequency';

// Parse a pasted custom word list — accepts "fr, en", "fr - en", "fr : en"
// or tab-separated, one per line. Returns [{ fr, en }].
export function parseWordList(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.split(/\s*(?:\t|,|-|:|—|=>|\|)\s*/);
      const fr = (m[0] || '').trim();
      const en = (m.slice(1).join(' ') || '').trim();
      return fr && en ? { fr, en } : null;
    })
    .filter(Boolean);
}
