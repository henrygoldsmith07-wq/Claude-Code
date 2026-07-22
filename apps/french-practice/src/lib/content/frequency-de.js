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

// ── Third wave — mid-frequency vocabulary toward the top ~2,000 words ─────────
const verbs3 = b(4, [
  ['anfangen', 'to start'], ['aufhören', 'to stop'], ['weitermachen', 'to continue'], ['ankommen', 'to arrive'],
  ['abfahren', 'to depart'], ['einsteigen', 'to get in / board'], ['aussteigen', 'to get off'], ['umsteigen', 'to change (transport)'],
  ['mitkommen', 'to come along'], ['zurückkommen', 'to come back'], ['weggehen', 'to go away'], ['hereinkommen', 'to come in'],
  ['hinausgehen', 'to go out'], ['aufmachen', 'to open'], ['zumachen', 'to close'], ['anmachen', 'to switch on'],
  ['ausmachen', 'to switch off'], ['anrufen', 'to phone'], ['aufpassen', 'to pay attention'], ['einkaufen', 'to shop'],
  ['aufräumen', 'to tidy up'], ['abholen', 'to pick up'], ['vorbereiten', 'to prepare'], ['wiederholen', 'to repeat'],
  ['erzählen', 'to tell'], ['berichten', 'to report'], ['beschreiben', 'to describe'], ['erwähnen', 'to mention'],
  ['vorschlagen', 'to suggest'], ['empfehlen', 'to recommend'], ['versprechen', 'to promise'], ['entschuldigen', 'to apologise'],
]);
const verbs4 = b(6, [
  ['verbessern', 'to improve'], ['vergleichen', 'to compare'], ['wählen', 'to choose'], ['sammeln', 'to collect'],
  ['teilen', 'to share / divide'], ['verbinden', 'to connect'], ['trennen', 'to separate'], ['mischen', 'to mix'],
  ['füllen', 'to fill'], ['leeren', 'to empty'], ['schneiden', 'to cut'], ['brechen', 'to break'],
  ['reparieren', 'to repair'], ['putzen', 'to clean'], ['waschen', 'to wash'], ['trocknen', 'to dry'],
  ['bügeln', 'to iron'], ['nähen', 'to sew'], ['malen', 'to paint'], ['zeichnen', 'to draw'],
  ['bauen', 'to build'], ['graben', 'to dig'], ['pflanzen', 'to plant'], ['ernten', 'to harvest'],
  ['gießen', 'to pour / water'], ['backen', 'to bake'], ['braten', 'to fry / roast'], ['grillen', 'to grill'],
  ['rühren', 'to stir'], ['probieren', 'to taste / try'], ['servieren', 'to serve'], ['bestellen', 'to order'],
]);
const verbs5 = b(7, [
  ['denken an', 'to think of'], ['sich freuen', 'to be glad'], ['sich ärgern', 'to get annoyed'], ['sich fürchten', 'to be afraid'],
  ['sich erinnern', 'to remember'], ['sich verlieben', 'to fall in love'], ['heiraten', 'to marry'], ['sich scheiden', 'to divorce'],
  ['geboren werden', 'to be born'], ['sterben', 'to die'], ['wachsen', 'to grow'], ['leben', 'to live'],
  ['atmen', 'to breathe'], ['husten', 'to cough'], ['niesen', 'to sneeze'], ['schwitzen', 'to sweat'],
  ['frieren', 'to freeze / be cold'], ['zittern', 'to tremble'], ['fühlen', 'to feel'], ['berühren', 'to touch'],
  ['riechen', 'to smell'], ['schmecken', 'to taste'], ['spüren', 'to sense'], ['bemerken', 'to notice'],
  ['beobachten', 'to observe'], ['betrachten', 'to look at'], ['entdecken', 'to discover'], ['erforschen', 'to explore'],
  ['messen', 'to measure'], ['wiegen', 'to weigh'], ['zählen', 'to count'], ['rechnen', 'to calculate'],
]);
const foodEx = b(5, [
  ['die Banane', 'banana'], ['die Orange', 'orange'], ['die Zitrone', 'lemon'], ['die Erdbeere', 'strawberry'],
  ['die Kirsche', 'cherry'], ['die Traube', 'grape'], ['die Birne', 'pear'], ['der Pfirsich', 'peach'],
  ['die Tomate', 'tomato'], ['die Zwiebel', 'onion'], ['der Knoblauch', 'garlic'], ['die Karotte', 'carrot'],
  ['der Salat', 'salad / lettuce'], ['die Gurke', 'cucumber'], ['die Bohne', 'bean'], ['die Erbse', 'pea'],
  ['der Pilz', 'mushroom'], ['der Mais', 'corn'], ['die Nudeln', 'pasta / noodles'], ['die Pizza', 'pizza'],
  ['die Wurst', 'sausage'], ['der Schinken', 'ham'], ['das Hähnchen', 'chicken'], ['das Rindfleisch', 'beef'],
  ['das Schweinefleisch', 'pork'], ['die Meeresfrüchte', 'seafood'], ['die Garnele', 'shrimp'], ['der Kuchen', 'cake'],
  ['der Keks', 'biscuit'], ['die Schokolade', 'chocolate'], ['das Eis', 'ice cream'], ['der Honig', 'honey'],
  ['die Marmelade', 'jam'], ['das Öl', 'oil'], ['der Essig', 'vinegar'], ['der Pfeffer', 'pepper'],
  ['das Mehl', 'flour'], ['die Sahne', 'cream'], ['der Joghurt', 'yoghurt'], ['die Mahlzeit', 'meal'],
]);
const houseEx = b(6, [
  ['das Wohnzimmer', 'living room'], ['das Esszimmer', 'dining room'], ['der Flur', 'hallway'], ['der Keller', 'basement'],
  ['der Dachboden', 'attic'], ['der Balkon', 'balcony'], ['die Garage', 'garage'], ['das Dach', 'roof'],
  ['die Treppe', 'staircase'], ['der Ofen', 'oven'], ['der Herd', 'stove'], ['der Kühlschrank', 'fridge'],
  ['die Waschmaschine', 'washing machine'], ['die Spülmaschine', 'dishwasher'], ['der Fernseher', 'TV set'], ['die Heizung', 'heating'],
  ['die Klimaanlage', 'air conditioning'], ['das Regal', 'shelf'], ['die Schublade', 'drawer'], ['der Sessel', 'armchair'],
  ['das Waschbecken', 'sink'], ['die Dusche', 'shower'], ['die Badewanne', 'bathtub'], ['die Toilette', 'toilet'],
  ['der Wasserhahn', 'tap'], ['die Glühbirne', 'light bulb'], ['der Schalter', 'switch'], ['das Kabel', 'cable'],
  ['der Müll', 'rubbish'], ['die Miete', 'rent'], ['der Nachbar', 'neighbour'], ['der Vermieter', 'landlord'],
]);
const natureEx = b(7, [
  ['der Stein', 'stone'], ['der Sand', 'sand'], ['die Erde', 'earth / soil'], ['das Gras', 'grass'],
  ['das Blatt', 'leaf'], ['die Wurzel', 'root'], ['der Ast', 'branch'], ['der Samen', 'seed'],
  ['die Ernte', 'harvest'], ['das Feld', 'field'], ['die Wiese', 'meadow'], ['der Hügel', 'hill'],
  ['das Tal', 'valley'], ['die Höhle', 'cave'], ['die Küste', 'coast'], ['die Insel', 'island'],
  ['der Wasserfall', 'waterfall'], ['der Bach', 'stream'], ['der Teich', 'pond'], ['der Sumpf', 'swamp'],
  ['die Wüste', 'desert'], ['der Dschungel', 'jungle'], ['der Vulkan', 'volcano'], ['das Erdbeben', 'earthquake'],
  ['der Sturm', 'storm'], ['der Donner', 'thunder'], ['der Blitz', 'lightning'], ['der Nebel', 'fog'],
  ['der Frost', 'frost'], ['das Eis', 'ice'], ['die Hitze', 'heat'], ['der Schatten', 'shadow'],
  ['der Stern', 'star'], ['der Planet', 'planet'], ['die Sonne', 'sun'], ['das Universum', 'universe'],
]);
const animalsEx = b(8, [
  ['das Kaninchen', 'rabbit'], ['der Hase', 'hare'], ['das Eichhörnchen', 'squirrel'], ['der Fuchs', 'fox'],
  ['der Wolf', 'wolf'], ['der Hirsch', 'deer'], ['das Reh', 'roe deer'], ['der Igel', 'hedgehog'],
  ['die Ente', 'duck'], ['die Gans', 'goose'], ['der Hahn', 'rooster'], ['die Taube', 'pigeon'],
  ['die Eule', 'owl'], ['der Adler', 'eagle'], ['der Schmetterling', 'butterfly'], ['die Fliege', 'fly'],
  ['die Mücke', 'mosquito'], ['die Ameise', 'ant'], ['der Käfer', 'beetle'], ['der Wurm', 'worm'],
  ['die Schlange', 'snake'], ['die Eidechse', 'lizard'], ['der Frosch', 'frog'], ['die Schildkröte', 'turtle'],
  ['der Hai', 'shark'], ['der Wal', 'whale'], ['der Delfin', 'dolphin'], ['der Tiger', 'tiger'],
  ['der Affe', 'monkey'], ['die Giraffe', 'giraffe'], ['das Zebra', 'zebra'], ['das Kamel', 'camel'],
]);
const adjEx = b(6, [
  ['dick', 'thick / fat'], ['dünn', 'thin'], ['breit', 'wide'], ['schmal', 'narrow'],
  ['tief', 'deep'], ['flach', 'shallow / flat'], ['rund', 'round'], ['eckig', 'angular'],
  ['gerade', 'straight'], ['krumm', 'crooked'], ['scharf', 'sharp / spicy'], ['stumpf', 'blunt'],
  ['hart', 'hard'], ['weich', 'soft'], ['glatt', 'smooth'], ['rau', 'rough'],
  ['hell', 'bright / light'], ['dunkel', 'dark'], ['klar', 'clear'], ['trüb', 'cloudy / murky'],
  ['süß', 'sweet'], ['sauer', 'sour'], ['bitter', 'bitter'], ['salzig', 'salty'],
  ['frisch', 'fresh'], ['faul', 'rotten / lazy'], ['reif', 'ripe'], ['roh', 'raw'],
  ['gekocht', 'cooked'], ['lecker', 'delicious'], ['ekelhaft', 'disgusting'], ['gesund', 'healthy'],
]);
const adjEx2 = b(8, [
  ['freundlich', 'friendly'], ['höflich', 'polite'], ['unhöflich', 'rude'], ['ehrlich', 'honest'],
  ['nett', 'nice'], ['gemein', 'mean'], ['klug', 'clever'], ['dumm', 'stupid'],
  ['fleißig', 'hardworking'], ['faul', 'lazy'], ['mutig', 'brave'], ['ängstlich', 'fearful'],
  ['geduldig', 'patient'], ['ungeduldig', 'impatient'], ['großzügig', 'generous'], ['geizig', 'stingy'],
  ['ruhig', 'quiet'], ['schüchtern', 'shy'], ['selbstbewusst', 'confident'], ['ernst', 'serious'],
  ['lustig', 'funny'], ['seltsam', 'strange'], ['normal', 'normal'], ['gewöhnlich', 'ordinary'],
  ['besonders', 'special'], ['berühmt', 'famous'], ['beliebt', 'popular'], ['bekannt', 'well-known'],
  ['fremd', 'foreign / strange'], ['ähnlich', 'similar'], ['gleich', 'same'], ['verschieden', 'different'],
]);
const abstractEx = b(9, [
  ['die Zeit', 'time'], ['der Raum', 'space'], ['die Menge', 'amount / quantity'], ['die Zahl', 'number'],
  ['der Teil', 'part'], ['das Ganze', 'whole'], ['die Hälfte', 'half'], ['das Ende', 'end'],
  ['der Anfang', 'beginning'], ['die Mitte', 'middle'], ['die Reihe', 'row / series'], ['die Folge', 'consequence'],
  ['die Ursache', 'cause'], ['die Wirkung', 'effect'], ['das Ziel', 'goal'], ['der Plan', 'plan'],
  ['die Entscheidung', 'decision'], ['die Wahl', 'choice'], ['die Lösung', 'solution'], ['die Aufgabe', 'task'],
  ['die Pflicht', 'duty'], ['die Verantwortung', 'responsibility'], ['die Bedeutung', 'meaning'], ['der Vorteil', 'advantage'],
  ['der Nachteil', 'disadvantage'], ['die Schwierigkeit', 'difficulty'], ['die Lage', 'situation'], ['der Zustand', 'condition'],
  ['die Veränderung', 'change'], ['die Entwicklung', 'development'], ['der Fortschritt', 'progress'], ['das Wachstum', 'growth'],
]);
const emotionsEx = b(7, [
  ['die Stimmung', 'mood'], ['die Laune', 'temper / mood'], ['die Zufriedenheit', 'satisfaction'], ['die Enttäuschung', 'disappointment'],
  ['die Überraschung', 'surprise'], ['die Aufregung', 'excitement'], ['die Langeweile', 'boredom'], ['die Einsamkeit', 'loneliness'],
  ['der Stolz', 'pride'], ['die Scham', 'shame'], ['die Schuld', 'guilt'], ['der Neid', 'envy'],
  ['die Eifersucht', 'jealousy'], ['das Mitleid', 'pity'], ['die Dankbarkeit', 'gratitude'], ['die Zuneigung', 'affection'],
  ['glücklich', 'happy'], ['zufrieden', 'content'], ['unglücklich', 'unhappy'], ['aufgeregt', 'excited'],
  ['entspannt', 'relaxed'], ['gestresst', 'stressed'], ['erschöpft', 'exhausted'], ['verwirrt', 'confused'],
  ['enttäuscht', 'disappointed'], ['begeistert', 'enthusiastic'], ['neugierig', 'curious'], ['besorgt', 'worried'],
]);

const businessMoney = b(7, [
  ['das Geschäft', 'business'], ['der Handel', 'trade'], ['der Markt', 'market'], ['der Kunde', 'customer'],
  ['der Verkauf', 'sale'], ['der Kauf', 'purchase'], ['das Angebot', 'offer'], ['die Nachfrage', 'demand'],
  ['der Gewinn', 'profit'], ['der Verlust', 'loss'], ['die Kosten', 'costs'], ['die Steuer', 'tax'],
  ['die Rechnung', 'invoice'], ['die Quittung', 'receipt'], ['das Gehalt', 'salary'], ['der Lohn', 'wage'],
  ['die Schulden', 'debt'], ['der Kredit', 'loan / credit'], ['das Konto', 'account'], ['die Münze', 'coin'],
  ['der Schein', 'banknote'], ['das Bargeld', 'cash'], ['die Wirtschaft', 'economy'], ['die Industrie', 'industry'],
  ['die Fabrik', 'factory'], ['das Produkt', 'product'], ['die Ware', 'goods'], ['die Lieferung', 'delivery'],
  ['der Vertrag', 'contract'], ['die Investition', 'investment'], ['die Aktie', 'share / stock'], ['der Chef', 'manager'],
  ['der Mitarbeiter', 'employee'], ['die Abteilung', 'department'], ['die Sitzung', 'session / meeting'], ['der Auftrag', 'order / assignment'],
]);
const techScience = b(8, [
  ['die Wissenschaft', 'science'], ['die Forschung', 'research'], ['das Experiment', 'experiment'], ['die Theorie', 'theory'],
  ['die Technik', 'technology'], ['die Maschine', 'machine'], ['der Motor', 'engine'], ['das Gerät', 'device'],
  ['der Bildschirm', 'screen'], ['die Tastatur', 'keyboard'], ['die Maus', 'mouse'], ['der Drucker', 'printer'],
  ['die Software', 'software'], ['das Netzwerk', 'network'], ['der Server', 'server'], ['die Verbindung', 'connection'],
  ['das Signal', 'signal'], ['die Energie', 'energy'], ['der Strom', 'electricity / current'], ['die Kraft', 'force / power'],
  ['die Geschwindigkeit', 'speed'], ['das Gewicht', 'weight'], ['die Länge', 'length'], ['die Höhe', 'height'],
  ['die Breite', 'width'], ['die Fläche', 'area'], ['das Volumen', 'volume'], ['die Temperatur', 'temperature'],
  ['der Stoff', 'material / substance'], ['das Element', 'element'], ['das Metall', 'metal'], ['der Kunststoff', 'plastic'],
  ['die Chemie', 'chemistry'], ['die Physik', 'physics'], ['die Biologie', 'biology'], ['die Mathematik', 'mathematics'],
]);
const artsMedia = b(8, [
  ['die Kunst', 'art'], ['das Bild', 'picture'], ['das Gemälde', 'painting'], ['die Zeichnung', 'drawing'],
  ['die Skulptur', 'sculpture'], ['der Künstler', 'artist'], ['das Konzert', 'concert'], ['die Oper', 'opera'],
  ['das Instrument', 'instrument'], ['die Gitarre', 'guitar'], ['das Klavier', 'piano'], ['die Trommel', 'drum'],
  ['der Sänger', 'singer'], ['die Band', 'band'], ['der Roman', 'novel'], ['das Gedicht', 'poem'],
  ['die Geschichte', 'story / history'], ['die Zeitschrift', 'magazine'], ['der Artikel', 'article'], ['die Sendung', 'broadcast'],
  ['der Schauspieler', 'actor'], ['die Bühne', 'stage'], ['die Vorstellung', 'performance'], ['das Publikum', 'audience'],
  ['die Kultur', 'culture'], ['die Tradition', 'tradition'], ['das Fest', 'festival'], ['die Feier', 'celebration'],
  ['der Tanz', 'dance'], ['das Lied', 'song'], ['die Melodie', 'melody'], ['der Rhythmus', 'rhythm'],
]);
const education = b(7, [
  ['die Bildung', 'education'], ['das Fach', 'subject'], ['die Vorlesung', 'lecture'], ['die Hausaufgabe', 'homework'],
  ['die Übung', 'exercise'], ['der Test', 'test'], ['das Zeugnis', 'report / certificate'], ['der Abschluss', 'degree'],
  ['das Wissen', 'knowledge'], ['die Kenntnis', 'knowledge / skill'], ['die Fähigkeit', 'ability'], ['der Fehler', 'mistake'],
  ['die Korrektur', 'correction'], ['die Erklärung', 'explanation'], ['das Beispiel', 'example'], ['die Regel', 'rule'],
  ['die Sprache', 'language'], ['das Alphabet', 'alphabet'], ['der Buchstabe', 'letter'], ['die Silbe', 'syllable'],
  ['der Satz', 'sentence'], ['die Grammatik', 'grammar'], ['die Bedeutung', 'meaning'], ['die Aussprache', 'pronunciation'],
  ['der Absatz', 'paragraph'], ['die Seite', 'page'], ['das Kapitel', 'chapter'], ['die Notiz', 'note'],
  ['der Bleistift', 'pencil'], ['der Radiergummi', 'eraser'], ['das Lineal', 'ruler'], ['die Tafel', 'blackboard'],
]);
const societyLaw = b(9, [
  ['die Gesellschaft', 'society'], ['die Regierung', 'government'], ['der Staat', 'state'], ['das Volk', 'people / nation'],
  ['der Bürger', 'citizen'], ['die Politik', 'politics'], ['die Partei', 'party'], ['die Wahl', 'election'],
  ['die Stimme', 'vote / voice'], ['das Gesetz', 'law'], ['das Recht', 'right'], ['die Regel', 'rule'],
  ['das Gericht', 'court'], ['der Richter', 'judge'], ['der Anwalt', 'lawyer'], ['das Verbrechen', 'crime'],
  ['der Dieb', 'thief'], ['die Strafe', 'punishment'], ['das Gefängnis', 'prison'], ['die Sicherheit', 'security'],
  ['der Frieden', 'peace'], ['der Krieg', 'war'], ['die Armee', 'army'], ['der Soldat', 'soldier'],
  ['die Grenze', 'border'], ['die Freiheit', 'freedom'], ['die Gleichheit', 'equality'], ['die Gerechtigkeit', 'justice'],
  ['die Religion', 'religion'], ['die Kirche', 'church'], ['der Gott', 'god'], ['der Glaube', 'faith / belief'],
]);
const healthMed = b(7, [
  ['die Behandlung', 'treatment'], ['die Untersuchung', 'examination'], ['die Operation', 'operation'], ['die Spritze', 'injection'],
  ['die Tablette', 'pill'], ['das Rezept', 'prescription / recipe'], ['der Verband', 'bandage'], ['die Wunde', 'wound'],
  ['die Verletzung', 'injury'], ['der Unfall', 'accident'], ['die Grippe', 'flu'], ['die Erkältung', 'cold'],
  ['der Husten', 'cough'], ['der Schnupfen', 'runny nose'], ['die Allergie', 'allergy'], ['der Zahnarzt', 'dentist'],
  ['die Apotheke', 'pharmacy'], ['die Krankenkasse', 'health insurance'], ['der Patient', 'patient'], ['die Diagnose', 'diagnosis'],
  ['die Kur', 'treatment / cure'], ['die Ernährung', 'nutrition'], ['die Diät', 'diet'], ['die Übung', 'exercise'],
  ['der Schlaf', 'sleep'], ['die Erholung', 'recovery / rest'], ['die Pflege', 'care'], ['die Hygiene', 'hygiene'],
  ['schwanger', 'pregnant'], ['blind', 'blind'], ['taub', 'deaf'], ['behindert', 'disabled'],
]);
const transportEx = b(6, [
  ['die U-Bahn', 'underground / metro'], ['die Straßenbahn', 'tram'], ['das Taxi', 'taxi'], ['der Lkw', 'lorry / truck'],
  ['das Motorrad', 'motorbike'], ['das Schiff', 'ship'], ['das Boot', 'boat'], ['der Hafen', 'harbour / port'],
  ['die Haltestelle', 'stop'], ['der Bahnsteig', 'platform'], ['der Fahrplan', 'timetable'], ['die Verspätung', 'delay'],
  ['der Verkehr', 'traffic'], ['die Ampel', 'traffic light'], ['das Schild', 'sign'], ['der Führerschein', 'driving licence'],
  ['das Benzin', 'petrol'], ['die Tankstelle', 'petrol station'], ['der Parkplatz', 'car park'], ['der Reifen', 'tyre'],
  ['die Bremse', 'brake'], ['das Rad', 'wheel'], ['der Sitz', 'seat'], ['der Gurt', 'seatbelt'],
  ['die Reise', 'journey'], ['der Ausflug', 'excursion'], ['das Gepäck', 'luggage'], ['der Koffer', 'suitcase'],
  ['der Rucksack', 'backpack'], ['der Pass', 'passport'], ['das Visum', 'visa'], ['die Unterkunft', 'accommodation'],
]);
const clothingEx = b(7, [
  ['die Jeans', 'jeans'], ['das T-Shirt', 'T-shirt'], ['die Bluse', 'blouse'], ['der Anzug', 'suit'],
  ['die Krawatte', 'tie'], ['der Gürtel', 'belt'], ['der Schal', 'scarf'], ['die Handschuhe', 'gloves'],
  ['die Mütze', 'cap'], ['die Stiefel', 'boots'], ['die Sandalen', 'sandals'], ['die Unterwäsche', 'underwear'],
  ['der Pyjama', 'pyjamas'], ['der Badeanzug', 'swimsuit'], ['die Tasche', 'bag'], ['der Geldbeutel', 'wallet'],
  ['der Schmuck', 'jewellery'], ['der Ring', 'ring'], ['die Kette', 'necklace'], ['die Uhr', 'watch'],
  ['die Größe', 'size'], ['die Mode', 'fashion'], ['der Stoff', 'fabric'], ['die Baumwolle', 'cotton'],
  ['die Wolle', 'wool'], ['die Seide', 'silk'], ['das Leder', 'leather'], ['die Naht', 'seam'],
  ['der Knopf', 'button'], ['der Reißverschluss', 'zip'], ['die Tasche', 'pocket'], ['der Kragen', 'collar'],
]);
const objectsEx = b(6, [
  ['das Ding', 'thing'], ['der Gegenstand', 'object'], ['die Kiste', 'box / crate'], ['die Schachtel', 'small box'],
  ['der Beutel', 'bag / pouch'], ['das Paket', 'parcel'], ['der Brief', 'letter'], ['die Karte', 'card'],
  ['der Umschlag', 'envelope'], ['die Briefmarke', 'stamp'], ['die Schere', 'scissors'], ['der Klebstoff', 'glue'],
  ['das Band', 'ribbon / tape'], ['die Schnur', 'string'], ['der Faden', 'thread'], ['die Nadel', 'needle'],
  ['der Nagel', 'nail'], ['die Schraube', 'screw'], ['das Seil', 'rope'], ['die Leiter', 'ladder'],
  ['der Eimer', 'bucket'], ['die Schüssel', 'bowl'], ['der Topf', 'pot'], ['die Pfanne', 'pan'],
  ['das Tablett', 'tray'], ['die Kanne', 'jug / pot'], ['der Korb', 'basket'], ['der Deckel', 'lid'],
  ['die Kerze', 'candle'], ['die Streichhölzer', 'matches'], ['die Taschenlampe', 'torch'], ['der Schirm', 'umbrella'],
]);
const communication = b(6, [
  ['das Gespräch', 'conversation'], ['die Unterhaltung', 'conversation / entertainment'], ['die Diskussion', 'discussion'], ['die Rede', 'speech'],
  ['die Ansage', 'announcement'], ['die Meinung', 'opinion'], ['der Rat', 'advice'], ['die Bitte', 'request'],
  ['die Erlaubnis', 'permission'], ['das Versprechen', 'promise'], ['die Warnung', 'warning'], ['die Drohung', 'threat'],
  ['die Lüge', 'lie'], ['die Wahrheit', 'truth'], ['das Geheimnis', 'secret'], ['der Witz', 'joke'],
  ['der Gruß', 'greeting'], ['der Dank', 'thanks'], ['die Entschuldigung', 'apology'], ['die Einladung', 'invitation'],
  ['die Nachricht', 'message'], ['der Anruf', 'phone call'], ['das Wort', 'word'], ['die Stimme', 'voice'],
  ['der Ton', 'sound / tone'], ['das Geräusch', 'noise'], ['die Stille', 'silence'], ['die Sprache', 'language'],
]);
const familyRel = b(6, [
  ['die Eltern', 'parents'], ['die Großmutter', 'grandmother'], ['der Großvater', 'grandfather'], ['der Onkel', 'uncle'],
  ['die Tante', 'aunt'], ['der Cousin', 'cousin (m)'], ['die Cousine', 'cousin (f)'], ['der Neffe', 'nephew'],
  ['die Nichte', 'niece'], ['der Enkel', 'grandson'], ['die Enkelin', 'granddaughter'], ['der Ehemann', 'husband'],
  ['die Ehefrau', 'wife'], ['der Partner', 'partner'], ['die Freundin', 'girlfriend'], ['der Freund', 'boyfriend / friend'],
  ['die Verwandten', 'relatives'], ['der Nachbar', 'neighbour'], ['der Bekannte', 'acquaintance'], ['der Gast', 'guest'],
  ['die Hochzeit', 'wedding'], ['die Ehe', 'marriage'], ['die Scheidung', 'divorce'], ['die Geburt', 'birth'],
  ['die Kindheit', 'childhood'], ['die Jugend', 'youth'], ['das Alter', 'age / old age'], ['die Beziehung', 'relationship'],
]);
const cityBuild = b(7, [
  ['das Gebäude', 'building'], ['der Turm', 'tower'], ['das Schloss', 'castle'], ['die Burg', 'fortress'],
  ['die Fabrik', 'factory'], ['das Lager', 'warehouse'], ['der Bauernhof', 'farm'], ['die Scheune', 'barn'],
  ['die Halle', 'hall'], ['das Stadion', 'stadium'], ['der Zoo', 'zoo'], ['der Friedhof', 'cemetery'],
  ['die Moschee', 'mosque'], ['der Tempel', 'temple'], ['die Botschaft', 'embassy'], ['das Gericht', 'courthouse'],
  ['die Schule', 'school'], ['der Kindergarten', 'kindergarten'], ['die Universität', 'university'], ['das Labor', 'laboratory'],
  ['die Brücke', 'bridge'], ['der Tunnel', 'tunnel'], ['der Zaun', 'fence'], ['das Tor', 'gate'],
  ['der Eingang', 'entrance'], ['der Ausgang', 'exit'], ['die Nummer', 'number'], ['die Adresse', 'address'],
  ['das Viertel', 'district'], ['der Vorort', 'suburb'], ['die Hauptstadt', 'capital'], ['die Gegend', 'area'],
]);
const shoppingEx = b(6, [
  ['der Laden', 'shop'], ['das Kaufhaus', 'department store'], ['die Kasse', 'checkout'], ['der Verkäufer', 'shop assistant'],
  ['der Warenkorb', 'shopping basket'], ['die Tüte', 'bag'], ['das Sonderangebot', 'special offer'], ['der Rabatt', 'discount'],
  ['der Ausverkauf', 'sale'], ['die Garantie', 'warranty'], ['der Umtausch', 'exchange'], ['die Rückgabe', 'return'],
  ['die Qualität', 'quality'], ['die Marke', 'brand'], ['das Etikett', 'label'], ['die Auswahl', 'selection'],
  ['die Bäckerei', 'bakery'], ['die Metzgerei', 'butcher’s'], ['die Konditorei', 'patisserie'], ['der Kiosk', 'kiosk'],
  ['die Drogerie', 'drugstore'], ['die Buchhandlung', 'bookshop'], ['das Blumengeschäft', 'florist'], ['der Juwelier', 'jeweller'],
  ['die Öffnungszeiten', 'opening hours'], ['geschlossen', 'closed'], ['geöffnet', 'open'], ['kostenlos', 'free of charge'],
]);
const adverbs3 = b(5, [
  ['sicherlich', 'certainly'], ['wahrscheinlich', 'probably'], ['möglicherweise', 'possibly'], ['hoffentlich', 'hopefully'],
  ['leider', 'unfortunately'], ['glücklicherweise', 'fortunately'], ['besonders', 'especially'], ['hauptsächlich', 'mainly'],
  ['teilweise', 'partly'], ['völlig', 'completely'], ['ungefähr', 'approximately'], ['mindestens', 'at least'],
  ['höchstens', 'at most'], ['sogar', 'even'], ['nur noch', 'only just'], ['bereits', 'already'],
  ['kaum', 'hardly'], ['ständig', 'constantly'], ['gelegentlich', 'occasionally'], ['normalerweise', 'usually'],
  ['einmal', 'once'], ['zweimal', 'twice'], ['mehrmals', 'several times'], ['erstens', 'firstly'],
  ['zweitens', 'secondly'], ['übrigens', 'by the way'], ['jedenfalls', 'in any case'], ['insgesamt', 'in total'],
]);
const verbs6 = b(7, [
  ['gehören zu', 'to belong to'], ['bestehen aus', 'to consist of'], ['sich kümmern', 'to take care'], ['sich beeilen', 'to hurry'],
  ['sich entspannen', 'to relax'], ['sich anziehen', 'to get dressed'], ['sich ausziehen', 'to undress'], ['sich waschen', 'to wash oneself'],
  ['sich setzen', 'to sit down'], ['sich hinlegen', 'to lie down'], ['aufwachen', 'to wake up'], ['einschlafen', 'to fall asleep'],
  ['sich treffen', 'to meet'], ['sich verabreden', 'to arrange to meet'], ['teilnehmen', 'to take part'], ['sich bewerben', 'to apply'],
  ['unterschreiben', 'to sign'], ['ausfüllen', 'to fill in'], ['drucken', 'to print'], ['kopieren', 'to copy'],
  ['löschen', 'to delete'], ['speichern', 'to save'], ['herunterladen', 'to download'], ['hochladen', 'to upload'],
  ['klicken', 'to click'], ['tippen', 'to type'], ['suchen', 'to search'], ['finden', 'to find'],
  ['verlieren', 'to lose'], ['gewinnen', 'to win'], ['verbieten', 'to forbid'], ['erlauben', 'to allow'],
]);
const measures = b(5, [
  ['das Kilo', 'kilo'], ['das Gramm', 'gram'], ['das Pfund', 'pound'], ['der Liter', 'litre'],
  ['der Meter', 'metre'], ['der Zentimeter', 'centimetre'], ['der Kilometer', 'kilometre'], ['das Stück', 'piece'],
  ['das Paar', 'pair'], ['das Dutzend', 'dozen'], ['die Portion', 'portion'], ['die Scheibe', 'slice'],
  ['das Viertel', 'quarter'], ['das Drittel', 'third'], ['das Prozent', 'percent'], ['die Menge', 'quantity'],
  ['viel', 'much'], ['wenig', 'little'], ['mehr', 'more'], ['weniger', 'less'],
  ['einige', 'some'], ['mehrere', 'several'], ['alle', 'all'], ['beide', 'both'],
  ['jeder', 'each'], ['manche', 'some'], ['kein', 'none'], ['genug', 'enough'],
]);
const calendarEx = b(5, [
  ['der Januar', 'January'], ['der Februar', 'February'], ['der März', 'March'], ['der April', 'April'],
  ['der Mai', 'May'], ['der Juni', 'June'], ['der Juli', 'July'], ['der August', 'August'],
  ['der September', 'September'], ['der Oktober', 'October'], ['der November', 'November'], ['der Dezember', 'December'],
  ['das Datum', 'date'], ['der Kalender', 'calendar'], ['die Jahreszeit', 'season'], ['der Termin', 'appointment'],
  ['gestern', 'yesterday'], ['vorgestern', 'day before yesterday'], ['nächste Woche', 'next week'], ['letzte Woche', 'last week'],
  ['früher', 'earlier / in the past'], ['später', 'later'], ['bald', 'soon'], ['pünktlich', 'on time'],
]);
const materials = b(8, [
  ['das Holz', 'wood'], ['das Eisen', 'iron'], ['der Stahl', 'steel'], ['das Gold', 'gold'],
  ['das Silber', 'silver'], ['das Kupfer', 'copper'], ['das Glas', 'glass'], ['das Papier', 'paper'],
  ['die Pappe', 'cardboard'], ['der Ton', 'clay'], ['der Beton', 'concrete'], ['der Ziegel', 'brick'],
  ['der Gummi', 'rubber'], ['das Wachs', 'wax'], ['das Salz', 'salt'], ['die Kohle', 'coal'],
  ['das Öl', 'oil'], ['das Gas', 'gas'], ['der Staub', 'dust'], ['der Schmutz', 'dirt'],
  ['der Schaum', 'foam'], ['der Rauch', 'smoke'], ['die Asche', 'ash'], ['der Dampf', 'steam'],
]);
const directions = b(4, [
  ['der Norden', 'north'], ['der Süden', 'south'], ['der Osten', 'east'], ['der Westen', 'west'],
  ['oben', 'top / above'], ['unten', 'bottom / below'], ['vorn', 'front'], ['hinten', 'back'],
  ['innen', 'inside'], ['außen', 'outside'], ['neben', 'next to'], ['gegenüber', 'opposite'],
  ['zwischen', 'between'], ['hinter', 'behind'], ['über', 'above'], ['unter', 'below'],
  ['die Richtung', 'direction'], ['der Abstand', 'distance'], ['die Nähe', 'proximity'], ['die Ferne', 'distance'],
]);
const miscNouns = b(9, [
  ['die Gelegenheit', 'opportunity'], ['der Zufall', 'coincidence'], ['das Glück', 'luck / happiness'], ['das Pech', 'bad luck'],
  ['die Hoffnung', 'hope'], ['der Traum', 'dream'], ['der Wunsch', 'wish'], ['das Bedürfnis', 'need'],
  ['die Gewohnheit', 'habit'], ['die Erfahrung', 'experience'], ['das Erlebnis', 'experience / event'], ['die Erinnerung', 'memory'],
  ['der Eindruck', 'impression'], ['die Vorstellung', 'idea / notion'], ['der Zweifel', 'doubt'], ['die Überzeugung', 'conviction'],
  ['die Vorsicht', 'caution'], ['die Geduld', 'patience'], ['die Mühe', 'effort'], ['die Anstrengung', 'exertion'],
  ['der Versuch', 'attempt'], ['der Erfolg', 'success'], ['das Ergebnis', 'result'], ['die Folge', 'consequence'],
  ['der Vorteil', 'benefit'], ['die Wirkung', 'effect'], ['die Ausnahme', 'exception'], ['die Regel', 'rule'],
  ['der Umstand', 'circumstance'], ['die Bedingung', 'condition'], ['die Möglichkeit', 'possibility'], ['die Notwendigkeit', 'necessity'],
]);

const verbs7 = b(8, [
  ['erreichen', 'to reach'], ['verpassen', 'to miss'], ['erlauben', 'to permit'], ['verhindern', 'to prevent'],
  ['schützen', 'to protect'], ['retten', 'to rescue'], ['gefährden', 'to endanger'], ['riskieren', 'to risk'],
  ['unterstützen', 'to support'], ['ermutigen', 'to encourage'], ['loben', 'to praise'], ['kritisieren', 'to criticise'],
  ['beschweren', 'to complain'], ['streiten', 'to argue'], ['kämpfen', 'to fight'], ['gewinnen', 'to gain'],
  ['besiegen', 'to defeat'], ['aufgeben', 'to give up'], ['erobern', 'to conquer'], ['beherrschen', 'to master'],
  ['leiten', 'to lead / manage'], ['organisieren', 'to organise'], ['planen', 'to plan'], ['gründen', 'to found'],
  ['entwickeln', 'to develop'], ['herstellen', 'to produce'], ['liefern', 'to deliver'], ['verteilen', 'to distribute'],
  ['sparen', 'to save'], ['ausgeben', 'to spend'], ['verdienen', 'to earn'], ['leihen', 'to lend / borrow'],
]);
const verbs8 = b(9, [
  ['bedeuten', 'to signify'], ['darstellen', 'to represent'], ['betreffen', 'to concern'], ['enthalten', 'to contain'],
  ['umfassen', 'to comprise'], ['erfordern', 'to require'], ['ermöglichen', 'to enable'], ['verursachen', 'to cause'],
  ['beeinflussen', 'to influence'], ['bestimmen', 'to determine'], ['festlegen', 'to fix / define'], ['beweisen', 'to prove'],
  ['zeigen', 'to demonstrate'], ['behaupten', 'to claim'], ['bestätigen', 'to confirm'], ['leugnen', 'to deny'],
  ['zweifeln', 'to doubt'], ['vermuten', 'to suspect'], ['erwarten', 'to expect'], ['voraussagen', 'to predict'],
  ['schätzen', 'to estimate / value'], ['bewerten', 'to evaluate'], ['beurteilen', 'to judge'], ['entscheiden', 'to decide'],
  ['überlegen', 'to consider'], ['nachdenken', 'to reflect'], ['sich vorstellen', 'to imagine'], ['erkennen', 'to realise'],
  ['begreifen', 'to grasp'], ['verwechseln', 'to confuse'], ['unterscheiden', 'to distinguish'], ['verbinden', 'to link'],
]);
const geography = b(7, [
  ['die Welt', 'world'], ['der Kontinent', 'continent'], ['das Land', 'country'], ['die Nation', 'nation'],
  ['die Region', 'region'], ['das Gebiet', 'territory'], ['die Provinz', 'province'], ['der Bezirk', 'district'],
  ['Deutschland', 'Germany'], ['Frankreich', 'France'], ['Spanien', 'Spain'], ['Italien', 'Italy'],
  ['England', 'England'], ['Europa', 'Europe'], ['Afrika', 'Africa'], ['Asien', 'Asia'],
  ['Amerika', 'America'], ['der Norden', 'north'], ['die See', 'sea'], ['der Ozean', 'ocean'],
  ['die Landschaft', 'landscape'], ['die Umgebung', 'surroundings'], ['die Umwelt', 'environment'], ['das Klima', 'climate'],
  ['die Bevölkerung', 'population'], ['die Sprache', 'language'], ['die Kultur', 'culture'], ['die Hauptstadt', 'capital'],
]);
const plants = b(8, [
  ['die Pflanze', 'plant'], ['der Busch', 'bush'], ['die Hecke', 'hedge'], ['die Palme', 'palm tree'],
  ['die Eiche', 'oak'], ['die Tanne', 'fir'], ['die Rose', 'rose'], ['die Tulpe', 'tulip'],
  ['das Gänseblümchen', 'daisy'], ['der Kaktus', 'cactus'], ['das Moos', 'moss'], ['der Pilz', 'mushroom'],
  ['das Getreide', 'grain'], ['der Weizen', 'wheat'], ['das Heu', 'hay'], ['das Stroh', 'straw'],
  ['die Frucht', 'fruit'], ['die Nuss', 'nut'], ['die Beere', 'berry'], ['der Kern', 'seed / pit'],
  ['die Blüte', 'blossom'], ['der Duft', 'scent'], ['der Garten', 'garden'], ['der Park', 'park'],
]);
const kitchenEx = b(6, [
  ['das Geschirr', 'dishes'], ['die Serviette', 'napkin'], ['das Tischtuch', 'tablecloth'], ['der Korkenzieher', 'corkscrew'],
  ['der Dosenöffner', 'can opener'], ['das Schneidebrett', 'chopping board'], ['der Mixer', 'blender'], ['der Wasserkocher', 'kettle'],
  ['die Mikrowelle', 'microwave'], ['der Toaster', 'toaster'], ['das Rezept', 'recipe'], ['die Zutat', 'ingredient'],
  ['die Portion', 'portion'], ['der Geschmack', 'taste'], ['der Geruch', 'smell'], ['der Appetit', 'appetite'],
  ['der Durst', 'thirst'], ['der Hunger', 'hunger'], ['das Getränk', 'drink'], ['die Nachspeise', 'dessert'],
  ['die Vorspeise', 'starter'], ['das Hauptgericht', 'main course'], ['die Beilage', 'side dish'], ['der Imbiss', 'snack'],
]);
const hobbies = b(7, [
  ['das Hobby', 'hobby'], ['die Freizeit', 'free time'], ['das Vergnügen', 'pleasure'], ['die Unterhaltung', 'entertainment'],
  ['das Lesen', 'reading'], ['das Kochen', 'cooking'], ['das Wandern', 'hiking'], ['das Radfahren', 'cycling'],
  ['das Schwimmen', 'swimming'], ['das Zeichnen', 'drawing'], ['die Fotografie', 'photography'], ['das Gärtnern', 'gardening'],
  ['das Sammeln', 'collecting'], ['das Reisen', 'travelling'], ['das Spiel', 'game'], ['die Karte', 'playing card'],
  ['das Schach', 'chess'], ['das Puzzle', 'puzzle'], ['der Verein', 'club'], ['das Mitglied', 'member'],
  ['das Turnier', 'tournament'], ['der Wettbewerb', 'competition'], ['der Preis', 'prize'], ['die Medaille', 'medal'],
]);
const adjEx3 = b(8, [
  ['nützlich', 'useful'], ['nutzlos', 'useless'], ['praktisch', 'practical'], ['bequem', 'comfortable'],
  ['unbequem', 'uncomfortable'], ['modern', 'modern'], ['altmodisch', 'old-fashioned'], ['teuer', 'costly'],
  ['wertvoll', 'valuable'], ['wertlos', 'worthless'], ['gefährlich', 'dangerous'], ['harmlos', 'harmless'],
  ['möglich', 'possible'], ['unmöglich', 'impossible'], ['wahr', 'true'], ['unwahr', 'untrue'],
  ['echt', 'genuine'], ['falsch', 'fake'], ['perfekt', 'perfect'], ['fertig', 'ready / finished'],
  ['bereit', 'ready'], ['offen', 'open'], ['geschlossen', 'closed'], ['privat', 'private'],
  ['öffentlich', 'public'], ['allgemein', 'general'], ['einzeln', 'individual'], ['gemeinsam', 'common / joint'],
  ['zusätzlich', 'additional'], ['notwendig', 'necessary'], ['überflüssig', 'superfluous'], ['ausreichend', 'sufficient'],
]);
const weatherEx = b(6, [
  ['sonnig', 'sunny'], ['wolkig', 'cloudy'], ['regnerisch', 'rainy'], ['windig', 'windy'],
  ['neblig', 'foggy'], ['stürmisch', 'stormy'], ['heiter', 'clear / bright'], ['schwül', 'humid'],
  ['die Temperatur', 'temperature'], ['der Grad', 'degree'], ['die Vorhersage', 'forecast'], ['der Schauer', 'shower'],
  ['der Hagel', 'hail'], ['der Tau', 'dew'], ['die Feuchtigkeit', 'humidity'], ['die Trockenheit', 'drought'],
  ['die Überschwemmung', 'flood'], ['der Regenbogen', 'rainbow'], ['die Brise', 'breeze'], ['der Frühling', 'springtime'],
]);
const jobsEx = b(8, [
  ['der Bäcker', 'baker'], ['der Metzger', 'butcher'], ['der Friseur', 'hairdresser'], ['der Klempner', 'plumber'],
  ['der Elektriker', 'electrician'], ['der Mechaniker', 'mechanic'], ['der Tischler', 'carpenter'], ['der Maurer', 'bricklayer'],
  ['der Maler', 'painter'], ['der Gärtner', 'gardener'], ['der Pilot', 'pilot'], ['der Kapitän', 'captain'],
  ['der Soldat', 'soldier'], ['der Feuerwehrmann', 'firefighter'], ['der Briefträger', 'postman'], ['der Reiniger', 'cleaner'],
  ['der Beamte', 'civil servant'], ['der Bankier', 'banker'], ['der Journalist', 'journalist'], ['der Fotograf', 'photographer'],
  ['der Übersetzer', 'translator'], ['der Dolmetscher', 'interpreter'], ['der Berater', 'consultant'], ['der Direktor', 'director'],
]);
const bodyEx2 = b(7, [
  ['das Gesicht', 'face'], ['die Augenbraue', 'eyebrow'], ['die Wimper', 'eyelash'], ['die Zunge', 'tongue'],
  ['der Kiefer', 'jaw'], ['die Kehle', 'throat'], ['die Brust', 'chest'], ['die Hüfte', 'hip'],
  ['der Oberschenkel', 'thigh'], ['die Wade', 'calf'], ['der Knöchel', 'ankle'], ['die Zehe', 'toe'],
  ['der Daumen', 'thumb'], ['die Faust', 'fist'], ['der Muskel', 'muscle'], ['die Vene', 'vein'],
  ['die Niere', 'kidney'], ['die Leber', 'liver'], ['der Nerv', 'nerve'], ['die Träne', 'tear'],
  ['der Schweiß', 'sweat'], ['der Atem', 'breath'], ['die Stimme', 'voice'], ['der Puls', 'pulse'],
]);
const mindWords = b(9, [
  ['der Geist', 'mind / spirit'], ['die Seele', 'soul'], ['der Verstand', 'reason / intellect'], ['das Bewusstsein', 'consciousness'],
  ['die Vernunft', 'reason'], ['die Fantasie', 'imagination'], ['die Kreativität', 'creativity'], ['die Intelligenz', 'intelligence'],
  ['das Gedächtnis', 'memory'], ['die Aufmerksamkeit', 'attention'], ['die Konzentration', 'concentration'], ['das Interesse', 'interest'],
  ['die Neugier', 'curiosity'], ['die Weisheit', 'wisdom'], ['das Talent', 'talent'], ['die Begabung', 'gift / aptitude'],
  ['der Charakter', 'character'], ['die Persönlichkeit', 'personality'], ['die Einstellung', 'attitude'], ['der Wille', 'will'],
  ['die Absicht', 'intention'], ['das Motiv', 'motive'], ['der Instinkt', 'instinct'], ['die Reaktion', 'reaction'],
]);
const moreNouns = b(9, [
  ['das System', 'system'], ['die Struktur', 'structure'], ['die Methode', 'method'], ['das Verfahren', 'procedure'],
  ['die Technik', 'technique'], ['das Werkzeug', 'tool'], ['das Mittel', 'means'], ['die Quelle', 'source'],
  ['das Material', 'material'], ['die Substanz', 'substance'], ['die Form', 'form / shape'], ['das Muster', 'pattern'],
  ['das Modell', 'model'], ['der Typ', 'type'], ['die Kategorie', 'category'], ['die Gruppe', 'group'],
  ['das Netz', 'net / network'], ['die Kette', 'chain'], ['die Verbindung', 'connection'], ['der Kontakt', 'contact'],
  ['die Beziehung', 'relation'], ['der Zusammenhang', 'context'], ['der Rahmen', 'framework'], ['das Detail', 'detail'],
  ['der Aspekt', 'aspect'], ['der Faktor', 'factor'], ['die Rolle', 'role'], ['die Funktion', 'function'],
  ['der Wert', 'value'], ['die Qualität', 'quality'], ['die Eigenschaft', 'property / trait'], ['das Merkmal', 'feature'],
]);

const verbs9 = b(8, [
  ['ziehen', 'to pull'], ['drücken', 'to push / press'], ['heben', 'to lift'], ['senken', 'to lower'],
  ['schieben', 'to shove'], ['rollen', 'to roll'], ['gleiten', 'to slide'], ['klettern', 'to climb'],
  ['kriechen', 'to crawl'], ['stolpern', 'to stumble'], ['rutschen', 'to slip'], ['schaukeln', 'to swing'],
  ['wischen', 'to wipe'], ['reiben', 'to rub'], ['kratzen', 'to scratch'], ['klopfen', 'to knock'],
  ['stechen', 'to sting / prick'], ['beißen', 'to bite'], ['kauen', 'to chew'], ['schlucken', 'to swallow'],
  ['gähnen', 'to yawn'], ['flüstern', 'to whisper'], ['schreien', 'to scream'], ['brüllen', 'to roar'],
  ['klingeln', 'to ring'], ['läuten', 'to chime'], ['pfeifen', 'to whistle'], ['klatschen', 'to clap'],
  ['winken', 'to wave'], ['nicken', 'to nod'], ['schütteln', 'to shake'], ['umarmen', 'to hug'],
]);
const officeEx = b(7, [
  ['die Akte', 'file'], ['der Ordner', 'folder'], ['das Formular', 'form'], ['der Stempel', 'stamp'],
  ['die Unterschrift', 'signature'], ['der Bericht', 'report'], ['die Notiz', 'note'], ['der Kalender', 'calendar'],
  ['die Besprechung', 'meeting'], ['die Frist', 'deadline'], ['der Schreibtisch', 'desk'], ['der Bürostuhl', 'office chair'],
  ['die Büroklammer', 'paperclip'], ['der Locher', 'hole punch'], ['der Hefter', 'stapler'], ['der Taschenrechner', 'calculator'],
  ['die Kopie', 'copy'], ['der Anhang', 'attachment'], ['der Entwurf', 'draft'], ['die Vorlage', 'template'],
  ['die Deadline', 'deadline'], ['die Pause', 'break'], ['die Schicht', 'shift'], ['der Urlaub', 'leave / holiday'],
]);
const routineEx = b(5, [
  ['aufwachen', 'to wake up'], ['duschen', 'to shower'], ['sich anziehen', 'to dress'], ['frühstücken', 'to have breakfast'],
  ['zur Arbeit gehen', 'to go to work'], ['Mittag essen', 'to have lunch'], ['nach Hause kommen', 'to come home'], ['fernsehen', 'to watch TV'],
  ['ins Bett gehen', 'to go to bed'], ['die Zähne putzen', 'to brush teeth'], ['sich rasieren', 'to shave'], ['sich schminken', 'to put on makeup'],
  ['die Wäsche waschen', 'to do laundry'], ['staubsaugen', 'to vacuum'], ['abwaschen', 'to wash up'], ['den Tisch decken', 'to set the table'],
  ['einkaufen gehen', 'to go shopping'], ['spazieren gehen', 'to go for a walk'], ['sich ausruhen', 'to rest'], ['aufwachen', 'to awaken'],
]);
const moreAdj = b(6, [
  ['müde', 'weary'], ['wach', 'awake'], ['hungrig', 'hungry'], ['satt', 'full (food)'],
  ['durstig', 'thirsty'], ['betrunken', 'drunk'], ['nüchtern', 'sober'], ['gesund', 'well'],
  ['fit', 'fit'], ['schwanger', 'pregnant'], ['nackt', 'naked'], ['angezogen', 'dressed'],
  ['barfuß', 'barefoot'], ['ordentlich', 'tidy'], ['unordentlich', 'messy'], ['pünktlich', 'punctual'],
  ['verspätet', 'delayed'], ['anwesend', 'present'], ['abwesend', 'absent'], ['lebendig', 'alive'],
  ['tot', 'dead'], ['leer', 'vacant'], ['besetzt', 'occupied'], ['verfügbar', 'available'],
]);
const phrasesEx = b(3, [
  ['guten Morgen', 'good morning'], ['guten Tag', 'good day'], ['guten Abend', 'good evening'], ['gute Nacht', 'good night'],
  ['auf Wiedersehen', 'goodbye'], ['bis später', 'see you later'], ['bis bald', 'see you soon'], ['herzlich willkommen', 'welcome'],
  ['viel Glück', 'good luck'], ['viel Spaß', 'have fun'], ['gute Reise', 'have a good trip'], ['alles Gute', 'all the best'],
  ['keine Ahnung', 'no idea'], ['kein Problem', 'no problem'], ['macht nichts', 'never mind'], ['stimmt', 'that’s right'],
  ['genau', 'exactly'], ['einverstanden', 'agreed'], ['tut mir leid', 'I’m sorry'], ['viel zu tun', 'lots to do'],
]);
const moreNouns2 = b(9, [
  ['der Anlass', 'occasion'], ['das Ereignis', 'event'], ['die Situation', 'situation'], ['die Lage', 'position'],
  ['der Fall', 'case'], ['das Thema', 'topic'], ['der Punkt', 'point'], ['die Frage', 'question / issue'],
  ['die Sorge', 'concern'], ['die Angelegenheit', 'matter'], ['der Bereich', 'area / field'], ['die Richtung', 'direction'],
  ['der Zweck', 'purpose'], ['das Interesse', 'interest'], ['der Nutzen', 'benefit'], ['der Schaden', 'damage'],
  ['die Gefahr', 'danger'], ['das Risiko', 'risk'], ['die Chance', 'chance'], ['der Vorschlag', 'suggestion'],
  ['die Entscheidung', 'decision'], ['die Meinung', 'view'], ['der Standpunkt', 'standpoint'], ['die Absicht', 'purpose'],
]);

const finalBatch = [
  ...b(5, [
    ['der Löffel', 'spoonful'], ['die Prise', 'pinch'], ['die Zutaten', 'ingredients'], ['der Nachtisch', 'dessert'],
    ['die Sahne', 'whipped cream'], ['der Pudding', 'pudding'], ['die Torte', 'gateau'], ['das Brötchen', 'bread roll'],
    ['die Semmel', 'roll'], ['der Toast', 'toast'], ['der Speck', 'bacon'], ['das Rührei', 'scrambled eggs'],
  ]),
  ...b(6, [
    ['der Zimt', 'cinnamon'], ['die Petersilie', 'parsley'], ['das Basilikum', 'basil'], ['der Ingwer', 'ginger'],
    ['die Chili', 'chilli'], ['die Minze', 'mint'], ['der Senf', 'mustard'], ['die Mayonnaise', 'mayonnaise'],
    ['die Soße', 'sauce'], ['die Brühe', 'broth'], ['der Teig', 'dough'], ['die Kruste', 'crust'],
  ]),
  ...b(8, [
    ['die Astronomie', 'astronomy'], ['die Galaxie', 'galaxy'], ['der Komet', 'comet'], ['die Rakete', 'rocket'],
    ['der Satellit', 'satellite'], ['die Schwerkraft', 'gravity'], ['die Umlaufbahn', 'orbit'], ['das Weltall', 'outer space'],
    ['der Mond', 'moon'], ['die Erde', 'Earth'], ['die Sonne', 'the Sun'], ['der Sauerstoff', 'oxygen'],
  ]),
  ...b(7, [
    ['die Mücke', 'gnat'], ['die Wespe', 'wasp'], ['der Schmetterling', 'butterfly'], ['die Raupe', 'caterpillar'],
    ['die Schnecke', 'snail'], ['der Regenwurm', 'earthworm'], ['der Marienkäfer', 'ladybird'], ['die Heuschrecke', 'grasshopper'],
    ['die Fledermaus', 'bat'], ['der Papagei', 'parrot'], ['der Pinguin', 'penguin'], ['das Krokodil', 'crocodile'],
  ]),
  ...b(6, [
    ['golden', 'golden'], ['silbern', 'silver'], ['bunt', 'colourful'], ['hellblau', 'light blue'],
    ['dunkelgrün', 'dark green'], ['türkis', 'turquoise'], ['beige', 'beige'], ['violett', 'violet'],
    ['dritte', 'third'], ['vierte', 'fourth'], ['fünfte', 'fifth'], ['zehnte', 'tenth'],
  ]),
  ...b(9, [
    ['die Empfindung', 'sensation'], ['der Schmerz', 'ache'], ['der Juckreiz', 'itch'], ['der Schwindel', 'dizziness'],
    ['die Übelkeit', 'nausea'], ['die Müdigkeit', 'tiredness'], ['die Wärme', 'warmth'], ['die Kälte', 'coldness'],
    ['die Berührung', 'touch'], ['der Druck', 'pressure'], ['das Kribbeln', 'tingling'], ['die Taubheit', 'numbness'],
  ]),
  ...b(8, [
    ['das Fach', 'school subject'], ['die Geschichte', 'history'], ['die Erdkunde', 'geography'], ['die Kunst', 'art class'],
    ['der Sport', 'PE'], ['die Musik', 'music class'], ['die Informatik', 'computer science'], ['die Wirtschaft', 'economics'],
    ['die Philosophie', 'philosophy'], ['die Psychologie', 'psychology'], ['die Medizin', 'medicine (field)'], ['das Recht', 'law (field)'],
  ]),
];

export const FREQUENCY_WORDS_DE = [
  ...band1, ...band2, ...band3, ...band4, ...band5, ...band6, ...band7, ...band8,
  ...band9, ...band10, ...numbers, ...colours, ...animals, ...techMedia, ...feelings,
  ...abstract, ...moreConnectors,
  ...verbs2, ...professions, ...cityPlaces, ...sports, ...houseTools, ...adverbs2,
  ...timeExtra, ...bodyExtra,
  ...verbs3, ...verbs4, ...verbs5, ...foodEx, ...houseEx, ...natureEx, ...animalsEx,
  ...adjEx, ...adjEx2, ...abstractEx, ...emotionsEx,
  ...businessMoney, ...techScience, ...artsMedia, ...education, ...societyLaw,
  ...healthMed, ...transportEx, ...clothingEx, ...objectsEx, ...communication,
  ...familyRel, ...cityBuild, ...shoppingEx, ...adverbs3, ...verbs6, ...measures,
  ...calendarEx, ...materials, ...directions, ...miscNouns,
  ...verbs7, ...verbs8, ...geography, ...plants, ...kitchenEx, ...hobbies,
  ...adjEx3, ...weatherEx, ...jobsEx, ...bodyEx2, ...mindWords, ...moreNouns,
  ...verbs9, ...officeEx, ...routineEx, ...moreAdj, ...phrasesEx, ...moreNouns2,
  ...finalBatch,
];
