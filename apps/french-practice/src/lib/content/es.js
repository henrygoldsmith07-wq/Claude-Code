// Spanish content core — themed vocab packs and everyday conversation
// scenarios, in the same shape as the French library (the `fr` field holds the
// target-language term), so every screen, the SRS engine, TTS and the AI
// conversation work unchanged.

const w = (id, fr, en, emoji, freq, example, exampleEn, extra = {}) =>
  ({ id, fr, en, emoji, freq, example, exampleEn, syn: [], ant: [], coll: [], note: '', ...extra });

export const ES_VOCAB_PACKS = [
  {
    id: 'es-basics', title: 'Greetings & Basics', description: 'The words you need in the first five minutes.',
    entries: [
      w('es-hola', 'hola', 'hello', '👋', 1, '¡Hola! ¿Qué tal?', 'Hi! How’s it going?'),
      w('es-gracias', 'gracias', 'thank you', '🙏', 1, 'Muchas gracias por todo.', 'Thank you very much for everything.'),
      w('es-porfavor', 'por favor', 'please', '🤲', 1, 'Un café, por favor.', 'A coffee, please.'),
      w('es-si', 'sí', 'yes', '✅', 1, 'Sí, claro.', 'Yes, of course.'),
      w('es-no', 'no', 'no', '❌', 1, 'No, gracias.', 'No, thanks.'),
      w('es-adios', 'adiós', 'goodbye', '👋', 1, '¡Adiós, hasta mañana!', 'Bye, see you tomorrow!'),
      w('es-perdon', 'perdón', 'excuse me / sorry', '🙇', 2, 'Perdón, ¿dónde está la estación?', 'Excuse me, where is the station?'),
      w('es-bien', 'bien', 'well / fine', '👍', 1, 'Estoy muy bien, gracias.', 'I’m very well, thanks.'),
    ],
  },
  {
    id: 'es-people', title: 'People & Pronouns', description: 'Talk about yourself and others.',
    entries: [
      w('es-yo', 'yo', 'I', '🙋', 1, 'Yo me llamo Ana.', 'My name is Ana.'),
      w('es-tu', 'tú', 'you (informal)', '👉', 1, '¿De dónde eres tú?', 'Where are you from?'),
      w('es-usted', 'usted', 'you (formal)', '🎩', 1, '¿Puede usted ayudarme?', 'Can you help me?'),
      w('es-amigo', 'el amigo', 'friend (m)', '🧑', 2, 'Es mi mejor amigo.', 'He’s my best friend.'),
      w('es-familia', 'la familia', 'family', '👨‍👩‍👧', 2, 'Mi familia vive en Madrid.', 'My family lives in Madrid.'),
      w('es-mujer', 'la mujer', 'woman / wife', '👩', 1, 'Esa mujer es mi jefa.', 'That woman is my boss.'),
      w('es-hombre', 'el hombre', 'man', '👨', 1, 'El hombre lee el periódico.', 'The man is reading the newspaper.'),
      w('es-nino', 'el niño', 'child / boy', '🧒', 2, 'El niño juega en el parque.', 'The child is playing in the park.'),
    ],
  },
  {
    id: 'es-food', title: 'Food & Café', description: 'Order, eat and drink with confidence.',
    entries: [
      w('es-agua', 'el agua', 'water', '💧', 1, 'Un vaso de agua, por favor.', 'A glass of water, please.'),
      w('es-cafe', 'el café', 'coffee', '☕', 2, 'Me gusta el café con leche.', 'I like coffee with milk.'),
      w('es-pan', 'el pan', 'bread', '🍞', 2, 'El pan está recién hecho.', 'The bread is freshly made.'),
      w('es-cerveza', 'la cerveza', 'beer', '🍺', 2, 'Dos cervezas, por favor.', 'Two beers, please.'),
      w('es-comida', 'la comida', 'food / lunch', '🍽️', 2, 'La comida está deliciosa.', 'The food is delicious.'),
      w('es-cuenta', 'la cuenta', 'the bill', '🧾', 3, 'La cuenta, por favor.', 'The bill, please.'),
      w('es-rico', 'rico', 'tasty', '😋', 3, '¡Qué rico está el pastel!', 'The cake is so tasty!'),
      w('es-hambre', 'el hambre', 'hunger', '🤤', 3, 'Tengo hambre.', 'I’m hungry.'),
    ],
  },
  {
    id: 'es-travel', title: 'Travel & Getting Around', description: 'Stations, tickets and directions.',
    entries: [
      w('es-estacion', 'la estación', 'station', '🚉', 2, 'La estación está muy cerca.', 'The station is very close.'),
      w('es-tren', 'el tren', 'train', '🚆', 2, 'El tren llega tarde.', 'The train is arriving late.'),
      w('es-billete', 'el billete', 'ticket', '🎫', 3, 'Quiero un billete para Sevilla.', 'I want a ticket to Seville.'),
      w('es-izquierda', 'la izquierda', 'left', '⬅️', 2, 'Gira a la izquierda.', 'Turn left.'),
      w('es-derecha', 'la derecha', 'right', '➡️', 2, 'El banco está a la derecha.', 'The bank is on the right.'),
      w('es-recto', 'todo recto', 'straight ahead', '⬆️', 3, 'Sigue todo recto.', 'Go straight ahead.'),
      w('es-aeropuerto', 'el aeropuerto', 'airport', '✈️', 3, '¿Cómo llego al aeropuerto?', 'How do I get to the airport?'),
      w('es-mapa', 'el mapa', 'map', '🗺️', 2, '¿Tienes un mapa de la ciudad?', 'Do you have a map of the city?'),
    ],
  },
  {
    id: 'es-verbs', title: 'Everyday Verbs', description: 'The verbs you can’t speak without.',
    entries: [
      w('es-ser', 'ser', 'to be (permanent)', '🫥', 1, 'Soy de México.', 'I’m from Mexico.', { note: 'soy, eres, es …' }),
      w('es-estar', 'estar', 'to be (state/place)', '📍', 1, 'Estoy cansado.', 'I’m tired.', { note: 'estoy, estás, está …' }),
      w('es-tener', 'tener', 'to have', '🤲', 1, '¿Tienes tiempo?', 'Do you have time?'),
      w('es-ir', 'ir', 'to go', '🚶', 1, 'Vamos al cine.', 'We’re going to the cinema.'),
      w('es-hacer', 'hacer', 'to do / make', '🔨', 1, '¿Qué haces hoy?', 'What are you doing today?'),
      w('es-querer', 'querer', 'to want', '🙏', 1, 'Quiero ir a casa.', 'I want to go home.'),
      w('es-poder', 'poder', 'can / to be able to', '💪', 1, '¿Puedes ayudarme?', 'Can you help me?'),
      w('es-hablar', 'hablar', 'to speak', '🗣️', 2, '¿Habla usted inglés?', 'Do you speak English?'),
    ],
  },
  {
    id: 'es-time', title: 'Numbers & Time', description: 'Count, tell the time, make plans.',
    entries: [
      w('es-uno', 'uno', 'one', '1️⃣', 1, 'Quiero uno, por favor.', 'I’d like one, please.'),
      w('es-dos', 'dos', 'two', '2️⃣', 1, 'Dos cafés, por favor.', 'Two coffees, please.'),
      w('es-tres', 'tres', 'three', '3️⃣', 1, 'En tres minutos.', 'In three minutes.'),
      w('es-hoy', 'hoy', 'today', '📅', 1, 'Hoy es lunes.', 'Today is Monday.'),
      w('es-manana', 'mañana', 'tomorrow / morning', '🌅', 2, '¡Hasta mañana!', 'See you tomorrow!'),
      w('es-ahora', 'ahora', 'now', '⏱️', 1, 'Tenemos que irnos ahora.', 'We have to leave now.'),
      w('es-hora', 'la hora', 'hour / time', '🕐', 2, '¿Qué hora es?', 'What time is it?'),
      w('es-semana', 'la semana', 'week', '🗓️', 2, 'La próxima semana tengo vacaciones.', 'Next week I’m on holiday.'),
    ],
  },
];

export const ES_SCENARIOS = [
  {
    id: 'es-cafe', title: 'At the Café', setup: 'You walk into a lively café in Madrid and want to order.',
    aiRole: 'You are a friendly but busy barista taking the order.',
    opener: '¡Buenos días! ¿Qué le pongo?', openerTranslation: 'Good morning! What can I get you?',
    curveball: 'the milk for the coffee has just run out',
    staticHints: ['Try: «Un café, por favor.»', 'Ask the price: «¿Cuánto es?»', 'Order food too: «Y una tostada.»'],
  },
  {
    id: 'es-directions', title: 'Asking for Directions', setup: 'You are lost and need to find the station.',
    aiRole: 'You are a helpful passer-by who knows the city well.',
    opener: 'Pareces perdido, ¿te ayudo?', openerTranslation: 'You look lost — can I help you?',
    curveball: 'the direct road is closed for a street festival',
    staticHints: ['Ask: «¿Dónde está la estación?»', 'Say you’re on foot: «Voy a pie.»', 'Thank them: «¡Muchas gracias!»'],
  },
  {
    id: 'es-hotel', title: 'Checking into a Hotel', setup: 'You arrive at your hotel and check in for two nights.',
    aiRole: 'You are the receptionist at the front desk.',
    opener: '¡Bienvenido! ¿Tiene una reserva?', openerTranslation: 'Welcome! Do you have a reservation?',
    curveball: 'the room they booked is not ready yet',
    staticHints: ['Say: «Tengo una habitación reservada.»', 'Give your name: «A nombre de …»', 'Ask about breakfast: «¿A qué hora es el desayuno?»'],
  },
  {
    id: 'es-shopping', title: 'At the Market', setup: 'You are buying fruit and vegetables at a market stall.',
    aiRole: 'You are a cheerful market vendor.',
    opener: '¡Todo fresquito hoy! ¿Qué le apetece?', openerTranslation: 'All fresh today! What would you like?',
    curveball: 'they are out of the oranges you wanted',
    staticHints: ['Ask for a kilo: «Un kilo de tomates, por favor.»', 'Ask the price: «¿Cuánto cuesta?»', 'Say that’s all: «Nada más, gracias.»'],
  },
  {
    id: 'es-smalltalk', title: 'Meeting Someone New', setup: 'You meet a new colleague at a work event.',
    aiRole: 'You are a friendly colleague making small talk.',
    opener: '¡Hola! Creo que aún no nos conocemos.', openerTranslation: 'Hi! I don’t think we’ve met yet.',
    curveball: 'they discover you both support the same football team',
    staticHints: ['Introduce yourself: «Me llamo …»', 'Say where you’re from: «Soy de …»', 'Ask about them: «¿Y a qué te dedicas?»'],
  },
  {
    id: 'es-doctor', title: 'At the Pharmacy', setup: 'You feel unwell and go to a pharmacy for advice.',
    aiRole: 'You are a knowledgeable pharmacist.',
    opener: 'Buenas, ¿en qué puedo ayudarle?', openerTranslation: 'Hello, how can I help you?',
    curveball: 'they ask whether you are allergic to anything',
    staticHints: ['Say what hurts: «Me duele la cabeza.»', 'Ask for something: «¿Tiene algo para esto?»', 'Ask how to take it: «¿Cada cuánto lo tomo?»'],
  },
];
