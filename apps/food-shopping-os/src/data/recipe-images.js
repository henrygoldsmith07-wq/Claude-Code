const IMAGE_ROOT = '/recipe-images';

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
  const hash = String(recipe.id || recipe.name || '').split('')
    .reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  return keys[hash % keys.length];
};

export const recipeImage = (recipe) => RECIPE_IMAGES[imageKey(recipe)];
