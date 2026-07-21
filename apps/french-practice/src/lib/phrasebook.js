// Essential travel phrasebook, grouped by situation, in French, German and
// Spanish. Authored and self-contained — the `getPhrasebook()` accessor
// follows the active content language so the tool switches with the app.
// Each phrase: { fr: target-language text, en: English }.

import { contentLang } from './content/active';

const p = (fr, en) => ({ fr, en });

const FR_PHRASEBOOK = [
  {
    id: 'essentials', title: 'Essentials', emoji: '✨',
    phrases: [
      p('Bonjour, comment allez-vous ?', 'Hello, how are you?'),
      p('Excusez-moi, pouvez-vous m’aider ?', 'Excuse me, can you help me?'),
      p('Je ne comprends pas.', 'I don’t understand.'),
      p('Pouvez-vous répéter, s’il vous plaît ?', 'Can you repeat that, please?'),
      p('Parlez-vous anglais ?', 'Do you speak English?'),
      p('Merci beaucoup !', 'Thank you very much!'),
    ],
  },
  {
    id: 'directions', title: 'Getting around', emoji: '🧭',
    phrases: [
      p('Où est la gare, s’il vous plaît ?', 'Where is the station, please?'),
      p('C’est loin d’ici ?', 'Is it far from here?'),
      p('Je voudrais un billet pour Paris.', 'I’d like a ticket to Paris.'),
      p('À quelle heure part le train ?', 'What time does the train leave?'),
      p('Tournez à gauche, puis tout droit.', 'Turn left, then straight ahead.'),
    ],
  },
  {
    id: 'eating', title: 'Eating out', emoji: '🍽️',
    phrases: [
      p('Une table pour deux, s’il vous plaît.', 'A table for two, please.'),
      p('Qu’est-ce que vous recommandez ?', 'What do you recommend?'),
      p('Je voudrais commander, s’il vous plaît.', 'I’d like to order, please.'),
      p('L’addition, s’il vous plaît.', 'The bill, please.'),
      p('C’était délicieux, merci.', 'That was delicious, thank you.'),
    ],
  },
  {
    id: 'shopping', title: 'Shopping', emoji: '🛍️',
    phrases: [
      p('Combien ça coûte ?', 'How much does it cost?'),
      p('Est-ce que je peux payer par carte ?', 'Can I pay by card?'),
      p('Avez-vous une taille plus grande ?', 'Do you have a bigger size?'),
      p('Je regarde seulement, merci.', 'I’m just looking, thanks.'),
    ],
  },
  {
    id: 'emergency', title: 'Emergencies', emoji: '🆘',
    phrases: [
      p('Au secours !', 'Help!'),
      p('J’ai besoin d’un médecin.', 'I need a doctor.'),
      p('Appelez la police, s’il vous plaît.', 'Call the police, please.'),
      p('J’ai perdu mon passeport.', 'I’ve lost my passport.'),
      p('Je ne me sens pas bien.', 'I don’t feel well.'),
    ],
  },
  {
    id: 'smalltalk', title: 'Small talk', emoji: '💬',
    phrases: [
      p('Je m’appelle…', 'My name is…'),
      p('Je viens d’Angleterre.', 'I’m from England.'),
      p('Qu’est-ce que vous faites dans la vie ?', 'What do you do for a living?'),
      p('Ça me fait plaisir de vous rencontrer.', 'It’s a pleasure to meet you.'),
      p('À bientôt !', 'See you soon!'),
    ],
  },
];

const DE_PHRASEBOOK = [
  {
    id: 'essentials', title: 'Essentials', emoji: '✨',
    phrases: [
      p('Hallo, wie geht es Ihnen?', 'Hello, how are you?'),
      p('Entschuldigung, können Sie mir helfen?', 'Excuse me, can you help me?'),
      p('Ich verstehe nicht.', 'I don’t understand.'),
      p('Können Sie das bitte wiederholen?', 'Can you repeat that, please?'),
      p('Sprechen Sie Englisch?', 'Do you speak English?'),
      p('Vielen Dank!', 'Thank you very much!'),
    ],
  },
  {
    id: 'directions', title: 'Getting around', emoji: '🧭',
    phrases: [
      p('Wo ist der Bahnhof, bitte?', 'Where is the station, please?'),
      p('Ist es weit von hier?', 'Is it far from here?'),
      p('Ich möchte eine Fahrkarte nach Berlin.', 'I’d like a ticket to Berlin.'),
      p('Wann fährt der Zug ab?', 'What time does the train leave?'),
      p('Biegen Sie links ab, dann geradeaus.', 'Turn left, then straight ahead.'),
    ],
  },
  {
    id: 'eating', title: 'Eating out', emoji: '🍽️',
    phrases: [
      p('Einen Tisch für zwei, bitte.', 'A table for two, please.'),
      p('Was empfehlen Sie?', 'What do you recommend?'),
      p('Ich möchte bestellen, bitte.', 'I’d like to order, please.'),
      p('Die Rechnung, bitte.', 'The bill, please.'),
      p('Das war köstlich, danke.', 'That was delicious, thank you.'),
    ],
  },
  {
    id: 'shopping', title: 'Shopping', emoji: '🛍️',
    phrases: [
      p('Wie viel kostet das?', 'How much does it cost?'),
      p('Kann ich mit Karte zahlen?', 'Can I pay by card?'),
      p('Haben Sie eine größere Größe?', 'Do you have a bigger size?'),
      p('Ich schaue nur, danke.', 'I’m just looking, thanks.'),
    ],
  },
  {
    id: 'emergency', title: 'Emergencies', emoji: '🆘',
    phrases: [
      p('Hilfe!', 'Help!'),
      p('Ich brauche einen Arzt.', 'I need a doctor.'),
      p('Rufen Sie bitte die Polizei.', 'Call the police, please.'),
      p('Ich habe meinen Pass verloren.', 'I’ve lost my passport.'),
      p('Mir geht es nicht gut.', 'I don’t feel well.'),
    ],
  },
  {
    id: 'smalltalk', title: 'Small talk', emoji: '💬',
    phrases: [
      p('Ich heiße…', 'My name is…'),
      p('Ich komme aus England.', 'I’m from England.'),
      p('Was machen Sie beruflich?', 'What do you do for a living?'),
      p('Es freut mich, Sie kennenzulernen.', 'It’s a pleasure to meet you.'),
      p('Bis bald!', 'See you soon!'),
    ],
  },
];

const ES_PHRASEBOOK = [
  {
    id: 'essentials', title: 'Essentials', emoji: '✨',
    phrases: [
      p('Hola, ¿cómo está usted?', 'Hello, how are you?'),
      p('Perdone, ¿puede ayudarme?', 'Excuse me, can you help me?'),
      p('No entiendo.', 'I don’t understand.'),
      p('¿Puede repetirlo, por favor?', 'Can you repeat that, please?'),
      p('¿Habla inglés?', 'Do you speak English?'),
      p('¡Muchas gracias!', 'Thank you very much!'),
    ],
  },
  {
    id: 'directions', title: 'Getting around', emoji: '🧭',
    phrases: [
      p('¿Dónde está la estación, por favor?', 'Where is the station, please?'),
      p('¿Está lejos de aquí?', 'Is it far from here?'),
      p('Quiero un billete para Madrid.', 'I’d like a ticket to Madrid.'),
      p('¿A qué hora sale el tren?', 'What time does the train leave?'),
      p('Gire a la izquierda y siga recto.', 'Turn left, then straight ahead.'),
    ],
  },
  {
    id: 'eating', title: 'Eating out', emoji: '🍽️',
    phrases: [
      p('Una mesa para dos, por favor.', 'A table for two, please.'),
      p('¿Qué me recomienda?', 'What do you recommend?'),
      p('Quiero pedir, por favor.', 'I’d like to order, please.'),
      p('La cuenta, por favor.', 'The bill, please.'),
      p('Estaba delicioso, gracias.', 'That was delicious, thank you.'),
    ],
  },
  {
    id: 'shopping', title: 'Shopping', emoji: '🛍️',
    phrases: [
      p('¿Cuánto cuesta?', 'How much does it cost?'),
      p('¿Puedo pagar con tarjeta?', 'Can I pay by card?'),
      p('¿Tiene una talla más grande?', 'Do you have a bigger size?'),
      p('Solo estoy mirando, gracias.', 'I’m just looking, thanks.'),
    ],
  },
  {
    id: 'emergency', title: 'Emergencies', emoji: '🆘',
    phrases: [
      p('¡Socorro!', 'Help!'),
      p('Necesito un médico.', 'I need a doctor.'),
      p('Llame a la policía, por favor.', 'Call the police, please.'),
      p('He perdido mi pasaporte.', 'I’ve lost my passport.'),
      p('No me siento bien.', 'I don’t feel well.'),
    ],
  },
  {
    id: 'smalltalk', title: 'Small talk', emoji: '💬',
    phrases: [
      p('Me llamo…', 'My name is…'),
      p('Soy de Inglaterra.', 'I’m from England.'),
      p('¿A qué se dedica?', 'What do you do for a living?'),
      p('Encantado de conocerle.', 'It’s a pleasure to meet you.'),
      p('¡Hasta pronto!', 'See you soon!'),
    ],
  },
];

const BY_LANG = { fr: FR_PHRASEBOOK, de: DE_PHRASEBOOK, es: ES_PHRASEBOOK };

export const getPhrasebook = () => BY_LANG[contentLang()] || FR_PHRASEBOOK;
