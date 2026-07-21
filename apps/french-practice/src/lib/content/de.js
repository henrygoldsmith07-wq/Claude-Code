// German content core — themed vocab packs and everyday conversation
// scenarios. The card/scenario shapes match the French library exactly (the
// `fr` field just holds the target-language term), so every screen, the SRS
// engine, TTS and the AI conversation work unchanged.

const w = (id, fr, en, emoji, freq, example, exampleEn, extra = {}) =>
  ({ id, fr, en, emoji, freq, example, exampleEn, syn: [], ant: [], coll: [], note: '', ...extra });

export const DE_VOCAB_PACKS = [
  {
    id: 'de-basics', title: 'Greetings & Basics', description: 'The words you need in the first five minutes.',
    entries: [
      w('de-hallo', 'hallo', 'hello', '👋', 1, 'Hallo, wie geht es dir?', 'Hello, how are you?'),
      w('de-danke', 'danke', 'thank you', '🙏', 1, 'Danke für deine Hilfe!', 'Thanks for your help!'),
      w('de-bitte', 'bitte', 'please / you’re welcome', '🤲', 1, 'Einen Kaffee, bitte.', 'A coffee, please.'),
      w('de-ja', 'ja', 'yes', '✅', 1, 'Ja, gern!', 'Yes, gladly!'),
      w('de-nein', 'nein', 'no', '❌', 1, 'Nein, danke.', 'No, thanks.'),
      w('de-tschuss', 'tschüss', 'bye', '👋', 1, 'Tschüss, bis morgen!', 'Bye, see you tomorrow!'),
      w('de-entschuldigung', 'die Entschuldigung', 'excuse me / sorry', '🙇', 2, 'Entschuldigung, wo ist der Bahnhof?', 'Excuse me, where is the station?'),
      w('de-gut', 'gut', 'good / well', '👍', 1, 'Mir geht es gut, danke.', 'I’m doing well, thanks.'),
    ],
  },
  {
    id: 'de-people', title: 'People & Pronouns', description: 'Talk about yourself and others.',
    entries: [
      w('de-ich', 'ich', 'I', '🙋', 1, 'Ich heiße Anna.', 'My name is Anna.'),
      w('de-du', 'du', 'you (informal)', '👉', 1, 'Woher kommst du?', 'Where are you from?'),
      w('de-sie', 'Sie', 'you (formal)', '🎩', 1, 'Können Sie mir helfen?', 'Can you help me?'),
      w('de-freund', 'der Freund', 'friend (m)', '🧑', 2, 'Er ist mein bester Freund.', 'He is my best friend.'),
      w('de-familie', 'die Familie', 'family', '👨‍👩‍👧', 2, 'Meine Familie wohnt in Berlin.', 'My family lives in Berlin.'),
      w('de-frau', 'die Frau', 'woman / wife', '👩', 1, 'Die Frau dort ist meine Chefin.', 'The woman over there is my boss.'),
      w('de-mann', 'der Mann', 'man / husband', '👨', 1, 'Der Mann liest eine Zeitung.', 'The man is reading a newspaper.'),
      w('de-kind', 'das Kind', 'child', '🧒', 2, 'Das Kind spielt im Park.', 'The child is playing in the park.'),
    ],
  },
  {
    id: 'de-food', title: 'Food & Café', description: 'Order, eat and drink with confidence.',
    entries: [
      w('de-wasser', 'das Wasser', 'water', '💧', 1, 'Ein Glas Wasser, bitte.', 'A glass of water, please.'),
      w('de-kaffee', 'der Kaffee', 'coffee', '☕', 2, 'Ich trinke gern Kaffee.', 'I like drinking coffee.'),
      w('de-brot', 'das Brot', 'bread', '🍞', 2, 'Das Brot ist noch warm.', 'The bread is still warm.'),
      w('de-bier', 'das Bier', 'beer', '🍺', 2, 'Zwei Bier, bitte!', 'Two beers, please!'),
      w('de-essen', 'das Essen', 'food / meal', '🍽️', 2, 'Das Essen schmeckt sehr gut.', 'The food tastes very good.'),
      w('de-rechnung', 'die Rechnung', 'the bill', '🧾', 3, 'Die Rechnung, bitte.', 'The bill, please.'),
      w('de-lecker', 'lecker', 'tasty', '😋', 3, 'Der Kuchen ist lecker!', 'The cake is tasty!'),
      w('de-hunger', 'der Hunger', 'hunger', '🤤', 3, 'Ich habe Hunger.', 'I’m hungry.'),
    ],
  },
  {
    id: 'de-travel', title: 'Travel & Getting Around', description: 'Stations, tickets and directions.',
    entries: [
      w('de-bahnhof', 'der Bahnhof', 'train station', '🚉', 2, 'Der Bahnhof ist gleich um die Ecke.', 'The station is just around the corner.'),
      w('de-zug', 'der Zug', 'train', '🚆', 2, 'Der Zug hat Verspätung.', 'The train is delayed.'),
      w('de-fahrkarte', 'die Fahrkarte', 'ticket', '🎫', 3, 'Ich möchte eine Fahrkarte nach München.', 'I’d like a ticket to Munich.'),
      w('de-links', 'links', 'left', '⬅️', 2, 'Gehen Sie nach links.', 'Go to the left.'),
      w('de-rechts', 'rechts', 'right', '➡️', 2, 'Die Bank ist rechts.', 'The bank is on the right.'),
      w('de-geradeaus', 'geradeaus', 'straight ahead', '⬆️', 3, 'Immer geradeaus, dann links.', 'Straight ahead, then left.'),
      w('de-flughafen', 'der Flughafen', 'airport', '✈️', 3, 'Wie komme ich zum Flughafen?', 'How do I get to the airport?'),
      w('de-karte', 'die Karte', 'map / card', '🗺️', 2, 'Hast du eine Karte der Stadt?', 'Do you have a map of the city?'),
    ],
  },
  {
    id: 'de-verbs', title: 'Everyday Verbs', description: 'The verbs you can’t speak without.',
    entries: [
      w('de-sein', 'sein', 'to be', '🫥', 1, 'Ich bin müde.', 'I am tired.', { note: 'ich bin, du bist, er ist …' }),
      w('de-haben', 'haben', 'to have', '🤲', 1, 'Hast du Zeit?', 'Do you have time?', { note: 'ich habe, du hast, er hat …' }),
      w('de-gehen', 'gehen', 'to go', '🚶', 1, 'Wir gehen ins Kino.', 'We’re going to the cinema.'),
      w('de-machen', 'machen', 'to do / make', '🔨', 1, 'Was machst du heute?', 'What are you doing today?'),
      w('de-kommen', 'kommen', 'to come', '👋', 1, 'Ich komme aus Spanien.', 'I come from Spain.'),
      w('de-wollen', 'wollen', 'to want', '🙏', 1, 'Ich will nach Hause.', 'I want to go home.'),
      w('de-koennen', 'können', 'can / to be able to', '💪', 1, 'Kannst du mir helfen?', 'Can you help me?'),
      w('de-sprechen', 'sprechen', 'to speak', '🗣️', 2, 'Sprechen Sie Englisch?', 'Do you speak English?'),
    ],
  },
  {
    id: 'de-time', title: 'Numbers & Time', description: 'Count, tell the time, make plans.',
    entries: [
      w('de-eins', 'eins', 'one', '1️⃣', 1, 'Ich hätte gern eins.', 'I’d like one.'),
      w('de-zwei', 'zwei', 'two', '2️⃣', 1, 'Zwei Kaffee, bitte.', 'Two coffees, please.'),
      w('de-drei', 'drei', 'three', '3️⃣', 1, 'In drei Minuten.', 'In three minutes.'),
      w('de-heute', 'heute', 'today', '📅', 1, 'Heute ist Montag.', 'Today is Monday.'),
      w('de-morgen', 'morgen', 'tomorrow / morning', '🌅', 2, 'Bis morgen!', 'See you tomorrow!'),
      w('de-jetzt', 'jetzt', 'now', '⏱️', 1, 'Wir müssen jetzt gehen.', 'We have to go now.'),
      w('de-uhr', 'die Uhr', 'clock / o’clock', '🕐', 2, 'Es ist drei Uhr.', 'It’s three o’clock.'),
      w('de-woche', 'die Woche', 'week', '🗓️', 2, 'Nächste Woche habe ich frei.', 'Next week I’m off.'),
    ],
  },
];

export const DE_SCENARIOS = [
  {
    id: 'de-cafe', title: 'At the Café', setup: 'You walk into a busy Berlin café and want to order.',
    aiRole: 'You are a friendly but busy barista taking the order.',
    opener: 'Guten Tag! Was darf es sein?', openerTranslation: 'Hello! What would you like?',
    curveball: 'the milk for the coffee has just run out',
    staticHints: ['Try: «Einen Kaffee, bitte.»', 'Ask the price: «Was kostet das?»', 'Order something to eat too: «Und ein Stück Kuchen.»'],
  },
  {
    id: 'de-directions', title: 'Asking for Directions', setup: 'You are lost and need to find the train station.',
    aiRole: 'You are a helpful passer-by who knows the city well.',
    opener: 'Sie sehen verloren aus — kann ich Ihnen helfen?', openerTranslation: 'You look lost — can I help you?',
    curveball: 'the direct road is closed for construction',
    staticHints: ['Ask: «Wo ist der Bahnhof?»', 'Say you’re on foot: «Ich bin zu Fuß.»', 'Thank them: «Vielen Dank!»'],
  },
  {
    id: 'de-hotel', title: 'Checking into a Hotel', setup: 'You arrive at your hotel and check in for two nights.',
    aiRole: 'You are the receptionist at the front desk.',
    opener: 'Willkommen! Haben Sie eine Reservierung?', openerTranslation: 'Welcome! Do you have a reservation?',
    curveball: 'the room they booked is not ready yet',
    staticHints: ['Say: «Ich habe ein Zimmer reserviert.»', 'Give your name: «Auf den Namen …»', 'Ask about breakfast: «Wann gibt es Frühstück?»'],
  },
  {
    id: 'de-shopping', title: 'At the Market', setup: 'You are buying fruit and vegetables at a weekly market.',
    aiRole: 'You are a cheerful market vendor.',
    opener: 'Frisch heute Morgen geerntet! Was möchten Sie?', openerTranslation: 'Freshly picked this morning! What would you like?',
    curveball: 'they are out of the apples you wanted',
    staticHints: ['Ask for a kilo: «Ein Kilo Tomaten, bitte.»', 'Ask the price: «Wie viel kostet das?»', 'Say that’s all: «Das ist alles, danke.»'],
  },
  {
    id: 'de-smalltalk', title: 'Meeting Someone New', setup: 'You meet a new colleague at a work event.',
    aiRole: 'You are a friendly colleague making small talk.',
    opener: 'Hallo! Ich glaube, wir kennen uns noch nicht.', openerTranslation: 'Hi! I don’t think we’ve met yet.',
    curveball: 'they discover you both grew up in the same city',
    staticHints: ['Introduce yourself: «Ich heiße …»', 'Say where you’re from: «Ich komme aus …»', 'Ask about them: «Und was machen Sie beruflich?»'],
  },
  {
    id: 'de-doctor', title: 'At the Pharmacy', setup: 'You feel unwell and go to a pharmacy for advice.',
    aiRole: 'You are a knowledgeable pharmacist.',
    opener: 'Guten Tag, wie kann ich Ihnen helfen?', openerTranslation: 'Hello, how can I help you?',
    curveball: 'they ask whether you are allergic to anything',
    staticHints: ['Say what hurts: «Ich habe Kopfschmerzen.»', 'Ask for something: «Haben Sie etwas dagegen?»', 'Ask how to take it: «Wie oft soll ich das nehmen?»'],
  },
];
