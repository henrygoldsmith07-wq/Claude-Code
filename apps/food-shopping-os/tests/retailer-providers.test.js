import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lookupOpenFoodFactsProduct,
  lookupOpenPrices,
  normaliseRetailerProduct,
  retailerProviderFor,
  retailerProviderStatus,
  searchRetailerProducts,
} from '../src/server/retailer-providers.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('retailer provider adapters', () => {
  it('normalises a provider product without inventing a price or stock state', () => {
    const result = normaliseRetailerProduct({
      sku: 'milk-1',
      productName: 'British semi-skimmed milk',
      brandName: 'Dairy Farm',
      gtin: '5012345678901',
      currentPrice: '£1.65',
      currency: 'GBP',
      pricePerUnit: 0.165,
      unitPriceUnit: 'litre',
      stock: 'in stock',
      promotion: 'Clubcard price',
      link: 'https://retailer.example/products/milk-1',
    }, { retailer: 'tesco', sourceLabel: 'Tesco partner feed' });

    expect(result).toMatchObject({
      retailer: 'tesco',
      name: 'British semi-skimmed milk',
      brand: 'Dairy Farm',
      barcode: '5012345678901',
      price: 1.65,
      unitPrice: 0.165,
      unit: 'litre',
      availability: 'available',
      offer: 'Clubcard price',
      source: 'licensed-provider',
      sourceLabel: 'Tesco partner feed',
    });
    expect(normaliseRetailerProduct({ name: 'Unlabelled price', price: 2 }, { retailer: 'tesco' })).toBeNull();
  });

  it('supports a configured per-retailer API key header', async () => {
    vi.stubEnv('RETAILER_API_CONFIG_JSON', JSON.stringify({
      tesco: {
        baseUrl: 'https://partner.example.test',
        path: '/search',
        apiKeyEnv: 'TESCO_API_KEY',
        auth: 'x-api-key',
        apiKeyHeader: 'x-retailer-key',
      },
    }));
    vi.stubEnv('TESCO_API_KEY', 'secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: [{ name: 'Milk', price: 1.5, currency: 'GBP', availability: 'available' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchRetailerProducts({ retailer: 'tesco', query: 'Milk' });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(1.5);
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/search?retailer=tesco&query=Milk');
    expect(fetchMock.mock.calls[0][1].headers['x-retailer-key']).toBe('secret');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it('reports which licensed retailers are configured without claiming open data is a retailer feed', () => {
    vi.stubEnv('RETAILER_API_BASE_URL', 'https://licensed.example.test');
    vi.stubEnv('RETAILER_API_KEY', 'secret');
    const status = retailerProviderStatus();
    expect(status.licensed).toBe(true);
    expect(status.configuredRetailers).toHaveLength(9);
    expect(status.openFoodFacts).toBe(true);
    expect(status.openPrices).toBe(true);
    expect(retailerProviderFor('tesco').label).toBe('Licensed retailer provider');
  });

  it('maps Open Food Facts product and nutrition fields through a bounded response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        product_name: 'Oat drink',
        brands: 'Example',
        quantity: '1 l',
        image_front_url: 'https://images.example/oat.jpg',
        ingredients_text: 'Water, oats',
        allergens: 'Oats',
        labels: 'Vegan',
        nutriscore_grade: 'b',
        ecoscore_grade: 'a',
        nutriments: {
          'energy-kcal_100g': 42,
          proteins_100g: 1.1,
          sugars_100g: 3.2,
        },
      },
    }), { status: 200 })));

    const result = await lookupOpenFoodFactsProduct('5012345678901');
    expect(result).toMatchObject({
      barcode: '5012345678901',
      name: 'Oat drink',
      brand: 'Example',
      quantity: '1 l',
      source: 'open-food-facts',
      nutrition: { kcal: 42, protein: 1.1, sugar: 3.2 },
    });
  });

  it('treats an Open Food Facts 404 as an unknown barcode, not a provider outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(lookupOpenFoodFactsProduct('5012345678901')).resolves.toBeNull();
  });

  it('keeps only GBP Open Prices observations and preserves location context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [
        {
          id: 1,
          product_code: '5012345678901',
          product_name: 'Oat drink',
          price: 1.75,
          currency: 'GBP',
          price_is_discounted: true,
          date: '2026-07-30',
          product: { code: '5012345678901', product_name: 'Oat drink', brands: 'Example' },
          location: { osm_brand: 'Tesco', osm_display_name: 'Tesco, London' },
        },
        { product_code: '5012345678901', product_name: 'Oat drink', price: 2, currency: 'USD' },
      ],
    }), { status: 200 })));

    const result = await lookupOpenPrices({ barcode: '5012345678901' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      price: 1.75,
      currency: 'GBP',
      store: 'Tesco',
      location: 'Tesco, London',
      observedAt: '2026-07-30',
      offer: 'Observed discounted price',
      sourceLabel: 'Open Prices (community observed)',
    });
  });
});
