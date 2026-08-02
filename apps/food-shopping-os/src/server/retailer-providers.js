import { ApiError } from './api.js';
import {
  observedPriceSchema,
  priceLookupSchema,
  productDataSchema,
  retailerResultSchema,
} from './schemas.js';

export const SUPPORTED_RETAILERS = Object.freeze([
  'tesco', 'sainsburys', 'asda', 'aldi', 'lidl', 'morrisons',
  'waitrose', 'ocado', 'amazon-fresh',
]);

const DEFAULT_OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org';
const DEFAULT_OPEN_PRICES_URL = 'https://prices.openfoodfacts.org';
const DEFAULT_USER_AGENT = 'Forq/1.0 (+https://github.com/henrygoldsmith07-wq/Claude-Code)';
const REQUEST_TIMEOUT_MS = 8000;

const numeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.-]+/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value, max = 4000) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
};

const barcode = (value) => {
  const cleaned = String(value || '').replace(/\D/g, '');
  return /^\d{8,14}$/.test(cleaned) ? cleaned : null;
};

const url = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const baseUrl = (value) => {
  const parsed = url(value);
  if (!parsed) return null;
  const protocol = new URL(parsed).protocol;
  if (process.env.NODE_ENV === 'production' && protocol !== 'https:') return null;
  return new URL(parsed);
};

const checkedAt = () => new Date().toISOString();

const configuredMap = () => {
  if (!process.env.RETAILER_API_CONFIG_JSON) return {};
  try {
    const parsed = JSON.parse(process.env.RETAILER_API_CONFIG_JSON);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const providerFromConfig = (retailer) => {
  const entry = configuredMap()[retailer];
  if (!entry || typeof entry !== 'object') return null;
  const base = baseUrl(entry.baseUrl);
  if (!base) return null;
  const keyEnv = typeof entry.apiKeyEnv === 'string' && /^[A-Z0-9_]+$/.test(entry.apiKeyEnv)
    ? entry.apiKeyEnv
    : null;
  const auth = ['bearer', 'x-api-key', 'none'].includes(entry.auth) ? entry.auth : 'bearer';
  const apiKey = keyEnv ? process.env[keyEnv] : '';
  if (auth !== 'none' && !apiKey) return null;
  return {
    base,
    path: typeof entry.path === 'string' && /^\/(?!\/)/.test(entry.path) ? entry.path : '/v1/products/search',
    apiKey,
    auth,
    apiKeyHeader: typeof entry.apiKeyHeader === 'string' && /^[A-Za-z0-9-]+$/.test(entry.apiKeyHeader)
      ? entry.apiKeyHeader
      : 'x-api-key',
    retailerParam: typeof entry.retailerParam === 'string' ? entry.retailerParam.slice(0, 40) : 'retailer',
    queryParam: typeof entry.queryParam === 'string' ? entry.queryParam.slice(0, 40) : 'query',
    label: typeof entry.label === 'string' ? entry.label.slice(0, 120) : 'Licensed retailer provider',
  };
};

export const retailerProviderFor = (retailer) => providerFromConfig(retailer) || (() => {
  const base = baseUrl(process.env.RETAILER_API_BASE_URL);
  if (!base || !process.env.RETAILER_API_KEY) return null;
  return {
    base,
    path: '/v1/products/search',
    apiKey: process.env.RETAILER_API_KEY,
    auth: 'bearer',
    apiKeyHeader: 'x-api-key',
    retailerParam: 'retailer',
    queryParam: 'query',
    label: 'Licensed retailer provider',
  };
})();

export const retailerProviderStatus = () => {
  const configuredRetailers = SUPPORTED_RETAILERS.filter((retailer) => retailerProviderFor(retailer));
  const openFoodFacts = process.env.OPEN_FOOD_FACTS_ENABLED !== 'false';
  const openPrices = process.env.OPEN_PRICES_ENABLED !== 'false';
  return {
    licensed: configuredRetailers.length > 0,
    configuredRetailers,
    openFoodFacts,
    openPrices,
  };
};

const providerHeaders = (provider) => {
  const headers = { accept: 'application/json' };
  if (provider.auth === 'bearer') headers.authorization = `Bearer ${provider.apiKey}`;
  if (provider.auth === 'x-api-key') headers[provider.apiKeyHeader] = provider.apiKey;
  return headers;
};

const getJson = async (endpoint, options = {}, failureMessage = 'Provider data is temporarily unavailable.', { allowNotFound = false } = {}) => {
  let response;
  try {
    response = await fetch(endpoint, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, failureMessage);
  }
  if (response.status === 404 && allowNotFound) return null;
  if (!response.ok) throw new ApiError(502, failureMessage);
  try {
    return await response.json();
  } catch {
    throw new ApiError(502, failureMessage);
  }
};

const rowsFrom = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === 'object') return rowsFrom(payload.data);
  return [];
};

export const normaliseRetailerProduct = (raw, { retailer, source = 'licensed-provider', sourceLabel = 'Licensed retailer provider' } = {}) => {
  const value = raw && typeof raw === 'object' ? raw : {};
  const availability = String(value.availability ?? value.stock ?? value.status ?? 'unknown').toLowerCase();
  const normalisedAvailability = ['available', 'in stock', 'instock', 'yes', 'true'].includes(availability)
    ? 'available'
    : ['unavailable', 'out of stock', 'outofstock', 'no', 'false'].includes(availability)
      ? 'unavailable'
      : 'unknown';
  const productPrice = numeric(value.price ?? value.currentPrice ?? value.salePrice);
  const productCurrency = text(value.currency, 3)?.toUpperCase()
    || (productPrice === null ? undefined : '');
  const candidate = {
    id: text(value.id ?? value.productId ?? value.sku, 200) || undefined,
    name: text(value.name ?? value.productName ?? value.title, 200) || 'Unnamed product',
    brand: text(value.brand ?? value.brandName, 200),
    barcode: barcode(value.barcode ?? value.gtin ?? value.ean),
    price: productPrice,
    currency: productCurrency,
    unitPrice: numeric(value.unitPrice ?? value.pricePerUnit ?? value.price_per_100g),
    unit: text(value.unit ?? value.priceUnit ?? value.unitPriceUnit, 40)
      || (value.price_per_100g !== undefined ? '100g' : null),
    offer: text(value.offer ?? value.offerText ?? value.promotion, 300),
    availability: normalisedAvailability,
    deliveryUrl: url(value.deliveryUrl ?? value.delivery_url),
    productUrl: url(value.productUrl ?? value.url ?? value.link),
    imageUrl: url(value.imageUrl ?? value.image ?? value.thumbnail),
    source,
    sourceLabel,
    checkedAt: checkedAt(),
  };
  const product = retailerResultSchema.safeParse(candidate);
  return product.success ? { ...product.data, retailer } : null;
};

export const searchRetailerProducts = async ({ retailer, query }) => {
  const provider = retailerProviderFor(retailer);
  if (!provider) throw new ApiError(503, 'No licensed provider is configured for this retailer.');
  const endpoint = new URL(provider.path, provider.base);
  if (endpoint.origin !== provider.base.origin) throw new ApiError(503, 'The configured retailer provider path is invalid.');
  endpoint.searchParams.set(provider.retailerParam, retailer);
  endpoint.searchParams.set(provider.queryParam, query);
  const payload = await getJson(endpoint, { headers: providerHeaders(provider) }, 'Retailer data is temporarily unavailable.');
  return rowsFrom(payload)
    .slice(0, 30)
    .map((row) => normaliseRetailerProduct(row, { retailer, sourceLabel: provider.label }))
    .filter(Boolean);
};

const openFoodFactsBase = () => baseUrl(process.env.OPEN_FOOD_FACTS_API_BASE_URL || DEFAULT_OPEN_FOOD_FACTS_URL);
const openPricesBase = () => baseUrl(process.env.OPEN_PRICES_API_BASE_URL || DEFAULT_OPEN_PRICES_URL);
const openFoodFactsImage = (value) => {
  const parsed = url(value);
  const base = openFoodFactsBase();
  if (!parsed || !base) return null;
  const hostname = new URL(parsed).hostname.toLowerCase();
  const baseHostname = new URL(base).hostname.toLowerCase();
  const trusted = hostname === baseHostname
    || hostname.endsWith(`.${baseHostname}`)
    || hostname === 'openfoodfacts.org'
    || hostname.endsWith('.openfoodfacts.org');
  return trusted ? parsed : null;
};
const openDataHeaders = () => ({
  accept: 'application/json',
  'user-agent': process.env.OPEN_FOOD_FACTS_USER_AGENT || DEFAULT_USER_AGENT,
});

export const lookupOpenFoodFactsProduct = async (value) => {
  const code = barcode(value);
  if (!code || process.env.OPEN_FOOD_FACTS_ENABLED === 'false') return null;
  const base = openFoodFactsBase();
  if (!base) throw new ApiError(503, 'Open Food Facts is not configured.');
  const endpoint = new URL(`/api/v3/product/${code}`, base);
  endpoint.searchParams.set('product_type', 'food');
  endpoint.searchParams.set('lc', 'en');
  endpoint.searchParams.set('cc', 'gb');
  endpoint.searchParams.set('fields', [
    'code', 'product_name', 'generic_name', 'brands', 'quantity', 'product_quantity',
    'product_quantity_unit', 'image_front_url', 'image_front_small_url', 'ingredients_text',
    'allergens', 'labels', 'nutriscore_grade', 'ecoscore_grade', 'nutriments',
  ].join(','));
  const payload = await getJson(endpoint, { headers: openDataHeaders() }, 'Open Food Facts is temporarily unavailable.', { allowNotFound: true });
  if (payload?.status === 0 || !payload?.product) return null;
  const product = payload.product;
  const nutrients = {
    kcal: numeric(product.nutriments?.['energy-kcal_100g']),
    protein: numeric(product.nutriments?.proteins_100g),
    carbohydrate: numeric(product.nutriments?.carbohydrates_100g),
    fat: numeric(product.nutriments?.fat_100g),
    fibre: numeric(product.nutriments?.fiber_100g),
    sugar: numeric(product.nutriments?.sugars_100g),
    salt: numeric(product.nutriments?.salt_100g),
  };
  const nutrition = Object.fromEntries(Object.entries(nutrients).filter(([, item]) => item !== null));
  return productDataSchema.parse({
    barcode: code,
    name: text(product.product_name ?? product.generic_name, 200) || `Barcode ${code}`,
    brand: text(product.brands, 200),
    quantity: text(product.quantity || [product.product_quantity, product.product_quantity_unit].filter(Boolean).join(' '), 120),
    imageUrl: openFoodFactsImage(product.image_front_url || product.image_front_small_url),
    ingredients: text(product.ingredients_text, 4000),
    allergens: text(product.allergens, 1000),
    labels: text(product.labels, 1000),
    nutriScore: text(product.nutriscore_grade, 20),
    ecoScore: text(product.ecoscore_grade, 20),
    nutrition: Object.keys(nutrition).length ? nutrition : undefined,
    source: 'open-food-facts',
    sourceLabel: 'Open Food Facts',
    checkedAt: checkedAt(),
  });
};

const normaliseObservedPrice = (raw) => {
  const value = raw && typeof raw === 'object' ? raw : {};
  const product = value.product && typeof value.product === 'object' ? value.product : {};
  const location = value.location && typeof value.location === 'object' ? value.location : {};
  const amount = numeric(value.price);
  const currency = text(value.currency, 3)?.toUpperCase();
  if (amount === null || amount < 0 || currency !== 'GBP') return null;
  const store = text(location.osm_brand || location.osm_name || value.store || value.location_name, 200);
  const locationText = text(location.osm_display_name || location.osm_address_city || location.osm_address_country, 300);
  return observedPriceSchema.parse({
    id: value.id === undefined ? undefined : String(value.id),
    barcode: barcode(value.product_code || product.code),
    name: text(value.product_name || product.product_name || value.product_code, 200) || 'Unknown product',
    brand: text(product.brands, 200),
    price: amount,
    currency,
    offer: value.price_is_discounted ? 'Observed discounted price' : null,
    store,
    location: locationText,
    observedAt: text(value.date, 40),
    source: 'open-prices',
    sourceLabel: 'Open Prices (community observed)',
    checkedAt: checkedAt(),
  });
};

export const lookupOpenPrices = async (input) => {
  const parsed = priceLookupSchema.parse(input);
  if (process.env.OPEN_PRICES_ENABLED === 'false') return [];
  const base = openPricesBase();
  if (!base) throw new ApiError(503, 'Open Prices is not configured.');
  const endpoint = new URL('/api/v1/prices', base);
  endpoint.searchParams.set('size', '30');
  endpoint.searchParams.set('currency', 'GBP');
  if (parsed.barcode) endpoint.searchParams.set('product_code', parsed.barcode);
  if (!parsed.barcode && parsed.query) endpoint.searchParams.set('product_name', parsed.query);
  const payload = await getJson(endpoint, { headers: openDataHeaders() }, 'Open Prices is temporarily unavailable.');
  return rowsFrom(payload).slice(0, 30).map(normaliseObservedPrice).filter(Boolean);
};

export const lookupProductWithPrices = async (value) => {
  const code = barcode(value);
  const product = await lookupOpenFoodFactsProduct(code);
  if (!product) return { product: null, prices: [], priceStatus: 'not-requested' };
  let prices = [];
  let priceStatus = 'available';
  try {
    prices = await lookupOpenPrices({ barcode: code });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    priceStatus = 'unavailable';
  }
  return { product, prices, priceStatus };
};
