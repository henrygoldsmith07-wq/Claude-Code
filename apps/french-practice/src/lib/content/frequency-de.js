// High-frequency German dictionary — the German core lexicon, mirroring the
// French frequency.js in shape ({ fr, en, rank }, where `fr` holds the German
// term). Feeds the frequency vocab decks, the SRS engine and the offline
// dictionary for German learners. Authored and self-contained; rank is a
// coarse frequency band (1 = most common … 10 = still useful but rarer).

const b = (rank, pairs) => pairs.map(([fr, en]) => ({ fr, en, rank }));

// ── Band 1 — grammatical core: articles, pronouns, top prepositions ──────────
const band1 = b(1, [
  ['der / die / das', 'the'], ['ein / eine', 'a / an'], ['und', 'and'], ['oder', 'or'],
  ['aber', 'but'], ['dass', 'that'], ['weil', 'because'], ['wenn', 'if / when'],
  ['ich', 'I'], ['du', 'you (informal)'], ['er', 'he'], ['sie', 'she / they'],
  ['es', 'it'], ['wir', 'we'], ['ihr', 'you (plural)'], ['Sie', 'you (formal)'],
  ['man', 'one / you (impersonal)'], ['mich', 'me'], ['dich', 'you'], ['sich', 'oneself'],
  ['mir', 'to me'], ['dir', 'to you'], ['ihm', 'to him'], ['uns', 'us'],
  ['mein', 'my'], ['dein', 'your'], ['sein', 'his / its'], ['unser', 'our'],
  ['in', 'in'], ['auf', 'on'], ['an', 'at / on'], ['zu', 'to'], ['mit', 'with'],
  ['von', 'from / of'], ['für', 'for'], ['aus', 'out of / from'], ['bei', 'at / near'],
  ['nach', 'after / to'], ['über', 'over / about'], ['unter', 'under'], ['vor', 'before / in front of'],
  ['durch', 'through'], ['ohne', 'without'], ['gegen', 'against'], ['um', 'around / at'],
  ['nicht', 'not'], ['kein', 'no / none'], ['dieser', 'this'], ['welcher', 'which'],
]);

// ── Band 2 — top verbs ───────────────────────────────────────────────────────
const band2 = b(2, [
  ['sein', 'to be'], ['haben', 'to have'], ['werden', 'to become / will'], ['können', 'can'],
  ['müssen', 'must'], ['sagen', 'to say'], ['machen', 'to make / do'], ['gehen', 'to go'],
  ['wollen', 'to want'], ['kommen', 'to come'], ['sollen', 'should'], ['wissen', 'to know'],
  ['sehen', 'to see'], ['lassen', 'to let / leave'], ['stehen', 'to stand'], ['finden', 'to find'],
  ['bleiben', 'to stay'], ['geben', 'to give'], ['nehmen', 'to take'], ['bringen', 'to bring'],
  ['halten', 'to hold'], ['nennen', 'to name / call'], ['denken', 'to think'], ['glauben', 'to believe'],
  ['sprechen', 'to speak'], ['fragen', 'to ask'], ['antworten', 'to answer'], ['brauchen', 'to need'],
  ['fühlen', 'to feel'], ['dürfen', 'may / to be allowed'], ['mögen', 'to like'], ['tun', 'to do'],
]);

// ── Band 3 — adverbs, question words, more function words ─────────────────────
const band3 = b(3, [
  ['auch', 'also'], ['schon', 'already'], ['noch', 'still / yet'], ['nur', 'only'],
  ['immer', 'always'], ['sehr', 'very'], ['hier', 'here'], ['dort', 'there'],
  ['jetzt', 'now'], ['dann', 'then'], ['heute', 'today'], ['morgen', 'tomorrow'],
  ['gestern', 'yesterday'], ['wieder', 'again'], ['oft', 'often'], ['manchmal', 'sometimes'],
  ['nie', 'never'], ['vielleicht', 'maybe'], ['natürlich', 'of course'], ['wirklich', 'really'],
  ['gut', 'good / well'], ['gern', 'gladly'], ['zusammen', 'together'], ['allein', 'alone'],
  ['wer', 'who'], ['was', 'what'], ['wo', 'where'], ['wann', 'when'], ['warum', 'why'],
  ['wie', 'how'], ['wie viel', 'how much'], ['ja', 'yes'], ['nein', 'no'], ['bitte', 'please'],
  ['danke', 'thanks'], ['vielleicht', 'perhaps'], ['ziemlich', 'quite'], ['fast', 'almost'],
  ['genug', 'enough'], ['zu viel', 'too much'], ['sehr gut', 'very good'],
]);

// ── Band 4 — people, time, everyday nouns ────────────────────────────────────
const band4 = b(4, [
  ['der Mann', 'man'], ['die Frau', 'woman'], ['das Kind', 'child'], ['der Mensch', 'human / person'],
  ['die Leute', 'people'], ['der Freund', 'friend (m)'], ['die Freundin', 'friend (f)'], ['die Familie', 'family'],
  ['die Mutter', 'mother'], ['der Vater', 'father'], ['der Sohn', 'son'], ['die Tochter', 'daughter'],
  ['der Bruder', 'brother'], ['die Schwester', 'sister'], ['das Baby', 'baby'], ['der Name', 'name'],
  ['die Zeit', 'time'], ['der Tag', 'day'], ['die Nacht', 'night'], ['die Stunde', 'hour'],
  ['die Minute', 'minute'], ['die Woche', 'week'], ['der Monat', 'month'], ['das Jahr', 'year'],
  ['der Morgen', 'morning'], ['der Abend', 'evening'], ['der Mittag', 'noon'], ['die Uhr', 'clock / o’clock'],
  ['der Moment', 'moment'], ['das Leben', 'life'], ['die Welt', 'world'], ['das Land', 'country'],
  ['die Stadt', 'city'], ['das Dorf', 'village'], ['der Ort', 'place'], ['die Sache', 'thing / matter'],
  ['das Ding', 'thing'], ['die Art', 'kind / way'], ['das Wort', 'word'], ['die Frage', 'question'],
  ['die Antwort', 'answer'], ['das Problem', 'problem'], ['die Idee', 'idea'], ['der Grund', 'reason'],
]);

// ── Band 5 — home & food ─────────────────────────────────────────────────────
const band5 = b(5, [
  ['das Haus', 'house'], ['die Wohnung', 'flat / apartment'], ['das Zimmer', 'room'], ['die Küche', 'kitchen'],
  ['das Bad', 'bathroom'], ['das Schlafzimmer', 'bedroom'], ['die Tür', 'door'], ['das Fenster', 'window'],
  ['der Tisch', 'table'], ['der Stuhl', 'chair'], ['das Bett', 'bed'], ['das Sofa', 'sofa'],
  ['der Schrank', 'cupboard'], ['die Lampe', 'lamp'], ['der Boden', 'floor / ground'], ['die Wand', 'wall'],
  ['der Garten', 'garden'], ['der Schlüssel', 'key'], ['das Essen', 'food / meal'], ['das Frühstück', 'breakfast'],
  ['das Mittagessen', 'lunch'], ['das Abendessen', 'dinner'], ['das Brot', 'bread'], ['die Butter', 'butter'],
  ['der Käse', 'cheese'], ['das Ei', 'egg'], ['das Fleisch', 'meat'], ['der Fisch', 'fish'],
  ['das Gemüse', 'vegetables'], ['das Obst', 'fruit'], ['der Apfel', 'apple'], ['die Kartoffel', 'potato'],
  ['der Reis', 'rice'], ['die Suppe', 'soup'], ['der Zucker', 'sugar'], ['das Salz', 'salt'],
  ['das Wasser', 'water'], ['der Kaffee', 'coffee'], ['der Tee', 'tea'], ['die Milch', 'milk'],
  ['der Saft', 'juice'], ['das Bier', 'beer'], ['der Wein', 'wine'], ['der Teller', 'plate'],
  ['das Glas', 'glass'], ['die Tasse', 'cup'], ['das Messer', 'knife'], ['die Gabel', 'fork'],
  ['der Löffel', 'spoon'], ['die Flasche', 'bottle'],
]);

// ── Band 6 — body, health, clothing ──────────────────────────────────────────
const band6 = b(6, [
  ['der Körper', 'body'], ['der Kopf', 'head'], ['das Gesicht', 'face'], ['das Auge', 'eye'],
  ['das Ohr', 'ear'], ['die Nase', 'nose'], ['der Mund', 'mouth'], ['der Zahn', 'tooth'],
  ['das Haar', 'hair'], ['der Hals', 'neck / throat'], ['die Hand', 'hand'], ['der Arm', 'arm'],
  ['der Finger', 'finger'], ['das Bein', 'leg'], ['der Fuß', 'foot'], ['das Herz', 'heart'],
  ['der Rücken', 'back'], ['der Bauch', 'stomach'], ['die Gesundheit', 'health'], ['der Arzt', 'doctor'],
  ['das Krankenhaus', 'hospital'], ['die Krankheit', 'illness'], ['der Schmerz', 'pain'], ['das Fieber', 'fever'],
  ['die Medizin', 'medicine'], ['krank', 'ill'], ['gesund', 'healthy'], ['müde', 'tired'],
  ['die Kleidung', 'clothing'], ['das Hemd', 'shirt'], ['die Hose', 'trousers'], ['das Kleid', 'dress'],
  ['der Rock', 'skirt'], ['die Jacke', 'jacket'], ['der Mantel', 'coat'], ['der Pullover', 'sweater'],
  ['die Schuhe', 'shoes'], ['die Socke', 'sock'], ['der Hut', 'hat'], ['die Brille', 'glasses'],
]);

// ── Band 7 — work, school, money ─────────────────────────────────────────────
const band7 = b(7, [
  ['die Arbeit', 'work'], ['der Job', 'job'], ['der Beruf', 'profession'], ['das Büro', 'office'],
  ['die Firma', 'company'], ['der Chef', 'boss'], ['der Kollege', 'colleague'], ['die Aufgabe', 'task'],
  ['das Projekt', 'project'], ['die Besprechung', 'meeting'], ['der Termin', 'appointment'], ['der Computer', 'computer'],
  ['das Handy', 'mobile phone'], ['das Telefon', 'telephone'], ['die E-Mail', 'email'], ['das Internet', 'internet'],
  ['die Schule', 'school'], ['die Universität', 'university'], ['der Lehrer', 'teacher'], ['der Schüler', 'pupil'],
  ['der Student', 'student'], ['die Klasse', 'class'], ['die Prüfung', 'exam'], ['das Buch', 'book'],
  ['das Heft', 'notebook'], ['der Stift', 'pen'], ['das Papier', 'paper'], ['die Note', 'grade'],
  ['lernen', 'to learn'], ['studieren', 'to study'], ['das Geld', 'money'], ['der Euro', 'euro'],
  ['die Bank', 'bank'], ['der Preis', 'price'], ['die Rechnung', 'bill'], ['teuer', 'expensive'],
  ['billig', 'cheap'], ['bezahlen', 'to pay'], ['kaufen', 'to buy'], ['verkaufen', 'to sell'],
]);

// ── Band 8 — travel, city, nature ────────────────────────────────────────────
const band8 = b(8, [
  ['die Reise', 'trip / journey'], ['der Urlaub', 'holiday'], ['der Zug', 'train'], ['der Bahnhof', 'station'],
  ['der Bus', 'bus'], ['das Auto', 'car'], ['das Fahrrad', 'bicycle'], ['das Flugzeug', 'plane'],
  ['der Flughafen', 'airport'], ['die Fahrkarte', 'ticket'], ['die Straße', 'street'], ['der Weg', 'way / path'],
  ['die Brücke', 'bridge'], ['der Platz', 'square / place'], ['die Ecke', 'corner'], ['das Hotel', 'hotel'],
  ['das Zimmer', 'room'], ['die Karte', 'map / card'], ['links', 'left'], ['rechts', 'right'],
  ['geradeaus', 'straight ahead'], ['die Natur', 'nature'], ['der Baum', 'tree'], ['die Blume', 'flower'],
  ['der Wald', 'forest'], ['der Berg', 'mountain'], ['der Fluss', 'river'], ['der See', 'lake'],
  ['das Meer', 'sea'], ['der Strand', 'beach'], ['die Sonne', 'sun'], ['der Mond', 'moon'],
  ['der Himmel', 'sky'], ['die Wolke', 'cloud'], ['der Regen', 'rain'], ['der Schnee', 'snow'],
  ['der Wind', 'wind'], ['das Wetter', 'weather'], ['die Luft', 'air'], ['das Feuer', 'fire'],
]);

// ── Band 9 — common adjectives ───────────────────────────────────────────────
const band9 = b(9, [
  ['groß', 'big / tall'], ['klein', 'small'], ['neu', 'new'], ['alt', 'old'],
  ['jung', 'young'], ['lang', 'long'], ['kurz', 'short'], ['hoch', 'high'],
  ['niedrig', 'low'], ['schnell', 'fast'], ['langsam', 'slow'], ['früh', 'early'],
  ['spät', 'late'], ['gut', 'good'], ['schlecht', 'bad'], ['schön', 'beautiful'],
  ['hässlich', 'ugly'], ['einfach', 'easy / simple'], ['schwer', 'hard / heavy'], ['leicht', 'light / easy'],
  ['wichtig', 'important'], ['richtig', 'correct'], ['falsch', 'wrong'], ['sicher', 'sure / safe'],
  ['möglich', 'possible'], ['nötig', 'necessary'], ['voll', 'full'], ['leer', 'empty'],
  ['warm', 'warm'], ['kalt', 'cold'], ['heiß', 'hot'], ['nass', 'wet'],
  ['trocken', 'dry'], ['sauber', 'clean'], ['schmutzig', 'dirty'], ['ruhig', 'quiet / calm'],
  ['laut', 'loud'], ['stark', 'strong'], ['schwach', 'weak'], ['reich', 'rich'],
  ['arm', 'poor'], ['glücklich', 'happy'], ['traurig', 'sad'], ['frei', 'free'],
]);

// ── Band 10 — more everyday verbs ────────────────────────────────────────────
const band10 = b(10, [
  ['essen', 'to eat'], ['trinken', 'to drink'], ['schlafen', 'to sleep'], ['aufstehen', 'to get up'],
  ['arbeiten', 'to work'], ['spielen', 'to play'], ['laufen', 'to run / walk'], ['fahren', 'to drive / go'],
  ['fliegen', 'to fly'], ['kaufen', 'to buy'], ['kochen', 'to cook'], ['helfen', 'to help'],
  ['lieben', 'to love'], ['hören', 'to hear'], ['lesen', 'to read'], ['schreiben', 'to write'],
  ['zeigen', 'to show'], ['öffnen', 'to open'], ['schließen', 'to close'], ['beginnen', 'to begin'],
  ['enden', 'to end'], ['warten', 'to wait'], ['suchen', 'to search'], ['verlieren', 'to lose'],
  ['gewinnen', 'to win'], ['vergessen', 'to forget'], ['erinnern', 'to remember'], ['verstehen', 'to understand'],
  ['erklären', 'to explain'], ['lachen', 'to laugh'], ['weinen', 'to cry'], ['singen', 'to sing'],
  ['tanzen', 'to dance'], ['reisen', 'to travel'], ['wohnen', 'to live / reside'], ['treffen', 'to meet'],
  ['besuchen', 'to visit'], ['bezahlen', 'to pay'], ['bestellen', 'to order'], ['probieren', 'to try'],
]);

// ── Themed extras — numbers, colours, animals, tech, feelings, abstract ──────
const numbers = b(3, [
  ['null', 'zero'], ['eins', 'one'], ['zwei', 'two'], ['drei', 'three'], ['vier', 'four'],
  ['fünf', 'five'], ['sechs', 'six'], ['sieben', 'seven'], ['acht', 'eight'], ['neun', 'nine'],
  ['zehn', 'ten'], ['elf', 'eleven'], ['zwölf', 'twelve'], ['zwanzig', 'twenty'], ['dreißig', 'thirty'],
  ['hundert', 'hundred'], ['tausend', 'thousand'], ['erste', 'first'], ['zweite', 'second'], ['letzte', 'last'],
]);
const colours = b(6, [
  ['die Farbe', 'colour'], ['rot', 'red'], ['blau', 'blue'], ['grün', 'green'], ['gelb', 'yellow'],
  ['schwarz', 'black'], ['weiß', 'white'], ['grau', 'grey'], ['braun', 'brown'], ['orange', 'orange'],
  ['rosa', 'pink'], ['lila', 'purple'],
]);
const animals = b(8, [
  ['das Tier', 'animal'], ['der Hund', 'dog'], ['die Katze', 'cat'], ['das Pferd', 'horse'],
  ['die Kuh', 'cow'], ['das Schwein', 'pig'], ['das Schaf', 'sheep'], ['das Huhn', 'chicken'],
  ['der Vogel', 'bird'], ['der Fisch', 'fish'], ['die Maus', 'mouse'], ['der Bär', 'bear'],
  ['der Löwe', 'lion'], ['der Elefant', 'elephant'], ['die Spinne', 'spider'], ['die Biene', 'bee'],
]);
const techMedia = b(8, [
  ['das Fernsehen', 'television'], ['der Film', 'film'], ['die Musik', 'music'], ['das Lied', 'song'],
  ['das Radio', 'radio'], ['die Zeitung', 'newspaper'], ['die Nachricht', 'message / news'], ['das Foto', 'photo'],
  ['die Kamera', 'camera'], ['das Spiel', 'game'], ['die App', 'app'], ['die Datei', 'file'],
  ['das Programm', 'program'], ['die Webseite', 'website'], ['das Passwort', 'password'],
]);
const feelings = b(7, [
  ['das Gefühl', 'feeling'], ['die Liebe', 'love'], ['die Angst', 'fear'], ['die Freude', 'joy'],
  ['die Wut', 'anger'], ['die Hoffnung', 'hope'], ['der Spaß', 'fun'], ['die Sorge', 'worry'],
  ['froh', 'glad'], ['böse', 'angry / evil'], ['nervös', 'nervous'], ['ruhig', 'calm'],
  ['stolz', 'proud'], ['überrascht', 'surprised'], ['langweilig', 'boring'], ['interessant', 'interesting'],
]);
const abstract = b(9, [
  ['die Wahrheit', 'truth'], ['die Freiheit', 'freedom'], ['die Macht', 'power'], ['das Recht', 'right / law'],
  ['die Möglichkeit', 'possibility'], ['die Wirklichkeit', 'reality'], ['der Gedanke', 'thought'], ['das Gefühl', 'emotion'],
  ['der Sinn', 'sense / meaning'], ['der Zweck', 'purpose'], ['die Meinung', 'opinion'], ['die Erfahrung', 'experience'],
  ['der Erfolg', 'success'], ['der Fehler', 'mistake'], ['die Gefahr', 'danger'], ['die Chance', 'chance'],
  ['der Unterschied', 'difference'], ['das Beispiel', 'example'], ['die Regel', 'rule'], ['die Ordnung', 'order'],
]);
const moreConnectors = b(4, [
  ['also', 'so / therefore'], ['deshalb', 'that’s why'], ['trotzdem', 'nevertheless'], ['obwohl', 'although'],
  ['sondern', 'but rather'], ['denn', 'because / for'], ['damit', 'so that'], ['zuerst', 'first'],
  ['danach', 'afterwards'], ['schließlich', 'finally'], ['zum Beispiel', 'for example'], ['außerdem', 'besides'],
  ['zwischen', 'between'], ['während', 'during / while'], ['seit', 'since'], ['bis', 'until'],
]);

// ── Second wave — extend coverage toward the top ~800 words ──────────────────
const verbs2 = b(10, [
  ['bekommen', 'to get / receive'], ['bringen', 'to bring'], ['setzen', 'to set / put'], ['legen', 'to lay'],
  ['stellen', 'to place'], ['ziehen', 'to pull'], ['tragen', 'to carry / wear'], ['werfen', 'to throw'],
  ['fangen', 'to catch'], ['fallen', 'to fall'], ['steigen', 'to climb / rise'], ['sitzen', 'to sit'],
  ['liegen', 'to lie'], ['drehen', 'to turn'], ['bauen', 'to build'], ['schaffen', 'to manage / create'],
  ['benutzen', 'to use'], ['ändern', 'to change'], ['entscheiden', 'to decide'], ['versuchen', 'to try'],
  ['gehören', 'to belong'], ['bedeuten', 'to mean'], ['passieren', 'to happen'], ['scheinen', 'to seem / shine'],
  ['gefallen', 'to please'], ['danken', 'to thank'], ['grüßen', 'to greet'], ['küssen', 'to kiss'],
  ['rufen', 'to call'], ['schauen', 'to look'], ['merken', 'to notice'], ['erkennen', 'to recognise'],
]);
const professions = b(7, [
  ['der Arzt', 'doctor'], ['die Krankenschwester', 'nurse'], ['der Lehrer', 'teacher'], ['der Polizist', 'police officer'],
  ['der Verkäufer', 'salesperson'], ['der Koch', 'cook'], ['der Kellner', 'waiter'], ['der Fahrer', 'driver'],
  ['der Bauer', 'farmer'], ['der Ingenieur', 'engineer'], ['der Anwalt', 'lawyer'], ['der Künstler', 'artist'],
  ['der Musiker', 'musician'], ['der Schauspieler', 'actor'], ['der Autor', 'author'], ['der Wissenschaftler', 'scientist'],
]);
const cityPlaces = b(8, [
  ['das Geschäft', 'shop'], ['der Supermarkt', 'supermarket'], ['der Markt', 'market'], ['das Restaurant', 'restaurant'],
  ['das Café', 'café'], ['die Bäckerei', 'bakery'], ['die Apotheke', 'pharmacy'], ['die Post', 'post office'],
  ['die Kirche', 'church'], ['das Museum', 'museum'], ['das Theater', 'theatre'], ['das Kino', 'cinema'],
  ['der Park', 'park'], ['die Bibliothek', 'library'], ['das Rathaus', 'town hall'], ['die Polizei', 'police'],
  ['das Krankenhaus', 'hospital'], ['die Toilette', 'toilet'], ['der Aufzug', 'lift / elevator'], ['die Treppe', 'stairs'],
]);
const sports = b(9, [
  ['der Sport', 'sport'], ['der Fußball', 'football'], ['das Spiel', 'match / game'], ['die Mannschaft', 'team'],
  ['der Ball', 'ball'], ['das Tor', 'goal'], ['schwimmen', 'to swim'], ['rennen', 'to run'],
  ['springen', 'to jump'], ['gewinnen', 'to win'], ['verlieren', 'to lose'], ['trainieren', 'to train'],
  ['der Spieler', 'player'], ['das Stadion', 'stadium'], ['die Meisterschaft', 'championship'], ['der Sieg', 'victory'],
]);
const houseTools = b(7, [
  ['das Werkzeug', 'tool'], ['der Hammer', 'hammer'], ['das Messer', 'knife'], ['die Schere', 'scissors'],
  ['die Uhr', 'watch / clock'], ['der Spiegel', 'mirror'], ['das Handtuch', 'towel'], ['die Seife', 'soap'],
  ['die Zahnbürste', 'toothbrush'], ['der Kamm', 'comb'], ['die Decke', 'blanket / ceiling'], ['das Kissen', 'pillow'],
  ['der Vorhang', 'curtain'], ['der Teppich', 'carpet'], ['die Steckdose', 'socket'], ['die Batterie', 'battery'],
]);
const adverbs2 = b(5, [
  ['dann', 'then'], ['bald', 'soon'], ['plötzlich', 'suddenly'], ['endlich', 'finally'],
  ['sofort', 'immediately'], ['gerade', 'just now'], ['bereits', 'already'], ['damals', 'back then'],
  ['überall', 'everywhere'], ['nirgends', 'nowhere'], ['irgendwo', 'somewhere'], ['drinnen', 'inside'],
  ['draußen', 'outside'], ['oben', 'above / up'], ['unten', 'below / down'], ['vorne', 'in front'],
  ['hinten', 'behind'], ['weit', 'far'], ['nah', 'near'], ['genau', 'exactly'],
]);
const timeExtra = b(6, [
  ['die Sekunde', 'second'], ['der Frühling', 'spring'], ['der Sommer', 'summer'], ['der Herbst', 'autumn'],
  ['der Winter', 'winter'], ['der Montag', 'Monday'], ['der Dienstag', 'Tuesday'], ['der Mittwoch', 'Wednesday'],
  ['der Donnerstag', 'Thursday'], ['der Freitag', 'Friday'], ['der Samstag', 'Saturday'], ['der Sonntag', 'Sunday'],
  ['das Wochenende', 'weekend'], ['der Feiertag', 'holiday'], ['der Geburtstag', 'birthday'], ['die Zukunft', 'future'],
  ['die Vergangenheit', 'past'], ['die Gegenwart', 'present'], ['heute Abend', 'tonight'], ['übermorgen', 'day after tomorrow'],
]);
const bodyExtra = b(8, [
  ['die Schulter', 'shoulder'], ['das Knie', 'knee'], ['der Ellbogen', 'elbow'], ['die Haut', 'skin'],
  ['das Blut', 'blood'], ['der Knochen', 'bone'], ['das Gehirn', 'brain'], ['die Lunge', 'lung'],
  ['der Magen', 'stomach'], ['die Zunge', 'tongue'], ['die Lippe', 'lip'], ['die Wange', 'cheek'],
  ['die Stirn', 'forehead'], ['das Kinn', 'chin'], ['der Nagel', 'nail'], ['die Ferse', 'heel'],
]);

export const FREQUENCY_WORDS_DE = [
  ...band1, ...band2, ...band3, ...band4, ...band5, ...band6, ...band7, ...band8,
  ...band9, ...band10, ...numbers, ...colours, ...animals, ...techMedia, ...feelings,
  ...abstract, ...moreConnectors,
  ...verbs2, ...professions, ...cityPlaces, ...sports, ...houseTools, ...adverbs2,
  ...timeExtra, ...bodyExtra,
];
