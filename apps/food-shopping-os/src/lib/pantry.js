/**
 * Pantry quantity maths: parsing, package-size normalisation, summing and
 * comparison.
 *
 * The pantry stores quantities as free text ("2 tins", "400 g", "3 x 200g",
 * "½ lemon"). That is right for display, but the app can only be honest about
 * "do I have enough" when it can put two quantities on the same scale. This
 * module parses what it can, normalises countable packages to mass where the
 * package size is a known everyday fact (a tin of tomatoes is 400 g — that is
 * not a guess, it is the size they come in), and refuses to compare anything
 * it cannot put on the same scale. A number the maths cannot trust is left as
 * text rather than quietly assumed.
 */

const clean = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const COUNT_UNITS = [
  'tin', 'tins', 'can', 'cans', 'pack', 'packs', 'bag', 'bags', 'box', 'boxes',
  'bottle', 'bottles', 'jar', 'jars', 'carton', 'cartons', 'loaf', 'loaves',
  'piece', 'pieces', 'egg', 'eggs', 'unit', 'units', 'portion', 'portions',
  'bunch', 'bunches', 'head', 'heads', 'bar', 'bars', 'tub', 'tubs', 'tray', 'trays',
  'roll', 'rolls', 'slice', 'slices', 'nest', 'nests', 'scoop', 'scoops',
  'clove', 'cloves', 'thumb', 'thumbs', 'squares', 'square', 'lemon', 'lemons',
  'onion', 'onions', 'apple', 'apples', 'pepper', 'peppers', 'potato', 'potatoes',
  'tomato', 'tomatoes',
];

const SINGULAR = {
  tins: 'tin', cans: 'can', packs: 'pack', bags: 'bag', boxes: 'box', bottles: 'bottle',
  jars: 'jar', cartons: 'carton', loaves: 'loaf', pieces: 'piece', eggs: 'egg', units: 'unit',
  portions: 'portion', bunches: 'bunch', heads: 'head', bars: 'bar', tubs: 'tub', trays: 'tray',
  rolls: 'roll', slices: 'slice', nests: 'nest', scoops: 'scoop', cloves: 'clove',
  lemons: 'lemon', onions: 'onion', apples: 'apple', peppers: 'pepper', potatoes: 'potato',
  tomatoes: 'tomato', thumbs: 'thumb',
};

const MASS_UNITS = { g: 1, kg: 1000, ml: 1, l: 1000 };
const MASS_LABEL = { g: 'g', kg: 'g', ml: 'ml', l: 'ml' };

/**
 * Everyday package sizes, in grams. A tin of tomatoes is 400 g — this is the
 * size they come in, not an estimate. Unlisted packages are left as counts.
 */
export const PACKAGE_GRAMS = {
  tin: 400, tins: 400, can: 400, cans: 400, // tinned veg / tomatoes
  carton: 200, // cream / passata
  jar: 300, // sauces, pesto
  pouch: 250, // grains
  tub: 400, // yogurt / spread
  bottle: 500, // oil, soy
  bag: 300, // salad, veg (very variable — used only when a mass is really needed)
  bar: 100,
  square: 50, // chocolate
  nest: 60, // dried noodles
  scoop: 30,
};

const parseNumber = (text) => {
  const m = /^(\d+(?:\.\d+)?)$/.exec(text);
  return m ? Number(m[1]) : null;
};

/**
 * One quantity → a comparable shape.
 * Returns { amount, unit: 'g'|'ml'|'count', countUnit?, raw } or null when
 * the text cannot be trusted on a scale.
 */
export const parseQtyAmount = (qty) => {
  const text = clean(qty);
  if (!text) return null;

  // "2 × 400g" / "3 x 200 g" — packed multi-buy
  const packed = text.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/);
  if (packed) {
    const count = Number(packed[1]);
    const amount = Number(packed[2]);
    const unit = packed[3];
    return {
      amount: Math.round(count * amount * (unit === 'kg' || unit === 'l' ? 1000 : 1) * 100) / 100,
      unit: MASS_LABEL[unit],
      raw: text,
      packed: { count, amount, unit },
    };
  }

  // "400 g" / "1.5 kg" / "200 ml" / "1 l"
  const mass = text.match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (mass) {
    const amount = Number(mass[1]);
    const unit = mass[2];
    return { amount: Math.round(amount * (unit === 'kg' || unit === 'l' ? 1000 : 1) * 100) / 100, unit: MASS_LABEL[unit], raw: text };
  }

  // "2 tins", "1 pack", "4 eggs" — countable, package-normalised when known
  const count = text.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (count && COUNT_UNITS.includes(count[2])) {
    const amount = Number(count[1]);
    const unit = count[2];
    const singular = SINGULAR[unit] || unit;
    const grams = PACKAGE_GRAMS[singular];
    if (grams) {
      return { amount: Math.round(amount * grams * 100) / 100, unit: 'g', raw: text, count: { amount, unit: singular, grams } };
    }
    return { amount, unit: 'count', countUnit: singular, raw: text };
  }

  // "½ lemon" — single unicode fraction
  const fraction = text.match(/^([½¼¾⅓⅔])\s*([a-z]+)$/);
  if (fraction && COUNT_UNITS.includes(fraction[2])) {
    const singular = SINGULAR[fraction[2]] || fraction[2];
    return { amount: FRACTIONS[fraction[1]], unit: 'count', countUnit: singular, raw: text };
  }

  // "1 ½ lemons" / "1½ lemons" — mixed integer + unicode fraction
  const mixedSpaced = text.match(/^(\d+(?:\.\d+)?)\s+([½¼¾⅓⅔])\s+([a-z]+)$/);
  if (mixedSpaced && COUNT_UNITS.includes(mixedSpaced[3])) {
    const singular = SINGULAR[mixedSpaced[3]] || mixedSpaced[3];
    return { amount: Number(mixedSpaced[1]) + FRACTIONS[mixedSpaced[2]], unit: 'count', countUnit: singular, raw: text };
  }
  const mixedAttached = text.match(/^(\d+)([½¼¾⅓⅔])\s+([a-z]+)$/);
  if (mixedAttached && COUNT_UNITS.includes(mixedAttached[3])) {
    const singular = SINGULAR[mixedAttached[3]] || mixedAttached[3];
    return { amount: Number(mixedAttached[1]) + FRACTIONS[mixedAttached[2]], unit: 'count', countUnit: singular, raw: text };
  }

  // "1" — a bare count
  const bare = parseNumber(text);
  if (bare !== null) return { amount: bare, unit: 'count', countUnit: 'unit', raw: text };

  return null;
};

/** Both quantities on the same scale, or null — mass (g) and volume (ml) never mix. */
const sameScale = (a, b) => {
  if (!a || !b) return null;
  if (a.unit === b.unit) return { unit: a.unit, amount: a.amount + b.amount };
  return null;
};

const formatGrams = (amount) => {
  const g = Math.round(amount * 100) / 100;
  if (g >= 1000 && Number.isInteger(g / 1000)) return `${g / 1000} kg`;
  if (g >= 1000) return `${Math.round((g / 1000) * 100) / 100} kg`;
  if (Number.isInteger(g)) return `${g} g`;
  return `${g} g`;
};

const formatMillilitres = (amount) => {
  const ml = Math.round(amount * 100) / 100;
  if (ml >= 1000 && Number.isInteger(ml / 1000)) return `${ml / 1000} l`;
  if (ml >= 1000) return `${Math.round((ml / 1000) * 100) / 100} l`;
  if (Number.isInteger(ml)) return `${ml} ml`;
  return `${ml} ml`;
};

/**
 * Merge two quantity strings ("600 g" + "400 g" → "1 kg"; "2 tins" + "1 pack"
 * of tomatoes → "1.2 kg"). Anything it can't put on the same scale is kept as
 * "a + b" rather than silently dropped.
 */
export const mergeQtys = (qtyA, qtyB) => {
  const a = clean(qtyA);
  const b = clean(qtyB);
  if (!a) return qtyB || '';
  if (!b) return qtyA || '';
  const pa = parseQtyAmount(a);
  const pb = parseQtyAmount(b);
  if (!pa || !pb) return `${a} + ${b}`;
  if (pa.unit === 'count' && pb.unit === 'count' && pa.countUnit === pb.countUnit) {
    return `${pa.amount + pb.amount} ${pa.countUnit}${pa.amount + pb.amount === 1 ? '' : 's'}`;
  }
  const scaled = sameScale(pa, pb);
  if (scaled) {
    if (scaled.unit === 'g') return formatGrams(scaled.amount);
    if (scaled.unit === 'ml') return formatMillilitres(scaled.amount);
    return `${scaled.amount} ${scaled.unit}`;
  }
  return `${a} + ${b}`;
};

/**
 * Does `have` cover `need`? Both must parse onto the same scale; otherwise the
 * answer is null ("can't tell") — never a confident guess.
 */
export const qtySuffices = (have, need) => {
  const h = parseQtyAmount(have);
  const n = parseQtyAmount(need);
  if (!h || !n) return null;
  if (h.unit === 'count' && n.unit === 'count') {
    if (h.countUnit !== n.countUnit) return null;
    return h.amount >= n.amount;
  }
  if (h.unit === n.unit && (h.unit === 'g' || h.unit === 'ml')) return h.amount >= n.amount;
  return null;
};

/** A short, honest label for what the app knows about a quantity. */
export const qtyConfidence = (qty) => {
  const parsed = parseQtyAmount(qty);
  if (!parsed) return 'unknown';
  return 'exact';
};
