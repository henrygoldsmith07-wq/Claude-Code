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
 * The primary picture is a small set of curated, public-domain food photos
 * bundled with the app and selected by dish family. That makes the first
 * render reliable and keeps the catalogue useful offline. Recipes that do not
 * fit a named family use a meal-format photo rather than a random dish; the
 * name, cuisine and hero ingredients remain available to Pollinations as a
 * secondary network option for custom recipes.
 *
 * Two honesty notes, because they are the reason this file is shaped the way
 * it is. These are reference images of a dish, not photographs of the food
 * the user will make, and the app says so wherever one is shown large. A
 * generated image is only a secondary illustration; if it cannot be fetched,
 * the final fallback carries the recipe name and hero ingredients instead of
 * showing a wrong dish.
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
 * The original category photos remain available for broad families and as the
 * final image fallback for recipes with incomplete data.
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

const PHOTO_ROOT = `${IMAGE_ROOT}/families`;

/**
 * Curated CC0/public-domain photos bundled with the app. Keeping the primary
 * photo local means a recipe card never depends on a third-party generator or
 * image host being available at the moment it is opened.
 */
export const RECIPE_PHOTOS = {
  bagel: `${PHOTO_ROOT}/bagel.webp`,
  breakfast: RECIPE_IMAGES.breakfast,
  bibimbap: `${PHOTO_ROOT}/bibimbap.webp`,
  brownie: `${PHOTO_ROOT}/brownie.webp`,
  couscous: `${PHOTO_ROOT}/couscous.webp`,
  crumble: `${PHOTO_ROOT}/crumble.webp`,
  frittata: `${PHOTO_ROOT}/frittata.webp`,
  noodles: RECIPE_IMAGES.noodles,
  overnight: `${PHOTO_ROOT}/overnight.webp`,
  pancakes: RECIPE_IMAGES.breakfast,
  pasta: RECIPE_IMAGES.pasta,
  pizza: `${PHOTO_ROOT}/pizza.webp`,
  porridge: `${PHOTO_ROOT}/overnight.webp`,
  roast: RECIPE_IMAGES.roast,
  roastveg: `${PHOTO_ROOT}/roastveg.webp`,
  salad: RECIPE_IMAGES.salad,
  salmon: `${PHOTO_ROOT}/salmon.webp`,
  sandwich: RECIPE_IMAGES.sandwich,
  shakshuka: `${PHOTO_ROOT}/shakshuka.webp`,
  smoothie: `${PHOTO_ROOT}/smoothie.webp`,
  stirfry: `${PHOTO_ROOT}/stirfry.webp`,
  tacos: `${PHOTO_ROOT}/tacos.webp`,
  tuna: `${PHOTO_ROOT}/tuna.webp`,
  curry: RECIPE_IMAGES.curry,
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

const photoKey = (recipe = {}) => {
  const text = [
    recipe.name,
    recipe.cuisine,
    recipe.meal,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []).map((item) => item.name || item),
  ].join(' ').toLowerCase();

  if (/shakshuka|poached egg|tomato.*egg/.test(text)) return 'shakshuka';
  if (/smoothie bowl|smoothie/.test(text)) return 'smoothie';
  if (/overnight oat/.test(text)) return 'overnight';
  if (/porridge|oatmeal/.test(text)) return 'porridge';
  if (/pancake|waffle|crumpet/.test(text)) return 'pancakes';
  if (/bagel/.test(text)) return 'bagel';
  if (/omelette|omelet|frittata|quiche|egg[s]? .*toast|egg[s]? .*wholemeal/.test(text)) return 'frittata';
  if (/yogurt bowl|yoghurt bowl/.test(text)) return 'overnight';
  if (/bibimbap/.test(text)) return 'bibimbap';
  if (/salmon.*bowl|bowl.*salmon/.test(text)) return 'salmon';
  if (/salmon/.test(text)) return 'salmon';
  if (/pho/.test(text)) return 'noodles';
  if (/couscous|quinoa bowl|grain bowl/.test(text)) return 'couscous';
  if (/pesto.*pasta|pasta.*pesto/.test(text)) return 'pasta';
  if (/pasta|spaghetti|linguine|penne|lasagne|lasagna|risotto/.test(text)) return 'pasta';
  if (/stir[- ]?fry/.test(text)) return 'stirfry';
  if (/brownie/.test(text)) return 'brownie';
  if (/crumble|cobbler/.test(text)) return 'crumble';
  if (/curry|korma|dal|dahl|tikka|masala/.test(text)) return 'curry';
  if (/paella|tagine/.test(text)) return 'couscous';
  if (/soup|stew|casserole|chilli|chili|jerk/.test(text)) return 'curry';
  if (/tuna.*salad|salad.*tuna/.test(text)) return 'tuna';
  if (/salad/.test(text)) return 'salad';
  if (/jacket potato/.test(text)) return 'roastveg';
  if (/traybake|roast/.test(text)) return /chicken|turkey|pork|lamb/.test(text) ? 'roast' : 'roastveg';
  if (/pizza/.test(text)) return 'pizza';
  if (/taco|fajita|burrito|quesadilla/.test(text)) return 'tacos';
  if (/sandwich|wrap|burger|toastie|halloumi/.test(text)) return 'sandwich';
  if (/ramen|noodle/.test(text)) return 'noodles';
  if (recipe.meal === 'breakfast') return 'breakfast';
  if (recipe.meal === 'lunch') return 'salad';
  if (recipe.meal === 'dinner') return 'roast';
  return undefined;
};

const hash = (s) => String(s).split('')
  .reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);

/** The bundled picture for a recipe: the offline answer, and the fallback. */
export const fallbackImage = (recipe) => RECIPE_IMAGES[imageKey(recipe)];

/** The best local photo family for a recipe, available before any network call. */
export const recipePhotoImage = (recipe) => RECIPE_PHOTOS[photoKey(recipe)];

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
