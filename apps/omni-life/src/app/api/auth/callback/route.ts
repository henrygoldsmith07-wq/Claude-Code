import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthClient } from '@/lib/services/google-workspace';
import { encrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Can be used to identify service or user
  
  // Determine if this is a Supabase auth callback or a service (Google) callback
  // Usually, service callbacks are initiated from a logged-in session.
  
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If there's no logged-in user, it's likely a Supabase login callback
  if (!user) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  }

  // If there is a user, handle service token exchange
  const url = new URL(request.url);
  const isGoogle = url.searchParams.has('scope') && url.searchParams.get('scope')?.includes('google');
  
  try {
    if (isGoogle) {
      const oauth2Client = getGoogleAuthClient();
      const { tokens } = await oauth2Client.getToken(code);
      
      await supabase.from('user_credentials').upsert({
        user_id: user.id,
        service_name: 'google',
        encrypted_token: encrypt(JSON.stringify(tokens)),
        scopes: tokens.scope?.split(' '),
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString()
      });
    } else {
      // If it's not Google, and not Supabase auth, then it's an unhandled callback.
      console.warn('Unhandled OAuth callback received:', state);
      return NextResponse.redirect(new URL('/settings?error=unhandled_oauth', request.url));
    }

    return NextResponse.redirect(new URL('/settings?success=connected', request.url));
  } catch (error) {
    console.error('Service connection error:', error);
    return NextResponse.redirect(new URL('/settings?error=connection_failed', request.url));
  }
}
