import { NextResponse } from 'next/server';
import { ApiError, handleApiError, rateLimit, requireUser } from '../../../../server/api.js';
import { retailerQuerySchema, retailerResultSchema } from '../../../../server/schemas.js';

export async function GET(request) {
  try {
    const user = await requireUser();
    await rateLimit(`retailers:${user.id}`, 120, 3600000);
    if (!process.env.RETAILER_API_BASE_URL || !process.env.RETAILER_API_KEY) {
      throw new ApiError(503, 'A licensed retailer data provider is not configured.');
    }
    const url = new URL(request.url);
    const input = retailerQuerySchema.parse({
      retailer: url.searchParams.get('retailer'),
      query: url.searchParams.get('query'),
    });
    const providerUrl = new URL('/v1/products/search', process.env.RETAILER_API_BASE_URL);
    providerUrl.searchParams.set('retailer', input.retailer);
    providerUrl.searchParams.set('query', input.query);
    const response = await fetch(providerUrl, {
      headers: { authorization: `Bearer ${process.env.RETAILER_API_KEY}`, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new ApiError(502, 'Retailer data is temporarily unavailable.');
    const products = retailerResultSchema.array().max(30).parse(await response.json());
    return NextResponse.json({ products, source: 'licensed-provider' });
  } catch (error) {
    return handleApiError(error);
  }
}
