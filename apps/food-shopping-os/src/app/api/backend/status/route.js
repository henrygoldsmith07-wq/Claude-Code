import { NextResponse } from 'next/server';
import { getSession } from '../../../../server/auth.js';
import { databaseConfigured } from '../../../../server/database.js';

export async function GET() {
  const enabled = Boolean(databaseConfigured && process.env.AUTH_SECRET);
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      authenticated: false,
      user: null,
      providers: {},
      capabilities: {},
    });
  }
  const session = await getSession();
  return NextResponse.json({
    enabled,
    authenticated: Boolean(session?.user),
    user: session?.user ? { name: session.user.name, email: session.user.email } : null,
    providers: {
      google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      apple: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
      microsoft: Boolean(process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET),
    },
    capabilities: {
      ai: Boolean(process.env.OPENAI_API_KEY),
      uploads: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      realtime: Boolean(process.env.ABLY_API_KEY),
      calendar: Boolean(process.env.AUTH_GOOGLE_ID || process.env.AUTH_MICROSOFT_ID),
    },
  });
}
