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
 * from the network, so a local, recipe-specific illustration is used when the
 * request cannot be made — offline, or on a failed request, a card still shows
 * the dish it belongs to rather than an unrelated category photo.
 */

const IMAGE_ROOT = '/recipe-images';

const GENERATOR_ROOT = 'https://image.pollinations.ai/prompt';

/** One request size for every use, so a thumbnail and a hero share a cache entry. */
const IMAGE_WIDTH = 768;
const IMAGE_HEIGHT = 512;
const MAX_GENERATOR_SEED = 2147483647;

/** Long prompts stop steering the picture and only bloat the URL. */
const MAX_PROMPT = 420;

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

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const fallbackPalette = {
  breakfast: ['#FFF1D7', '#D47B38', '#F5C06A'],
  curry: ['#FBE7C4', '#B9542A', '#E69B45'],
  noodles: ['#E5F0E8', '#377A58', '#E6A24A'],
  pasta: ['#F8E8C8', '#C65B37', '#E1A24A'],
  roast: ['#F3E4D9', '#8E4933', '#C87746'],
  salad: ['#E4F1E2', '#3B8050', '#9DBD54'],
  sandwich: ['#F5E9D2', '#9A5B35', '#D39A56'],
  tacos: ['#FBE6BE', '#BD672F', '#E2A845'],
};

/**
 * The hero ingredients a cook would actually name when describing the dish.
 * Components are listed base-first, and the salt and oil at the end of the
 * list describe nothing, so the front of the list is the useful part.
 */
const heroIngredients = (recipe = {}) => (recipe.ingredients || [])
  .map((item) => (typeof item === 'string' ? item : item?.name))
  .filter((name) => typeof name === 'string' && name.trim())
  .slice(0, 4)
  .map((name) => name.trim().toLowerCase());

/**
 * A deterministic, recipe-specific local illustration. It is deliberately
 * not another stock photograph: if a generated image is unavailable, the
 * name and hero ingredients still travel with the recipe instead of silently
 * showing the wrong dish.
 */
export const recipeFallbackImage = (recipe = {}) => {
  const name = String(recipe.name || '').trim();
  if (!name) return fallbackImage(recipe);

  const key = imageKey(recipe);
  const [background, accent, highlight] = fallbackPalette[key];
  const ingredients = heroIngredients(recipe);
  const ingredientLabels = ingredients.length ? ingredients : ['your ingredients'];
  const ingredientChips = ingredientLabels.map((ingredient, index) => {
    const x = 48 + (index * 170);
    return `<g transform="translate(${x} 430)"><rect width="154" height="32" rx="16" fill="${highlight}" opacity=".82"/><text x="77" y="21" text-anchor="middle" font-size="13" font-weight="700" fill="#3b3028">${escapeXml(ingredient.slice(0, 22))}</text></g>`;
  }).join('');
  const seed = hash(`${recipe.id || name}:${key}`);
  const random = (index, modulo) => (seed + (index * 7919)) % modulo;
  const garnish = Array.from({ length: 7 }, (_, index) => {
    const x = 260 + random(index, 250);
    const y = 228 + random(index + 7, 94);
    const radius = 10 + random(index + 13, 10);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${index % 2 ? highlight : accent}" opacity=".${index % 3 + 4}"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512" viewBox="0 0 768 512"><rect width="768" height="512" fill="${background}"/><circle cx="384" cy="274" r="176" fill="#ffffff" opacity=".42"/><ellipse cx="384" cy="306" rx="190" ry="118" fill="#ffffff" stroke="${accent}" stroke-width="8"/><ellipse cx="384" cy="298" rx="150" ry="86" fill="${background}" opacity=".82"/>${garnish}<text x="48" y="58" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="2" fill="${accent}">RECIPE ILLUSTRATION</text><text x="48" y="103" font-family="system-ui, sans-serif" font-size="30" font-weight="800" fill="#2f2924">${escapeXml(name.slice(0, 42))}</text>${ingredientChips}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const dishFormat = (recipe = {}) => {
  const text = [recipe.name, recipe.meal, ...(recipe.tags || [])].join(' ').toLowerCase();
  if (/porridge|oat|smoothie|yogurt|yoghurt|cereal/.test(text)) return 'one breakfast bowl of';
  if (/pancake|waffle|crumpet/.test(text)) return 'one breakfast stack of';
  if (/soup|pho|ramen|noodle|curry|dal|dahl|chilli|chili|stew|tagine|casserole/.test(text)) return 'one bowl of';
  if (/salad|grain bowl|poke|bibimbap|bowl/.test(text)) return 'one bowl of';
  if (/pasta|spaghetti|linguine|penne|lasagne|lasagna|risotto/.test(text)) return 'one plate of';
  if (/traybake|tray bake|roast|barbecue|bbq/.test(text)) return 'one roasting tray of';
  if (/sandwich|toastie|wrap|burger|bagel/.test(text)) return 'one finished sandwich';
  if (/taco|fajita|burrito|quesadilla|pizza|flatbread|roti/.test(text)) return 'one plate of';
  if (/omelette|omelet|frittata|quiche|pie|bake/.test(text)) return 'one finished bake on one plate';
  return 'one finished meal on one plate';
};

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
    `photorealistic food photograph of ${dishFormat(recipe)} ${name}`,
    [recipe.cuisine, recipe.meal].filter(Boolean).join(' ').trim().toLowerCase(),
    ingredients.length ? `made with ${ingredients.join(', ')} only` : '',
    'show only this named dish and its listed ingredients, overhead, natural daylight, plain background, no extra food, no text',
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

  // Pollinations validates seed as a signed 32-bit integer. The hash is
  // intentionally unsigned so it can be stable across browsers; reduce it
  // before putting it on the wire or the request becomes a generic fallback.
  const seed = hash(recipe.id || recipe.name) % MAX_GENERATOR_SEED;
  // The keyless legacy endpoint currently honours size and seed. Its newer
  // model and post-processing parameters are ignored (and the newer endpoint
  // requires an API key), so keep the URL to the parameters that work here.
  const query = new URLSearchParams({
    width: String(IMAGE_WIDTH),
    height: String(IMAGE_HEIGHT),
    seed: String(seed),
  });

  return `${GENERATOR_ROOT}/${encodeURIComponent(prompt)}?${query}`;
};
