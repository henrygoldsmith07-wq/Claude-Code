/**
 * Recipe imagery.
 *
 * The dishes here are composed, not hand-written — over twelve hundred of them
 * built from the components in `recipe-parts.js` — so there is no photograph
 * waiting for each one. Eight stock pictures spread across that many recipes
 * meant a single image did duty for 534 different dishes: every porridge, every
 * omelette and every smoothie shared one bowl of oats. A picture that generic
 * tells you nothing about what you are about to cook.
 *
 * So the picture is made from the dish itself. The recipe's name, cuisine and
 * hero ingredients become a prompt to Pollinations — a free image service that
 * needs no key and no account — and the recipe's id becomes the seed, so the
 * same dish always resolves to the same picture. Stable seeds matter for more
 * than consistency: an unchanging URL is one the browser can cache, so a
 * recipe is only ever generated once per device.
 *
 * Two honesty notes, because they are the reason this file is shaped the way
 * it is. These are illustrations of a dish, not photographs of the food you
 * will make, and the app says so wherever one is shown large. And they come
 * from the network, so the eight bundled pictures stay exactly where they were
 * as the fallback — offline, or on a failed request, a card still shows
 * something sensible rather than a broken frame.
 */

const IMAGE_ROOT = '/recipe-images';

const GENERATOR_ROOT = 'https://image.pollinations.ai/prompt';

/** One request size for every use, so a thumbnail and a hero share a cache entry. */
const IMAGE_WIDTH = 768;
const IMAGE_HEIGHT = 512;

/** Long prompts stop steering the picture and only bloat the URL. */
const MAX_PROMPT = 220;

/**
 * The bundled pictures. No longer the primary source, but still the answer
 * when there is no network — and still the reason an offline recipe card
 * looks like a recipe card.
 */
export const RECIPE_IMAGES = {
  breakfast: `${IMAGE_ROOT}/breakfast.webp`,
  curry: `${IMAGE_ROOT}/curry.webp`,
  noodles: `${IMAGE_ROOT}/noodles.webp`,
  pasta: `${IMAGE_ROOT}/pasta.webp`,
  roast: `${IMAGE_ROOT}/roast.webp`,
  salad: `${IMAGE_ROOT}/salad.webp`,
  sandwich: `${IMAGE_ROOT}/sandwich.webp`,
  tacos: `${IMAGE_ROOT}/tacos.webp`,
};

const imageKey = (recipe = {}) => {
  const text = [
    recipe.name,
    recipe.cuisine,
    recipe.meal,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []).map((item) => item.name || item),
  ].join(' ').toLowerCase();

  if (/\b(breakfast|brunch|oat|porridge|pancake|yogurt|yoghurt|smoothie|egg)\b/.test(text)) return 'breakfast';
  if (/\b(curry|dal|dahl|tikka|masala|indian)\b/.test(text)) return 'curry';
  if (/\b(pasta|spaghetti|linguine|penne|lasagne|lasagna|ragu|italian)\b/.test(text)) return 'pasta';
  if (/\b(taco|fajita|burrito|quesadilla|mexican|chilli|chili)\b/.test(text)) return 'tacos';
  if (/\b(sandwich|toastie|wrap|burger|bagel)\b/.test(text)) return 'sandwich';
  if (/\b(salad|grain bowl|poke|greens|mediterranean|halloumi)\b/.test(text)) return 'salad';
  if (/\b(roast|traybake|tray bake|chicken|potato|barbecue|bbq)\b/.test(text)) return 'roast';
  if (/\b(noodle|stir-fry|stir fry|teriyaki|ramen|sushi|japanese|chinese|thai)\b/.test(text)) return 'noodles';

  const keys = Object.keys(RECIPE_IMAGES);
  return keys[hash(String(recipe.id || recipe.name || '')) % keys.length];
};

const hash = (s) => String(s).split('')
  .reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);

/** The bundled picture for a recipe: the offline answer, and the fallback. */
export const fallbackImage = (recipe) => RECIPE_IMAGES[imageKey(recipe)];

/**
 * The three ingredients a cook would actually name when describing the dish.
 * Components are listed base-first, and the salt and oil at the end of the
 * list describe nothing, so the front of the list is the useful part.
 */
const heroIngredients = (recipe = {}) => (recipe.ingredients || [])
  .map((item) => (typeof item === 'string' ? item : item?.name))
  .filter((name) => typeof name === 'string' && name.trim())
  .slice(0, 3)
  .map((name) => name.trim().toLowerCase());

/**
 * What the picture should show. The dish leads, because the name is the most
 * specific thing known about it; the styling clauses are fixed so that a grid
 * of recipes reads as one set of photographs rather than eight moods.
 */
export const imagePrompt = (recipe = {}) => {
  const name = String(recipe.name || '').trim();
  if (!name) return '';

  const ingredients = heroIngredients(recipe);
  const parts = [
    name,
    [recipe.cuisine, recipe.meal].filter(Boolean).join(' ').trim().toLowerCase(),
    ingredients.length ? `made with ${ingredients.join(', ')}` : '',
    'appetising food photography, overhead, natural daylight, plain background, no text',
  ].filter(Boolean);

  return parts.join(', ').slice(0, MAX_PROMPT);
};

/**
 * The picture for a recipe. Generated from the dish where there is enough to
 * describe it, bundled where there is not — a recipe with no name would only
 * produce a prompt for "food".
 */
export const recipeImage = (recipe = {}) => {
  const prompt = imagePrompt(recipe);
  if (!prompt) return fallbackImage(recipe);

  const seed = hash(recipe.id || recipe.name);
  const query = new URLSearchParams({
    width: String(IMAGE_WIDTH),
    height: String(IMAGE_HEIGHT),
    seed: String(seed),
    nologo: 'true',
    model: 'flux',
  });

  return `${GENERATOR_ROOT}/${encodeURIComponent(prompt)}?${query}`;
};
