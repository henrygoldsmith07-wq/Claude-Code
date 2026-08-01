/**
 * High-definition recipe icons.
 *
 * Recipe cards use deterministic inline SVG rather than stock photography or
 * a remote image service. The icon is crisp at any size, works offline, and
 * uses the same neutral surfaces and restrained accents as the Le Studio UI.
 * Dish families still get a recognisable motif and a quiet colour cue.
 */

const hash = (value) => String(value).split('')
  .reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const recipeText = (recipe = {}) => [
  recipe.name,
  recipe.cuisine,
  recipe.meal,
  ...(recipe.tags || []),
  ...(recipe.ingredients || []).map((item) => item?.name || item),
].join(' ').toLowerCase();

const heroIngredients = (recipe = {}) => (recipe.ingredients || [])
  .map((item) => (typeof item === 'string' ? item : item?.name))
  .filter((name) => typeof name === 'string' && name.trim())
  .slice(0, 3)
  .map((name) => name.trim().toLowerCase());

const iconKey = (recipe = {}) => {
  const text = recipeText(recipe);

  if (/shakshuka|poached egg|tomato.*egg/.test(text)) return 'shakshuka';
  if (/smoothie bowl|smoothie/.test(text)) return 'smoothie';
  if (/overnight oat/.test(text)) return 'overnight';
  if (/porridge|oatmeal/.test(text)) return 'porridge';
  if (/pancake|waffle|crumpet/.test(text)) return 'pancakes';
  if (/bagel/.test(text)) return 'bagel';
  if (/egg[s]? .*toast|egg[s]? .*wholemeal/.test(text)) return 'eggs';
  if (/omelette|omelet|frittata|quiche/.test(text)) return 'frittata';
  if (/yogurt bowl|yoghurt bowl/.test(text)) return 'overnight';
  if (/bibimbap/.test(text)) return 'bibimbap';
  if (/salmon/.test(text)) return 'salmon';
  if (/tuna.*salad|salad.*tuna/.test(text)) return 'tuna';
  if (/pho/.test(text)) return 'noodles';
  if (/couscous|quinoa bowl|grain bowl/.test(text)) return 'couscous';
  if (/pasta|spaghetti|linguine|penne|lasagne|lasagna|risotto/.test(text)) return 'pasta';
  if (/stir[- ]?fry/.test(text)) return 'stirfry';
  if (/brownie/.test(text)) return 'brownie';
  if (/crumble|cobbler/.test(text)) return 'crumble';
  if (/soup/.test(text)) return 'soup';
  if (/curry|korma|dal|dahl|tikka|masala/.test(text)) return 'curry';
  if (/chilli|chili/.test(text)) return 'chilli';
  if (/paella|tagine/.test(text)) return 'couscous';
  if (/stew|casserole|jerk/.test(text)) return 'stew';
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
  return 'default';
};

const THEME_TOKENS = {
  light: {
    background: '#F4F4F6', wash: '#ECECEF', plate: '#FFFFFF', line: '#DCDCE1',
    ink: '#131316', muted: '#4D4D55', faint: '#6A6A74',
  },
  dark: {
    background: '#0B0B0D', wash: '#242428', plate: '#17171A', line: '#34343A',
    ink: '#F4F4F5', muted: '#B2B2BA', faint: '#8F8F99',
  },
};

const ACCENT_TONES = {
  mono: '#131316', forest: '#3D5C4B', ocean: '#3B5B73', wine: '#6E4550',
  honey: '#8A6A3B', sage: '#5F7360', clay: '#8C5A44', ink: '#2F3640',
};

const FAMILY_TONES = {
  sunrise: { light: ['#8A6A3B', '#B69D70'], dark: ['#D2B077', '#AA8043'] },
  berry: { light: ['#6E4550', '#AA8791'], dark: ['#C797A3', '#9B6573'] },
  spice: { light: ['#8C5A44', '#B58D78'], dark: ['#D1A289', '#A16D53'] },
  jade: { light: ['#3D5C4B', '#85A18C'], dark: ['#87B89B', '#5F8C71'] },
  tomato: { light: ['#8F4D47', '#C78576'], dark: ['#D49A91', '#A96B62'] },
  leaf: { light: ['#3D5C4B', '#85A18C'], dark: ['#87B89B', '#5F8C71'] },
  sand: { light: ['#8A6A3B', '#B69D70'], dark: ['#D2B077', '#AA8043'] },
  citrus: { light: ['#8A6A3B', '#C4A34D'], dark: ['#D2B077', '#AD893D'] },
  ocean: { light: ['#3B5B73', '#7F9DB3'], dark: ['#8DB8D4', '#5C91B4'] },
  ember: { light: ['#6E4550', '#B98272'], dark: ['#C797A3', '#9B6573'] },
  cocoa: { light: ['#60473B', '#A98065'], dark: ['#C4A18A', '#946E58'] },
  default: { light: ['#2F3640', '#85909C'], dark: ['#C1CAD4', '#7E8D9F'] },
};

const PALETTE_BY_KEY = {
  breakfast: 'sunrise', pancakes: 'sunrise', eggs: 'sunrise', frittata: 'sunrise', shakshuka: 'sunrise',
  overnight: 'berry', porridge: 'berry', smoothie: 'berry',
  curry: 'spice', chilli: 'spice', soup: 'spice', stew: 'spice',
  noodles: 'jade', stirfry: 'jade',
  pasta: 'tomato', pizza: 'tomato',
  salad: 'leaf', couscous: 'leaf', bibimbap: 'leaf',
  sandwich: 'sand', bagel: 'sand', tacos: 'citrus',
  salmon: 'ocean', tuna: 'ocean', roast: 'ember', roastveg: 'ember',
  brownie: 'cocoa', crumble: 'cocoa',
};

const resolvePalette = (key, theme = 'light', accent = 'mono') => {
  const mode = theme === 'dark' ? 'dark' : 'light';
  const tokens = THEME_TOKENS[mode];
  const family = FAMILY_TONES[PALETTE_BY_KEY[key] || 'default'] || FAMILY_TONES.default;
  const [primary, accentTone] = family[mode];
  return {
    ...tokens,
    primary,
    accent: accentTone,
    secondary: tokens.muted,
    brand: ACCENT_TONES[accent] || ACCENT_TONES.mono,
  };
};

const FAMILY_LABELS = {
  breakfast: 'BREAKFAST', pancakes: 'PANCAKES', eggs: 'EGGS ON TOAST', frittata: 'BAKED EGGS',
  shakshuka: 'SHAKSHUKA', overnight: 'OVERNIGHT OATS', porridge: 'PORRIDGE', smoothie: 'SMOOTHIE BOWL',
  curry: 'CURRY', chilli: 'CHILLI', soup: 'SOUP', stew: 'STEW', noodles: 'NOODLES', stirfry: 'STIR-FRY',
  pasta: 'PASTA', pizza: 'PIZZA', salad: 'SALAD', couscous: 'GRAIN BOWL', bibimbap: 'BIBIMBAP',
  sandwich: 'SANDWICH', bagel: 'BAGEL', tacos: 'TACOS', salmon: 'SALMON', tuna: 'TUNA',
  roast: 'ROAST', roastveg: 'ROASTED VEG', brownie: 'BROWNIE', crumble: 'CRUMBLE',
};

const seeded = (seed, index, modulo) => (seed + (index * 7919)) % modulo;

const garnish = (palette, seed) => Array.from({ length: 9 }, (_, index) => {
  const x = 335 + seeded(seed, index, 360);
  const y = 250 + seeded(seed, index + 11, 170);
  const radius = 8 + seeded(seed, index + 23, 13);
  const colour = [palette.primary, palette.secondary, palette.accent][index % 3];
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${colour}" opacity=".88"/>`;
}).join('');

const plate = (palette) => `<ellipse cx="512" cy="398" rx="260" ry="142" fill="${palette.plate}" stroke="${palette.line}" stroke-width="7"/><ellipse cx="512" cy="390" rx="204" ry="103" fill="${palette.background}" opacity=".8"/>`;
const bowl = (palette) => `<path d="M278 330 Q512 540 746 330 Q718 520 512 554 Q306 520 278 330Z" fill="${palette.plate}" stroke="${palette.line}" stroke-width="7"/><ellipse cx="512" cy="331" rx="236" ry="74" fill="${palette.primary}" opacity=".88"/>`;

const renderMotif = (key, palette, seed) => {
  const garnishDots = garnish(palette, seed);
  if (['soup', 'curry', 'chilli', 'stew'].includes(key)) {
    return `${bowl(palette)}<ellipse cx="512" cy="324" rx="188" ry="52" fill="${palette.accent}" opacity=".72"/>${garnishDots}<path d="M395 245 Q405 196 430 182 M512 235 Q512 184 535 162 M620 245 Q634 202 659 188" fill="none" stroke="${palette.plate}" stroke-width="10" stroke-linecap="round" opacity=".8"/>`;
  }
  if (['porridge', 'overnight', 'smoothie'].includes(key)) {
    return `${bowl(palette)}<ellipse cx="512" cy="326" rx="184" ry="48" fill="${palette.secondary}" opacity=".55"/>${garnishDots}<path d="M407 303 Q470 270 530 310 T628 302" fill="none" stroke="${palette.plate}" stroke-width="14" stroke-linecap="round"/>`;
  }
  if (['salad', 'couscous', 'bibimbap'].includes(key)) {
    return `${bowl(palette)}<path d="M350 326 Q410 284 470 326 T590 326 T674 326" fill="none" stroke="${palette.accent}" stroke-width="40" stroke-linecap="round"/>${garnishDots}<path d="M382 345 Q440 306 490 347 M536 347 Q590 306 650 345" fill="none" stroke="${palette.plate}" stroke-width="13" stroke-linecap="round"/>`;
  }
  if (['noodles', 'stirfry'].includes(key)) {
    return `${bowl(palette)}<path d="M344 320 Q410 278 468 323 T588 323 T680 315 M350 350 Q414 308 475 350 T598 348 T675 338" fill="none" stroke="${palette.plate}" stroke-width="16" stroke-linecap="round"/>${garnishDots}`;
  }
  if (['pasta'].includes(key)) {
    return `${plate(palette)}<path d="M374 340 Q440 270 506 347 T638 338 M392 382 Q460 314 520 382 T646 374 M410 420 Q475 352 530 420 T616 414" fill="none" stroke="${palette.primary}" stroke-width="24" stroke-linecap="round"/>${garnishDots}`;
  }
  if (['sandwich', 'bagel'].includes(key)) {
    const bread = key === 'bagel'
      ? `<ellipse cx="512" cy="370" rx="174" ry="92" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10"/><ellipse cx="512" cy="370" rx="65" ry="30" fill="${palette.background}" stroke="${palette.secondary}" stroke-width="10"/>`
      : `<rect x="336" y="294" width="352" height="92" rx="30" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10" transform="rotate(-7 512 340)"/><rect x="356" y="382" width="352" height="92" rx="30" fill="${palette.accent}" stroke="${palette.secondary}" stroke-width="10" transform="rotate(7 512 420)"/>`;
    return `${plate(palette)}${bread}<path d="M382 360 Q512 310 642 360" fill="none" stroke="${palette.plate}" stroke-width="16" stroke-linecap="round" opacity=".9"/>`;
  }
  if (['tacos'].includes(key)) {
    return `${plate(palette)}<path d="M342 394 Q392 258 468 394Z M462 394 Q512 250 588 394Z M582 394 Q632 264 706 394Z" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10"/>${garnishDots}`;
  }
  if (['pizza'].includes(key)) {
    return `${plate(palette)}<circle cx="512" cy="378" r="132" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10"/><path d="M512 246 V510 M380 378 H644" stroke="${palette.plate}" stroke-width="8" opacity=".8"/>${garnishDots}`;
  }
  if (['salmon', 'tuna'].includes(key)) {
    return `${plate(palette)}<path d="M352 384 Q448 270 594 350 Q645 378 694 330 Q682 398 694 446 Q638 400 594 414 Q448 490 352 384Z" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10"/><circle cx="590" cy="360" r="10" fill="${palette.plate}"/> <path d="M420 354 Q495 382 576 378 M424 398 Q500 420 580 400" fill="none" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round"/>`;
  }
  if (['roast', 'roastveg'].includes(key)) {
    return `<rect x="296" y="282" width="432" height="190" rx="32" fill="${palette.plate}" stroke="${palette.secondary}" stroke-width="10"/><ellipse cx="420" cy="370" rx="92" ry="56" fill="${palette.primary}"/><ellipse cx="580" cy="370" rx="92" ry="56" fill="${palette.accent}"/>${garnishDots}`;
  }
  if (['brownie', 'crumble'].includes(key)) {
    return `${plate(palette)}<rect x="372" y="288" width="280" height="166" rx="22" fill="${palette.primary}" stroke="${palette.secondary}" stroke-width="10" transform="rotate(-4 512 370)"/><path d="M415 350 H610 M430 404 H590" stroke="${palette.accent}" stroke-width="20" stroke-linecap="round"/>${garnishDots}`;
  }
  if (['eggs', 'frittata', 'shakshuka'].includes(key)) {
    return `${plate(palette)}<ellipse cx="448" cy="362" rx="66" ry="55" fill="${palette.plate}" stroke="${palette.primary}" stroke-width="10"/><circle cx="448" cy="362" r="22" fill="${palette.accent}"/><ellipse cx="580" cy="392" rx="66" ry="55" fill="${palette.plate}" stroke="${palette.primary}" stroke-width="10"/><circle cx="580" cy="392" r="22" fill="${palette.accent}"/>${garnishDots}`;
  }
  return `${plate(palette)}${garnishDots}`;
};

const ICON_CACHE = new Map();

const iconCacheKey = (recipe = {}, theme = 'light', accent = 'mono') => [
  theme,
  accent,
  recipe.id,
  recipe.name,
  recipe.meal,
  recipe.cuisine,
  ...(recipe.ingredients || []).map((item) => (typeof item === 'string' ? item : item?.name)),
].join('|');

/** Render the recipe as an inline SVG data URI; no photo files or network calls are needed. */
export const recipeIconImage = (recipe = {}, options = {}) => {
  const theme = options?.theme === 'dark' ? 'dark' : 'light';
  const accent = options?.accent || 'mono';
  const cacheKey = iconCacheKey(recipe, theme, accent);
  const cached = ICON_CACHE.get(cacheKey);
  if (cached) return cached;

  const name = String(recipe.name || 'Recipe').trim() || 'Recipe';
  const key = iconKey(recipe);
  const palette = resolvePalette(key, theme, accent);
  const seed = hash(`${recipe.id || name}:${key}`);
  const gradientId = `recipe-icon-${seed}`;
  const label = FAMILY_LABELS[key] || 'RECIPE ICON';
  const chips = heroIngredients(recipe).map((ingredient, index) => {
    const x = 48 + (index * 236);
    return `<g transform="translate(${x} 607)"><rect width="214" height="38" rx="19" fill="${palette.plate}" stroke="${palette.line}" stroke-width="2" opacity=".92"/><text x="107" y="25" text-anchor="middle" font-size="15" font-weight="750" fill="${palette.muted}">${escapeXml(ingredient.slice(0, 22))}</text></g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="680" viewBox="0 0 1024 680" role="img" aria-label="${escapeXml(name)} recipe icon"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.background}"/><stop offset="1" stop-color="${palette.wash}"/></linearGradient></defs><rect width="1024" height="680" rx="42" fill="url(#${gradientId})"/><circle cx="860" cy="96" r="150" fill="${palette.secondary}" opacity=".08"/><circle cx="120" cy="594" r="170" fill="${palette.primary}" opacity=".08"/><path d="M0 520 Q220 438 410 560 T820 520 T1120 550 V680 H0Z" fill="${palette.plate}" opacity=".45"/><path d="M828 58l9 54 54 9-54 9-9 54-9-54-54-9 54-9Z" fill="${palette.brand}" opacity=".55"/>${renderMotif(key, palette, seed)}<g transform="translate(48 46)"><rect width="190" height="36" rx="18" fill="${palette.ink}" opacity=".92"/><text x="95" y="24" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="1.5" fill="${palette.background}">${escapeXml(label)}</text></g><text x="48" y="565" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="30" font-weight="750" fill="${palette.ink}">${escapeXml(name.slice(0, 42))}</text>${chips}</svg>`;
  const icon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  if (ICON_CACHE.size >= 2048) ICON_CACHE.delete(ICON_CACHE.keys().next().value);
  ICON_CACHE.set(cacheKey, icon);
  return icon;
};

/** Compatibility names for callers that only need the recipe artwork. */
export const recipeImage = recipeIconImage;
export const recipeFallbackImage = recipeIconImage;
