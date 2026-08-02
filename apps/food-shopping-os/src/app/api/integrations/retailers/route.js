import { NextResponse } from 'next/server';
import { handleApiError, rateLimit, requireUser } from '../../../../server/api.js';
import { retailerQuerySchema } from '../../../../server/schemas.js';
import { searchRetailerProducts } from '../../../../server/retailer-providers.js';

export async function GET(request) {
  try {
    const user = await requireUser();
    await rateLimit(`retailers:${user.id}`, 120, 3600000);
    const url = new URL(request.url);
    const input = retailerQuerySchema.parse({
      retailer: url.searchParams.get('retailer'),
      query: url.searchParams.get('query'),
    });
    const products = await searchRetailerProducts(input);
    return NextResponse.json({
      products,
      source: products[0]?.source || 'licensed-provider',
      sourceLabel: products[0]?.sourceLabel || 'Licensed retailer provider',
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
