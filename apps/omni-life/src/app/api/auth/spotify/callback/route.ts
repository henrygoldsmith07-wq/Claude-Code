import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/encryption';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/spotify/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Spotify OAuth error:', error);
    return NextResponse.redirect(new URL('/settings?error=spotify_oauth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=spotify_no_code', request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=session_required', request.url));
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Failed to exchange Spotify code for tokens:', errorData);
      return NextResponse.redirect(new URL('/settings?error=spotify_token_exchange_failed', request.url));
    }

    const tokens = await tokenResponse.json();

    await supabase.from('user_credentials').upsert({
      user_id: user.id,
      service_name: 'spotify',
      encrypted_token: encrypt(JSON.stringify(tokens)),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, service_name' });

    return NextResponse.redirect(new URL('/settings?success=spotify_connected', request.url));
  } catch (err) {
    console.error('Unhandled Spotify OAuth callback error:', err);
    return NextResponse.redirect(new URL('/settings?error=spotify_oauth_unhandled_error', request.url));
  }
}
