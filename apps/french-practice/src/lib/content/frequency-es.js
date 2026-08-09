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

// ── Third wave — mid-frequency vocabulary toward the top ~2,000 words ─────────
const verbs3 = b(4, [
  ['empezar', 'to start'], ['parar', 'to stop'], ['continuar', 'to continue'], ['llegar', 'to arrive'],
  ['salir', 'to depart'], ['subir', 'to get on / go up'], ['bajar', 'to get off / go down'], ['cambiar', 'to change'],
  ['acompañar', 'to accompany'], ['regresar', 'to come back'], ['irse', 'to go away'], ['entrar', 'to come in'],
  ['salir', 'to go out'], ['abrir', 'to open'], ['cerrar', 'to close'], ['encender', 'to switch on'],
  ['apagar', 'to switch off'], ['llamar', 'to phone'], ['prestar atención', 'to pay attention'], ['ir de compras', 'to go shopping'],
  ['ordenar', 'to tidy'], ['recoger', 'to pick up'], ['preparar', 'to prepare'], ['repetir', 'to repeat'],
  ['contar', 'to tell / count'], ['informar', 'to report'], ['describir', 'to describe'], ['mencionar', 'to mention'],
  ['sugerir', 'to suggest'], ['recomendar', 'to recommend'], ['prometer', 'to promise'], ['disculparse', 'to apologise'],
]);
const verbs4 = b(6, [
  ['mejorar', 'to improve'], ['comparar', 'to compare'], ['elegir', 'to choose'], ['coleccionar', 'to collect'],
  ['compartir', 'to share'], ['conectar', 'to connect'], ['separar', 'to separate'], ['mezclar', 'to mix'],
  ['llenar', 'to fill'], ['vaciar', 'to empty'], ['cortar', 'to cut'], ['romper', 'to break'],
  ['reparar', 'to repair'], ['limpiar', 'to clean'], ['lavar', 'to wash'], ['secar', 'to dry'],
  ['planchar', 'to iron'], ['coser', 'to sew'], ['pintar', 'to paint'], ['dibujar', 'to draw'],
  ['construir', 'to build'], ['cavar', 'to dig'], ['plantar', 'to plant'], ['cosechar', 'to harvest'],
  ['regar', 'to water'], ['hornear', 'to bake'], ['freír', 'to fry'], ['asar', 'to roast / grill'],
  ['remover', 'to stir'], ['probar', 'to taste'], ['servir', 'to serve'], ['pedir', 'to order'],
]);
const verbs5 = b(7, [
  ['pensar en', 'to think of'], ['alegrarse', 'to be glad'], ['enfadarse', 'to get angry'], ['asustarse', 'to get scared'],
  ['acordarse', 'to remember'], ['enamorarse', 'to fall in love'], ['casarse', 'to marry'], ['divorciarse', 'to divorce'],
  ['nacer', 'to be born'], ['morir', 'to die'], ['crecer', 'to grow'], ['vivir', 'to live'],
  ['respirar', 'to breathe'], ['toser', 'to cough'], ['estornudar', 'to sneeze'], ['sudar', 'to sweat'],
  ['temblar', 'to tremble'], ['sentir', 'to feel'], ['tocar', 'to touch'], ['oler', 'to smell'],
  ['saborear', 'to savour'], ['notar', 'to notice'], ['observar', 'to observe'], ['mirar', 'to look at'],
  ['descubrir', 'to discover'], ['explorar', 'to explore'], ['medir', 'to measure'], ['pesar', 'to weigh'],
  ['contar', 'to count'], ['calcular', 'to calculate'], ['soñar', 'to dream'], ['despertar', 'to wake'],
]);
const foodEx = b(5, [
  ['el plátano', 'banana'], ['la naranja', 'orange'], ['el limón', 'lemon'], ['la fresa', 'strawberry'],
  ['la cereza', 'cherry'], ['la uva', 'grape'], ['la pera', 'pear'], ['el melocotón', 'peach'],
  ['el tomate', 'tomato'], ['la cebolla', 'onion'], ['el ajo', 'garlic'], ['la zanahoria', 'carrot'],
  ['la lechuga', 'lettuce'], ['el pepino', 'cucumber'], ['la judía', 'bean'], ['el guisante', 'pea'],
  ['el champiñón', 'mushroom'], ['el maíz', 'corn'], ['la pasta', 'pasta'], ['la pizza', 'pizza'],
  ['la salchicha', 'sausage'], ['el jamón', 'ham'], ['el pollo', 'chicken'], ['la ternera', 'beef'],
  ['el cerdo', 'pork'], ['el marisco', 'seafood'], ['la gamba', 'prawn'], ['el pastel', 'cake'],
  ['la galleta', 'biscuit'], ['el chocolate', 'chocolate'], ['el helado', 'ice cream'], ['la miel', 'honey'],
  ['la mermelada', 'jam'], ['el aceite', 'oil'], ['el vinagre', 'vinegar'], ['la pimienta', 'pepper'],
  ['la harina', 'flour'], ['la nata', 'cream'], ['el yogur', 'yoghurt'], ['la comida', 'meal'],
]);
const houseEx = b(6, [
  ['el salón', 'living room'], ['el comedor', 'dining room'], ['el pasillo', 'hallway'], ['el sótano', 'basement'],
  ['el desván', 'attic'], ['el balcón', 'balcony'], ['el garaje', 'garage'], ['el tejado', 'roof'],
  ['la escalera', 'staircase'], ['el horno', 'oven'], ['la cocina', 'stove'], ['la nevera', 'fridge'],
  ['la lavadora', 'washing machine'], ['el lavavajillas', 'dishwasher'], ['el televisor', 'TV set'], ['la calefacción', 'heating'],
  ['el aire acondicionado', 'air conditioning'], ['la estantería', 'shelf'], ['el cajón', 'drawer'], ['el sillón', 'armchair'],
  ['el fregadero', 'sink'], ['la ducha', 'shower'], ['la bañera', 'bathtub'], ['el inodoro', 'toilet'],
  ['el grifo', 'tap'], ['la bombilla', 'light bulb'], ['el interruptor', 'switch'], ['el cable', 'cable'],
  ['la basura', 'rubbish'], ['el alquiler', 'rent'], ['el vecino', 'neighbour'], ['el casero', 'landlord'],
]);
const natureEx = b(7, [
  ['la piedra', 'stone'], ['la arena', 'sand'], ['la tierra', 'soil'], ['la hierba', 'grass'],
  ['la hoja', 'leaf'], ['la raíz', 'root'], ['la rama', 'branch'], ['la semilla', 'seed'],
  ['la cosecha', 'harvest'], ['el campo', 'field'], ['el prado', 'meadow'], ['la colina', 'hill'],
  ['el valle', 'valley'], ['la cueva', 'cave'], ['la costa', 'coast'], ['la isla', 'island'],
  ['la cascada', 'waterfall'], ['el arroyo', 'stream'], ['el estanque', 'pond'], ['el pantano', 'swamp'],
  ['el desierto', 'desert'], ['la selva', 'jungle'], ['el volcán', 'volcano'], ['el terremoto', 'earthquake'],
  ['la tormenta', 'storm'], ['el trueno', 'thunder'], ['el relámpago', 'lightning'], ['la niebla', 'fog'],
  ['la escarcha', 'frost'], ['el hielo', 'ice'], ['el calor', 'heat'], ['la sombra', 'shadow'],
  ['la estrella', 'star'], ['el planeta', 'planet'], ['el sol', 'sun'], ['el universo', 'universe'],
]);
const animalsEx = b(8, [
  ['el conejo', 'rabbit'], ['la liebre', 'hare'], ['la ardilla', 'squirrel'], ['el zorro', 'fox'],
  ['el lobo', 'wolf'], ['el ciervo', 'deer'], ['el erizo', 'hedgehog'], ['el pato', 'duck'],
  ['el ganso', 'goose'], ['el gallo', 'rooster'], ['la paloma', 'pigeon'], ['el búho', 'owl'],
  ['el águila', 'eagle'], ['la mariposa', 'butterfly'], ['la mosca', 'fly'], ['el mosquito', 'mosquito'],
  ['la hormiga', 'ant'], ['el escarabajo', 'beetle'], ['el gusano', 'worm'], ['la serpiente', 'snake'],
  ['el lagarto', 'lizard'], ['la rana', 'frog'], ['la tortuga', 'turtle'], ['el tiburón', 'shark'],
  ['la ballena', 'whale'], ['el delfín', 'dolphin'], ['el tigre', 'tiger'], ['el mono', 'monkey'],
  ['la jirafa', 'giraffe'], ['la cebra', 'zebra'], ['el camello', 'camel'], ['el ratón', 'mouse'],
]);
const adjEx = b(6, [
  ['grueso', 'thick'], ['delgado', 'thin'], ['ancho', 'wide'], ['estrecho', 'narrow'],
  ['profundo', 'deep'], ['llano', 'flat'], ['redondo', 'round'], ['cuadrado', 'square'],
  ['recto', 'straight'], ['torcido', 'crooked'], ['afilado', 'sharp'], ['romo', 'blunt'],
  ['duro', 'hard'], ['blando', 'soft'], ['liso', 'smooth'], ['áspero', 'rough'],
  ['brillante', 'bright'], ['oscuro', 'dark'], ['claro', 'clear'], ['turbio', 'murky'],
  ['dulce', 'sweet'], ['agrio', 'sour'], ['amargo', 'bitter'], ['salado', 'salty'],
  ['fresco', 'fresh'], ['podrido', 'rotten'], ['maduro', 'ripe'], ['crudo', 'raw'],
  ['cocido', 'cooked'], ['delicioso', 'delicious'], ['asqueroso', 'disgusting'], ['sano', 'healthy'],
]);
const adjEx2 = b(8, [
  ['amable', 'kind'], ['educado', 'polite'], ['maleducado', 'rude'], ['honesto', 'honest'],
  ['simpático', 'nice'], ['antipático', 'unpleasant'], ['listo', 'clever'], ['tonto', 'silly'],
  ['trabajador', 'hardworking'], ['perezoso', 'lazy'], ['valiente', 'brave'], ['miedoso', 'fearful'],
  ['paciente', 'patient'], ['impaciente', 'impatient'], ['generoso', 'generous'], ['tacaño', 'stingy'],
  ['tímido', 'shy'], ['seguro', 'confident'], ['serio', 'serious'], ['gracioso', 'funny'],
  ['raro', 'strange'], ['normal', 'normal'], ['común', 'common'], ['especial', 'special'],
  ['famoso', 'famous'], ['popular', 'popular'], ['conocido', 'well-known'], ['extranjero', 'foreign'],
  ['parecido', 'similar'], ['mismo', 'same'], ['distinto', 'different'], ['único', 'unique'],
]);
const abstractEx = b(9, [
  ['el espacio', 'space'], ['la cantidad', 'quantity'], ['el número', 'number'], ['la parte', 'part'],
  ['el conjunto', 'whole / set'], ['la mitad', 'half'], ['el final', 'end'], ['el principio', 'beginning'],
  ['el medio', 'middle'], ['la serie', 'series'], ['la consecuencia', 'consequence'], ['la causa', 'cause'],
  ['el efecto', 'effect'], ['el objetivo', 'objective'], ['el plan', 'plan'], ['la decisión', 'decision'],
  ['la elección', 'choice'], ['la solución', 'solution'], ['el deber', 'duty'], ['la responsabilidad', 'responsibility'],
  ['el significado', 'meaning'], ['la ventaja', 'advantage'], ['la desventaja', 'disadvantage'], ['la dificultad', 'difficulty'],
  ['la situación', 'situation'], ['la condición', 'condition'], ['el cambio', 'change'], ['el desarrollo', 'development'],
  ['el progreso', 'progress'], ['el crecimiento', 'growth'], ['la meta', 'goal'], ['el propósito', 'purpose'],
]);
const emotionsEx = b(7, [
  ['el humor', 'mood'], ['la satisfacción', 'satisfaction'], ['la decepción', 'disappointment'], ['la sorpresa', 'surprise'],
  ['la emoción', 'excitement'], ['el aburrimiento', 'boredom'], ['la soledad', 'loneliness'], ['el orgullo', 'pride'],
  ['la vergüenza', 'shame'], ['la culpa', 'guilt'], ['la envidia', 'envy'], ['los celos', 'jealousy'],
  ['la lástima', 'pity'], ['la gratitud', 'gratitude'], ['el cariño', 'affection'], ['el asombro', 'amazement'],
  ['contento', 'happy'], ['satisfecho', 'content'], ['infeliz', 'unhappy'], ['emocionado', 'excited'],
  ['relajado', 'relaxed'], ['estresado', 'stressed'], ['agotado', 'exhausted'], ['confundido', 'confused'],
  ['decepcionado', 'disappointed'], ['entusiasmado', 'enthusiastic'], ['curioso', 'curious'], ['preocupado', 'worried'],
]);

const businessMoney = b(7, [
  ['el negocio', 'business'], ['el comercio', 'trade'], ['el cliente', 'customer'], ['la venta', 'sale'],
  ['la compra', 'purchase'], ['la oferta', 'offer'], ['la demanda', 'demand'], ['la ganancia', 'profit'],
  ['la pérdida', 'loss'], ['el coste', 'cost'], ['el impuesto', 'tax'], ['la factura', 'invoice'],
  ['el recibo', 'receipt'], ['el sueldo', 'salary'], ['el salario', 'wage'], ['la deuda', 'debt'],
  ['el préstamo', 'loan'], ['el crédito', 'credit'], ['la cuenta', 'account'], ['la moneda', 'coin'],
  ['el billete', 'banknote'], ['el efectivo', 'cash'], ['la economía', 'economy'], ['la industria', 'industry'],
  ['la fábrica', 'factory'], ['el producto', 'product'], ['la mercancía', 'goods'], ['la entrega', 'delivery'],
  ['el contrato', 'contract'], ['la inversión', 'investment'], ['la acción', 'share / stock'], ['el gerente', 'manager'],
  ['el empleado', 'employee'], ['el departamento', 'department'], ['la reunión', 'meeting'], ['el pedido', 'order'],
]);
const techScience = b(8, [
  ['la ciencia', 'science'], ['la investigación', 'research'], ['el experimento', 'experiment'], ['la teoría', 'theory'],
  ['la tecnología', 'technology'], ['la máquina', 'machine'], ['el motor', 'engine'], ['el aparato', 'device'],
  ['la pantalla', 'screen'], ['el teclado', 'keyboard'], ['el ratón', 'mouse'], ['la impresora', 'printer'],
  ['el programa', 'software'], ['la red', 'network'], ['el servidor', 'server'], ['la conexión', 'connection'],
  ['la señal', 'signal'], ['la energía', 'energy'], ['la corriente', 'current'], ['la fuerza', 'force'],
  ['la velocidad', 'speed'], ['el peso', 'weight'], ['la longitud', 'length'], ['la altura', 'height'],
  ['la anchura', 'width'], ['el área', 'area'], ['el volumen', 'volume'], ['la temperatura', 'temperature'],
  ['la sustancia', 'substance'], ['el elemento', 'element'], ['el metal', 'metal'], ['el plástico', 'plastic'],
  ['la química', 'chemistry'], ['la física', 'physics'], ['la biología', 'biology'], ['las matemáticas', 'mathematics'],
]);
const artsMedia = b(8, [
  ['el arte', 'art'], ['el cuadro', 'painting'], ['el dibujo', 'drawing'], ['la escultura', 'sculpture'],
  ['el artista', 'artist'], ['el concierto', 'concert'], ['la ópera', 'opera'], ['el instrumento', 'instrument'],
  ['la guitarra', 'guitar'], ['el piano', 'piano'], ['el tambor', 'drum'], ['el cantante', 'singer'],
  ['el grupo', 'band'], ['la novela', 'novel'], ['el poema', 'poem'], ['la historia', 'story / history'],
  ['la revista', 'magazine'], ['el artículo', 'article'], ['el programa', 'programme'], ['el actor', 'actor'],
  ['el escenario', 'stage'], ['la función', 'performance'], ['el público', 'audience'], ['la cultura', 'culture'],
  ['la tradición', 'tradition'], ['la fiesta', 'festival'], ['la celebración', 'celebration'], ['el baile', 'dance'],
  ['la canción', 'song'], ['la melodía', 'melody'], ['el ritmo', 'rhythm'], ['el teatro', 'theatre'],
]);
const education = b(7, [
  ['la educación', 'education'], ['la asignatura', 'subject'], ['la conferencia', 'lecture'], ['los deberes', 'homework'],
  ['el ejercicio', 'exercise'], ['la prueba', 'test'], ['el título', 'degree'], ['el conocimiento', 'knowledge'],
  ['la habilidad', 'ability'], ['el error', 'mistake'], ['la corrección', 'correction'], ['la explicación', 'explanation'],
  ['el ejemplo', 'example'], ['la regla', 'rule'], ['el idioma', 'language'], ['el alfabeto', 'alphabet'],
  ['la letra', 'letter'], ['la sílaba', 'syllable'], ['la frase', 'sentence'], ['la gramática', 'grammar'],
  ['el significado', 'meaning'], ['la pronunciación', 'pronunciation'], ['el párrafo', 'paragraph'], ['la página', 'page'],
  ['el capítulo', 'chapter'], ['la nota', 'note'], ['el lápiz', 'pencil'], ['la goma', 'eraser'],
  ['la regla', 'ruler'], ['la pizarra', 'blackboard'], ['el diccionario', 'dictionary'], ['la biblioteca', 'library'],
]);
const societyLaw = b(9, [
  ['la sociedad', 'society'], ['el gobierno', 'government'], ['el estado', 'state'], ['el pueblo', 'people / nation'],
  ['el ciudadano', 'citizen'], ['la política', 'politics'], ['el partido', 'party'], ['la elección', 'election'],
  ['el voto', 'vote'], ['la ley', 'law'], ['el derecho', 'right'], ['el tribunal', 'court'],
  ['el juez', 'judge'], ['el abogado', 'lawyer'], ['el crimen', 'crime'], ['el ladrón', 'thief'],
  ['el castigo', 'punishment'], ['la cárcel', 'prison'], ['la seguridad', 'security'], ['la paz', 'peace'],
  ['la guerra', 'war'], ['el ejército', 'army'], ['el soldado', 'soldier'], ['la frontera', 'border'],
  ['la libertad', 'freedom'], ['la igualdad', 'equality'], ['la justicia', 'justice'], ['la religión', 'religion'],
  ['la iglesia', 'church'], ['el dios', 'god'], ['la fe', 'faith'], ['la nación', 'nation'],
]);
const healthMed = b(7, [
  ['el tratamiento', 'treatment'], ['el examen', 'examination'], ['la operación', 'operation'], ['la inyección', 'injection'],
  ['la pastilla', 'pill'], ['la receta', 'prescription'], ['la venda', 'bandage'], ['la herida', 'wound'],
  ['la lesión', 'injury'], ['el accidente', 'accident'], ['la gripe', 'flu'], ['el resfriado', 'cold'],
  ['la tos', 'cough'], ['la alergia', 'allergy'], ['el dentista', 'dentist'], ['la farmacia', 'pharmacy'],
  ['el seguro médico', 'health insurance'], ['el paciente', 'patient'], ['el diagnóstico', 'diagnosis'], ['la cura', 'cure'],
  ['la nutrición', 'nutrition'], ['la dieta', 'diet'], ['el ejercicio', 'exercise'], ['el sueño', 'sleep'],
  ['el descanso', 'rest'], ['el cuidado', 'care'], ['la higiene', 'hygiene'], ['embarazada', 'pregnant'],
  ['ciego', 'blind'], ['sordo', 'deaf'], ['discapacitado', 'disabled'], ['la sangre', 'blood'],
]);
const transportEx = b(6, [
  ['el metro', 'underground'], ['el tranvía', 'tram'], ['el taxi', 'taxi'], ['el camión', 'lorry'],
  ['la moto', 'motorbike'], ['el barco', 'ship'], ['la barca', 'boat'], ['el puerto', 'port'],
  ['la parada', 'stop'], ['el andén', 'platform'], ['el horario', 'timetable'], ['el retraso', 'delay'],
  ['el tráfico', 'traffic'], ['el semáforo', 'traffic light'], ['la señal', 'sign'], ['el carné de conducir', 'driving licence'],
  ['la gasolina', 'petrol'], ['la gasolinera', 'petrol station'], ['el aparcamiento', 'car park'], ['la rueda', 'wheel / tyre'],
  ['el freno', 'brake'], ['el asiento', 'seat'], ['el cinturón', 'seatbelt'], ['el viaje', 'journey'],
  ['la excursión', 'excursion'], ['el equipaje', 'luggage'], ['la maleta', 'suitcase'], ['la mochila', 'backpack'],
  ['el pasaporte', 'passport'], ['el visado', 'visa'], ['el alojamiento', 'accommodation'], ['la aduana', 'customs'],
]);
const clothingEx = b(7, [
  ['los vaqueros', 'jeans'], ['la camiseta', 'T-shirt'], ['la blusa', 'blouse'], ['el traje', 'suit'],
  ['la corbata', 'tie'], ['el cinturón', 'belt'], ['la bufanda', 'scarf'], ['los guantes', 'gloves'],
  ['la gorra', 'cap'], ['las botas', 'boots'], ['las sandalias', 'sandals'], ['la ropa interior', 'underwear'],
  ['el pijama', 'pyjamas'], ['el bañador', 'swimsuit'], ['el bolso', 'bag'], ['la cartera', 'wallet'],
  ['la joya', 'jewellery'], ['el anillo', 'ring'], ['el collar', 'necklace'], ['el reloj', 'watch'],
  ['la talla', 'size'], ['la moda', 'fashion'], ['la tela', 'fabric'], ['el algodón', 'cotton'],
  ['la lana', 'wool'], ['la seda', 'silk'], ['el cuero', 'leather'], ['el botón', 'button'],
  ['la cremallera', 'zip'], ['el bolsillo', 'pocket'], ['el cuello', 'collar'], ['la manga', 'sleeve'],
]);
const objectsEx = b(6, [
  ['la cosa', 'thing'], ['el objeto', 'object'], ['la caja', 'box'], ['la bolsa', 'bag'],
  ['el paquete', 'parcel'], ['la carta', 'letter'], ['la tarjeta', 'card'], ['el sobre', 'envelope'],
  ['el sello', 'stamp'], ['las tijeras', 'scissors'], ['el pegamento', 'glue'], ['la cinta', 'tape'],
  ['la cuerda', 'string / rope'], ['el hilo', 'thread'], ['la aguja', 'needle'], ['el clavo', 'nail'],
  ['el tornillo', 'screw'], ['la escalera', 'ladder'], ['el cubo', 'bucket'], ['el cuenco', 'bowl'],
  ['la olla', 'pot'], ['la sartén', 'pan'], ['la bandeja', 'tray'], ['la cesta', 'basket'],
  ['la tapa', 'lid'], ['la vela', 'candle'], ['las cerillas', 'matches'], ['la linterna', 'torch'],
  ['el paraguas', 'umbrella'], ['el abanico', 'fan'], ['la balanza', 'scales'], ['el imán', 'magnet'],
]);
const communication = b(6, [
  ['la conversación', 'conversation'], ['la discusión', 'discussion'], ['el discurso', 'speech'], ['el anuncio', 'announcement'],
  ['la opinión', 'opinion'], ['el consejo', 'advice'], ['la petición', 'request'], ['el permiso', 'permission'],
  ['la promesa', 'promise'], ['la advertencia', 'warning'], ['la amenaza', 'threat'], ['la mentira', 'lie'],
  ['la verdad', 'truth'], ['el secreto', 'secret'], ['el chiste', 'joke'], ['el saludo', 'greeting'],
  ['el agradecimiento', 'thanks'], ['la disculpa', 'apology'], ['la invitación', 'invitation'], ['el mensaje', 'message'],
  ['la llamada', 'call'], ['la palabra', 'word'], ['la voz', 'voice'], ['el sonido', 'sound'],
  ['el ruido', 'noise'], ['el silencio', 'silence'], ['el idioma', 'language'], ['la respuesta', 'reply'],
]);
const familyRel = b(6, [
  ['los padres', 'parents'], ['la abuela', 'grandmother'], ['el abuelo', 'grandfather'], ['el tío', 'uncle'],
  ['la tía', 'aunt'], ['el primo', 'cousin (m)'], ['la prima', 'cousin (f)'], ['el sobrino', 'nephew'],
  ['la sobrina', 'niece'], ['el nieto', 'grandson'], ['la nieta', 'granddaughter'], ['el marido', 'husband'],
  ['la esposa', 'wife'], ['la pareja', 'partner'], ['la novia', 'girlfriend'], ['el novio', 'boyfriend'],
  ['los parientes', 'relatives'], ['el vecino', 'neighbour'], ['el conocido', 'acquaintance'], ['el invitado', 'guest'],
  ['la boda', 'wedding'], ['el matrimonio', 'marriage'], ['el divorcio', 'divorce'], ['el nacimiento', 'birth'],
  ['la infancia', 'childhood'], ['la juventud', 'youth'], ['la edad', 'age'], ['la relación', 'relationship'],
]);
const cityBuild = b(7, [
  ['el edificio', 'building'], ['la torre', 'tower'], ['el castillo', 'castle'], ['la fortaleza', 'fortress'],
  ['la fábrica', 'factory'], ['el almacén', 'warehouse'], ['la granja', 'farm'], ['el granero', 'barn'],
  ['la sala', 'hall'], ['el estadio', 'stadium'], ['el zoológico', 'zoo'], ['el cementerio', 'cemetery'],
  ['la mezquita', 'mosque'], ['el templo', 'temple'], ['la embajada', 'embassy'], ['el juzgado', 'courthouse'],
  ['la escuela', 'school'], ['la guardería', 'nursery'], ['la universidad', 'university'], ['el laboratorio', 'laboratory'],
  ['el puente', 'bridge'], ['el túnel', 'tunnel'], ['la valla', 'fence'], ['la puerta', 'gate'],
  ['la entrada', 'entrance'], ['la salida', 'exit'], ['el número', 'number'], ['la dirección', 'address'],
  ['el barrio', 'district'], ['las afueras', 'suburbs'], ['la capital', 'capital'], ['la zona', 'zone'],
]);
const shoppingEx = b(6, [
  ['la tienda', 'shop'], ['los grandes almacenes', 'department store'], ['la caja', 'checkout'], ['el dependiente', 'shop assistant'],
  ['el carrito', 'shopping trolley'], ['la bolsa', 'bag'], ['la oferta', 'special offer'], ['el descuento', 'discount'],
  ['las rebajas', 'sales'], ['la garantía', 'warranty'], ['el cambio', 'exchange / change'], ['la devolución', 'return'],
  ['la calidad', 'quality'], ['la marca', 'brand'], ['la etiqueta', 'label'], ['la selección', 'selection'],
  ['la panadería', 'bakery'], ['la carnicería', 'butcher’s'], ['la pastelería', 'patisserie'], ['el quiosco', 'kiosk'],
  ['la droguería', 'drugstore'], ['la librería', 'bookshop'], ['la floristería', 'florist'], ['la joyería', 'jeweller'],
  ['el horario', 'opening hours'], ['cerrado', 'closed'], ['abierto', 'open'], ['gratis', 'free'],
]);
const adverbs3 = b(5, [
  ['ciertamente', 'certainly'], ['probablemente', 'probably'], ['posiblemente', 'possibly'], ['ojalá', 'hopefully'],
  ['desgraciadamente', 'unfortunately'], ['afortunadamente', 'fortunately'], ['especialmente', 'especially'], ['principalmente', 'mainly'],
  ['parcialmente', 'partly'], ['completamente', 'completely'], ['aproximadamente', 'approximately'], ['al menos', 'at least'],
  ['como máximo', 'at most'], ['incluso', 'even'], ['apenas', 'hardly'], ['constantemente', 'constantly'],
  ['ocasionalmente', 'occasionally'], ['normalmente', 'usually'], ['una vez', 'once'], ['dos veces', 'twice'],
  ['varias veces', 'several times'], ['en primer lugar', 'firstly'], ['por cierto', 'by the way'], ['en total', 'in total'],
  ['sobre todo', 'above all'], ['en general', 'in general'], ['por supuesto', 'of course'], ['de repente', 'suddenly'],
]);
const verbs6 = b(7, [
  ['pertenecer a', 'to belong to'], ['consistir en', 'to consist of'], ['cuidar', 'to take care'], ['apresurarse', 'to hurry'],
  ['relajarse', 'to relax'], ['vestirse', 'to get dressed'], ['desvestirse', 'to undress'], ['lavarse', 'to wash oneself'],
  ['sentarse', 'to sit down'], ['acostarse', 'to lie down'], ['despertarse', 'to wake up'], ['dormirse', 'to fall asleep'],
  ['reunirse', 'to meet'], ['quedar', 'to arrange to meet'], ['participar', 'to take part'], ['solicitar', 'to apply'],
  ['firmar', 'to sign'], ['rellenar', 'to fill in'], ['imprimir', 'to print'], ['copiar', 'to copy'],
  ['borrar', 'to delete'], ['guardar', 'to save'], ['descargar', 'to download'], ['subir', 'to upload'],
  ['hacer clic', 'to click'], ['escribir', 'to type'], ['prohibir', 'to forbid'], ['permitir', 'to allow'],
  ['reservar', 'to book'], ['cancelar', 'to cancel'], ['confirmar', 'to confirm'], ['aceptar', 'to accept'],
]);
const measures = b(5, [
  ['el kilo', 'kilo'], ['el gramo', 'gram'], ['el litro', 'litre'], ['el metro', 'metre'],
  ['el centímetro', 'centimetre'], ['el kilómetro', 'kilometre'], ['el pedazo', 'piece'], ['el par', 'pair'],
  ['la docena', 'dozen'], ['la ración', 'portion'], ['la rebanada', 'slice'], ['el cuarto', 'quarter'],
  ['el tercio', 'third'], ['el porcentaje', 'percentage'], ['la cantidad', 'quantity'], ['mucho', 'much'],
  ['poco', 'little'], ['más', 'more'], ['menos', 'less'], ['algunos', 'some'],
  ['varios', 'several'], ['todos', 'all'], ['ambos', 'both'], ['cada', 'each'],
  ['ninguno', 'none'], ['bastante', 'enough'], ['demasiado', 'too much'], ['la media', 'average'],
]);
const calendarEx = b(5, [
  ['enero', 'January'], ['febrero', 'February'], ['marzo', 'March'], ['abril', 'April'],
  ['mayo', 'May'], ['junio', 'June'], ['julio', 'July'], ['agosto', 'August'],
  ['septiembre', 'September'], ['octubre', 'October'], ['noviembre', 'November'], ['diciembre', 'December'],
  ['la fecha', 'date'], ['el calendario', 'calendar'], ['la estación', 'season'], ['la cita', 'appointment'],
  ['anteayer', 'day before yesterday'], ['la próxima semana', 'next week'], ['la semana pasada', 'last week'], ['antes', 'before'],
  ['más tarde', 'later'], ['pronto', 'soon'], ['puntual', 'on time'], ['a tiempo', 'in time'],
]);
const materials = b(8, [
  ['la madera', 'wood'], ['el hierro', 'iron'], ['el acero', 'steel'], ['el oro', 'gold'],
  ['la plata', 'silver'], ['el cobre', 'copper'], ['el vidrio', 'glass'], ['el papel', 'paper'],
  ['el cartón', 'cardboard'], ['la arcilla', 'clay'], ['el cemento', 'concrete'], ['el ladrillo', 'brick'],
  ['el caucho', 'rubber'], ['la cera', 'wax'], ['la sal', 'salt'], ['el carbón', 'coal'],
  ['el petróleo', 'oil'], ['el gas', 'gas'], ['el polvo', 'dust'], ['la suciedad', 'dirt'],
  ['la espuma', 'foam'], ['el humo', 'smoke'], ['la ceniza', 'ash'], ['el vapor', 'steam'],
]);
const directions = b(4, [
  ['el norte', 'north'], ['el sur', 'south'], ['el este', 'east'], ['el oeste', 'west'],
  ['arriba', 'up / above'], ['abajo', 'down / below'], ['delante', 'front'], ['detrás', 'back'],
  ['dentro', 'inside'], ['fuera', 'outside'], ['al lado', 'beside'], ['enfrente', 'opposite'],
  ['entre', 'between'], ['encima', 'on top'], ['debajo', 'underneath'], ['alrededor', 'around'],
  ['la dirección', 'direction'], ['la distancia', 'distance'], ['cerca', 'near'], ['lejos', 'far'],
]);
const miscNouns = b(9, [
  ['la oportunidad', 'opportunity'], ['la casualidad', 'coincidence'], ['la suerte', 'luck'], ['la esperanza', 'hope'],
  ['el sueño', 'dream'], ['el deseo', 'wish'], ['la necesidad', 'need'], ['la costumbre', 'habit'],
  ['la experiencia', 'experience'], ['el recuerdo', 'memory'], ['la impresión', 'impression'], ['la duda', 'doubt'],
  ['la precaución', 'caution'], ['la paciencia', 'patience'], ['el esfuerzo', 'effort'], ['el intento', 'attempt'],
  ['el resultado', 'result'], ['la consecuencia', 'consequence'], ['el beneficio', 'benefit'], ['el efecto', 'effect'],
  ['la excepción', 'exception'], ['la circunstancia', 'circumstance'], ['la condición', 'condition'], ['la posibilidad', 'possibility'],
  ['el hecho', 'fact'], ['el detalle', 'detail'], ['el aspecto', 'aspect'], ['el factor', 'factor'],
]);

const verbs7 = b(8, [
  ['alcanzar', 'to reach'], ['perder', 'to miss'], ['permitir', 'to permit'], ['impedir', 'to prevent'],
  ['proteger', 'to protect'], ['salvar', 'to rescue'], ['arriesgar', 'to risk'], ['apoyar', 'to support'],
  ['animar', 'to encourage'], ['elogiar', 'to praise'], ['criticar', 'to criticise'], ['quejarse', 'to complain'],
  ['discutir', 'to argue'], ['luchar', 'to fight'], ['vencer', 'to defeat'], ['rendirse', 'to give up'],
  ['conquistar', 'to conquer'], ['dominar', 'to master'], ['dirigir', 'to lead'], ['organizar', 'to organise'],
  ['planear', 'to plan'], ['fundar', 'to found'], ['desarrollar', 'to develop'], ['producir', 'to produce'],
  ['entregar', 'to deliver'], ['distribuir', 'to distribute'], ['ahorrar', 'to save'], ['gastar', 'to spend'],
  ['ganar', 'to earn'], ['prestar', 'to lend'], ['deber', 'to owe'], ['invertir', 'to invest'],
]);
const verbs8 = b(9, [
  ['significar', 'to mean'], ['representar', 'to represent'], ['afectar', 'to affect'], ['contener', 'to contain'],
  ['requerir', 'to require'], ['permitir', 'to enable'], ['causar', 'to cause'], ['influir', 'to influence'],
  ['determinar', 'to determine'], ['probar', 'to prove'], ['demostrar', 'to demonstrate'], ['afirmar', 'to claim'],
  ['confirmar', 'to confirm'], ['negar', 'to deny'], ['dudar', 'to doubt'], ['sospechar', 'to suspect'],
  ['esperar', 'to expect'], ['predecir', 'to predict'], ['estimar', 'to estimate'], ['evaluar', 'to evaluate'],
  ['juzgar', 'to judge'], ['considerar', 'to consider'], ['reflexionar', 'to reflect'], ['imaginar', 'to imagine'],
  ['reconocer', 'to recognise'], ['comprender', 'to comprehend'], ['confundir', 'to confuse'], ['distinguir', 'to distinguish'],
  ['relacionar', 'to relate'], ['comparar', 'to compare'], ['resolver', 'to solve'], ['analizar', 'to analyse'],
]);
const geography = b(7, [
  ['el mundo', 'world'], ['el continente', 'continent'], ['el país', 'country'], ['la nación', 'nation'],
  ['la región', 'region'], ['el territorio', 'territory'], ['la provincia', 'province'], ['el distrito', 'district'],
  ['España', 'Spain'], ['Francia', 'France'], ['Alemania', 'Germany'], ['Italia', 'Italy'],
  ['Inglaterra', 'England'], ['Europa', 'Europe'], ['África', 'Africa'], ['Asia', 'Asia'],
  ['América', 'America'], ['el mar', 'sea'], ['el océano', 'ocean'], ['el paisaje', 'landscape'],
  ['el entorno', 'surroundings'], ['el medio ambiente', 'environment'], ['el clima', 'climate'], ['la población', 'population'],
  ['el idioma', 'language'], ['la cultura', 'culture'], ['la capital', 'capital'], ['la bandera', 'flag'],
]);
const plants = b(8, [
  ['la planta', 'plant'], ['el arbusto', 'bush'], ['el seto', 'hedge'], ['la palmera', 'palm tree'],
  ['el roble', 'oak'], ['el pino', 'pine'], ['la rosa', 'rose'], ['el tulipán', 'tulip'],
  ['la margarita', 'daisy'], ['el cactus', 'cactus'], ['el musgo', 'moss'], ['el hongo', 'fungus'],
  ['el cereal', 'grain'], ['el trigo', 'wheat'], ['el heno', 'hay'], ['la paja', 'straw'],
  ['la fruta', 'fruit'], ['la nuez', 'nut'], ['la baya', 'berry'], ['la pepita', 'seed'],
  ['la flor', 'blossom'], ['el aroma', 'scent'], ['el jardín', 'garden'], ['el huerto', 'orchard'],
]);
const kitchenEx = b(6, [
  ['la vajilla', 'crockery'], ['la servilleta', 'napkin'], ['el mantel', 'tablecloth'], ['el sacacorchos', 'corkscrew'],
  ['el abrelatas', 'can opener'], ['la tabla de cortar', 'chopping board'], ['la batidora', 'blender'], ['el hervidor', 'kettle'],
  ['el microondas', 'microwave'], ['la tostadora', 'toaster'], ['la receta', 'recipe'], ['el ingrediente', 'ingredient'],
  ['la ración', 'portion'], ['el sabor', 'flavour'], ['el olor', 'smell'], ['el apetito', 'appetite'],
  ['la sed', 'thirst'], ['el hambre', 'hunger'], ['la bebida', 'drink'], ['el postre', 'dessert'],
  ['el entrante', 'starter'], ['el plato principal', 'main course'], ['la guarnición', 'side dish'], ['la merienda', 'snack'],
]);
const hobbies = b(7, [
  ['el pasatiempo', 'hobby'], ['el tiempo libre', 'free time'], ['el placer', 'pleasure'], ['el entretenimiento', 'entertainment'],
  ['la lectura', 'reading'], ['la cocina', 'cooking'], ['el senderismo', 'hiking'], ['el ciclismo', 'cycling'],
  ['la natación', 'swimming'], ['el dibujo', 'drawing'], ['la fotografía', 'photography'], ['la jardinería', 'gardening'],
  ['el coleccionismo', 'collecting'], ['el viaje', 'travelling'], ['el juego', 'game'], ['la carta', 'playing card'],
  ['el ajedrez', 'chess'], ['el rompecabezas', 'puzzle'], ['el club', 'club'], ['el socio', 'member'],
  ['el torneo', 'tournament'], ['la competición', 'competition'], ['el premio', 'prize'], ['la medalla', 'medal'],
]);
const adjEx3 = b(8, [
  ['útil', 'useful'], ['inútil', 'useless'], ['práctico', 'practical'], ['cómodo', 'comfortable'],
  ['incómodo', 'uncomfortable'], ['moderno', 'modern'], ['anticuado', 'old-fashioned'], ['costoso', 'costly'],
  ['valioso', 'valuable'], ['peligroso', 'dangerous'], ['inofensivo', 'harmless'], ['posible', 'possible'],
  ['imposible', 'impossible'], ['verdadero', 'true'], ['falso', 'false'], ['auténtico', 'genuine'],
  ['perfecto', 'perfect'], ['listo', 'ready'], ['abierto', 'open'], ['cerrado', 'closed'],
  ['privado', 'private'], ['público', 'public'], ['general', 'general'], ['individual', 'individual'],
  ['común', 'shared'], ['adicional', 'additional'], ['necesario', 'necessary'], ['suficiente', 'sufficient'],
  ['gratuito', 'free'], ['caro', 'pricey'], ['barato', 'inexpensive'], ['razonable', 'reasonable'],
]);
const weatherEx = b(6, [
  ['soleado', 'sunny'], ['nublado', 'cloudy'], ['lluvioso', 'rainy'], ['ventoso', 'windy'],
  ['brumoso', 'foggy'], ['tormentoso', 'stormy'], ['despejado', 'clear'], ['húmedo', 'humid'],
  ['la temperatura', 'temperature'], ['el grado', 'degree'], ['la previsión', 'forecast'], ['el chubasco', 'shower'],
  ['el granizo', 'hail'], ['el rocío', 'dew'], ['la humedad', 'humidity'], ['la sequía', 'drought'],
  ['la inundación', 'flood'], ['el arcoíris', 'rainbow'], ['la brisa', 'breeze'], ['la primavera', 'springtime'],
]);
const jobsEx = b(8, [
  ['el panadero', 'baker'], ['el carnicero', 'butcher'], ['el peluquero', 'hairdresser'], ['el fontanero', 'plumber'],
  ['el electricista', 'electrician'], ['el mecánico', 'mechanic'], ['el carpintero', 'carpenter'], ['el albañil', 'bricklayer'],
  ['el pintor', 'painter'], ['el jardinero', 'gardener'], ['el piloto', 'pilot'], ['el capitán', 'captain'],
  ['el soldado', 'soldier'], ['el bombero', 'firefighter'], ['el cartero', 'postman'], ['el limpiador', 'cleaner'],
  ['el funcionario', 'civil servant'], ['el banquero', 'banker'], ['el periodista', 'journalist'], ['el fotógrafo', 'photographer'],
  ['el traductor', 'translator'], ['el intérprete', 'interpreter'], ['el asesor', 'consultant'], ['el director', 'director'],
]);
const bodyEx2 = b(7, [
  ['la ceja', 'eyebrow'], ['la pestaña', 'eyelash'], ['la lengua', 'tongue'], ['la mandíbula', 'jaw'],
  ['la garganta', 'throat'], ['el pecho', 'chest'], ['la cadera', 'hip'], ['el muslo', 'thigh'],
  ['la pantorrilla', 'calf'], ['el tobillo', 'ankle'], ['el dedo del pie', 'toe'], ['el pulgar', 'thumb'],
  ['el puño', 'fist'], ['el músculo', 'muscle'], ['la vena', 'vein'], ['el riñón', 'kidney'],
  ['el hígado', 'liver'], ['el nervio', 'nerve'], ['la lágrima', 'tear'], ['el sudor', 'sweat'],
  ['el aliento', 'breath'], ['la voz', 'voice'], ['el pulso', 'pulse'], ['la cintura', 'waist'],
]);
const mindWords = b(9, [
  ['la mente', 'mind'], ['el alma', 'soul'], ['la conciencia', 'consciousness'], ['la razón', 'reason'],
  ['la imaginación', 'imagination'], ['la creatividad', 'creativity'], ['la inteligencia', 'intelligence'], ['la memoria', 'memory'],
  ['la atención', 'attention'], ['la concentración', 'concentration'], ['el interés', 'interest'], ['la curiosidad', 'curiosity'],
  ['la sabiduría', 'wisdom'], ['el talento', 'talent'], ['el don', 'gift'], ['el carácter', 'character'],
  ['la personalidad', 'personality'], ['la actitud', 'attitude'], ['la voluntad', 'will'], ['la intención', 'intention'],
  ['el motivo', 'motive'], ['el instinto', 'instinct'], ['la reacción', 'reaction'], ['el pensamiento', 'thought'],
]);
const moreNouns = b(9, [
  ['el sistema', 'system'], ['la estructura', 'structure'], ['el método', 'method'], ['el procedimiento', 'procedure'],
  ['la técnica', 'technique'], ['la herramienta', 'tool'], ['el medio', 'means'], ['la fuente', 'source'],
  ['el material', 'material'], ['la forma', 'form'], ['el patrón', 'pattern'], ['el modelo', 'model'],
  ['el tipo', 'type'], ['la categoría', 'category'], ['el grupo', 'group'], ['la red', 'network'],
  ['la cadena', 'chain'], ['la conexión', 'connection'], ['el contacto', 'contact'], ['la relación', 'relation'],
  ['el contexto', 'context'], ['el marco', 'framework'], ['el detalle', 'detail'], ['el aspecto', 'aspect'],
  ['el factor', 'factor'], ['el papel', 'role'], ['la función', 'function'], ['el valor', 'value'],
  ['la cualidad', 'quality'], ['la característica', 'feature'], ['la propiedad', 'property'], ['el rasgo', 'trait'],
]);

const verbs9 = b(8, [
  ['tirar', 'to pull'], ['empujar', 'to push'], ['levantar', 'to lift'], ['bajar', 'to lower'],
  ['rodar', 'to roll'], ['deslizar', 'to slide'], ['trepar', 'to climb'], ['gatear', 'to crawl'],
  ['tropezar', 'to stumble'], ['resbalar', 'to slip'], ['columpiar', 'to swing'], ['limpiar', 'to wipe'],
  ['frotar', 'to rub'], ['rascar', 'to scratch'], ['golpear', 'to knock / hit'], ['pinchar', 'to prick'],
  ['morder', 'to bite'], ['masticar', 'to chew'], ['tragar', 'to swallow'], ['bostezar', 'to yawn'],
  ['susurrar', 'to whisper'], ['gritar', 'to shout'], ['silbar', 'to whistle'], ['aplaudir', 'to clap'],
  ['saludar con la mano', 'to wave'], ['asentir', 'to nod'], ['sacudir', 'to shake'], ['abrazar', 'to hug'],
  ['sonreír', 'to smile'], ['guiñar', 'to wink'], ['señalar', 'to point'], ['esconder', 'to hide'],
]);
const officeEx = b(7, [
  ['el archivo', 'file'], ['la carpeta', 'folder'], ['el formulario', 'form'], ['el sello', 'stamp'],
  ['la firma', 'signature'], ['el informe', 'report'], ['la nota', 'note'], ['el calendario', 'calendar'],
  ['la reunión', 'meeting'], ['el plazo', 'deadline'], ['el escritorio', 'desk'], ['la silla de oficina', 'office chair'],
  ['el clip', 'paperclip'], ['la grapadora', 'stapler'], ['la calculadora', 'calculator'], ['la copia', 'copy'],
  ['el adjunto', 'attachment'], ['el borrador', 'draft'], ['la plantilla', 'template'], ['el descanso', 'break'],
  ['el turno', 'shift'], ['la baja', 'sick leave'], ['el jefe', 'boss'], ['la oficina', 'office'],
]);
const routineEx = b(5, [
  ['despertarse', 'to wake up'], ['ducharse', 'to shower'], ['vestirse', 'to dress'], ['desayunar', 'to have breakfast'],
  ['ir al trabajo', 'to go to work'], ['almorzar', 'to have lunch'], ['volver a casa', 'to come home'], ['ver la tele', 'to watch TV'],
  ['acostarse', 'to go to bed'], ['cepillarse los dientes', 'to brush teeth'], ['afeitarse', 'to shave'], ['maquillarse', 'to put on makeup'],
  ['lavar la ropa', 'to do laundry'], ['pasar la aspiradora', 'to vacuum'], ['fregar los platos', 'to wash up'], ['poner la mesa', 'to set the table'],
  ['ir de compras', 'to go shopping'], ['pasear', 'to go for a walk'], ['descansar', 'to rest'], ['cenar', 'to have dinner'],
]);
const moreAdj = b(6, [
  ['cansado', 'weary'], ['despierto', 'awake'], ['hambriento', 'hungry'], ['lleno', 'full'],
  ['sediento', 'thirsty'], ['borracho', 'drunk'], ['sobrio', 'sober'], ['en forma', 'fit'],
  ['embarazada', 'pregnant'], ['desnudo', 'naked'], ['vestido', 'dressed'], ['descalzo', 'barefoot'],
  ['ordenado', 'tidy'], ['desordenado', 'messy'], ['puntual', 'punctual'], ['retrasado', 'delayed'],
  ['presente', 'present'], ['ausente', 'absent'], ['vivo', 'alive'], ['muerto', 'dead'],
  ['ocupado', 'busy'], ['libre', 'free / vacant'], ['disponible', 'available'], ['agotado', 'sold out'],
]);
const phrasesEx = b(3, [
  ['buenos días', 'good morning'], ['buenas tardes', 'good afternoon'], ['buenas noches', 'good night'], ['adiós', 'goodbye'],
  ['hasta luego', 'see you later'], ['hasta pronto', 'see you soon'], ['bienvenido', 'welcome'], ['buena suerte', 'good luck'],
  ['que te diviertas', 'have fun'], ['buen viaje', 'have a good trip'], ['saludos', 'regards'], ['ni idea', 'no idea'],
  ['no hay problema', 'no problem'], ['no importa', 'never mind'], ['exacto', 'exactly'], ['de acuerdo', 'agreed'],
  ['lo siento', 'I’m sorry'], ['con permiso', 'excuse me'], ['claro que sí', 'of course'], ['por supuesto', 'certainly'],
]);
const moreNouns2 = b(9, [
  ['la ocasión', 'occasion'], ['el acontecimiento', 'event'], ['la situación', 'situation'], ['el caso', 'case'],
  ['el tema', 'topic'], ['el punto', 'point'], ['el asunto', 'matter'], ['la preocupación', 'concern'],
  ['el ámbito', 'field'], ['la dirección', 'direction'], ['el propósito', 'purpose'], ['el interés', 'interest'],
  ['el daño', 'damage'], ['el peligro', 'danger'], ['el riesgo', 'risk'], ['la oportunidad', 'chance'],
  ['la sugerencia', 'suggestion'], ['la decisión', 'decision'], ['la opinión', 'view'], ['el punto de vista', 'standpoint'],
  ['la intención', 'intent'], ['la mejora', 'improvement'], ['el problema', 'problem'], ['la solución', 'solution'],
]);
const finalBatch = [
  ...b(5, [
    ['la cucharada', 'spoonful'], ['la pizca', 'pinch'], ['los ingredientes', 'ingredients'], ['el flan', 'custard'],
    ['la tarta', 'tart'], ['el bollo', 'bun'], ['la tostada', 'toast'], ['el bacón', 'bacon'],
    ['los huevos revueltos', 'scrambled eggs'], ['la tortilla', 'omelette'], ['el bocadillo', 'sandwich'], ['la magdalena', 'muffin'],
  ]),
  ...b(6, [
    ['la canela', 'cinnamon'], ['el perejil', 'parsley'], ['la albahaca', 'basil'], ['el jengibre', 'ginger'],
    ['el chile', 'chilli'], ['la menta', 'mint'], ['la mostaza', 'mustard'], ['la mayonesa', 'mayonnaise'],
    ['la salsa', 'sauce'], ['el caldo', 'broth'], ['la masa', 'dough'], ['la corteza', 'crust'],
  ]),
  ...b(8, [
    ['la astronomía', 'astronomy'], ['la galaxia', 'galaxy'], ['el cometa', 'comet'], ['el cohete', 'rocket'],
    ['el satélite', 'satellite'], ['la gravedad', 'gravity'], ['la órbita', 'orbit'], ['la luna', 'moon'],
    ['la Tierra', 'Earth'], ['el oxígeno', 'oxygen'], ['el espacio exterior', 'outer space'], ['el astronauta', 'astronaut'],
  ]),
  ...b(7, [
    ['la avispa', 'wasp'], ['la oruga', 'caterpillar'], ['el caracol', 'snail'], ['la lombriz', 'earthworm'],
    ['la mariquita', 'ladybird'], ['el saltamontes', 'grasshopper'], ['el murciélago', 'bat'], ['el loro', 'parrot'],
    ['el pingüino', 'penguin'], ['el cocodrilo', 'crocodile'], ['la foca', 'seal'], ['el pulpo', 'octopus'],
  ]),
  ...b(6, [
    ['dorado', 'golden'], ['plateado', 'silver'], ['colorido', 'colourful'], ['azul claro', 'light blue'],
    ['verde oscuro', 'dark green'], ['turquesa', 'turquoise'], ['beige', 'beige'], ['violeta', 'violet'],
    ['tercero', 'third'], ['cuarto', 'fourth'], ['quinto', 'fifth'], ['décimo', 'tenth'],
  ]),
  ...b(9, [
    ['la sensación', 'sensation'], ['el picor', 'itch'], ['el mareo', 'dizziness'], ['la náusea', 'nausea'],
    ['la fatiga', 'tiredness'], ['el calor', 'warmth'], ['el frío', 'coldness'], ['el tacto', 'touch'],
    ['la presión', 'pressure'], ['el hormigueo', 'tingling'], ['el entumecimiento', 'numbness'], ['el equilibrio', 'balance'],
  ]),
  ...b(8, [
    ['la asignatura', 'school subject'], ['la historia', 'history'], ['la geografía', 'geography'], ['el arte', 'art class'],
    ['la educación física', 'PE'], ['la música', 'music class'], ['la informática', 'computer science'], ['la economía', 'economics'],
    ['la filosofía', 'philosophy'], ['la psicología', 'psychology'], ['la medicina', 'medicine (field)'], ['el derecho', 'law (field)'],
  ]),
];

const topUp = [
  ...b(7, [
    ['el vaso de plástico', 'plastic cup'], ['la jarra', 'jug'], ['el termo', 'thermos'], ['el delantal', 'apron'],
    ['el trapo', 'cloth'], ['la esponja', 'sponge'], ['el detergente', 'detergent'], ['la lejía', 'bleach'],
    ['el cubo de basura', 'bin'], ['la fregona', 'mop'], ['la escoba', 'broom'], ['el recogedor', 'dustpan'],
  ]),
  ...b(8, [
    ['el gobierno local', 'local government'], ['el alcalde', 'mayor'], ['el presidente', 'president'], ['el ministro', 'minister'],
    ['el impuesto', 'levy'], ['el presupuesto', 'budget'], ['la manifestación', 'demonstration'], ['la huelga', 'strike'],
    ['el sindicato', 'trade union'], ['la protesta', 'protest'], ['el discurso', 'address'], ['la campaña', 'campaign'],
  ]),
  ...b(6, [
    ['orgulloso', 'proud'], ['avergonzado', 'ashamed'], ['celoso', 'jealous'], ['agradecido', 'grateful'],
    ['asustado', 'frightened'], ['sorprendido', 'surprised'], ['aliviado', 'relieved'], ['frustrado', 'frustrated'],
    ['motivado', 'motivated'], ['inspirado', 'inspired'], ['satisfecho', 'pleased'], ['decidido', 'determined'],
  ]),
  ...b(7, [
    ['aparecer', 'to appear'], ['desaparecer', 'to disappear'], ['ocurrir', 'to occur'], ['suceder', 'to happen'],
    ['comenzar', 'to commence'], ['acabar', 'to finish'], ['durar', 'to last'], ['repartir', 'to hand out'],
    ['recoger', 'to gather'], ['guardar', 'to keep'], ['devolver', 'to return'], ['prestar', 'to lend'],
    ['pedir prestado', 'to borrow'], ['añadir', 'to add'], ['quitar', 'to remove'], ['colgar', 'to hang'],
  ]),
  ...b(8, [
    ['el escritor', 'writer'], ['el poeta', 'poet'], ['el pintor', 'painter'], ['el escultor', 'sculptor'],
    ['el bailarín', 'dancer'], ['el chef', 'chef'], ['el camionero', 'lorry driver'], ['el marinero', 'sailor'],
    ['el pescador', 'fisherman'], ['el minero', 'miner'], ['el granjero', 'farmer'], ['el veterinario', 'vet'],
  ]),
  ...b(9, [
    ['la teoría', 'theory'], ['el concepto', 'concept'], ['la idea', 'idea'], ['la hipótesis', 'hypothesis'],
    ['la prueba', 'proof'], ['la evidencia', 'evidence'], ['el argumento', 'argument'], ['la conclusión', 'conclusion'],
    ['el análisis', 'analysis'], ['la comparación', 'comparison'], ['la diferencia', 'difference'], ['la semejanza', 'similarity'],
  ]),
  ...b(6, [
    ['el vecindario', 'neighbourhood'], ['la acera', 'pavement'], ['la carretera', 'road'], ['la autopista', 'motorway'],
    ['el cruce', 'crossroads'], ['la rotonda', 'roundabout'], ['la fuente', 'fountain'], ['el banco', 'bench'],
    ['la farola', 'streetlight'], ['el buzón', 'postbox'], ['la papelera', 'litter bin'], ['el quiosco', 'newsstand'],
  ]),
];

export const FREQUENCY_WORDS_ES = [
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
  ...finalBatch, ...topUp,
];
