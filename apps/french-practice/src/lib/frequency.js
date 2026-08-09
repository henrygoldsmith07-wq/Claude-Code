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

// ── Verbs, tier 2 — everyday actions ─────────────────────────────────────────
const verbs2 = b(4, [
  ['marcher', 'to walk'], ['courir', 'to run'], ['sauter', 'to jump'], ['tomber', 'to fall'],
  ['monter', 'to go up'], ['descendre', 'to go down'], ['entrer', 'to enter'], ['sortir', 'to go out'],
  ['rester', 'to stay'], ['revenir', 'to come back'], ['retourner', 'to return'], ['arriver', 'to arrive'],
  ['partir', 'to leave'], ['tourner', 'to turn'], ['traverser', 'to cross'], ['suivre', 'to follow'],
  ['emmener', 'to take (someone)'], ['apporter', 'to bring'], ['tenir', 'to hold'], ['lancer', 'to throw'],
  ['jeter', 'to throw away'], ['ramasser', 'to pick up'], ['pousser', 'to push'], ['tirer', 'to pull'],
  ['couper', 'to cut'], ['casser', 'to break'], ['réparer', 'to repair'], ['construire', 'to build'],
  ['nettoyer', 'to clean'], ['laver', 'to wash'], ['ranger', 'to tidy'], ['remplir', 'to fill'],
  ['vider', 'to empty'], ['allumer', 'to turn on'], ['éteindre', 'to turn off'], ['pousser', 'to grow / push'],
  ['cacher', 'to hide'], ['trouver', 'to find'], ['ramener', 'to bring back'], ['déplacer', 'to move'],
]);

// ── Verbs, tier 3 — communication & mind ─────────────────────────────────────
const verbs3 = b(5, [
  ['expliquer', 'to explain'], ['raconter', 'to tell (a story)'], ['décrire', 'to describe'], ['discuter', 'to discuss'],
  ['bavarder', 'to chat'], ['crier', 'to shout'], ['chuchoter', 'to whisper'], ['répéter', 'to repeat'],
  ['annoncer', 'to announce'], ['proposer', 'to suggest'], ['promettre', 'to promise'], ['refuser', 'to refuse'],
  ['accepter', 'to accept'], ['remercier', 'to thank'], ['féliciter', 'to congratulate'], ['s’excuser', 'to apologise'],
  ['mentir', 'to lie'], ['avouer', 'to confess'], ['deviner', 'to guess'], ['imaginer', 'to imagine'],
  ['rêver', 'to dream'], ['réfléchir', 'to think / reflect'], ['décider', 'to decide'], ['espérer', 'to hope'],
  ['douter', 'to doubt'], ['remarquer', 'to notice'], ['reconnaître', 'to recognise'], ['se rappeler', 'to remember'],
  ['préférer', 'to prefer'], ['détester', 'to hate'], ['adorer', 'to adore'], ['souhaiter', 'to wish'],
  ['craindre', 'to fear'], ['oser', 'to dare'], ['hésiter', 'to hesitate'], ['convaincre', 'to convince'],
  ['prévenir', 'to warn'], ['conseiller', 'to advise'], ['interdire', 'to forbid'], ['permettre', 'to allow'],
]);

// ── Verbs, tier 4 — daily life & feelings ────────────────────────────────────
const verbs4 = b(6, [
  ['se réveiller', 'to wake up'], ['se lever', 'to get up'], ['se coucher', 'to go to bed'], ['s’habiller', 'to get dressed'],
  ['se laver', 'to wash oneself'], ['se raser', 'to shave'], ['se brosser', 'to brush'], ['se dépêcher', 'to hurry'],
  ['se reposer', 'to rest'], ['s’asseoir', 'to sit down'], ['se promener', 'to go for a walk'], ['s’amuser', 'to have fun'],
  ['s’ennuyer', 'to be bored'], ['s’inquiéter', 'to worry'], ['se fâcher', 'to get angry'], ['pleurer', 'to cry'],
  ['rire', 'to laugh'], ['sourire', 'to smile'], ['embrasser', 'to kiss'], ['serrer', 'to hug / squeeze'],
  ['tomber amoureux', 'to fall in love'], ['se marier', 'to get married'], ['divorcer', 'to divorce'], ['naître', 'to be born'],
  ['mourir', 'to die'], ['grandir', 'to grow up'], ['vieillir', 'to grow old'], ['guérir', 'to heal / recover'],
  ['souffrir', 'to suffer'], ['saigner', 'to bleed'], ['tousser', 'to cough'], ['éternuer', 'to sneeze'],
  ['respirer', 'to breathe'], ['sentir', 'to feel / smell'], ['toucher', 'to touch'], ['goûter', 'to taste'],
  ['fumer', 'to smoke'], ['cuisiner', 'to cook'], ['servir', 'to serve'], ['nourrir', 'to feed'],
]);

// ── Verbs, tier 5 — work, movement, abstract ─────────────────────────────────
const verbs5 = b(7, [
  ['diriger', 'to lead / manage'], ['organiser', 'to organise'], ['gérer', 'to manage'], ['employer', 'to employ'],
  ['embaucher', 'to hire'], ['licencier', 'to lay off'], ['produire', 'to produce'], ['fabriquer', 'to manufacture'],
  ['créer', 'to create'], ['inventer', 'to invent'], ['développer', 'to develop'], ['améliorer', 'to improve'],
  ['augmenter', 'to increase'], ['diminuer', 'to decrease'], ['réduire', 'to reduce'], ['ajouter', 'to add'],
  ['enlever', 'to remove'], ['remplacer', 'to replace'], ['comparer', 'to compare'], ['mesurer', 'to measure'],
  ['compter', 'to count'], ['calculer', 'to calculate'], ['dépenser', 'to spend'], ['économiser', 'to save (money)'],
  ['emprunter', 'to borrow'], ['prêter', 'to lend'], ['coûter', 'to cost'], ['valoir', 'to be worth'],
  ['livrer', 'to deliver'], ['envoyer', 'to send'], ['recevoir', 'to receive'], ['commander', 'to order'],
  ['réserver', 'to book'], ['annuler', 'to cancel'], ['confirmer', 'to confirm'], ['signer', 'to sign'],
  ['remplir', 'to fill in'], ['imprimer', 'to print'], ['télécharger', 'to download'], ['enregistrer', 'to save / record'],
]);

// ── Professions ──────────────────────────────────────────────────────────────
const jobs = b(6, [
  ['boulanger', 'baker'], ['boucher', 'butcher'], ['cuisinier', 'cook'], ['chef', 'chef / boss'],
  ['serveur', 'waiter'], ['agriculteur', 'farmer'], ['pêcheur', 'fisherman'], ['jardinier', 'gardener'],
  ['maçon', 'bricklayer'], ['plombier', 'plumber'], ['électricien', 'electrician'], ['menuisier', 'carpenter'],
  ['mécanicien', 'mechanic'], ['peintre', 'painter'], ['coiffeur', 'hairdresser'], ['caissier', 'cashier'],
  ['comptable', 'accountant'], ['secrétaire', 'secretary'], ['directeur', 'director'], ['gérant', 'manager'],
  ['infirmier', 'nurse'], ['dentiste', 'dentist'], ['pharmacien', 'pharmacist'], ['vétérinaire', 'vet'],
  ['policier', 'police officer'], ['pompier', 'firefighter'], ['soldat', 'soldier'], ['juge', 'judge'],
  ['journaliste', 'journalist'], ['écrivain', 'writer'], ['acteur', 'actor'], ['chanteur', 'singer'],
  ['musicien', 'musician'], ['artiste', 'artist'], ['photographe', 'photographer'], ['architecte', 'architect'],
  ['informaticien', 'IT specialist'], ['chercheur', 'researcher'], ['scientifique', 'scientist'], ['facteur', 'postman'],
  ['chauffeur', 'driver'], ['pilote', 'pilot'], ['agent', 'agent / officer'], ['ouvrier', 'worker'],
]);

// ── Health & medical ─────────────────────────────────────────────────────────
const health = b(6, [
  ['santé', 'health'], ['maladie', 'illness'], ['douleur', 'pain'], ['fièvre', 'fever'],
  ['rhume', 'cold'], ['grippe', 'flu'], ['toux', 'cough'], ['blessure', 'injury'],
  ['plaie', 'wound'], ['brûlure', 'burn'], ['fracture', 'fracture'], ['allergie', 'allergy'],
  ['médicament', 'medicine'], ['comprimé', 'tablet'], ['pilule', 'pill'], ['sirop', 'syrup'],
  ['ordonnance', 'prescription'], ['piqûre', 'injection / sting'], ['vaccin', 'vaccine'], ['pansement', 'bandage'],
  ['opération', 'operation'], ['régime', 'diet'], ['repos', 'rest'], ['forme', 'shape / fitness'],
  ['tension', 'blood pressure'], ['pouls', 'pulse'], ['poumon', 'lung'], ['estomac', 'stomach'],
  ['foie', 'liver'], ['rein', 'kidney'], ['muscle', 'muscle'], ['os', 'bone'],
  ['nerf', 'nerve'], ['cerveau', 'brain'], ['genou', 'knee'], ['épaule', 'shoulder'],
  ['coude', 'elbow'], ['poignet', 'wrist'], ['cheville', 'ankle'], ['gorge', 'throat'],
]);

// ── Food & cooking, expanded ─────────────────────────────────────────────────
const foodx = b(6, [
  ['farine', 'flour'], ['pâte', 'dough / paste'], ['crème', 'cream'], ['yaourt', 'yoghurt'],
  ['miel', 'honey'], ['confiture', 'jam'], ['céréales', 'cereal'], ['biscuit', 'biscuit'],
  ['bonbon', 'sweet / candy'], ['glace', 'ice cream / ice'], ['tarte', 'pie / tart'], ['crêpe', 'pancake'],
  ['sandwich', 'sandwich'], ['frites', 'chips / fries'], ['saucisse', 'sausage'], ['steak', 'steak'],
  ['agneau', 'lamb'], ['porc', 'pork'], ['bœuf', 'beef'], ['dinde', 'turkey'],
  ['crevette', 'shrimp'], ['huître', 'oyster'], ['saumon', 'salmon'], ['thon', 'tuna'],
  ['citron', 'lemon'], ['cerise', 'cherry'], ['pêche', 'peach'], ['poire', 'pear'],
  ['raisin', 'grape'], ['ananas', 'pineapple'], ['melon', 'melon'], ['pastèque', 'watermelon'],
  ['champignon', 'mushroom'], ['oignon', 'onion'], ['ail', 'garlic'], ['haricot', 'bean'],
  ['petit pois', 'pea'], ['concombre', 'cucumber'], ['épinard', 'spinach'], ['courgette', 'courgette'],
  ['épice', 'spice'], ['herbe', 'herb'], ['vinaigre', 'vinegar'], ['moutarde', 'mustard'],
  ['recette', 'recipe'], ['four', 'oven'], ['casserole', 'saucepan'], ['poêle', 'frying pan'],
]);

// ── Kitchen, household, tools ────────────────────────────────────────────────
const household = b(6, [
  ['meuble', 'furniture'], ['étagère', 'shelf'], ['tiroir', 'drawer'], ['placard', 'cupboard'],
  ['évier', 'sink'], ['robinet', 'tap'], ['douche', 'shower'], ['baignoire', 'bathtub'],
  ['toilettes', 'toilet'], ['réfrigérateur', 'fridge'], ['congélateur', 'freezer'], ['micro-ondes', 'microwave'],
  ['lave-vaisselle', 'dishwasher'], ['machine à laver', 'washing machine'], ['aspirateur', 'vacuum cleaner'], ['balai', 'broom'],
  ['éponge', 'sponge'], ['poubelle', 'bin'], ['couverture', 'blanket'], ['oreiller', 'pillow'],
  ['drap', 'sheet'], ['rideau', 'curtain'], ['coussin', 'cushion'], ['bougie', 'candle'],
  ['prise', 'socket / plug'], ['interrupteur', 'switch'], ['ampoule', 'light bulb'], ['chauffage', 'heating'],
  ['climatisation', 'air conditioning'], ['outil', 'tool'], ['marteau', 'hammer'], ['clou', 'nail'],
  ['vis', 'screw'], ['tournevis', 'screwdriver'], ['scie', 'saw'], ['perceuse', 'drill'],
  ['échelle', 'ladder'], ['corde', 'rope'], ['fil', 'thread / wire'], ['colle', 'glue'],
]);

// ── Clothing & materials, expanded ───────────────────────────────────────────
const clothingx = b(6, [
  ['tenue', 'outfit'], ['costume', 'suit'], ['cravate', 'tie'], ['nœud papillon', 'bow tie'],
  ['jean', 'jeans'], ['short', 'shorts'], ['maillot', 'jersey / swimsuit'], ['sous-vêtements', 'underwear'],
  ['pyjama', 'pyjamas'], ['bottes', 'boots'], ['sandales', 'sandals'], ['baskets', 'trainers'],
  ['casquette', 'cap'], ['bonnet', 'beanie'], ['bijou', 'jewel'], ['bague', 'ring'],
  ['collier', 'necklace'], ['bracelet', 'bracelet'], ['boucle d’oreille', 'earring'], ['sac à main', 'handbag'],
  ['parapluie', 'umbrella'], ['portefeuille', 'wallet'], ['tissu', 'fabric'], ['coton', 'cotton'],
  ['laine', 'wool'], ['soie', 'silk'], ['cuir', 'leather'], ['plastique', 'plastic'],
  ['métal', 'metal'], ['fer', 'iron'], ['acier', 'steel'], ['or', 'gold'],
  ['argent', 'silver'], ['bois', 'wood'], ['verre', 'glass'], ['pierre', 'stone'],
  ['brique', 'brick'], ['béton', 'concrete'], ['caoutchouc', 'rubber'], ['carton', 'cardboard'],
]);

// ── Colours & shades, shapes ─────────────────────────────────────────────────
const colours = b(7, [
  ['clair', 'light (colour)'], ['foncé', 'dark'], ['vif', 'bright'], ['pâle', 'pale'],
  ['beige', 'beige'], ['turquoise', 'turquoise'], ['doré', 'golden'], ['argenté', 'silvery'],
  ['forme', 'shape'], ['rond', 'round'], ['carré', 'square'], ['rectangle', 'rectangle'],
  ['triangle', 'triangle'], ['cercle', 'circle'], ['ligne', 'line'], ['courbe', 'curve'],
  ['point', 'point / dot'], ['angle', 'angle'], ['côté', 'side'], ['bord', 'edge'],
  ['coin', 'corner'], ['centre', 'centre'], ['taille', 'size / waist'], ['largeur', 'width'],
  ['longueur', 'length'], ['hauteur', 'height'], ['profondeur', 'depth'], ['épaisseur', 'thickness'],
]);

// ── Sports, games & hobbies ──────────────────────────────────────────────────
const sports = b(6, [
  ['sport', 'sport'], ['football', 'football'], ['rugby', 'rugby'], ['tennis', 'tennis'],
  ['basket', 'basketball'], ['natation', 'swimming'], ['course', 'running / race'], ['cyclisme', 'cycling'],
  ['ski', 'skiing'], ['patinage', 'skating'], ['randonnée', 'hiking'], ['escalade', 'climbing'],
  ['danse', 'dance'], ['gymnastique', 'gymnastics'], ['boxe', 'boxing'], ['équipe', 'team'],
  ['joueur', 'player'], ['entraîneur', 'coach'], ['arbitre', 'referee'], ['match', 'match'],
  ['but', 'goal'], ['ballon', 'ball'], ['balle', 'ball (small)'], ['raquette', 'racket'],
  ['filet', 'net'], ['terrain', 'pitch / court'], ['stade', 'stadium'], ['gymnase', 'gym'],
  ['piscine', 'swimming pool'], ['victoire', 'victory'], ['défaite', 'defeat'], ['médaille', 'medal'],
  ['jeu', 'game'], ['carte', 'card'], ['dé', 'dice'], ['échecs', 'chess'],
  ['puzzle', 'puzzle'], ['jouet', 'toy'], ['loisir', 'leisure'], ['hobby', 'hobby'],
]);

// ── Arts, music & culture ────────────────────────────────────────────────────
const arts = b(6, [
  ['art', 'art'], ['musique', 'music'], ['chanson', 'song'], ['instrument', 'instrument'],
  ['piano', 'piano'], ['guitare', 'guitar'], ['violon', 'violin'], ['batterie', 'drums'],
  ['flûte', 'flute'], ['trompette', 'trumpet'], ['orchestre', 'orchestra'], ['concert', 'concert'],
  ['peinture', 'painting'], ['dessin', 'drawing'], ['tableau', 'painting / board'], ['sculpture', 'sculpture'],
  ['photo', 'photo'], ['cinéma', 'cinema'], ['film', 'film'], ['théâtre', 'theatre'],
  ['pièce', 'play / room / coin'], ['scène', 'stage / scene'], ['danse', 'dance'], ['ballet', 'ballet'],
  ['roman', 'novel'], ['poème', 'poem'], ['conte', 'tale'], ['auteur', 'author'],
  ['personnage', 'character'], ['acteur', 'actor'], ['spectacle', 'show'], ['public', 'audience'],
  ['billet', 'ticket'], ['exposition', 'exhibition'], ['galerie', 'gallery'], ['culture', 'culture'],
  ['tradition', 'tradition'], ['fête', 'party / festival'], ['festival', 'festival'], ['carnaval', 'carnival'],
]);

// ── Technology & computing ───────────────────────────────────────────────────
const tech = b(6, [
  ['technologie', 'technology'], ['machine', 'machine'], ['moteur', 'engine / motor'], ['électricité', 'electricity'],
  ['batterie', 'battery'], ['pile', 'battery (cell)'], ['câble', 'cable'], ['prise', 'plug'],
  ['logiciel', 'software'], ['matériel', 'hardware'], ['données', 'data'], ['mémoire', 'memory'],
  ['disque', 'disk'], ['dossier', 'folder'], ['document', 'document'], ['page', 'page'],
  ['lien', 'link'], ['mot de passe', 'password'], ['compte', 'account'], ['utilisateur', 'user'],
  ['navigateur', 'browser'], ['moteur de recherche', 'search engine'], ['appareil', 'device'], ['tablette', 'tablet'],
  ['portable', 'laptop / mobile'], ['smartphone', 'smartphone'], ['caméra', 'camera'], ['imprimante', 'printer'],
  ['souris', 'mouse'], ['casque', 'headphones / helmet'], ['haut-parleur', 'speaker'], ['micro', 'microphone'],
  ['robot', 'robot'], ['intelligence artificielle', 'artificial intelligence'], ['programme', 'program'], ['code', 'code'],
  ['bug', 'bug'], ['panne', 'breakdown'], ['mise à jour', 'update'], ['sauvegarde', 'backup'],
]);

// ── Business, money & economy ────────────────────────────────────────────────
const business = b(7, [
  ['affaires', 'business'], ['commerce', 'trade'], ['économie', 'economy'], ['marché', 'market'],
  ['produit', 'product'], ['service', 'service'], ['vente', 'sale'], ['achat', 'purchase'],
  ['bénéfice', 'profit'], ['perte', 'loss'], ['coût', 'cost'], ['dépense', 'expense'],
  ['revenu', 'income'], ['budget', 'budget'], ['dette', 'debt'], ['crédit', 'credit'],
  ['prêt', 'loan'], ['intérêt', 'interest'], ['banque', 'bank'], ['monnaie', 'currency'],
  ['billet', 'note (money)'], ['pièce', 'coin'], ['carte bancaire', 'bank card'], ['chèque', 'cheque'],
  ['facture', 'invoice'], ['reçu', 'receipt'], ['taxe', 'tax'], ['assurance', 'insurance'],
  ['contrat', 'contract'], ['accord', 'agreement'], ['négociation', 'negotiation'], ['investissement', 'investment'],
  ['action', 'share / action'], ['bourse', 'stock exchange'], ['richesse', 'wealth'], ['pauvreté', 'poverty'],
  ['salaire', 'wage'], ['emploi', 'job / employment'], ['chômage', 'unemployment'], ['retraite', 'retirement'],
]);

// ── Society, politics & law ──────────────────────────────────────────────────
const society = b(7, [
  ['société', 'society'], ['peuple', 'people / nation'], ['citoyen', 'citizen'], ['population', 'population'],
  ['gouvernement', 'government'], ['état', 'state'], ['nation', 'nation'], ['république', 'republic'],
  ['président', 'president'], ['ministre', 'minister'], ['maire', 'mayor'], ['député', 'MP'],
  ['élection', 'election'], ['vote', 'vote'], ['parti', 'party'], ['politique', 'politics / policy'],
  ['loi', 'law'], ['règle', 'rule'], ['justice', 'justice'], ['tribunal', 'court'],
  ['crime', 'crime'], ['prison', 'prison'], ['police', 'police'], ['pompier', 'firefighter'],
  ['armée', 'army'], ['paix', 'peace'], ['manifestation', 'protest'], ['grève', 'strike'],
  ['droits', 'rights'], ['devoir', 'duty'], ['impôt', 'tax'], ['frontière', 'border'],
  ['drapeau', 'flag'], ['pouvoir', 'power'], ['liberté', 'freedom'], ['égalité', 'equality'],
  ['religion', 'religion'], ['église', 'church'], ['dieu', 'god'], ['croyance', 'belief'],
]);

// ── Science, nature & environment ────────────────────────────────────────────
const science = b(7, [
  ['science', 'science'], ['recherche', 'research'], ['expérience', 'experiment / experience'], ['découverte', 'discovery'],
  ['théorie', 'theory'], ['preuve', 'proof'], ['résultat', 'result'], ['cause', 'cause'],
  ['effet', 'effect'], ['énergie', 'energy'], ['force', 'force'], ['chaleur', 'heat'],
  ['lumière', 'light'], ['son', 'sound'], ['vitesse', 'speed'], ['poids', 'weight'],
  ['masse', 'mass'], ['matière', 'matter / subject'], ['gaz', 'gas'], ['liquide', 'liquid'],
  ['solide', 'solid'], ['métal', 'metal'], ['atome', 'atom'], ['molécule', 'molecule'],
  ['cellule', 'cell'], ['espèce', 'species'], ['planète', 'planet'], ['univers', 'universe'],
  ['espace', 'space'], ['gravité', 'gravity'], ['environnement', 'environment'], ['nature', 'nature'],
  ['climat', 'climate'], ['pollution', 'pollution'], ['déchet', 'waste'], ['recyclage', 'recycling'],
  ['forêt', 'forest'], ['océan', 'ocean'], ['désert', 'desert'], ['volcan', 'volcano'],
]);

// ── Plants & garden ──────────────────────────────────────────────────────────
const plants = b(8, [
  ['plante', 'plant'], ['graine', 'seed'], ['racine', 'root'], ['tige', 'stem'],
  ['branche', 'branch'], ['feuille', 'leaf'], ['fleur', 'flower'], ['fruit', 'fruit'],
  ['rose', 'rose'], ['tulipe', 'tulip'], ['marguerite', 'daisy'], ['tournesol', 'sunflower'],
  ['chêne', 'oak'], ['sapin', 'fir tree'], ['palmier', 'palm tree'], ['buisson', 'bush'],
  ['gazon', 'lawn'], ['mauvaise herbe', 'weed'], ['potager', 'vegetable garden'], ['verger', 'orchard'],
  ['récolte', 'harvest'], ['champ', 'field'], ['ferme', 'farm'], ['tracteur', 'tractor'],
]);

// ── Animals, expanded ────────────────────────────────────────────────────────
const animalsx = b(7, [
  ['loup', 'wolf'], ['renard', 'fox'], ['cerf', 'deer'], ['sanglier', 'wild boar'],
  ['écureuil', 'squirrel'], ['hérisson', 'hedgehog'], ['taupe', 'mole'], ['chauve-souris', 'bat'],
  ['éléphant', 'elephant'], ['girafe', 'giraffe'], ['singe', 'monkey'], ['tigre', 'tiger'],
  ['zèbre', 'zebra'], ['hippopotame', 'hippo'], ['rhinocéros', 'rhino'], ['crocodile', 'crocodile'],
  ['serpent', 'snake'], ['grenouille', 'frog'], ['tortue', 'tortoise / turtle'], ['lézard', 'lizard'],
  ['requin', 'shark'], ['baleine', 'whale'], ['dauphin', 'dolphin'], ['pieuvre', 'octopus'],
  ['crabe', 'crab'], ['méduse', 'jellyfish'], ['canard', 'duck'], ['poule', 'hen'],
  ['coq', 'rooster'], ['dinde', 'turkey'], ['aigle', 'eagle'], ['hibou', 'owl'],
  ['pigeon', 'pigeon'], ['corbeau', 'crow'], ['fourmi', 'ant'], ['mouche', 'fly'],
  ['moustique', 'mosquito'], ['guêpe', 'wasp'], ['coccinelle', 'ladybird'], ['escargot', 'snail'],
]);

// ── Weather & time, expanded ─────────────────────────────────────────────────
const timex = b(6, [
  ['météo', 'weather forecast'], ['température', 'temperature'], ['degré', 'degree'], ['brouillard', 'fog'],
  ['tempête', 'storm'], ['tonnerre', 'thunder'], ['éclair', 'lightning'], ['arc-en-ciel', 'rainbow'],
  ['gel', 'frost'], ['glace', 'ice'], ['ombre', 'shade / shadow'], ['humidité', 'humidity'],
  ['sécheresse', 'drought'], ['inondation', 'flood'], ['saison', 'season'], ['moment', 'moment'],
  ['instant', 'instant'], ['époque', 'era'], ['siècle', 'century'], ['décennie', 'decade'],
  ['weekend', 'weekend'], ['vacances', 'holidays'], ['anniversaire', 'birthday'], ['calendrier', 'calendar'],
  ['agenda', 'diary / schedule'], ['rendez-vous', 'appointment'], ['horaire', 'timetable'], ['retard', 'delay'],
  ['avenir', 'future'], ['passé', 'past'], ['présent', 'present'], ['début', 'beginning'],
  ['fin', 'end'], ['milieu', 'middle'], ['durée', 'duration'], ['fois', 'time (occurrence)'],
]);

// ── Geography, places & countries ────────────────────────────────────────────
const geo = b(7, [
  ['région', 'region'], ['province', 'province'], ['département', 'department'], ['capitale', 'capital'],
  ['village', 'village'], ['banlieue', 'suburb'], ['quartier', 'district'], ['adresse', 'address'],
  ['carte', 'map'], ['plan', 'map / plan'], ['direction', 'direction'], ['distance', 'distance'],
  ['nord', 'north'], ['sud', 'south'], ['est', 'east'], ['ouest', 'west'],
  ['colline', 'hill'], ['vallée', 'valley'], ['fleuve', 'river (large)'], ['côte', 'coast'],
  ['frontière', 'border'], ['continent', 'continent'], ['France', 'France'], ['Angleterre', 'England'],
  ['Allemagne', 'Germany'], ['Espagne', 'Spain'], ['Italie', 'Italy'], ['Belgique', 'Belgium'],
  ['Suisse', 'Switzerland'], ['Canada', 'Canada'], ['États-Unis', 'United States'], ['Chine', 'China'],
  ['Japon', 'Japan'], ['Russie', 'Russia'], ['Afrique', 'Africa'], ['Europe', 'Europe'],
  ['français', 'French'], ['anglais', 'English'], ['espagnol', 'Spanish'], ['étranger', 'foreign / abroad'],
]);

// ── Travel & tourism ─────────────────────────────────────────────────────────
const travel = b(6, [
  ['voyage', 'journey'], ['tourisme', 'tourism'], ['touriste', 'tourist'], ['vacances', 'holiday'],
  ['séjour', 'stay'], ['excursion', 'excursion'], ['visite', 'visit'], ['guide', 'guide'],
  ['passeport', 'passport'], ['visa', 'visa'], ['bagage', 'luggage'], ['sac à dos', 'backpack'],
  ['réservation', 'reservation'], ['chambre', 'room'], ['auberge', 'hostel / inn'], ['camping', 'campsite'],
  ['tente', 'tent'], ['plage', 'beach'], ['souvenir', 'souvenir / memory'], ['carte postale', 'postcard'],
  ['appareil photo', 'camera'], ['itinéraire', 'itinerary'], ['destination', 'destination'], ['départ', 'departure'],
  ['arrivée', 'arrival'], ['vol', 'flight / theft'], ['escale', 'stopover'], ['douane', 'customs'],
  ['frontière', 'border'], ['change', 'exchange'], ['office de tourisme', 'tourist office'], ['monument', 'monument'],
  ['château', 'castle'], ['cathédrale', 'cathedral'], ['sentier', 'path / trail'], ['carte routière', 'road map'],
]);

// ── Adjectives, big set ──────────────────────────────────────────────────────
const adj = b(6, [
  ['dernier', 'last'], ['prochain', 'next'], ['seul', 'alone / only'], ['même', 'same'],
  ['autre', 'other'], ['certain', 'certain'], ['différent', 'different'], ['pareil', 'similar / same'],
  ['propre', 'own / clean'], ['général', 'general'], ['particulier', 'particular'], ['principal', 'main'],
  ['simple', 'simple'], ['compliqué', 'complicated'], ['clair', 'clear'], ['évident', 'obvious'],
  ['étrange', 'strange'], ['bizarre', 'weird'], ['normal', 'normal'], ['habituel', 'usual'],
  ['rare', 'rare'], ['fréquent', 'frequent'], ['récent', 'recent'], ['moderne', 'modern'],
  ['ancien', 'old / former'], ['naturel', 'natural'], ['artificiel', 'artificial'], ['réel', 'real'],
  ['parfait', 'perfect'], ['excellent', 'excellent'], ['médiocre', 'mediocre'], ['horrible', 'horrible'],
  ['agréable', 'pleasant'], ['désagréable', 'unpleasant'], ['confortable', 'comfortable'], ['pratique', 'practical'],
  ['utile', 'useful'], ['inutile', 'useless'], ['nécessaire', 'necessary'], ['essentiel', 'essential'],
  ['gentil', 'kind'], ['méchant', 'mean / nasty'], ['aimable', 'friendly'], ['poli', 'polite'],
  ['timide', 'shy'], ['sérieux', 'serious'], ['drôle', 'funny'], ['amusant', 'fun'],
  ['ennuyeux', 'boring'], ['intéressant', 'interesting'], ['célèbre', 'famous'], ['inconnu', 'unknown'],
  ['riche', 'rich'], ['pauvre', 'poor'], ['libre', 'free'], ['occupé', 'busy'],
  ['seul', 'lonely'], ['nombreux', 'numerous'], ['plein', 'full'], ['entier', 'whole'],
  ['double', 'double'], ['profond', 'deep'], ['large', 'wide'], ['étroit', 'narrow'],
  ['épais', 'thick'], ['pointu', 'sharp / pointed'], ['plat', 'flat'], ['droit', 'straight'],
  ['courbé', 'bent'], ['mou', 'soft'], ['dur', 'hard'], ['lisse', 'smooth'],
  ['rugueux', 'rough'], ['mouillé', 'wet'], ['sec', 'dry'], ['frais', 'fresh / cool'],
  ['tiède', 'lukewarm'], ['brûlant', 'burning hot'], ['glacé', 'frozen'], ['sombre', 'dark'],
  ['lumineux', 'bright'], ['bruyant', 'noisy'], ['silencieux', 'silent'], ['doux', 'gentle / sweet'],
  ['amer', 'bitter'], ['salé', 'salty'], ['sucré', 'sweet'], ['épicé', 'spicy'],
  ['délicieux', 'delicious'], ['dégoûtant', 'disgusting'], ['propre', 'clean'], ['sale', 'dirty'],
]);

// ── Emotions & personality ───────────────────────────────────────────────────
const emotions = b(7, [
  ['émotion', 'emotion'], ['sentiment', 'feeling'], ['humeur', 'mood'], ['joie', 'joy'],
  ['tristesse', 'sadness'], ['colère', 'anger'], ['peur', 'fear'], ['surprise', 'surprise'],
  ['honte', 'shame'], ['fierté', 'pride'], ['jalousie', 'jealousy'], ['culpabilité', 'guilt'],
  ['inquiétude', 'worry'], ['stress', 'stress'], ['angoisse', 'anxiety'], ['ennui', 'boredom'],
  ['espoir', 'hope'], ['déception', 'disappointment'], ['courage', 'courage'], ['confiance', 'trust / confidence'],
  ['méfiance', 'distrust'], ['patience', 'patience'], ['curiosité', 'curiosity'], ['enthousiasme', 'enthusiasm'],
  ['caractère', 'character'], ['personnalité', 'personality'], ['comportement', 'behaviour'], ['attitude', 'attitude'],
  ['sympathique', 'nice'], ['antipathique', 'unpleasant'], ['généreux', 'generous'], ['égoïste', 'selfish'],
  ['honnête', 'honest'], ['menteur', 'liar / lying'], ['courageux', 'brave'], ['lâche', 'cowardly'],
  ['patient', 'patient'], ['impatient', 'impatient'], ['calme', 'calm'], ['nerveux', 'nervous'],
  ['optimiste', 'optimistic'], ['pessimiste', 'pessimistic'], ['intelligent', 'intelligent'], ['bête', 'stupid'],
  ['sage', 'wise / well-behaved'], ['fou', 'crazy'], ['sensible', 'sensitive'], ['fier', 'proud'],
]);

// ── Abstract nouns & concepts ────────────────────────────────────────────────
const abstract = b(7, [
  ['vérité', 'truth'], ['mensonge', 'lie'], ['réalité', 'reality'], ['rêve', 'dream'],
  ['pensée', 'thought'], ['opinion', 'opinion'], ['avis', 'opinion / notice'], ['connaissance', 'knowledge'],
  ['savoir', 'knowledge'], ['sagesse', 'wisdom'], ['mémoire', 'memory'], ['souvenir', 'memory'],
  ['imagination', 'imagination'], ['attention', 'attention'], ['intérêt', 'interest'], ['importance', 'importance'],
  ['valeur', 'value'], ['qualité', 'quality'], ['défaut', 'flaw'], ['avantage', 'advantage'],
  ['inconvénient', 'drawback'], ['différence', 'difference'], ['ressemblance', 'resemblance'], ['rapport', 'relationship / report'],
  ['relation', 'relationship'], ['lien', 'link'], ['ordre', 'order'], ['désordre', 'mess'],
  ['choix', 'choice'], ['décision', 'decision'], ['but', 'goal'], ['objectif', 'objective'],
  ['projet', 'plan'], ['idée', 'idea'], ['occasion', 'opportunity'], ['risque', 'risk'],
  ['danger', 'danger'], ['sécurité', 'safety'], ['aide', 'help'], ['soutien', 'support'],
  ['besoin', 'need'], ['manque', 'lack'], ['présence', 'presence'], ['absence', 'absence'],
  ['début', 'start'], ['suite', 'continuation'], ['résultat', 'result'], ['conséquence', 'consequence'],
]);

// ── Adverbs & connectors, expanded ───────────────────────────────────────────
const adverbs = b(5, [
  ['vraiment', 'really'], ['presque', 'almost'], ['environ', 'about / around'], ['surtout', 'especially'],
  ['seulement', 'only'], ['simplement', 'simply'], ['exactement', 'exactly'], ['probablement', 'probably'],
  ['certainement', 'certainly'], ['heureusement', 'fortunately'], ['malheureusement', 'unfortunately'], ['évidemment', 'obviously'],
  ['finalement', 'finally'], ['enfin', 'at last'], ['ensuite', 'then / next'], ['puis', 'then'],
  ['d’abord', 'first'], ['soudain', 'suddenly'], ['immédiatement', 'immediately'], ['rapidement', 'quickly'],
  ['lentement', 'slowly'], ['facilement', 'easily'], ['doucement', 'gently / softly'], ['fort', 'loudly / strongly'],
  ['ensemble', 'together'], ['séparément', 'separately'], ['partout', 'everywhere'], ['ailleurs', 'elsewhere'],
  ['dehors', 'outside'], ['dedans', 'inside'], ['dessus', 'on top'], ['dessous', 'underneath'],
  ['devant', 'in front'], ['derrière', 'behind'], ['autour', 'around'], ['loin', 'far'],
  ['près', 'near'], ['pourtant', 'yet / however'], ['cependant', 'however'], ['néanmoins', 'nevertheless'],
  ['donc', 'therefore'], ['ainsi', 'thus'], ['par contre', 'on the other hand'], ['en plus', 'moreover'],
  ['par exemple', 'for example'], ['c’est-à-dire', 'that is to say'], ['au lieu de', 'instead of'], ['grâce à', 'thanks to'],
]);

// ── Prepositions, positions & directions ─────────────────────────────────────
const prepositions = b(5, [
  ['entre', 'between'], ['parmi', 'among'], ['pendant', 'during'], ['depuis', 'since / for'],
  ['jusqu’à', 'until'], ['avant', 'before'], ['après', 'after'], ['contre', 'against'],
  ['vers', 'towards'], ['selon', 'according to'], ['malgré', 'despite'], ['sauf', 'except'],
  ['chez', 'at (someone’s)'], ['sous', 'under'], ['au-dessus', 'above'], ['au-dessous', 'below'],
  ['à côté de', 'next to'], ['en face de', 'opposite'], ['au milieu de', 'in the middle of'], ['le long de', 'along'],
  ['à travers', 'through'], ['hors de', 'out of'], ['à cause de', 'because of'], ['au bord de', 'at the edge of'],
  ['gauche', 'left'], ['droite', 'right'], ['haut', 'top'], ['bas', 'bottom'],
]);

// ── Communication & media ────────────────────────────────────────────────────
const media = b(7, [
  ['communication', 'communication'], ['information', 'information'], ['nouvelle', 'news item'], ['actualité', 'current events'],
  ['journal', 'newspaper'], ['magazine', 'magazine'], ['article', 'article'], ['reportage', 'report'],
  ['radio', 'radio'], ['télévision', 'television'], ['émission', 'programme'], ['chaîne', 'channel'],
  ['publicité', 'advertising'], ['annonce', 'announcement / ad'], ['affiche', 'poster'], ['courrier', 'mail'],
  ['lettre', 'letter'], ['enveloppe', 'envelope'], ['timbre', 'stamp'], ['colis', 'parcel'],
  ['appel', 'call'], ['conversation', 'conversation'], ['discours', 'speech'], ['débat', 'debate'],
  ['réponse', 'reply'], ['demande', 'request'], ['plainte', 'complaint'], ['remarque', 'remark'],
  ['signal', 'signal'], ['réseau', 'network'], ['antenne', 'antenna'], ['écran', 'screen'],
]);

// ── School & education ───────────────────────────────────────────────────────
const school = b(6, [
  ['école', 'school'], ['collège', 'secondary school'], ['lycée', 'high school'], ['classe', 'class'],
  ['élève', 'pupil'], ['maître', 'teacher (primary)'], ['directeur', 'headteacher'], ['matière', 'subject'],
  ['mathématiques', 'maths'], ['histoire', 'history'], ['géographie', 'geography'], ['physique', 'physics'],
  ['chimie', 'chemistry'], ['biologie', 'biology'], ['philosophie', 'philosophy'], ['littérature', 'literature'],
  ['grammaire', 'grammar'], ['orthographe', 'spelling'], ['calcul', 'arithmetic'], ['exercice', 'exercise'],
  ['leçon', 'lesson'], ['cahier', 'notebook'], ['manuel', 'textbook'], ['crayon', 'pencil'],
  ['gomme', 'eraser'], ['règle', 'ruler'], ['ciseaux', 'scissors'], ['tableau', 'board'],
  ['craie', 'chalk'], ['bureau', 'desk'], ['cartable', 'schoolbag'], ['diplôme', 'diploma'],
  ['bulletin', 'report card'], ['erreur', 'mistake'], ['correction', 'correction'], ['progrès', 'progress'],
  ['récréation', 'break'], ['cantine', 'canteen'], ['rentrée', 'back to school'], ['vacances', 'holidays'],
]);

// ── Useful extras: quantities, misc high-value nouns ─────────────────────────
const extras = b(6, [
  ['morceau', 'piece'], ['partie', 'part'], ['moitié', 'half'], ['tiers', 'third'],
  ['paire', 'pair'], ['dizaine', 'about ten'], ['tas', 'pile'], ['groupe', 'group'],
  ['série', 'series'], ['rangée', 'row'], ['file', 'queue'], ['liste', 'list'],
  ['tableau', 'table / chart'], ['exemple', 'example'], ['type', 'type / guy'], ['sorte', 'sort'],
  ['genre', 'kind / genre'], ['modèle', 'model'], ['objet', 'object'], ['truc', 'thing (informal)'],
  ['machin', 'thingy'], ['bruit', 'noise'], ['odeur', 'smell'], ['goût', 'taste'],
  ['toucher', 'touch'], ['vue', 'sight / view'], ['ouïe', 'hearing'], ['silence', 'silence'],
  ['cri', 'shout'], ['sourire', 'smile'], ['regard', 'look / gaze'], ['geste', 'gesture'],
  ['pas', 'step'], ['saut', 'jump'], ['chute', 'fall'], ['coup', 'blow / knock'],
  ['effort', 'effort'], ['mouvement', 'movement'], ['repos', 'rest'], ['sommeil', 'sleep'],
]);

// ── Verbs, tier 6 — physical & manual actions ────────────────────────────────
const verbs6 = b(7, [
  ['cuire', 'to cook (in oven)'], ['bouillir', 'to boil'], ['rôtir', 'to roast'], ['griller', 'to grill'],
  ['mélanger', 'to mix'], ['verser', 'to pour'], ['peser', 'to weigh'], ['plier', 'to fold'],
  ['déchirer', 'to tear'], ['percer', 'to pierce'], ['frapper', 'to hit / knock'], ['gratter', 'to scratch'],
  ['frotter', 'to rub'], ['essuyer', 'to wipe'], ['sécher', 'to dry'], ['tremper', 'to soak'],
  ['plonger', 'to dive'], ['nager', 'to swim'], ['flotter', 'to float'], ['couler', 'to sink / flow'],
  ['voler', 'to fly / steal'], ['ramper', 'to crawl'], ['glisser', 'to slide'], ['trembler', 'to shake'],
  ['secouer', 'to shake'], ['tordre', 'to twist'], ['presser', 'to press / squeeze'], ['appuyer', 'to lean / press'],
  ['gonfler', 'to inflate'], ['souffler', 'to blow'], ['avaler', 'to swallow'], ['mâcher', 'to chew'],
  ['mordre', 'to bite'], ['lécher', 'to lick'], ['bâiller', 'to yawn'], ['creuser', 'to dig'],
  ['coudre', 'to sew'], ['tricoter', 'to knit'], ['peindre', 'to paint'], ['dessiner', 'to draw'],
]);

// ── Verbs, tier 7 — social & relational ──────────────────────────────────────
const verbs7 = b(8, [
  ['saluer', 'to greet'], ['accueillir', 'to welcome'], ['présenter', 'to introduce'], ['inviter', 'to invite'],
  ['accompagner', 'to accompany'], ['quitter', 'to leave (someone)'], ['abandonner', 'to abandon'], ['rejoindre', 'to join'],
  ['séparer', 'to separate'], ['réunir', 'to gather'], ['partager', 'to share'], ['échanger', 'to exchange'],
  ['offrir', 'to offer'], ['gaspiller', 'to waste'], ['protéger', 'to protect'], ['défendre', 'to defend'],
  ['attaquer', 'to attack'], ['menacer', 'to threaten'], ['punir', 'to punish'], ['récompenser', 'to reward'],
  ['obéir', 'to obey'], ['respecter', 'to respect'], ['admirer', 'to admire'], ['envier', 'to envy'],
  ['consoler', 'to comfort'], ['encourager', 'to encourage'], ['soigner', 'to care for'], ['sauver', 'to save'],
  ['profiter', 'to take advantage'], ['mériter', 'to deserve'], ['dépendre', 'to depend'], ['appartenir', 'to belong'],
  ['ressembler', 'to resemble'], ['participer', 'to take part'], ['assister', 'to attend'], ['réussir', 'to succeed'],
  ['échouer', 'to fail'], ['éviter', 'to avoid'], ['empêcher', 'to prevent'], ['obtenir', 'to obtain'],
]);

// ── Body, expanded ───────────────────────────────────────────────────────────
const bodyx = b(7, [
  ['crâne', 'skull'], ['front', 'forehead'], ['joue', 'cheek'], ['menton', 'chin'],
  ['lèvre', 'lip'], ['langue', 'tongue'], ['nuque', 'nape'], ['poitrine', 'chest'],
  ['hanche', 'hip'], ['cuisse', 'thigh'], ['mollet', 'calf'], ['talon', 'heel'],
  ['orteil', 'toe'], ['ongle', 'nail'], ['paume', 'palm'], ['pouce', 'thumb'],
  ['articulation', 'joint'], ['colonne', 'spine'], ['côte', 'rib'], ['squelette', 'skeleton'],
  ['veine', 'vein'], ['organe', 'organ'], ['sourcil', 'eyebrow'], ['cil', 'eyelash'],
  ['paupière', 'eyelid'], ['barbe', 'beard'], ['moustache', 'moustache'], ['ride', 'wrinkle'],
  ['larme', 'tear'], ['sueur', 'sweat'], ['souffle', 'breath'], ['voix', 'voice'],
]);

// ── Animals, tier 3 ──────────────────────────────────────────────────────────
const animals3 = b(8, [
  ['veau', 'calf'], ['poulain', 'foal'], ['poussin', 'chick'], ['chaton', 'kitten'],
  ['chiot', 'puppy'], ['taureau', 'bull'], ['chèvre', 'goat'], ['âne', 'donkey'],
  ['hamster', 'hamster'], ['perroquet', 'parrot'], ['cygne', 'swan'], ['oie', 'goose'],
  ['paon', 'peacock'], ['truite', 'trout'], ['homard', 'lobster'], ['moule', 'mussel'],
  ['calmar', 'squid'], ['ver', 'worm'], ['puce', 'flea'], ['tique', 'tick'],
  ['sauterelle', 'grasshopper'], ['libellule', 'dragonfly'], ['scorpion', 'scorpion'], ['crapaud', 'toad'],
  ['souriceau', 'baby mouse'], ['patte', 'paw / leg'], ['aile', 'wing'], ['queue', 'tail'],
  ['plume', 'feather'], ['poil', 'fur / hair'], ['griffe', 'claw'], ['bec', 'beak'],
  ['corne', 'horn'], ['sabot', 'hoof'], ['écaille', 'scale'], ['nid', 'nest'],
]);

// ── Food, tier 3 ─────────────────────────────────────────────────────────────
const food3 = b(8, [
  ['potage', 'soup'], ['ragoût', 'stew'], ['purée', 'mash'], ['omelette', 'omelette'],
  ['pizza', 'pizza'], ['croissant', 'croissant'], ['pâtisserie', 'pastry'], ['abricot', 'apricot'],
  ['prune', 'plum'], ['framboise', 'raspberry'], ['myrtille', 'blueberry'], ['noix', 'walnut / nut'],
  ['noisette', 'hazelnut'], ['amande', 'almond'], ['cacahuète', 'peanut'], ['olive', 'olive'],
  ['avocat', 'avocado'], ['poireau', 'leek'], ['radis', 'radish'], ['betterave', 'beetroot'],
  ['chou', 'cabbage'], ['chou-fleur', 'cauliflower'], ['aubergine', 'aubergine'], ['poivron', 'bell pepper'],
  ['maïs', 'corn'], ['blé', 'wheat'], ['lentille', 'lentil'], ['pois chiche', 'chickpea'],
  ['sauce', 'sauce'], ['assaisonnement', 'seasoning'], ['portion', 'portion'], ['ingrédient', 'ingredient'],
]);

// ── Numbers, tier 2 & ordinals ───────────────────────────────────────────────
const numbers2 = b(8, [
  ['soixante', 'sixty'], ['soixante-dix', 'seventy'], ['quatre-vingts', 'eighty'], ['quatre-vingt-dix', 'ninety'],
  ['million', 'million'], ['milliard', 'billion'], ['troisième', 'third'], ['quatrième', 'fourth'],
  ['cinquième', 'fifth'], ['dixième', 'tenth'], ['douzaine', 'dozen'], ['centaine', 'a hundred or so'],
  ['millier', 'a thousand or so'], ['quart', 'quarter'], ['double', 'double'], ['triple', 'triple'],
  ['pourcentage', 'percentage'], ['total', 'total'], ['somme', 'sum'], ['différence', 'difference'],
  ['chiffre', 'figure / digit'], ['numéro', 'number'], ['pair', 'even'], ['impair', 'odd'],
]);

// ── Adjectives, tier 2 ───────────────────────────────────────────────────────
const adj2 = b(8, [
  ['tendre', 'tender'], ['ferme', 'firm'], ['souple', 'flexible'], ['raide', 'stiff'],
  ['rigide', 'rigid'], ['fragile', 'fragile'], ['résistant', 'tough'], ['usé', 'worn'],
  ['abîmé', 'damaged'], ['tranquille', 'quiet'], ['paisible', 'peaceful'], ['violent', 'violent'],
  ['cruel', 'cruel'], ['chaleureux', 'warm (person)'], ['distant', 'distant'], ['proche', 'close'],
  ['vivant', 'alive'], ['mort', 'dead'], ['éveillé', 'awake'], ['endormi', 'asleep'],
  ['malin', 'clever / cunning'], ['naïf', 'naive'], ['prudent', 'careful'], ['imprudent', 'reckless'],
  ['raisonnable', 'reasonable'], ['absurde', 'absurd'], ['logique', 'logical'], ['précis', 'precise'],
  ['vague', 'vague'], ['complet', 'complete'], ['partiel', 'partial'], ['supérieur', 'higher / superior'],
  ['inférieur', 'lower / inferior'], ['égal', 'equal'], ['semblable', 'similar'], ['opposé', 'opposite'],
  ['direct', 'direct'], ['positif', 'positive'], ['négatif', 'negative'], ['privé', 'private'],
  ['officiel', 'official'], ['légal', 'legal'], ['valide', 'valid'], ['correct', 'correct'],
  ['injuste', 'unfair'], ['loyal', 'loyal'], ['fidèle', 'faithful'], ['sincère', 'sincere'],
  ['franc', 'frank'], ['discret', 'discreet'], ['modeste', 'modest'], ['humble', 'humble'],
  ['arrogant', 'arrogant'], ['aigu', 'sharp / acute'], ['grave', 'serious / grave'], ['immense', 'huge'],
  ['minuscule', 'tiny'], ['énorme', 'enormous'], ['moyen', 'average'], ['principal', 'principal'],
]);

// ── Places & buildings, expanded ─────────────────────────────────────────────
const places = b(7, [
  ['bâtiment', 'building'], ['immeuble', 'building (block)'], ['tour', 'tower'], ['gratte-ciel', 'skyscraper'],
  ['usine', 'factory'], ['entrepôt', 'warehouse'], ['ferme', 'farm'], ['moulin', 'mill'],
  ['bibliothèque', 'library'], ['librairie', 'bookshop'], ['boutique', 'boutique'], ['centre commercial', 'shopping centre'],
  ['supermarché', 'supermarket'], ['épicerie', 'grocery'], ['kiosque', 'kiosk'], ['stade', 'stadium'],
  ['théâtre', 'theatre'], ['opéra', 'opera house'], ['zoo', 'zoo'], ['aquarium', 'aquarium'],
  ['prison', 'prison'], ['caserne', 'barracks'], ['mairie', 'town hall'], ['ambassade', 'embassy'],
  ['cimetière', 'cemetery'], ['temple', 'temple'], ['mosquée', 'mosque'], ['chapelle', 'chapel'],
  ['grenier', 'attic'], ['cave', 'cellar'], ['garage', 'garage'], ['balcon', 'balcony'],
  ['cour', 'courtyard'], ['couloir', 'corridor'], ['entrée', 'entrance'], ['sortie', 'exit'],
  ['ascenseur', 'lift'], ['clôture', 'fence'], ['portail', 'gate'], ['trottoir', 'pavement'],
]);

// ── Transport & vehicles, expanded ───────────────────────────────────────────
const transport = b(7, [
  ['camion', 'lorry / truck'], ['camionnette', 'van'], ['tramway', 'tram'], ['scooter', 'scooter'],
  ['trottinette', 'kick scooter'], ['ambulance', 'ambulance'], ['hélicoptère', 'helicopter'], ['fusée', 'rocket'],
  ['navire', 'ship'], ['ferry', 'ferry'], ['voilier', 'sailboat'], ['canoë', 'canoe'],
  ['sous-marin', 'submarine'], ['ancre', 'anchor'], ['voile', 'sail'], ['rame', 'oar'],
  ['roue', 'wheel'], ['pneu', 'tyre'], ['frein', 'brake'], ['volant', 'steering wheel'],
  ['siège', 'seat'], ['phare', 'headlight / lighthouse'], ['klaxon', 'horn'], ['essence', 'petrol'],
  ['carburant', 'fuel'], ['parking', 'car park'], ['péage', 'toll'], ['autoroute', 'motorway'],
  ['carrefour', 'crossroads'], ['rond-point', 'roundabout'], ['panneau', 'sign'], ['piéton', 'pedestrian'],
  ['circulation', 'traffic'], ['embouteillage', 'traffic jam'], ['permis', 'licence'], ['accident', 'accident'],
]);

// ── Nature & landscape, expanded ─────────────────────────────────────────────
const naturex = b(8, [
  ['marée', 'tide'], ['vague', 'wave'], ['courant', 'current'], ['rivage', 'shore'],
  ['falaise', 'cliff'], ['grotte', 'cave'], ['cascade', 'waterfall'], ['source', 'spring'],
  ['ruisseau', 'stream'], ['étang', 'pond'], ['marais', 'marsh'], ['prairie', 'meadow'],
  ['plaine', 'plain'], ['plateau', 'plateau'], ['sommet', 'summit'], ['pic', 'peak'],
  ['glacier', 'glacier'], ['dune', 'dune'], ['boue', 'mud'], ['poussière', 'dust'],
  ['rocher', 'rock'], ['caillou', 'pebble'], ['minéral', 'mineral'], ['charbon', 'coal'],
  ['pétrole', 'oil (crude)'], ['terrain', 'ground / land'], ['sol', 'soil'], ['paysage', 'landscape'],
  ['horizon', 'horizon'], ['espèce', 'species'], ['troupeau', 'herd'], ['nid', 'nest'],
]);

// ── Abstract & society, tier 2 ───────────────────────────────────────────────
const abstract2 = b(8, [
  ['honneur', 'honour'], ['gloire', 'glory'], ['respect', 'respect'], ['dignité', 'dignity'],
  ['réputation', 'reputation'], ['apparence', 'appearance'], ['aspect', 'aspect'], ['allure', 'look / pace'],
  ['mode', 'fashion / mode'], ['tendance', 'trend'], ['coutume', 'custom'], ['cérémonie', 'ceremony'],
  ['événement', 'event'], ['incident', 'incident'], ['catastrophe', 'disaster'], ['miracle', 'miracle'],
  ['hasard', 'chance'], ['destin', 'fate'], ['sort', 'fate / spell'], ['chance', 'luck'],
  ['occasion', 'occasion'], ['circonstance', 'circumstance'], ['situation', 'situation'], ['condition', 'condition'],
  ['état', 'state'], ['niveau', 'level'], ['degré', 'degree'], ['limite', 'limit'],
  ['mesure', 'measure'], ['proportion', 'proportion'], ['quantité', 'quantity'], ['nombre', 'number'],
  ['ensemble', 'whole / set'], ['détail', 'detail'], ['fond', 'bottom / background'], ['surface', 'surface'],
  ['sens', 'meaning / direction'], ['signification', 'meaning'], ['symbole', 'symbol'], ['signe', 'sign'],
]);

// ── Verbs, tier 8 — mind, states, misc high-value ────────────────────────────
const verbs8 = b(8, [
  ['exister', 'to exist'], ['apparaître', 'to appear'], ['disparaître', 'to disappear'], ['devenir', 'to become'],
  ['sembler', 'to seem'], ['paraître', 'to appear / seem'], ['représenter', 'to represent'], ['signifier', 'to mean'],
  ['indiquer', 'to indicate'], ['exprimer', 'to express'], ['préciser', 'to specify'], ['définir', 'to define'],
  ['résumer', 'to summarise'], ['traduire', 'to translate'], ['citer', 'to quote'], ['noter', 'to note'],
  ['souligner', 'to underline'], ['effacer', 'to erase'], ['corriger', 'to correct'], ['vérifier', 'to check'],
  ['contrôler', 'to control'], ['observer', 'to observe'], ['examiner', 'to examine'], ['étudier', 'to study'],
  ['analyser', 'to analyse'], ['juger', 'to judge'], ['critiquer', 'to criticise'], ['approuver', 'to approve'],
  ['soutenir', 'to support'], ['représenter', 'to stand for'], ['concerner', 'to concern'], ['impliquer', 'to imply'],
  ['provoquer', 'to cause'], ['entraîner', 'to lead to / train'], ['influencer', 'to influence'], ['modifier', 'to modify'],
  ['transformer', 'to transform'], ['maintenir', 'to maintain'], ['conserver', 'to preserve'], ['assurer', 'to ensure'],
]);

export const FREQUENCY_WORDS = [
  ...band1, ...band2, ...band3, ...band4, ...band4b, ...band5, ...band5b, ...band5c,
  ...band6, ...band6b, ...band7, ...band8, ...band9, ...band10,
  ...verbs2, ...verbs3, ...verbs4, ...verbs5, ...jobs, ...health, ...foodx, ...household,
  ...clothingx, ...colours, ...sports, ...arts, ...tech, ...business, ...society, ...science,
  ...plants, ...animalsx, ...timex, ...geo, ...travel, ...adj, ...emotions, ...abstract,
  ...adverbs, ...prepositions, ...media, ...school, ...extras,
  ...verbs6, ...verbs7, ...bodyx, ...animals3, ...food3, ...numbers2, ...adj2, ...places,
  ...transport, ...naturex, ...abstract2, ...verbs8,
];
