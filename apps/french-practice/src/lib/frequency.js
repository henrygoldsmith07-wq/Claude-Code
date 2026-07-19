// High-frequency French dictionary — the app's core lexicon.
//
// Real language apps teach a few thousand words; this is the searchable,
// frequency-ranked backbone behind them. Each entry is { fr, en, rank } with
// an optional `ipa` and `note`. `rank` is a frequency band (1 = the most
// common words, 10 = still useful but rarer). Everything is authored and
// self-contained: it doubles as the offline dictionary and works with
// on-device TTS, no network required.
//
// Grouped by band and part of speech so coverage is easy to audit. This is
// data-only by design — kept in its own module so it can grow without
// bloating the reference tooling.

const b = (rank, pairs, ipa = {}) =>
  pairs.map(([fr, en]) => (ipa[fr] ? { fr, en, rank, ipa: ipa[fr] } : { fr, en, rank }));

// ── Band 1 — grammatical core: articles, pronouns, top prepositions ──────────
const band1 = b(1, [
  ['le / la', 'the'], ['les', 'the (plural)'], ['un / une', 'a / an'], ['des', 'some'],
  ['de', 'of / from'], ['à', 'to / at'], ['et', 'and'], ['ou', 'or'], ['que', 'that / which'],
  ['qui', 'who / which'], ['ne… pas', 'not'], ['je', 'I'], ['tu', 'you (informal)'],
  ['il', 'he / it'], ['elle', 'she / it'], ['nous', 'we'], ['vous', 'you (formal/plural)'],
  ['ils', 'they (m)'], ['elles', 'they (f)'], ['on', 'one / we (informal)'],
  ['ce', 'this / it'], ['se', 'oneself'], ['me', 'me / to me'], ['te', 'you / to you'],
  ['lui', 'him / to him/her'], ['leur', 'their / to them'], ['en', 'of it / some'],
  ['y', 'there / to it'], ['son / sa', 'his / her'], ['mon / ma', 'my'], ['ton / ta', 'your'],
  ['pour', 'for'], ['dans', 'in'], ['sur', 'on'], ['avec', 'with'], ['par', 'by / through'],
  ['sans', 'without'], ['mais', 'but'], ['si', 'if'], ['ne', 'not (negation)'],
], {
  'de': '/də/', 'à': '/a/', 'et': '/e/', 'que': '/kə/', 'qui': '/ki/',
  'je': '/ʒə/', 'nous': '/nu/', 'vous': '/vu/', 'pour': '/puʁ/', 'dans': '/dɑ̃/',
  'sur': '/syʁ/', 'avec': '/avɛk/', 'sans': '/sɑ̃/', 'mais': '/mɛ/',
});

// ── Band 2 — top verbs, common adverbs, more prepositions ────────────────────
const band2 = b(2, [
  ['être', 'to be'], ['avoir', 'to have'], ['faire', 'to do / make'], ['aller', 'to go'],
  ['dire', 'to say'], ['voir', 'to see'], ['savoir', 'to know (a fact)'], ['pouvoir', 'to be able to'],
  ['vouloir', 'to want'], ['venir', 'to come'], ['devoir', 'to have to / owe'], ['prendre', 'to take'],
  ['trouver', 'to find'], ['donner', 'to give'], ['parler', 'to speak'], ['aimer', 'to like / love'],
  ['passer', 'to pass / spend (time)'], ['mettre', 'to put'], ['penser', 'to think'], ['croire', 'to believe'],
  ['plus', 'more'], ['très', 'very'], ['bien', 'well'], ['tout', 'all / everything'],
  ['aussi', 'also / too'], ['comme', 'like / as'], ['moins', 'less'], ['toujours', 'always'],
  ['jamais', 'never'], ['encore', 'again / still'], ['déjà', 'already'], ['ici', 'here'],
  ['là', 'there'], ['où', 'where'], ['quand', 'when'], ['comment', 'how'],
  ['pourquoi', 'why'], ['parce que', 'because'], ['donc', 'so / therefore'], ['alors', 'then / so'],
], {
  'être': '/ɛtʁ/', 'avoir': '/avwaʁ/', 'faire': '/fɛʁ/', 'aller': '/ale/',
  'prendre': '/pʁɑ̃dʁ/', 'très': '/tʁɛ/', 'bien': '/bjɛ̃/', 'toujours': '/tuʒuʁ/',
  'où': '/u/', 'quand': '/kɑ̃/', 'pourquoi': '/puʁkwa/', 'beaucoup': '/boku/',
});

// ── Band 3 — everyday verbs and connectors ───────────────────────────────────
const band3 = b(3, [
  ['manger', 'to eat'], ['boire', 'to drink'], ['dormir', 'to sleep'], ['travailler', 'to work'],
  ['jouer', 'to play'], ['lire', 'to read'], ['écrire', 'to write'], ['écouter', 'to listen'],
  ['entendre', 'to hear'], ['regarder', 'to watch / look at'], ['acheter', 'to buy'], ['vendre', 'to sell'],
  ['payer', 'to pay'], ['ouvrir', 'to open'], ['fermer', 'to close'], ['commencer', 'to begin'],
  ['finir', 'to finish'], ['arrêter', 'to stop'], ['continuer', 'to continue'], ['essayer', 'to try'],
  ['aider', 'to help'], ['montrer', 'to show'], ['demander', 'to ask'], ['répondre', 'to answer'],
  ['appeler', 'to call'], ['rencontrer', 'to meet'], ['attendre', 'to wait'], ['chercher', 'to look for'],
  ['perdre', 'to lose'], ['gagner', 'to win / earn'], ['apprendre', 'to learn'], ['comprendre', 'to understand'],
  ['connaître', 'to know (be familiar with)'], ['oublier', 'to forget'], ['se souvenir', 'to remember'],
  ['choisir', 'to choose'], ['changer', 'to change'], ['garder', 'to keep'], ['laisser', 'to leave / let'],
  ['porter', 'to carry / wear'],
], {
  'manger': '/mɑ̃ʒe/', 'boire': '/bwaʁ/', 'travailler': '/tʁavaje/',
  'comprendre': '/kɔ̃pʁɑ̃dʁ/', 'connaître': '/kɔnɛtʁ/',
});

// ── Band 4 — people, family, body ────────────────────────────────────────────
const band4 = b(4, [
  ['homme', 'man'], ['femme', 'woman / wife'], ['enfant', 'child'], ['garçon', 'boy'],
  ['fille', 'girl / daughter'], ['bébé', 'baby'], ['personne', 'person'], ['gens', 'people'],
  ['ami', 'friend'], ['famille', 'family'], ['père', 'father'], ['mère', 'mother'],
  ['parents', 'parents'], ['frère', 'brother'], ['sœur', 'sister'], ['fils', 'son'],
  ['grand-père', 'grandfather'], ['grand-mère', 'grandmother'], ['oncle', 'uncle'], ['tante', 'aunt'],
  ['cousin', 'cousin'], ['mari', 'husband'], ['voisin', 'neighbour'], ['collègue', 'colleague'],
  ['corps', 'body'], ['tête', 'head'], ['visage', 'face'], ['œil / yeux', 'eye / eyes'],
  ['nez', 'nose'], ['bouche', 'mouth'], ['oreille', 'ear'], ['dent', 'tooth'],
  ['cheveux', 'hair'], ['cou', 'neck'], ['bras', 'arm'], ['main', 'hand'],
  ['doigt', 'finger'], ['jambe', 'leg'], ['pied', 'foot'], ['cœur', 'heart'],
  ['ventre', 'belly / stomach'], ['dos', 'back'], ['peau', 'skin'], ['sang', 'blood'],
], {
  'femme': '/fam/', 'gens': '/ʒɑ̃/', 'sœur': '/sœʁ/', 'fils': '/fis/',
  'œil / yeux': '/œj, jø/', 'cœur': '/kœʁ/',
});

// ── Band 4 — food & drink ────────────────────────────────────────────────────
const band4b = b(4, [
  ['nourriture', 'food'], ['repas', 'meal'], ['petit-déjeuner', 'breakfast'], ['déjeuner', 'lunch'],
  ['dîner', 'dinner'], ['pain', 'bread'], ['fromage', 'cheese'], ['beurre', 'butter'],
  ['œuf', 'egg'], ['viande', 'meat'], ['poulet', 'chicken'], ['poisson', 'fish'],
  ['jambon', 'ham'], ['légume', 'vegetable'], ['fruit', 'fruit'], ['pomme', 'apple'],
  ['banane', 'banana'], ['orange', 'orange'], ['fraise', 'strawberry'], ['tomate', 'tomato'],
  ['pomme de terre', 'potato'], ['carotte', 'carrot'], ['salade', 'salad / lettuce'], ['riz', 'rice'],
  ['pâtes', 'pasta'], ['soupe', 'soup'], ['gâteau', 'cake'], ['chocolat', 'chocolate'],
  ['sucre', 'sugar'], ['sel', 'salt'], ['poivre', 'pepper'], ['huile', 'oil'],
  ['eau', 'water'], ['lait', 'milk'], ['café', 'coffee'], ['thé', 'tea'],
  ['vin', 'wine'], ['bière', 'beer'], ['jus', 'juice'], ['boisson', 'drink'],
], {
  'œuf': '/œf/', 'poisson': '/pwasɔ̃/', 'eau': '/o/', 'vin': '/vɛ̃/', 'pain': '/pɛ̃/',
});

// ── Band 5 — home & everyday objects ─────────────────────────────────────────
const band5 = b(5, [
  ['maison', 'house'], ['appartement', 'flat / apartment'], ['chambre', 'bedroom'], ['cuisine', 'kitchen'],
  ['salle de bain', 'bathroom'], ['salon', 'living room'], ['porte', 'door'], ['fenêtre', 'window'],
  ['mur', 'wall'], ['sol', 'floor / ground'], ['toit', 'roof'], ['escalier', 'stairs'],
  ['table', 'table'], ['chaise', 'chair'], ['lit', 'bed'], ['canapé', 'sofa'],
  ['armoire', 'wardrobe'], ['lampe', 'lamp'], ['miroir', 'mirror'], ['tapis', 'rug / carpet'],
  ['clé', 'key'], ['sac', 'bag'], ['boîte', 'box'], ['bouteille', 'bottle'],
  ['verre', 'glass'], ['assiette', 'plate'], ['couteau', 'knife'], ['fourchette', 'fork'],
  ['cuillère', 'spoon'], ['tasse', 'cup'], ['serviette', 'towel / napkin'], ['savon', 'soap'],
  ['livre', 'book'], ['papier', 'paper'], ['stylo', 'pen'], ['téléphone', 'phone'],
  ['ordinateur', 'computer'], ['télévision', 'television'], ['horloge', 'clock'], ['argent', 'money'],
], {
  'maison': '/mɛzɔ̃/', 'clé': '/kle/', 'œil': '/œj/', 'argent': '/aʁʒɑ̃/',
});

// ── Band 5 — clothing & colours ──────────────────────────────────────────────
const band5b = b(5, [
  ['vêtements', 'clothes'], ['chemise', 'shirt'], ['pantalon', 'trousers'], ['robe', 'dress'],
  ['jupe', 'skirt'], ['manteau', 'coat'], ['veste', 'jacket'], ['pull', 'jumper / sweater'],
  ['chaussure', 'shoe'], ['chaussette', 'sock'], ['chapeau', 'hat'], ['gant', 'glove'],
  ['écharpe', 'scarf'], ['ceinture', 'belt'], ['lunettes', 'glasses'], ['montre', 'watch'],
  ['couleur', 'colour'], ['rouge', 'red'], ['bleu', 'blue'], ['vert', 'green'],
  ['jaune', 'yellow'], ['noir', 'black'], ['blanc', 'white'], ['gris', 'grey'],
  ['marron', 'brown'], ['rose', 'pink'], ['violet', 'purple'], ['orange', 'orange'],
]);

// ── Band 5 — time, days, months ──────────────────────────────────────────────
const band5c = b(5, [
  ['temps', 'time / weather'], ['heure', 'hour / time'], ['minute', 'minute'], ['seconde', 'second'],
  ['jour', 'day'], ['journée', 'day (duration)'], ['semaine', 'week'], ['mois', 'month'],
  ['année', 'year'], ['matin', 'morning'], ['midi', 'noon'], ['après-midi', 'afternoon'],
  ['soir', 'evening'], ['nuit', 'night'], ['aujourd’hui', 'today'], ['hier', 'yesterday'],
  ['demain', 'tomorrow'], ['maintenant', 'now'], ['tôt', 'early'], ['tard', 'late'],
  ['lundi', 'Monday'], ['mardi', 'Tuesday'], ['mercredi', 'Wednesday'], ['jeudi', 'Thursday'],
  ['vendredi', 'Friday'], ['samedi', 'Saturday'], ['dimanche', 'Sunday'],
  ['janvier', 'January'], ['février', 'February'], ['mars', 'March'], ['avril', 'April'],
  ['mai', 'May'], ['juin', 'June'], ['juillet', 'July'], ['août', 'August'],
  ['septembre', 'September'], ['octobre', 'October'], ['novembre', 'November'], ['décembre', 'December'],
  ['printemps', 'spring'], ['été', 'summer'], ['automne', 'autumn'], ['hiver', 'winter'],
], { 'temps': '/tɑ̃/', 'août': '/u(t)/' });

// ── Band 6 — city, places, transport ─────────────────────────────────────────
const band6 = b(6, [
  ['ville', 'city / town'], ['rue', 'street'], ['route', 'road'], ['place', 'square / place'],
  ['quartier', 'neighbourhood'], ['centre-ville', 'town centre'], ['magasin', 'shop'], ['marché', 'market'],
  ['boulangerie', 'bakery'], ['restaurant', 'restaurant'], ['café', 'café'], ['hôtel', 'hotel'],
  ['banque', 'bank'], ['pharmacie', 'pharmacy'], ['hôpital', 'hospital'], ['école', 'school'],
  ['université', 'university'], ['bureau', 'office'], ['église', 'church'], ['musée', 'museum'],
  ['parc', 'park'], ['jardin', 'garden'], ['gare', 'train station'], ['aéroport', 'airport'],
  ['voiture', 'car'], ['train', 'train'], ['bus', 'bus'], ['métro', 'underground / subway'],
  ['vélo', 'bike'], ['moto', 'motorbike'], ['avion', 'plane'], ['bateau', 'boat'],
  ['taxi', 'taxi'], ['billet', 'ticket'], ['voyage', 'trip / journey'], ['valise', 'suitcase'],
  ['pont', 'bridge'], ['plage', 'beach'], ['montagne', 'mountain'], ['campagne', 'countryside'],
], { 'ville': '/vil/', 'voiture': '/vwatyʁ/', 'gare': '/ɡaʁ/' });

// ── Band 6 — nature & weather ────────────────────────────────────────────────
const band6b = b(6, [
  ['nature', 'nature'], ['ciel', 'sky'], ['soleil', 'sun'], ['lune', 'moon'],
  ['étoile', 'star'], ['nuage', 'cloud'], ['pluie', 'rain'], ['neige', 'snow'],
  ['vent', 'wind'], ['orage', 'storm'], ['feu', 'fire'], ['terre', 'earth / ground'],
  ['air', 'air'], ['mer', 'sea'], ['lac', 'lake'], ['rivière', 'river'],
  ['forêt', 'forest'], ['arbre', 'tree'], ['fleur', 'flower'], ['herbe', 'grass'],
  ['feuille', 'leaf'], ['pierre', 'stone'], ['sable', 'sand'], ['île', 'island'],
  ['animal', 'animal'], ['chien', 'dog'], ['chat', 'cat'], ['cheval', 'horse'],
  ['oiseau', 'bird'], ['vache', 'cow'], ['mouton', 'sheep'], ['cochon', 'pig'],
  ['souris', 'mouse'], ['lapin', 'rabbit'], ['ours', 'bear'], ['lion', 'lion'],
  ['insecte', 'insect'], ['abeille', 'bee'], ['papillon', 'butterfly'], ['araignée', 'spider'],
], { 'soleil': '/sɔlɛj/', 'œil': '/œj/', 'chien': '/ʃjɛ̃/', 'oiseau': '/wazo/' });

// ── Band 7 — work, school, money, tech ───────────────────────────────────────
const band7 = b(7, [
  ['travail', 'work'], ['métier', 'job / trade'], ['patron', 'boss'], ['employé', 'employee'],
  ['entreprise', 'company'], ['réunion', 'meeting'], ['projet', 'project'], ['salaire', 'salary'],
  ['client', 'customer'], ['médecin', 'doctor'], ['professeur', 'teacher'], ['étudiant', 'student'],
  ['avocat', 'lawyer'], ['ingénieur', 'engineer'], ['vendeur', 'salesperson'], ['serveur', 'waiter / server'],
  ['cours', 'class / course'], ['leçon', 'lesson'], ['devoir', 'homework'], ['examen', 'exam'],
  ['note', 'grade / note'], ['mot', 'word'], ['phrase', 'sentence'], ['question', 'question'],
  ['réponse', 'answer'], ['prix', 'price / prize'], ['euro', 'euro'], ['carte', 'card / map'],
  ['compte', 'account'], ['facture', 'bill / invoice'], ['impôt', 'tax'], ['courriel', 'email'],
  ['internet', 'internet'], ['site', 'website'], ['écran', 'screen'], ['clavier', 'keyboard'],
  ['fichier', 'file'], ['message', 'message'], ['application', 'app'], ['réseau', 'network'],
]);

// ── Band 8 — common adjectives ───────────────────────────────────────────────
const band8 = b(8, [
  ['grand', 'big / tall'], ['petit', 'small'], ['bon', 'good'], ['mauvais', 'bad'],
  ['beau', 'beautiful / handsome'], ['joli', 'pretty'], ['laid', 'ugly'], ['jeune', 'young'],
  ['vieux', 'old'], ['nouveau', 'new'], ['vieux / ancien', 'old / former'], ['long', 'long'],
  ['court', 'short'], ['haut', 'high / tall'], ['bas', 'low'], ['gros', 'big / fat'],
  ['mince', 'thin / slim'], ['lourd', 'heavy'], ['léger', 'light (weight)'], ['fort', 'strong'],
  ['faible', 'weak'], ['facile', 'easy'], ['difficile', 'difficult'], ['important', 'important'],
  ['cher', 'expensive / dear'], ['gratuit', 'free (no cost)'], ['plein', 'full'], ['vide', 'empty'],
  ['propre', 'clean / own'], ['sale', 'dirty'], ['chaud', 'hot / warm'], ['froid', 'cold'],
  ['rapide', 'fast'], ['lent', 'slow'], ['vrai', 'true'], ['faux', 'false'],
  ['ouvert', 'open'], ['fermé', 'closed'], ['prêt', 'ready'], ['possible', 'possible'],
  ['content', 'happy'], ['triste', 'sad'], ['fatigué', 'tired'], ['malade', 'ill / sick'],
  ['heureux', 'happy'], ['sûr', 'sure / safe'], ['dangereux', 'dangerous'], ['calme', 'calm'],
], { 'vieux': '/vjø/', 'chaud': '/ʃo/', 'heureux': '/øʁø/' });

// ── Band 9 — numbers, quantities, question words ─────────────────────────────
const band9 = b(9, [
  ['zéro', 'zero'], ['un', 'one'], ['deux', 'two'], ['trois', 'three'],
  ['quatre', 'four'], ['cinq', 'five'], ['six', 'six'], ['sept', 'seven'],
  ['huit', 'eight'], ['neuf', 'nine'], ['dix', 'ten'], ['onze', 'eleven'],
  ['douze', 'twelve'], ['treize', 'thirteen'], ['vingt', 'twenty'], ['trente', 'thirty'],
  ['quarante', 'forty'], ['cinquante', 'fifty'], ['cent', 'hundred'], ['mille', 'thousand'],
  ['premier', 'first'], ['deuxième', 'second'], ['dernier', 'last'], ['demi', 'half'],
  ['beaucoup', 'a lot'], ['peu', 'few / little'], ['assez', 'enough / quite'], ['trop', 'too much'],
  ['plusieurs', 'several'], ['quelques', 'a few'], ['chaque', 'each'], ['tous', 'all'],
  ['quel', 'which / what'], ['combien', 'how much / many'], ['quelque chose', 'something'], ['quelqu’un', 'someone'],
  ['rien', 'nothing'], ['personne', 'nobody'], ['nombre', 'number'], ['moitié', 'half'],
], { 'deux': '/dø/', 'six': '/sis/', 'neuf': '/nœf/', 'cinq': '/sɛ̃k/' });

// ── Band 10 — abstract nouns, feelings, useful extras ────────────────────────
const band10 = b(10, [
  ['idée', 'idea'], ['problème', 'problem'], ['solution', 'solution'], ['raison', 'reason'],
  ['exemple', 'example'], ['façon', 'way / manner'], ['moyen', 'means / way'], ['chose', 'thing'],
  ['fait', 'fact'], ['histoire', 'story / history'], ['vie', 'life'], ['monde', 'world'],
  ['pays', 'country'], ['langue', 'language / tongue'], ['nom', 'name'], ['âge', 'age'],
  ['amour', 'love'], ['peur', 'fear'], ['joie', 'joy'], ['colère', 'anger'],
  ['espoir', 'hope'], ['rêve', 'dream'], ['chance', 'luck / chance'], ['santé', 'health'],
  ['force', 'strength'], ['esprit', 'mind / spirit'], ['sens', 'meaning / sense'], ['besoin', 'need'],
  ['envie', 'desire / urge'], ['plaisir', 'pleasure'], ['bonheur', 'happiness'], ['malheur', 'misfortune'],
  ['droit', 'right / law'], ['liberté', 'freedom'], ['paix', 'peace'], ['guerre', 'war'],
  ['pouvoir', 'power'], ['effort', 'effort'], ['succès', 'success'], ['échec', 'failure'],
  ['bonjour', 'hello'], ['bonsoir', 'good evening'], ['salut', 'hi / bye'], ['au revoir', 'goodbye'],
  ['merci', 'thank you'], ['s’il vous plaît', 'please'], ['pardon', 'sorry / excuse me'], ['oui', 'yes'],
  ['non', 'no'], ['peut-être', 'maybe'], ['d’accord', 'okay / agreed'], ['bien sûr', 'of course'],
], { 'vie': '/vi/', 'pays': '/pei/', 'œil': '/œj/', 'oui': '/wi/' });

export const FREQUENCY_WORDS = [
  ...band1, ...band2, ...band3, ...band4, ...band4b, ...band5, ...band5b, ...band5c,
  ...band6, ...band6b, ...band7, ...band8, ...band9, ...band10,
];
