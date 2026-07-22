// High-frequency Spanish dictionary — the Spanish core lexicon, mirroring the
// French frequency.js in shape ({ fr, en, rank }, where `fr` holds the Spanish
// term). Feeds the frequency vocab decks, the SRS engine and the offline
// dictionary for Spanish learners. Authored and self-contained; rank is a
// coarse frequency band (1 = most common … 10 = still useful but rarer).

const b = (rank, pairs) => pairs.map(([fr, en]) => ({ fr, en, rank }));

// ── Band 1 — grammatical core: articles, pronouns, top prepositions ──────────
const band1 = b(1, [
  ['el / la', 'the'], ['los / las', 'the (plural)'], ['un / una', 'a / an'], ['unos / unas', 'some'],
  ['y', 'and'], ['o', 'or'], ['pero', 'but'], ['que', 'that / which'], ['porque', 'because'],
  ['si', 'if'], ['yo', 'I'], ['tú', 'you (informal)'], ['él', 'he'], ['ella', 'she'],
  ['nosotros', 'we'], ['vosotros', 'you (pl.)'], ['ellos', 'they'], ['usted', 'you (formal)'],
  ['me', 'me'], ['te', 'you'], ['se', 'oneself'], ['nos', 'us'], ['le', 'to him/her'],
  ['lo', 'it / him'], ['mi', 'my'], ['tu', 'your'], ['su', 'his / her / their'], ['nuestro', 'our'],
  ['en', 'in / on'], ['a', 'to / at'], ['de', 'of / from'], ['con', 'with'], ['por', 'by / for'],
  ['para', 'for / to'], ['sin', 'without'], ['sobre', 'on / about'], ['entre', 'between'],
  ['hasta', 'until'], ['desde', 'from / since'], ['hacia', 'towards'], ['durante', 'during'],
  ['no', 'no / not'], ['este', 'this'], ['ese', 'that'], ['cuál', 'which'], ['más', 'more'],
]);

// ── Band 2 — top verbs ───────────────────────────────────────────────────────
const band2 = b(2, [
  ['ser', 'to be (permanent)'], ['estar', 'to be (state)'], ['haber', 'to have (aux.)'], ['tener', 'to have'],
  ['hacer', 'to do / make'], ['poder', 'to be able to'], ['decir', 'to say'], ['ir', 'to go'],
  ['ver', 'to see'], ['dar', 'to give'], ['saber', 'to know'], ['querer', 'to want'],
  ['llegar', 'to arrive'], ['pasar', 'to pass / happen'], ['deber', 'must / to owe'], ['poner', 'to put'],
  ['parecer', 'to seem'], ['quedar', 'to stay / remain'], ['creer', 'to believe'], ['hablar', 'to speak'],
  ['llevar', 'to carry / wear'], ['dejar', 'to leave / let'], ['seguir', 'to follow / continue'], ['encontrar', 'to find'],
  ['llamar', 'to call'], ['venir', 'to come'], ['pensar', 'to think'], ['salir', 'to leave / go out'],
  ['volver', 'to return'], ['tomar', 'to take'], ['conocer', 'to know (people)'], ['vivir', 'to live'],
]);

// ── Band 3 — adverbs, question words, more function words ─────────────────────
const band3 = b(3, [
  ['también', 'also'], ['ya', 'already / now'], ['todavía', 'still / yet'], ['solo', 'only'],
  ['siempre', 'always'], ['muy', 'very'], ['aquí', 'here'], ['allí', 'there'],
  ['ahora', 'now'], ['luego', 'then / later'], ['hoy', 'today'], ['mañana', 'tomorrow'],
  ['ayer', 'yesterday'], ['otra vez', 'again'], ['a menudo', 'often'], ['a veces', 'sometimes'],
  ['nunca', 'never'], ['quizás', 'maybe'], ['claro', 'of course'], ['de verdad', 'really'],
  ['bien', 'well'], ['mal', 'badly'], ['juntos', 'together'], ['solo', 'alone'],
  ['quién', 'who'], ['qué', 'what'], ['dónde', 'where'], ['cuándo', 'when'], ['por qué', 'why'],
  ['cómo', 'how'], ['cuánto', 'how much'], ['sí', 'yes'], ['no', 'no'], ['por favor', 'please'],
  ['gracias', 'thanks'], ['tal vez', 'perhaps'], ['bastante', 'quite'], ['casi', 'almost'],
  ['suficiente', 'enough'], ['demasiado', 'too much'], ['muy bien', 'very well'],
]);

// ── Band 4 — people, time, everyday nouns ────────────────────────────────────
const band4 = b(4, [
  ['el hombre', 'man'], ['la mujer', 'woman'], ['el niño', 'child / boy'], ['la niña', 'girl'],
  ['la gente', 'people'], ['el amigo', 'friend (m)'], ['la amiga', 'friend (f)'], ['la familia', 'family'],
  ['la madre', 'mother'], ['el padre', 'father'], ['el hijo', 'son'], ['la hija', 'daughter'],
  ['el hermano', 'brother'], ['la hermana', 'sister'], ['el bebé', 'baby'], ['el nombre', 'name'],
  ['el tiempo', 'time / weather'], ['el día', 'day'], ['la noche', 'night'], ['la hora', 'hour'],
  ['el minuto', 'minute'], ['la semana', 'week'], ['el mes', 'month'], ['el año', 'year'],
  ['la mañana', 'morning'], ['la tarde', 'afternoon'], ['el momento', 'moment'], ['el reloj', 'clock / watch'],
  ['la vida', 'life'], ['el mundo', 'world'], ['el país', 'country'], ['la ciudad', 'city'],
  ['el pueblo', 'town / village'], ['el lugar', 'place'], ['la cosa', 'thing'], ['el modo', 'way / manner'],
  ['la palabra', 'word'], ['la pregunta', 'question'], ['la respuesta', 'answer'], ['el problema', 'problem'],
  ['la idea', 'idea'], ['la razón', 'reason'], ['el ejemplo', 'example'], ['la parte', 'part'],
]);

// ── Band 5 — home & food ─────────────────────────────────────────────────────
const band5 = b(5, [
  ['la casa', 'house / home'], ['el piso', 'flat / apartment'], ['la habitación', 'room'], ['la cocina', 'kitchen'],
  ['el baño', 'bathroom'], ['el dormitorio', 'bedroom'], ['la puerta', 'door'], ['la ventana', 'window'],
  ['la mesa', 'table'], ['la silla', 'chair'], ['la cama', 'bed'], ['el sofá', 'sofa'],
  ['el armario', 'wardrobe'], ['la lámpara', 'lamp'], ['el suelo', 'floor'], ['la pared', 'wall'],
  ['el jardín', 'garden'], ['la llave', 'key'], ['la comida', 'food / meal'], ['el desayuno', 'breakfast'],
  ['el almuerzo', 'lunch'], ['la cena', 'dinner'], ['el pan', 'bread'], ['la mantequilla', 'butter'],
  ['el queso', 'cheese'], ['el huevo', 'egg'], ['la carne', 'meat'], ['el pescado', 'fish'],
  ['la verdura', 'vegetable'], ['la fruta', 'fruit'], ['la manzana', 'apple'], ['la patata', 'potato'],
  ['el arroz', 'rice'], ['la sopa', 'soup'], ['el azúcar', 'sugar'], ['la sal', 'salt'],
  ['el agua', 'water'], ['el café', 'coffee'], ['el té', 'tea'], ['la leche', 'milk'],
  ['el zumo', 'juice'], ['la cerveza', 'beer'], ['el vino', 'wine'], ['el plato', 'plate / dish'],
  ['el vaso', 'glass'], ['la taza', 'cup'], ['el cuchillo', 'knife'], ['el tenedor', 'fork'],
  ['la cuchara', 'spoon'], ['la botella', 'bottle'],
]);

// ── Band 6 — body, health, clothing ──────────────────────────────────────────
const band6 = b(6, [
  ['el cuerpo', 'body'], ['la cabeza', 'head'], ['la cara', 'face'], ['el ojo', 'eye'],
  ['la oreja', 'ear'], ['la nariz', 'nose'], ['la boca', 'mouth'], ['el diente', 'tooth'],
  ['el pelo', 'hair'], ['el cuello', 'neck'], ['la mano', 'hand'], ['el brazo', 'arm'],
  ['el dedo', 'finger'], ['la pierna', 'leg'], ['el pie', 'foot'], ['el corazón', 'heart'],
  ['la espalda', 'back'], ['el estómago', 'stomach'], ['la salud', 'health'], ['el médico', 'doctor'],
  ['el hospital', 'hospital'], ['la enfermedad', 'illness'], ['el dolor', 'pain'], ['la fiebre', 'fever'],
  ['la medicina', 'medicine'], ['enfermo', 'ill'], ['sano', 'healthy'], ['cansado', 'tired'],
  ['la ropa', 'clothing'], ['la camisa', 'shirt'], ['el pantalón', 'trousers'], ['el vestido', 'dress'],
  ['la falda', 'skirt'], ['la chaqueta', 'jacket'], ['el abrigo', 'coat'], ['el jersey', 'sweater'],
  ['los zapatos', 'shoes'], ['el calcetín', 'sock'], ['el sombrero', 'hat'], ['las gafas', 'glasses'],
]);

// ── Band 7 — work, school, money ─────────────────────────────────────────────
const band7 = b(7, [
  ['el trabajo', 'work'], ['el empleo', 'job'], ['la profesión', 'profession'], ['la oficina', 'office'],
  ['la empresa', 'company'], ['el jefe', 'boss'], ['el compañero', 'colleague'], ['la tarea', 'task'],
  ['el proyecto', 'project'], ['la reunión', 'meeting'], ['la cita', 'appointment'], ['el ordenador', 'computer'],
  ['el móvil', 'mobile phone'], ['el teléfono', 'telephone'], ['el correo', 'email / mail'], ['internet', 'internet'],
  ['la escuela', 'school'], ['la universidad', 'university'], ['el profesor', 'teacher'], ['el alumno', 'pupil'],
  ['el estudiante', 'student'], ['la clase', 'class'], ['el examen', 'exam'], ['el libro', 'book'],
  ['el cuaderno', 'notebook'], ['el bolígrafo', 'pen'], ['el papel', 'paper'], ['la nota', 'grade / note'],
  ['aprender', 'to learn'], ['estudiar', 'to study'], ['el dinero', 'money'], ['el euro', 'euro'],
  ['el banco', 'bank'], ['el precio', 'price'], ['la cuenta', 'bill / account'], ['caro', 'expensive'],
  ['barato', 'cheap'], ['pagar', 'to pay'], ['comprar', 'to buy'], ['vender', 'to sell'],
]);

// ── Band 8 — travel, city, nature ────────────────────────────────────────────
const band8 = b(8, [
  ['el viaje', 'trip'], ['las vacaciones', 'holidays'], ['el tren', 'train'], ['la estación', 'station'],
  ['el autobús', 'bus'], ['el coche', 'car'], ['la bicicleta', 'bicycle'], ['el avión', 'plane'],
  ['el aeropuerto', 'airport'], ['el billete', 'ticket'], ['la calle', 'street'], ['el camino', 'way / path'],
  ['el puente', 'bridge'], ['la plaza', 'square'], ['la esquina', 'corner'], ['el hotel', 'hotel'],
  ['el mapa', 'map'], ['la izquierda', 'left'], ['la derecha', 'right'], ['recto', 'straight ahead'],
  ['la naturaleza', 'nature'], ['el árbol', 'tree'], ['la flor', 'flower'], ['el bosque', 'forest'],
  ['la montaña', 'mountain'], ['el río', 'river'], ['el lago', 'lake'], ['el mar', 'sea'],
  ['la playa', 'beach'], ['el sol', 'sun'], ['la luna', 'moon'], ['el cielo', 'sky'],
  ['la nube', 'cloud'], ['la lluvia', 'rain'], ['la nieve', 'snow'], ['el viento', 'wind'],
  ['el clima', 'climate / weather'], ['el aire', 'air'], ['el fuego', 'fire'], ['la tierra', 'earth / land'],
]);

// ── Band 9 — common adjectives ───────────────────────────────────────────────
const band9 = b(9, [
  ['grande', 'big'], ['pequeño', 'small'], ['nuevo', 'new'], ['viejo', 'old'],
  ['joven', 'young'], ['largo', 'long'], ['corto', 'short'], ['alto', 'tall / high'],
  ['bajo', 'low / short'], ['rápido', 'fast'], ['lento', 'slow'], ['temprano', 'early'],
  ['tarde', 'late'], ['bueno', 'good'], ['malo', 'bad'], ['bonito', 'pretty'],
  ['feo', 'ugly'], ['fácil', 'easy'], ['difícil', 'difficult'], ['ligero', 'light'],
  ['importante', 'important'], ['correcto', 'correct'], ['pesado', 'heavy'], ['seguro', 'safe / sure'],
  ['posible', 'possible'], ['necesario', 'necessary'], ['lleno', 'full'], ['vacío', 'empty'],
  ['caliente', 'hot'], ['frío', 'cold'], ['templado', 'warm'], ['mojado', 'wet'],
  ['seco', 'dry'], ['limpio', 'clean'], ['sucio', 'dirty'], ['tranquilo', 'calm'],
  ['ruidoso', 'noisy'], ['fuerte', 'strong'], ['débil', 'weak'], ['rico', 'rich / tasty'],
  ['pobre', 'poor'], ['feliz', 'happy'], ['triste', 'sad'], ['libre', 'free'],
]);

// ── Band 10 — more everyday verbs ────────────────────────────────────────────
const band10 = b(10, [
  ['comer', 'to eat'], ['beber', 'to drink'], ['dormir', 'to sleep'], ['levantarse', 'to get up'],
  ['trabajar', 'to work'], ['jugar', 'to play'], ['correr', 'to run'], ['conducir', 'to drive'],
  ['volar', 'to fly'], ['cocinar', 'to cook'], ['ayudar', 'to help'], ['amar', 'to love'],
  ['escuchar', 'to listen'], ['oír', 'to hear'], ['leer', 'to read'], ['escribir', 'to write'],
  ['mostrar', 'to show'], ['abrir', 'to open'], ['cerrar', 'to close'], ['empezar', 'to begin'],
  ['terminar', 'to finish'], ['esperar', 'to wait / hope'], ['buscar', 'to look for'], ['perder', 'to lose'],
  ['ganar', 'to win / earn'], ['olvidar', 'to forget'], ['recordar', 'to remember'], ['entender', 'to understand'],
  ['explicar', 'to explain'], ['reír', 'to laugh'], ['llorar', 'to cry'], ['cantar', 'to sing'],
  ['bailar', 'to dance'], ['viajar', 'to travel'], ['visitar', 'to visit'], ['comprar', 'to buy'],
  ['pedir', 'to ask for / order'], ['probar', 'to try / taste'], ['usar', 'to use'], ['cambiar', 'to change'],
]);

// ── Themed extras ────────────────────────────────────────────────────────────
const numbers = b(3, [
  ['cero', 'zero'], ['uno', 'one'], ['dos', 'two'], ['tres', 'three'], ['cuatro', 'four'],
  ['cinco', 'five'], ['seis', 'six'], ['siete', 'seven'], ['ocho', 'eight'], ['nueve', 'nine'],
  ['diez', 'ten'], ['once', 'eleven'], ['doce', 'twelve'], ['veinte', 'twenty'], ['treinta', 'thirty'],
  ['cien', 'hundred'], ['mil', 'thousand'], ['primero', 'first'], ['segundo', 'second'], ['último', 'last'],
]);
const colours = b(6, [
  ['el color', 'colour'], ['rojo', 'red'], ['azul', 'blue'], ['verde', 'green'], ['amarillo', 'yellow'],
  ['negro', 'black'], ['blanco', 'white'], ['gris', 'grey'], ['marrón', 'brown'], ['naranja', 'orange'],
  ['rosa', 'pink'], ['morado', 'purple'],
]);
const animals = b(8, [
  ['el animal', 'animal'], ['el perro', 'dog'], ['el gato', 'cat'], ['el caballo', 'horse'],
  ['la vaca', 'cow'], ['el cerdo', 'pig'], ['la oveja', 'sheep'], ['la gallina', 'hen'],
  ['el pájaro', 'bird'], ['el pez', 'fish'], ['el ratón', 'mouse'], ['el oso', 'bear'],
  ['el león', 'lion'], ['el elefante', 'elephant'], ['la araña', 'spider'], ['la abeja', 'bee'],
]);
const techMedia = b(8, [
  ['la televisión', 'television'], ['la película', 'film'], ['la música', 'music'], ['la canción', 'song'],
  ['la radio', 'radio'], ['el periódico', 'newspaper'], ['el mensaje', 'message'], ['la foto', 'photo'],
  ['la cámara', 'camera'], ['el juego', 'game'], ['la aplicación', 'app'], ['el archivo', 'file'],
  ['el programa', 'program'], ['la página web', 'website'], ['la contraseña', 'password'],
]);
const feelings = b(7, [
  ['el sentimiento', 'feeling'], ['el amor', 'love'], ['el miedo', 'fear'], ['la alegría', 'joy'],
  ['la rabia', 'anger'], ['la esperanza', 'hope'], ['la diversión', 'fun'], ['la preocupación', 'worry'],
  ['contento', 'glad'], ['enfadado', 'angry'], ['nervioso', 'nervous'], ['tranquilo', 'calm'],
  ['orgulloso', 'proud'], ['sorprendido', 'surprised'], ['aburrido', 'bored'], ['interesante', 'interesting'],
]);
const abstract = b(9, [
  ['la verdad', 'truth'], ['la libertad', 'freedom'], ['el poder', 'power'], ['el derecho', 'right / law'],
  ['la posibilidad', 'possibility'], ['la realidad', 'reality'], ['el pensamiento', 'thought'], ['la emoción', 'emotion'],
  ['el sentido', 'sense / meaning'], ['el objetivo', 'goal'], ['la opinión', 'opinion'], ['la experiencia', 'experience'],
  ['el éxito', 'success'], ['el error', 'mistake'], ['el peligro', 'danger'], ['la oportunidad', 'opportunity'],
  ['la diferencia', 'difference'], ['el ejemplo', 'example'], ['la regla', 'rule'], ['el orden', 'order'],
]);
const moreConnectors = b(4, [
  ['así que', 'so'], ['por eso', 'that’s why'], ['sin embargo', 'however'], ['aunque', 'although'],
  ['sino', 'but rather'], ['pues', 'well / because'], ['para que', 'so that'], ['primero', 'first'],
  ['después', 'afterwards'], ['finalmente', 'finally'], ['por ejemplo', 'for example'], ['además', 'besides'],
  ['mientras', 'while'], ['cuando', 'when'], ['antes', 'before'], ['luego', 'then'],
]);

// ── Second wave — extend coverage toward the top ~800 words ──────────────────
const verbs2 = b(10, [
  ['recibir', 'to receive'], ['traer', 'to bring'], ['poner', 'to put'], ['sacar', 'to take out'],
  ['colocar', 'to place'], ['tirar', 'to pull / throw'], ['coger', 'to take / grab'], ['lanzar', 'to throw'],
  ['caer', 'to fall'], ['subir', 'to go up'], ['bajar', 'to go down'], ['sentarse', 'to sit down'],
  ['construir', 'to build'], ['lograr', 'to achieve'], ['decidir', 'to decide'], ['intentar', 'to try'],
  ['pertenecer', 'to belong'], ['significar', 'to mean'], ['ocurrir', 'to happen'], ['brillar', 'to shine'],
  ['gustar', 'to like / please'], ['agradecer', 'to thank'], ['saludar', 'to greet'], ['besar', 'to kiss'],
  ['mirar', 'to look'], ['notar', 'to notice'], ['reconocer', 'to recognise'], ['mover', 'to move'],
  ['nadar', 'to swim'], ['saltar', 'to jump'], ['crecer', 'to grow'], ['nacer', 'to be born'],
]);
const professions = b(7, [
  ['el médico', 'doctor'], ['la enfermera', 'nurse'], ['el profesor', 'teacher'], ['el policía', 'police officer'],
  ['el vendedor', 'salesperson'], ['el cocinero', 'cook'], ['el camarero', 'waiter'], ['el conductor', 'driver'],
  ['el agricultor', 'farmer'], ['el ingeniero', 'engineer'], ['el abogado', 'lawyer'], ['el artista', 'artist'],
  ['el músico', 'musician'], ['el actor', 'actor'], ['el escritor', 'writer'], ['el científico', 'scientist'],
]);
const cityPlaces = b(8, [
  ['la tienda', 'shop'], ['el supermercado', 'supermarket'], ['el mercado', 'market'], ['el restaurante', 'restaurant'],
  ['la cafetería', 'café'], ['la panadería', 'bakery'], ['la farmacia', 'pharmacy'], ['el correo', 'post office'],
  ['la iglesia', 'church'], ['el museo', 'museum'], ['el teatro', 'theatre'], ['el cine', 'cinema'],
  ['el parque', 'park'], ['la biblioteca', 'library'], ['el ayuntamiento', 'town hall'], ['la policía', 'police'],
  ['el hospital', 'hospital'], ['el aseo', 'toilet'], ['el ascensor', 'lift'], ['la escalera', 'stairs'],
]);
const sports = b(9, [
  ['el deporte', 'sport'], ['el fútbol', 'football'], ['el partido', 'match'], ['el equipo', 'team'],
  ['la pelota', 'ball'], ['el gol', 'goal'], ['nadar', 'to swim'], ['correr', 'to run'],
  ['saltar', 'to jump'], ['ganar', 'to win'], ['perder', 'to lose'], ['entrenar', 'to train'],
  ['el jugador', 'player'], ['el estadio', 'stadium'], ['el campeonato', 'championship'], ['la victoria', 'victory'],
]);
const houseTools = b(7, [
  ['la herramienta', 'tool'], ['el martillo', 'hammer'], ['las tijeras', 'scissors'], ['el espejo', 'mirror'],
  ['la toalla', 'towel'], ['el jabón', 'soap'], ['el cepillo', 'brush'], ['el peine', 'comb'],
  ['la manta', 'blanket'], ['la almohada', 'pillow'], ['la cortina', 'curtain'], ['la alfombra', 'carpet'],
  ['el enchufe', 'plug / socket'], ['la pila', 'battery'], ['la nevera', 'fridge'], ['el horno', 'oven'],
]);
const adverbs2 = b(5, [
  ['pronto', 'soon'], ['de repente', 'suddenly'], ['por fin', 'finally'], ['enseguida', 'right away'],
  ['antes', 'before'], ['entonces', 'then'], ['en todas partes', 'everywhere'], ['en ninguna parte', 'nowhere'],
  ['en algún sitio', 'somewhere'], ['dentro', 'inside'], ['fuera', 'outside'], ['arriba', 'up / above'],
  ['abajo', 'down / below'], ['delante', 'in front'], ['detrás', 'behind'], ['lejos', 'far'],
  ['cerca', 'near'], ['exactamente', 'exactly'], ['despacio', 'slowly'], ['deprisa', 'quickly'],
]);
const timeExtra = b(6, [
  ['el segundo', 'second'], ['la primavera', 'spring'], ['el verano', 'summer'], ['el otoño', 'autumn'],
  ['el invierno', 'winter'], ['el lunes', 'Monday'], ['el martes', 'Tuesday'], ['el miércoles', 'Wednesday'],
  ['el jueves', 'Thursday'], ['el viernes', 'Friday'], ['el sábado', 'Saturday'], ['el domingo', 'Sunday'],
  ['el fin de semana', 'weekend'], ['la fiesta', 'party / holiday'], ['el cumpleaños', 'birthday'], ['el futuro', 'future'],
  ['el pasado', 'past'], ['el presente', 'present'], ['esta noche', 'tonight'], ['pasado mañana', 'day after tomorrow'],
]);
const bodyExtra = b(8, [
  ['el hombro', 'shoulder'], ['la rodilla', 'knee'], ['el codo', 'elbow'], ['la piel', 'skin'],
  ['la sangre', 'blood'], ['el hueso', 'bone'], ['el cerebro', 'brain'], ['el pulmón', 'lung'],
  ['la lengua', 'tongue'], ['el labio', 'lip'], ['la mejilla', 'cheek'], ['la frente', 'forehead'],
  ['la barbilla', 'chin'], ['la uña', 'nail'], ['el talón', 'heel'], ['la muñeca', 'wrist'],
]);

export const FREQUENCY_WORDS_ES = [
  ...band1, ...band2, ...band3, ...band4, ...band5, ...band6, ...band7, ...band8,
  ...band9, ...band10, ...numbers, ...colours, ...animals, ...techMedia, ...feelings,
  ...abstract, ...moreConnectors,
  ...verbs2, ...professions, ...cityPlaces, ...sports, ...houseTools, ...adverbs2,
  ...timeExtra, ...bodyExtra,
];
